import { access } from "node:fs/promises";
import path from "node:path";
import nodePlop from "node-plop";
import packageJson from "../package.json" with { type: "json" };
import { getBaseTemplateDir, getFramework } from "./frameworks";
import { detectPackageManager, getDevCommand } from "./install";
import type { ResolvedCreateConfig } from "./schema";
import { buildServerTemplateData } from "./server-template";

const betterAgentVersion = packageJson.version;

const providerPackageNames: Record<ResolvedCreateConfig["providers"][number], string> = {
    openai: "@better-agent/openai",
    anthropic: "@better-agent/anthropic",
    gemini: "@better-agent/gemini",
    xai: "@better-agent/xai",
    ollama: "@better-agent/ollama",
    openrouter: "@better-agent/openrouter",
    "workers-ai": "@better-agent/workers-ai",
};

const buildBetterAgentDependencyEntries = (
    providers: ResolvedCreateConfig["providers"],
    plugins: ResolvedCreateConfig["plugins"],
) => {
    const dependencyNames = [
        "@better-agent/client",
        "@better-agent/core",
        ...new Set(providers.map((provider) => providerPackageNames[provider])),
        ...(plugins.length > 0 ? ["@better-agent/plugins"] : []),
    ];

    return dependencyNames
        .map((dependencyName) => `    "${dependencyName}": "${betterAgentVersion}"`)
        .join(",\n");
};

const ensureTargetDirDoesNotExist = async (targetDir: string) => {
    try {
        await access(targetDir);
    } catch (error) {
        const nodeError = error as NodeJS.ErrnoException;

        if (nodeError.code === "ENOENT") {
            return;
        }

        throw error;
    }

    throw new Error(`Target directory already exists: ${targetDir}`);
};

export const runPlopGenerate = async (config: ResolvedCreateConfig) => {
    await ensureTargetDirDoesNotExist(config.targetDir);

    const plop = await nodePlop();
    const baseRoot = getBaseTemplateDir(config.framework);
    const framework = getFramework(config.framework);
    const packageManager = detectPackageManager();
    const serverTemplateData = buildServerTemplateData(
        config.framework,
        config.providers,
        config.plugins,
    );
    const commonTemplateData = {
        appName: config.name,
        betterAgentVersion,
        betterAgentDependencyEntries: buildBetterAgentDependencyEntries(
            config.providers,
            config.plugins,
        ),
        frameworkTitle: framework.label,
        packageManager,
        primaryAgentName: config.providers[0],
        devCommand: getDevCommand(packageManager),
        ...serverTemplateData,
    };

    plop.setGenerator("create-app", {
        actions: [
            {
                type: "addMany",
                destination: config.targetDir,
                base: path.join(baseRoot, "static"),
                templateFiles: path.join(baseRoot, "static", "**/*"),
                globOptions: { dot: true },
            },
            ...framework.dynamicFiles.map((file) => ({
                type: "add" as const,
                path: path.join(config.targetDir, file.output),
                templateFile: path.join(baseRoot, file.template),
                data: commonTemplateData,
            })),
        ],
    });

    const generator = plop.getGenerator("create-app");
    const result = await generator.runActions({});

    if (result.failures.length > 0) {
        throw new Error(result.failures.map((failure) => String(failure.error)).join("\n"));
    }
};
