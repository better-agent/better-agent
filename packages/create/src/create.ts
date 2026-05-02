import { existsSync } from "node:fs";
import path from "node:path";
import {
    cancel,
    confirm,
    isCancel,
    multiselect,
    outro,
    select,
    spinner,
    text,
} from "@clack/prompts";
import packageJson from "../package.json" with { type: "json" };
import { type Framework, frameworkEntries } from "./frameworks";
import {
    detectPackageManager,
    formatGeneratedApp,
    getDevCommand,
    installDependencies,
} from "./install";
import { runPlopGenerate } from "./plop";
import { type Plugin, type Provider, appNameSchema, resolveCreateConfig } from "./schema";
import { providerEntries } from "./server-template";
import type { CreateConfig } from "./types";
import { renderHeader, renderSummary } from "./ui";

export const runCreate = async (config: CreateConfig) => {
    renderHeader({
        version: packageJson.version,
        mode: "create",
        directory: process.cwd(),
    });
    const isInteractive = Boolean(process.stdin.isTTY && process.stdout.isTTY);

    let name = config.name?.trim();
    const hasExplicitName = Boolean(name);
    let nameError: string | undefined;

    while (true) {
        if (!name) {
            if (!isInteractive) {
                throw new Error("App name is required in non-interactive mode.");
            }

            const result = await text({
                message: nameError ?? "Enter the name of your app",
                validate: (value) => {
                    const parsed = appNameSchema.safeParse(value);
                    if (!parsed.success) {
                        return parsed.error.issues[0]?.message;
                    }

                    const nextTargetDir = path.resolve(process.cwd(), parsed.data);
                    return existsSync(nextTargetDir)
                        ? `Target directory already exists: ${nextTargetDir}`
                        : undefined;
                },
            });
            if (isCancel(result)) {
                cancel("Cancelled");
                process.exit(0);
            }

            name = result.trim();
            nameError = undefined;
        }

        if (!name) {
            cancel("Name is required");
            process.exit(1);
        }

        const parsedName = appNameSchema.safeParse(name);
        if (!parsedName.success) {
            throw new Error(parsedName.error.issues[0]?.message ?? "Invalid app name.");
        }

        name = parsedName.data;

        const targetDir = path.resolve(process.cwd(), name);
        if (!existsSync(targetDir)) {
            break;
        }

        if (!isInteractive || hasExplicitName) {
            throw new Error(`Target directory already exists: ${targetDir}`);
        }

        nameError = `Target directory already exists: ${targetDir}`;
        name = undefined;
    }

    let framework = config.framework;
    let providers = config.providers;
    let plugins = config.plugins;

    if (!framework) {
        if (!isInteractive) {
            throw new Error("Framework is required in non-interactive mode.");
        }

        const result = await select<Framework>({
            message: "Select a framework",
            options: frameworkEntries.map(([value, framework]) => ({
                value,
                label: framework.label,
            })),
        });
        if (isCancel(result)) {
            cancel("Cancelled");
            process.exit(0);
        }
        framework = result;
    }

    if (!providers || providers.length === 0) {
        if (!isInteractive) {
            throw new Error("At least one provider is required in non-interactive mode.");
        }

        const result = await multiselect<Provider>({
            message: "Select providers",
            options: providerEntries.map(([value, provider]) => ({
                value,
                label: provider.label,
            })),
        });
        if (isCancel(result)) {
            cancel("Cancelled");
            process.exit(0);
        }
        providers = result;
    }

    const shouldPromptForPlugins =
        config.plugins !== undefined
            ? false
            : !(config.name && config.framework && config.providers && config.providers.length > 0);

    if (!plugins) {
        if (!isInteractive) {
            plugins = [];
        } else if (!shouldPromptForPlugins) {
            plugins = [];
        } else {
            const result = await multiselect<Plugin>({
                message: "Select plugins (optional)",
                options: [
                    { value: "ip-allowlist", label: "IP Allowlist" },
                    { value: "logging", label: "Logging" },
                    { value: "rate-limit", label: "Rate Limit" },
                    { value: "sandbox", label: "Sandbox (E2B example)" },
                ],
                required: false,
            });

            if (isCancel(result)) {
                cancel("Cancelled");
                process.exit(0);
            }

            plugins = result;
        }
    }

    const resolved = resolveCreateConfig({ name, framework, providers, plugins });

    const scaffoldSpinner = spinner();
    scaffoldSpinner.start("Scaffolding project");

    try {
        await runPlopGenerate(resolved);
        await formatGeneratedApp(resolved.targetDir);
        scaffoldSpinner.stop("Scaffolded project");
    } catch (error) {
        scaffoldSpinner.stop("Scaffolding failed");
        throw error;
    }

    let shouldInstall = config.install;
    const packageManager = detectPackageManager();
    const devCommand = getDevCommand(packageManager);

    if (shouldInstall === undefined) {
        if (!isInteractive) {
            shouldInstall = true;
        } else {
            const result = await confirm({
                message: `Install dependencies with ${packageManager}?`,
                initialValue: true,
            });

            if (isCancel(result)) {
                cancel("Cancelled");
                process.exit(0);
            }

            shouldInstall = result;
        }
    }

    if (shouldInstall) {
        const installSpinner = spinner();
        installSpinner.start(`Installing dependencies with ${packageManager}`);

        try {
            await installDependencies(resolved.targetDir, packageManager);
            installSpinner.stop(`Installed dependencies with ${packageManager}`);
        } catch (error) {
            installSpinner.stop("Dependency installation failed");
            throw error;
        }
    }

    outro(
        renderSummary({
            name: resolved.name,
            targetDir: resolved.targetDir,
            framework: resolved.framework,
            providers: resolved.providers,
            plugins: resolved.plugins,
            shouldInstall,
            packageManager,
            devCommand,
        }),
    );
};
