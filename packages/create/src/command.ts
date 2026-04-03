import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { getCliVersion, requiredPackageSpecs } from "./deps";
import {
    createPackageJson,
    ensureDirectory,
    updateEnvFile,
    updateGitignore,
    updatePackageDependencies,
    writeTargetFiles,
} from "./files";
import * as p from "./prompt";
import {
    PLUGINS,
    PROVIDERS,
    copyLocalTemplate,
    envTemplate,
    frameworkLabel,
    genericInstructions,
    getFrameworkBaseTargetFiles,
    getFrameworkPromptOptions,
    getFrameworkStarterUiFiles,
    isFrameworkId,
    isPluginId,
    isProviderId,
    pluginLabel,
    providerLabel,
    supportsFrameworkStarterUi,
} from "./templates";
import type {
    DetectionResult,
    DirectoryState,
    FrameworkId,
    InitMode,
    InitOptions,
    PluginId,
    ProviderId,
} from "./types";

type ResolvedSelection = {
    framework: FrameworkId;
    providers: ProviderId[];
    plugins: PluginId[];
    starterUi: boolean;
};

type PackageJsonShape = {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
};

const NEXT_CONFIG_FILES = [
    "next.config.js",
    "next.config.mjs",
    "next.config.ts",
    "next.config.mts",
];
const REMIX_CONFIG_FILES = ["remix.config.js", "remix.config.mjs", "remix.config.ts"];
const SVELTEKIT_CONFIG_FILES = ["svelte.config.js", "svelte.config.ts"];
const ASTRO_CONFIG_FILES = ["astro.config.mjs", "astro.config.ts", "astro.config.js"];
const NUXT_CONFIG_FILES = ["nuxt.config.ts", "nuxt.config.js", "nuxt.config.mjs"];
const REACT_ROUTER_CONFIG_FILES = [
    "react-router.config.ts",
    "react-router.config.js",
    "react-router.config.mjs",
];

class PromptCancelledError extends Error {
    constructor() {
        super("Cancelled.");
        this.name = "PromptCancelledError";
    }
}

const parseCsv = (value: string | undefined) =>
    value
        ? value
              .split(",")
              .map((item) => item.trim())
              .filter(Boolean)
        : [];

const readPackageJson = (cwd: string): PackageJsonShape =>
    JSON.parse(readFileSync(path.join(cwd, "package.json"), "utf8")) as PackageJsonShape;

const hasDependency = (pkg: PackageJsonShape, name: string) =>
    Boolean(pkg.dependencies?.[name] ?? pkg.devDependencies?.[name]);

const parseProviderValues = (value: string | undefined): ProviderId[] => {
    const items = parseCsv(value);
    const invalid = items.filter((item) => !isProviderId(item));
    if (invalid.length > 0) {
        throw new Error(`Unsupported provider list: ${invalid.join(", ")}.`);
    }
    return items as ProviderId[];
};

const parsePluginValues = (value: string | undefined): PluginId[] => {
    const items = parseCsv(value);
    const invalid = items.filter((item) => !isPluginId(item));
    if (invalid.length > 0) {
        throw new Error(`Unsupported plugin list: ${invalid.join(", ")}.`);
    }
    return items as PluginId[];
};

const handleCancel = <T>(value: T | symbol): T => {
    if (p.isCancel(value)) {
        throw new PromptCancelledError();
    }
    return value as T;
};

const renderStatus = (label: string, status: "created" | "updated" | "exists" | "skipped") => {
    const prefix =
        status === "created"
            ? p.format.success("+")
            : status === "updated"
              ? p.format.accent("~")
              : status === "exists"
                ? p.format.muted("=")
                : p.format.muted("-");
    p.log.message(`  ${prefix} ${p.format.subtle(label)}`);
};

const nextSteps = (
    mode: InitMode,
    framework: FrameworkId,
    selection: ResolvedSelection,
    uiResults: ReturnType<typeof writeTargetFiles>,
) => {
    const starterRoute = mode === "create" ? "/" : "/chat";

    return framework === "generic"
        ? genericInstructions(selection.providers, selection.plugins)
        : [
              `Add your ${selection.providers.map((provider) => (provider === "openai" ? "OPENAI_API_KEY" : provider === "anthropic" ? "ANTHROPIC_API_KEY" : "XAI_API_KEY")).join(" and ")} to .env.`,
              selection.plugins.length > 0
                  ? "Review the generated plugin config in your Better Agent server file."
                  : "Review the generated server and client files.",
              selection.starterUi
                  ? uiResults.some((result) => result.kind === "exists")
                      ? "Review the existing starter UI file or rerun and choose overwrite if you want the generated starter."
                      : `Run your dev server and open ${starterRoute} to verify the generated starter UI.`
                  : "Import the generated client in your UI and wire your own chat surface.",
          ];
};

export const parseArgs = (argv: string[]): InitOptions => {
    const args = [...argv];
    const options: InitOptions = {};
    const providers = new Set<ProviderId>();
    const plugins = new Set<PluginId>();
    const nextValue = (flag: string) => {
        const value = args.shift();
        if (!value || value.startsWith("-")) {
            throw new Error(`Missing value for ${flag}.`);
        }
        return value;
    };

    while (args.length > 0) {
        const arg = args.shift();
        if (!arg) continue;

        if (!arg.startsWith("-") && !options.name) {
            options.name = arg;
            continue;
        }

        if (arg === "--yes") {
            options.yes = true;
            continue;
        }
        if (arg === "--cwd") {
            options.cwd = nextValue(arg);
            continue;
        }
        if (arg === "--mode") {
            const value = nextValue(arg);
            if (value !== "create" && value !== "patch") {
                throw new Error(`Unsupported mode: ${value}. Use "create" or "patch".`);
            }
            options.mode = value;
            continue;
        }
        if (arg === "--name") {
            options.name = nextValue(arg);
            continue;
        }
        if (arg === "--framework") {
            const value = nextValue(arg);
            if (!isFrameworkId(value)) {
                throw new Error(`Unsupported framework: ${value}.`);
            }
            options.framework = value;
            continue;
        }
        if (arg === "--provider" || arg === "--providers") {
            for (const provider of parseProviderValues(nextValue(arg))) {
                providers.add(provider);
            }
            continue;
        }
        if (arg === "--plugin" || arg === "--plugins") {
            for (const plugin of parsePluginValues(nextValue(arg))) {
                plugins.add(plugin);
            }
            continue;
        }
        if (arg === "--starter-ui") {
            options.starterUi = true;
            continue;
        }
        if (arg === "--no-starter-ui") {
            options.starterUi = false;
            continue;
        }

        throw new Error(`Unknown option: ${arg}.`);
    }

    if (providers.size > 0) {
        options.providers = [...providers];
    }
    if (plugins.size > 0) {
        options.plugins = [...plugins];
    }

    return options;
};

export const detectDirectoryState = (cwd: string): DirectoryState => {
    if (!existsSync(cwd)) {
        return { exists: false, isEmpty: true, hasPackageJson: false };
    }

    const entries = readdirSync(cwd).filter((entry) => entry !== ".DS_Store");
    return {
        exists: true,
        isEmpty: entries.length === 0,
        hasPackageJson: entries.includes("package.json"),
    };
};

export const isProjectDirectory = (cwd: string) => existsSync(path.join(cwd, "package.json"));

export const detectProject = (cwd: string): DetectionResult => {
    if (!isProjectDirectory(cwd)) {
        throw new Error("No package.json found. Run this from a project root.");
    }

    const pkg = readPackageJson(cwd);
    return {
        framework:
            NEXT_CONFIG_FILES.some((file) => existsSync(path.join(cwd, file))) ||
            hasDependency(pkg, "next")
                ? "nextjs"
                : REMIX_CONFIG_FILES.some((file) => existsSync(path.join(cwd, file))) ||
                    hasDependency(pkg, "@remix-run/react") ||
                    hasDependency(pkg, "@remix-run/dev")
                  ? "remix"
                  : SVELTEKIT_CONFIG_FILES.some((file) => existsSync(path.join(cwd, file))) ||
                      hasDependency(pkg, "@sveltejs/kit")
                    ? "sveltekit"
                    : ASTRO_CONFIG_FILES.some((file) => existsSync(path.join(cwd, file))) ||
                        hasDependency(pkg, "astro")
                      ? "astro"
                      : NUXT_CONFIG_FILES.some((file) => existsSync(path.join(cwd, file))) ||
                          hasDependency(pkg, "nuxt")
                        ? "nuxt"
                        : existsSync(path.join(cwd, "app.config.ts")) ||
                            existsSync(path.join(cwd, "app.config.js")) ||
                            hasDependency(pkg, "@solidjs/start")
                          ? "solidstart"
                          : hasDependency(pkg, "@tanstack/react-start") ||
                              ((existsSync(path.join(cwd, "vite.config.ts")) ||
                                  existsSync(path.join(cwd, "app.config.ts"))) &&
                                  existsSync(path.join(cwd, "src/router.tsx")))
                            ? "tanstack-start"
                            : REACT_ROUTER_CONFIG_FILES.some((file) =>
                                    existsSync(path.join(cwd, file)),
                                ) || hasDependency(pkg, "react-router")
                              ? "react-router"
                              : null,
        useSrcDir: existsSync(path.join(cwd, "src")),
        hasTypeScript: existsSync(path.join(cwd, "tsconfig.json")),
    };
};

export const run = async (options: InitOptions): Promise<number> => {
    const baseCwd = path.resolve(options.cwd ?? process.cwd());
    const promptMode =
        options.yes || !process.stdin.isTTY || !process.stdout.isTTY
            ? "non-interactive"
            : "interactive";

    try {
        if (options.providers && options.providers.length === 0) {
            throw new Error("Provider list cannot be empty.");
        }

        p.intro({
            version: getCliVersion(),
            mode: promptMode,
            directory: baseCwd.replace(process.env.HOME ?? "", "~"),
        });

        const mode =
            options.mode ??
            (options.name
                ? "create"
                : options.yes
                  ? isProjectDirectory(baseCwd)
                      ? "patch"
                      : "create"
                  : handleCancel(
                        await p.select<InitMode>({
                            title: "Create or patch",
                            initialValue: isProjectDirectory(baseCwd) ? "patch" : "create",
                            options: [
                                { label: "Create a new app", value: "create" },
                                {
                                    label: "Add Better Agent to this app",
                                    value: "patch",
                                    hint: isProjectDirectory(baseCwd)
                                        ? p.shortenDisplayPath(
                                              baseCwd.replace(process.env.HOME ?? "", "~"),
                                          )
                                        : undefined,
                                },
                            ],
                        }),
                    ));

        let targetCwd = baseCwd;
        let projectName: string | null = null;
        let selection: ResolvedSelection;
        let overwriteUiEntry = false;

        if (mode === "create") {
            const validateProjectName = (value: string) => {
                const name = value.trim();
                if (name.length === 0) {
                    return "Project name is required.";
                }

                const state = detectDirectoryState(path.resolve(baseCwd, name));
                return state.exists && !state.isEmpty
                    ? `Target directory is not empty: ${p.shortenDisplayPath(path.resolve(baseCwd, name))}`
                    : undefined;
            };

            projectName = options.name
                ? (() => {
                      const error = validateProjectName(options.name);
                      if (error) throw new Error(error);
                      return options.name;
                  })()
                : options.yes
                  ? (() => {
                        throw new Error(
                            "Project name is required when creating a new app in --yes mode.",
                        );
                    })()
                  : handleCancel(
                        await p.text({
                            title: "Project name",
                            message: "Project name",
                            placeholder: "my-app",
                            validate: validateProjectName,
                        }),
                    ).trim();

            targetCwd = path.resolve(baseCwd, projectName);

            const framework =
                options.framework ??
                (options.yes
                    ? "nextjs"
                    : handleCancel(
                          await p.select<FrameworkId>({
                              title: "Framework",
                              initialValue: "nextjs",
                              options: getFrameworkPromptOptions(),
                          }),
                      ));

            if (framework === "generic") {
                selection = {
                    framework,
                    providers: options.providers?.length
                        ? options.providers
                        : options.yes
                          ? ["openai"]
                          : (handleCancel(
                                await p.multiselect({
                                    title: "Providers",
                                    message: "Providers",
                                    options: PROVIDERS.map((provider) => ({
                                        label: provider.label,
                                        value: provider.id,
                                    })),
                                    required: true,
                                }),
                            ) as ProviderId[]),
                    plugins: options.plugins
                        ? options.plugins
                        : options.yes
                          ? []
                          : ((handleCancel(
                                await p.multiselect({
                                    title: "Plugins",
                                    message: "Plugins",
                                    options: PLUGINS.map((plugin) => ({
                                        label: plugin.label,
                                        value: plugin.id,
                                    })),
                                    required: false,
                                }),
                            ) ?? []) as PluginId[]),
                    starterUi: false,
                };
            } else {
                selection = {
                    framework,
                    providers: options.providers?.length
                        ? options.providers
                        : options.yes
                          ? ["openai"]
                          : (handleCancel(
                                await p.multiselect({
                                    title: "Providers",
                                    message: "Providers",
                                    options: PROVIDERS.map((provider) => ({
                                        label: provider.label,
                                        value: provider.id,
                                    })),
                                    required: true,
                                }),
                            ) as ProviderId[]),
                    plugins: options.plugins
                        ? options.plugins
                        : options.yes
                          ? []
                          : ((handleCancel(
                                await p.multiselect({
                                    title: "Plugins",
                                    message: "Plugins",
                                    options: PLUGINS.map((plugin) => ({
                                        label: plugin.label,
                                        value: plugin.id,
                                    })),
                                    required: false,
                                }),
                            ) ?? []) as PluginId[]),
                    starterUi: true,
                };
            }

            const state = detectDirectoryState(targetCwd);
            if (state.exists && !state.isEmpty) {
                throw new Error(
                    `Target directory is not empty: ${p.shortenDisplayPath(targetCwd)}`,
                );
            }

            p.log.step("Review");
            const reviewRows: Array<[string, string]> = [
                ["Mode", "New app"],
                ["Project", projectName],
                ["Framework", frameworkLabel(selection.framework)],
                ["Providers", selection.providers.map(providerLabel).join(", ")],
                [
                    "Plugins",
                    selection.plugins.length > 0
                        ? selection.plugins.map(pluginLabel).join(", ")
                        : "none",
                ],
                ["Starter UI", selection.starterUi ? "Yes" : "No"],
            ];
            for (const [label, value] of reviewRows) {
                p.log.message(
                    `  ${p.format.muted(label.padEnd(10, " "))}  ${p.format.subtle(value)}`,
                );
            }

            p.log.step("Create app foundation");
            p.log.message(`  Framework: ${frameworkLabel(selection.framework)}`);
            if (selection.framework === "generic") {
                ensureDirectory(targetCwd);
            } else {
                copyLocalTemplate(selection.framework, targetCwd);
            }

            if (selection.framework === "generic") {
                const packageJsonResult = createPackageJson(targetCwd);
                renderStatus(packageJsonResult.label, packageJsonResult.kind);
            }

            overwriteUiEntry = true;
        } else {
            const detectedFramework = isProjectDirectory(baseCwd)
                ? detectProject(baseCwd).framework
                : null;
            const framework =
                options.framework ??
                (options.yes
                    ? (detectedFramework ?? "generic")
                    : handleCancel(
                          await p.select<FrameworkId>({
                              title: "Framework",
                              initialValue: detectedFramework ?? "generic",
                              options: getFrameworkPromptOptions()
                                  .map((option) => ({
                                      ...option,
                                      hint:
                                          option.value === detectedFramework
                                              ? "Detected"
                                              : undefined,
                                  }))
                                  .sort((left, right) => {
                                      if (left.value === detectedFramework) return -1;
                                      if (right.value === detectedFramework) return 1;
                                      return 0;
                                  }),
                          }),
                      ));

            selection = {
                framework,
                providers: options.providers?.length
                    ? options.providers
                    : options.yes
                      ? ["openai"]
                      : (handleCancel(
                            await p.multiselect({
                                title: "Providers",
                                message: "Providers",
                                options: PROVIDERS.map((provider) => ({
                                    label: provider.label,
                                    value: provider.id,
                                })),
                                required: true,
                            }),
                        ) as ProviderId[]),
                plugins: options.plugins
                    ? options.plugins
                    : options.yes
                      ? []
                      : ((handleCancel(
                            await p.multiselect({
                                title: "Plugins",
                                message: "Plugins",
                                options: PLUGINS.map((plugin) => ({
                                    label: plugin.label,
                                    value: plugin.id,
                                })),
                                required: false,
                            }),
                        ) ?? []) as PluginId[]),
                starterUi: !supportsFrameworkStarterUi(framework)
                    ? false
                    : typeof options.starterUi === "boolean"
                      ? options.starterUi
                      : options.yes
                        ? true
                        : handleCancel(
                              await p.confirm({
                                  title: "Starter UI",
                                  message: "Scaffold starter chat UI?",
                                  initialValue: true,
                              }),
                          ),
            };

            if (!isProjectDirectory(baseCwd)) {
                const shouldCreate = options.yes
                    ? true
                    : handleCancel(
                          await p.confirm({
                              message: "No package.json found. Create one here?",
                              initialValue: true,
                          }),
                      );
                if (!shouldCreate) {
                    throw new Error("A package.json is required to initialize Better Agent.");
                }
                ensureDirectory(baseCwd);
                p.log.step("Prepare project");
                const packageJsonResult = createPackageJson(baseCwd);
                renderStatus(packageJsonResult.label, packageJsonResult.kind);
            }

            p.log.step("Review");
            const reviewRows: Array<[string, string]> = [
                ["Mode", "Patch"],
                ["Framework", frameworkLabel(selection.framework)],
                ["Providers", selection.providers.map(providerLabel).join(", ")],
                [
                    "Plugins",
                    selection.plugins.length > 0
                        ? selection.plugins.map(pluginLabel).join(", ")
                        : "none",
                ],
                ["Starter UI", selection.starterUi ? "Yes" : "No"],
            ];
            for (const [label, value] of reviewRows) {
                p.log.message(
                    `  ${p.format.muted(label.padEnd(10, " "))}  ${p.format.subtle(value)}`,
                );
            }
        }

        const detection =
            selection.framework === "generic" ? { useSrcDir: false } : detectProject(targetCwd);
        const baseFiles = getFrameworkBaseTargetFiles(
            targetCwd,
            selection.framework,
            detection.useSrcDir,
            { providers: selection.providers, plugins: selection.plugins },
        );
        const starterUiFiles = selection.starterUi
            ? getFrameworkStarterUiFiles(
                  targetCwd,
                  selection.framework,
                  detection.useSrcDir,
                  selection.providers[0] ?? "openai",
                  overwriteUiEntry,
                  mode,
              )
            : [];
        const shouldPromptForOverwrite = mode === "patch" && promptMode === "interactive";
        const existingGeneratedFiles =
            mode === "patch"
                ? [...baseFiles, ...starterUiFiles].filter(
                      (file) => existsSync(file.path) && file.label !== "tsconfig.json",
                  )
                : [];
        const overwriteDecisions = new Map<string, boolean>();
        if (shouldPromptForOverwrite) {
            if (existingGeneratedFiles.length > 0) {
                p.log.message("");
            }
            for (const file of existingGeneratedFiles) {
                overwriteDecisions.set(
                    file.path,
                    handleCancel(
                        await p.confirm({
                            title: "Overwrite file",
                            message: `${file.label} already exists. Overwrite it?`,
                            initialValue: false,
                        }),
                    ),
                );
            }
        }
        const applyOverwritePreference = (files: typeof baseFiles) =>
            mode !== "patch"
                ? files
                : files.map((file) => ({
                      ...file,
                      overwrite:
                          shouldPromptForOverwrite && existsSync(file.path)
                              ? (overwriteDecisions.get(file.path) ?? false)
                              : file.overwrite,
                  }));

        p.log.step("Add Better Agent files");
        for (const result of writeTargetFiles(applyOverwritePreference(baseFiles))) {
            renderStatus(result.label, result.kind);
        }

        const uiResults: ReturnType<typeof writeTargetFiles> = [];
        if (selection.starterUi) {
            p.log.step("Add starter chat UI");
            for (const result of writeTargetFiles(applyOverwritePreference(starterUiFiles))) {
                uiResults.push(result);
                renderStatus(result.label, result.kind);
            }
        }

        p.log.step("Update project files");
        renderStatus(
            ".env",
            updateEnvFile(targetCwd, envTemplate(selection.providers, selection.plugins)).kind,
        );
        renderStatus(".gitignore", updateGitignore(targetCwd).kind);
        renderStatus(
            "package.json",
            updatePackageDependencies(
                targetCwd,
                requiredPackageSpecs({
                    providers: selection.providers,
                    plugins: selection.plugins,
                }),
            ).kind,
        );

        p.log.step("Install dependencies");
        p.log.message(
            `  ${p.format.muted("Install dependencies with your package manager when you're ready.")}`,
        );

        p.log.step("Next steps");
        for (const [index, step] of nextSteps(
            mode,
            selection.framework,
            selection,
            uiResults,
        ).entries()) {
            p.log.message(`  ${p.format.success(`${index + 1}.`)} ${step}`);
        }

        p.outro("Done.");
        return 0;
    } catch (error) {
        if (error instanceof PromptCancelledError) {
            p.cancel(error.message);
            return 0;
        }
        p.log.error(error instanceof Error ? error.message : "Create Better Agent failed.");
        return 1;
    }
};

export const parseCliArgs = parseArgs;
