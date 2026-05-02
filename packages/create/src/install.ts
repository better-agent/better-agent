import { createRequire } from "node:module";
import { x } from "tinyexec";
import type { PackageManager } from "./types";

const require = createRequire(import.meta.url);
const prettierBinPath = require.resolve("prettier/bin/prettier.cjs");

export const getDevCommand = (packageManager: PackageManager) => {
    return packageManager === "npm" ? "npm run dev" : `${packageManager} dev`;
};

const installCommands: Record<PackageManager, { command: string; args: string[] }> = {
    bun: { command: "bun", args: ["install"] },
    pnpm: { command: "pnpm", args: ["install"] },
    yarn: { command: "yarn", args: ["install"] },
    npm: { command: "npm", args: ["install"] },
};

export const detectPackageManager = (): PackageManager => {
    const userAgent = process.env.npm_config_user_agent ?? "";

    if (userAgent.startsWith("bun/")) {
        return "bun";
    }

    if (userAgent.startsWith("pnpm/")) {
        return "pnpm";
    }

    if (userAgent.startsWith("yarn/")) {
        return "yarn";
    }

    if (userAgent.startsWith("npm/")) {
        return "npm";
    }

    return "npm";
};

export const installDependencies = async (targetDir: string, packageManager: PackageManager) => {
    const install = installCommands[packageManager];

    const result = await x(install.command, install.args, {
        throwOnError: false,
        nodeOptions: {
            cwd: targetDir,
        },
    });

    if (result.exitCode !== 0) {
        const message =
            result.stderr.trim() || result.stdout.trim() || "Dependency installation failed.";
        throw new Error(message);
    }
};

export const formatGeneratedApp = async (targetDir: string) => {
    const result = await x(process.execPath, [prettierBinPath, ".", "--write"], {
        throwOnError: false,
        nodeOptions: {
            cwd: targetDir,
        },
    });

    if (result.exitCode !== 0) {
        const message =
            result.stderr.trim() || result.stdout.trim() || "Formatting generated files failed.";
        throw new Error(message);
    }
};
