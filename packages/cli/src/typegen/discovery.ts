import { existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { BetterAgentError } from "@better-agent/shared/errors";
import { createJiti } from "jiti";
import type { DiscoveredApp, TypegenAppExport } from "./types";

const isRecord = (value: unknown): value is Record<PropertyKey, unknown> =>
    value !== null && typeof value === "object";

const isTypegenAppExport = (value: unknown): value is TypegenAppExport => {
    if (!isRecord(value)) return false;
    if (!isRecord(value.config)) return false;
    return (
        typeof value.run === "function" &&
        typeof value.stream === "function" &&
        typeof value.handler === "function"
    );
};

export const resolveConfigPaths = (config: string[] | undefined, cwd: string) =>
    (config ?? []).map((configPath) =>
        path.isAbsolute(configPath) ? configPath : path.resolve(cwd, configPath),
    );

export const existingConfigPaths = (configPaths: string[]) =>
    configPaths.filter((configPath) => existsSync(configPath));

const withMutedConsole = async <T>(work: () => Promise<T>): Promise<T> => {
    const original = { log: console.log, info: console.info, warn: console.warn };
    console.log = () => {};
    console.info = () => {};
    console.warn = () => {};
    try {
        return await work();
    } finally {
        console.log = original.log;
        console.info = original.info;
        console.warn = original.warn;
    }
};

export const collectDiscoveredApps = async (
    configPaths: string[],
    cwd: string,
    onImportError: (error: BetterAgentError) => void,
): Promise<DiscoveredApp[]> => {
    const jiti = createJiti(import.meta.url, { extensions: [".ts", ".js"] });
    const candidates: DiscoveredApp[] = [];
    let importErrors = 0;

    const collectExportedApp = (app: unknown, configFile: string, exportName: string) => {
        if (!isTypegenAppExport(app)) return false;
        candidates.push({
            app,
            configFile,
            exportPath: exportName.split("."),
            label: `${path.relative(cwd, configFile)}:${exportName}`,
        });
        return true;
    };

    const exportedEntries = (mod: Record<string, unknown>) =>
        Object.entries(mod).flatMap(([exportName, value]) => {
            if (exportName !== "default" || !isRecord(value)) {
                return [[exportName, value] as const];
            }

            return [
                [exportName, value] as const,
                ...Object.entries(value).map(
                    ([nestedName, nestedValue]) => [`default.${nestedName}`, nestedValue] as const,
                ),
            ];
        });

    for (const configPath of configPaths) {
        const configFile = path.isAbsolute(configPath) ? configPath : path.resolve(cwd, configPath);
        let mod: unknown;
        try {
            mod = await withMutedConsole(() => jiti.import(pathToFileURL(configFile).href));
        } catch (error) {
            onImportError(
                BetterAgentError.wrap({
                    err: error,
                    message: `Failed to load config: ${path.relative(cwd, configFile)}`,
                    opts: {
                        code: "INTERNAL",
                        context: {
                            command: "generate type",
                            configPath: path.relative(cwd, configFile),
                        },
                        trace: [{ at: "cli.typegen.discovery.collectDiscoveredApps.loadConfig" }],
                        stackFrom: collectDiscoveredApps,
                    },
                }),
            );
            importErrors += 1;
            continue;
        }

        if (!isRecord(mod)) continue;
        for (const [exportName, value] of exportedEntries(mod)) {
            collectExportedApp(value, configFile, exportName);
        }
    }

    if (candidates.length > 0) return candidates;

    throw BetterAgentError.fromCode(
        "NOT_FOUND",
        "No Better Agent app exports found in the provided config(s).",
        {
            context: {
                command: "generate type",
                configCount: configPaths.length,
                importErrors,
            },
            trace: [{ at: "cli.typegen.discovery.collectDiscoveredApps.findApps" }],
            stackFrom: collectDiscoveredApps,
        },
    );
};
