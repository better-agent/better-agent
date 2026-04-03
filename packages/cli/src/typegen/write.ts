import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { createInterface } from "node:readline/promises";
import chalk from "chalk";

const isTestRuntime = () =>
    process.env.NODE_ENV === "test" ||
    process.env.BUN_TEST === "1" ||
    process.env.VITEST === "true" ||
    process.env.JEST_WORKER_ID !== undefined;

export const createTypegenLogger = () => ({
    info(message: string) {
        if (isTestRuntime()) return;
        console.log(message);
    },
});

const confirmOverwrite = async (message: string) => {
    if (!process.stdin.isTTY || !process.stdout.isTTY) {
        return false;
    }

    const rl = createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    try {
        const answer = await rl.question(`${message} (y/N) `);
        const normalized = answer.trim().toLowerCase();
        return normalized === "y" || normalized === "yes";
    } finally {
        rl.close();
    }
};

export const writeGeneratedTypes = async (params: {
    body: string;
    cwd: string;
    outputPath: string;
    yes: boolean;
    logger: ReturnType<typeof createTypegenLogger>;
}) => {
    const exists = existsSync(params.outputPath);
    const current = exists ? await fs.readFile(params.outputPath, "utf-8") : "";

    if (current.trim() === params.body.trim()) {
        params.logger.info(
            chalk.dim(`Types already up to date: ${path.relative(params.cwd, params.outputPath)}`),
        );
        return 0;
    }

    if (exists && !params.yes) {
        const confirmed = await confirmOverwrite(
            `Overwrite ${path.relative(params.cwd, params.outputPath)}?`,
        );
        if (!confirmed) {
            params.logger.info(chalk.dim("Type generation aborted."));
            return 0;
        }
    }

    await fs.mkdir(path.dirname(params.outputPath), { recursive: true });
    await fs.writeFile(params.outputPath, params.body);
    params.logger.info(
        chalk.green(`Types generated: ${path.relative(params.cwd, params.outputPath)}`),
    );
    return 0;
};
