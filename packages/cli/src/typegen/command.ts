import path from "node:path";
import { BetterAgentError } from "@better-agent/shared/errors";
import chalk from "chalk";
import { collectDiscoveredApps, existingConfigPaths, resolveConfigPaths } from "./discovery";
import { normalizeDiscoveredApp } from "./normalize";
import { TypegenRenderError, renderTypegenOutput, toTypeIdentifier } from "./render";
import { selectDiscoveredApps } from "./selection";
import type { GenerateTypeOptions } from "./types";
import { createTypegenLogger, writeGeneratedTypes } from "./write";

const COMMAND = "generate type";
const DEFAULT_OUTPUT = "better-agent.types.d.ts";
const DEFAULT_TYPE_NAME = "BAClientApp";

const writeError = (message: string) => process.stderr.write(`${message}\n`);

const writeBetterAgentError = (error: BetterAgentError) => {
    writeError(chalk.red(`[${error.code}] ${error.message}`));
    if (process.env.BA_DEBUG === "1") {
        writeError(chalk.dim(JSON.stringify(error.toDebugJSON(), null, 2)));
    }
};

const resolveTypegenRequest = (opts: GenerateTypeOptions) => {
    const cwd = opts.cwd ? path.resolve(opts.cwd) : process.cwd();
    const configPaths = resolveConfigPaths(opts.config, cwd);

    // Validate the CLI input before loading any config files.
    if (configPaths.length === 0) {
        throw BetterAgentError.fromCode("BAD_REQUEST", "No config paths provided.", {
            context: { command: COMMAND },
            trace: [{ at: "cli.typegen.command.generateTypes.validateInput" }],
            stackFrom: generateTypes,
        });
    }

    const existingPaths = existingConfigPaths(configPaths);
    if (existingPaths.length === 0) {
        throw BetterAgentError.fromCode("NOT_FOUND", "None of the provided config paths exist.", {
            context: {
                command: COMMAND,
                configPaths: configPaths.map((configPath) => path.relative(cwd, configPath)),
            },
            trace: [{ at: "cli.typegen.command.generateTypes.validatePaths" }],
            stackFrom: generateTypes,
        });
    }

    return {
        cwd,
        existingPaths,
        outputPath: path.resolve(cwd, opts.out ?? DEFAULT_OUTPUT),
        typeName: toTypeIdentifier(opts.name ?? DEFAULT_TYPE_NAME),
        yes: opts.yes ?? false,
    };
};

export const generateTypes = async (opts: GenerateTypeOptions): Promise<number> => {
    const logger = createTypegenLogger();

    try {
        const request = resolveTypegenRequest(opts);

        // Discover app exports, narrow them to the selected apps, then render and write the output.
        const discoveredApps = await collectDiscoveredApps(
            request.existingPaths,
            request.cwd,
            writeBetterAgentError,
        );
        const selectedApps = await selectDiscoveredApps(discoveredApps, request.yes);
        if (selectedApps.length === 0) {
            logger.info(chalk.dim("No app exports selected. Type generation aborted."));
            return 0;
        }

        const normalizedApps = selectedApps.map(normalizeDiscoveredApp);
        const body = renderTypegenOutput(normalizedApps, request.typeName);
        return await writeGeneratedTypes({
            body,
            cwd: request.cwd,
            outputPath: request.outputPath,
            yes: request.yes,
            logger,
        });
    } catch (error) {
        const wrapped =
            error instanceof BetterAgentError
                ? error
                : error instanceof TypegenRenderError
                  ? BetterAgentError.fromCode("VALIDATION_FAILED", error.message, {
                        context: { command: COMMAND, path: error.path },
                        trace: [{ at: "cli.typegen.command.generateTypes.renderPortableType" }],
                        stackFrom: generateTypes,
                    })
                  : BetterAgentError.wrap({
                        err: error,
                        message: "Type generate command failed",
                        opts: {
                            code: "INTERNAL",
                            context: { command: COMMAND },
                            trace: [{ at: "cli.typegen.command.generateTypes" }],
                            stackFrom: generateTypes,
                        },
                    });

        writeBetterAgentError(wrapped);
        if (wrapped.code === "BAD_REQUEST") {
            writeError(chalk.dim("Example: better-agent generate type --config ./better-agent.ts"));
        }
        return 1;
    }
};
