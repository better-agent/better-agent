import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { copyDirectory } from "./files";
import type {
    FrameworkId,
    InitMode,
    PluginId,
    ProviderId,
    SandboxClientId,
    TargetFile,
} from "./types";

export const FRAMEWORKS = [
    {
        id: "nextjs",
        label: "Next.js",
        createSupported: true,
        patchSupported: true,
        localTemplate: true,
        starterUi: true,
    },
    {
        id: "remix",
        label: "Remix",
        createSupported: true,
        patchSupported: true,
        localTemplate: true,
        starterUi: true,
    },
    {
        id: "sveltekit",
        label: "SvelteKit",
        createSupported: true,
        patchSupported: true,
        localTemplate: true,
        starterUi: true,
    },
    {
        id: "astro",
        label: "Astro",
        createSupported: true,
        patchSupported: true,
        localTemplate: true,
        starterUi: true,
    },
    {
        id: "nuxt",
        label: "Nuxt",
        createSupported: true,
        patchSupported: true,
        localTemplate: true,
        starterUi: true,
    },
    {
        id: "tanstack-start",
        label: "TanStack Start",
        createSupported: true,
        patchSupported: true,
        localTemplate: true,
        starterUi: true,
    },
    {
        id: "solidstart",
        label: "SolidStart",
        createSupported: true,
        patchSupported: true,
        localTemplate: true,
        starterUi: true,
    },
    {
        id: "react-router",
        label: "React Router",
        createSupported: true,
        patchSupported: true,
        localTemplate: true,
        starterUi: true,
    },
    {
        id: "generic",
        label: "Generic",
        createSupported: true,
        patchSupported: true,
        localTemplate: false,
        starterUi: false,
    },
] as const satisfies ReadonlyArray<{
    id: FrameworkId;
    label: string;
    createSupported: boolean;
    patchSupported: boolean;
    localTemplate: boolean;
    starterUi: boolean;
}>;

export const PROVIDERS = [
    { id: "anthropic", label: "Anthropic" },
    { id: "openai", label: "OpenAI" },
    { id: "xai", label: "xAI" },
] as const satisfies ReadonlyArray<{ id: ProviderId; label: string }>;

export const PLUGINS = [
    { id: "auth", label: "Auth" },
    { id: "ip-allowlist", label: "IP Allowlist" },
    { id: "logging", label: "Logging" },
    { id: "rate-limit", label: "Rate Limit" },
    { id: "sandbox", label: "Sandbox" },
] as const satisfies ReadonlyArray<{ id: PluginId; label: string }>;

export const SANDBOX_CLIENTS = [
    { id: "e2b", label: "E2B" },
    { id: "daytona", label: "Daytona" },
] as const satisfies ReadonlyArray<{ id: SandboxClientId; label: string }>;

type FrameworkPaths = {
    serverLabel: string;
    serverPath: string;
    clientLabel: string;
    clientPath: string;
    routeLabel: string;
    routePath: string;
    starterPageLabel: string;
    starterPagePath: string;
};

const TEMPLATE_ROOT = path.resolve(import.meta.dirname, "..", "templates");
const FRAMEWORK_META = Object.fromEntries(
    FRAMEWORKS.map((framework) => [framework.id, framework]),
) as Record<FrameworkId, (typeof FRAMEWORKS)[number]>;
const FRAMEWORK_IDS = FRAMEWORKS.map((framework) => framework.id) as FrameworkId[];
const PROVIDER_IDS = PROVIDERS.map((provider) => provider.id) as ProviderId[];
const PLUGIN_IDS = PLUGINS.map((plugin) => plugin.id) as PluginId[];
const SANDBOX_CLIENT_IDS = SANDBOX_CLIENTS.map((client) => client.id) as SandboxClientId[];

const providerConfig: Record<
    ProviderId,
    {
        envVar: string;
        importLine: string;
        setup: string;
        model: string;
    }
> = {
    openai: {
        envVar: "OPENAI_API_KEY",
        importLine: 'import { createOpenAI } from "@better-agent/providers/openai";',
        setup: [
            "const openaiProvider = createOpenAI({",
            '    apiKey: process.env.OPENAI_API_KEY ?? "your-openai-api-key",',
            "});",
        ].join("\n"),
        model: 'openaiProvider.model("gpt-4.1")',
    },
    anthropic: {
        envVar: "ANTHROPIC_API_KEY",
        importLine: 'import { createAnthropic } from "@better-agent/providers/anthropic";',
        setup: [
            "const anthropicProvider = createAnthropic({",
            '    apiKey: process.env.ANTHROPIC_API_KEY ?? "your-anthropic-api-key",',
            "});",
        ].join("\n"),
        model: 'anthropicProvider.text("claude-sonnet-4-6")',
    },
    xai: {
        envVar: "XAI_API_KEY",
        importLine: 'import { createXAI } from "@better-agent/providers/xai";',
        setup: [
            "const xaiProvider = createXAI({",
            '    apiKey: process.env.XAI_API_KEY ?? "your-xai-api-key",',
            "});",
        ].join("\n"),
        model: 'xaiProvider.text("grok-4")',
    },
};

const pluginConfig: Record<
    Exclude<PluginId, "sandbox">,
    {
        importNames: string[];
        setup: string;
        envLines?: string[];
    }
> = {
    auth: {
        importNames: ["authPlugin"],
        setup: [
            "authPlugin({",
            '    apiKeys: [process.env.BETTER_AGENT_API_KEY ?? "dev-api-key"],',
            "})",
        ].join("\n"),
        envLines: ["BETTER_AGENT_API_KEY=dev-api-key"],
    },
    "ip-allowlist": {
        importNames: ["ipAllowlistPlugin"],
        setup: ["ipAllowlistPlugin({", '    allow: ["127.0.0.1", "::1"],', "})"].join("\n"),
    },
    logging: {
        importNames: ["loggingPlugin"],
        setup: "loggingPlugin()",
    },
    "rate-limit": {
        importNames: ["rateLimitPlugin"],
        setup: ["rateLimitPlugin({", "    windowMs: 60_000,", "    max: 30,", "})"].join("\n"),
    },
};

export const isFrameworkId = (value: string): value is FrameworkId =>
    FRAMEWORK_IDS.includes(value as FrameworkId);

export const isProviderId = (value: string): value is ProviderId =>
    PROVIDER_IDS.includes(value as ProviderId);

export const isPluginId = (value: string): value is PluginId =>
    PLUGIN_IDS.includes(value as PluginId);

export const isSandboxClientId = (value: string): value is SandboxClientId =>
    SANDBOX_CLIENT_IDS.includes(value as SandboxClientId);

export const frameworkLabel = (framework: FrameworkId) => FRAMEWORK_META[framework].label;

export const providerLabel = (provider: ProviderId) =>
    PROVIDERS.find((entry) => entry.id === provider)?.label ?? provider;

export const pluginLabel = (plugin: PluginId) =>
    PLUGINS.find((entry) => entry.id === plugin)?.label ?? plugin;

export const sandboxClientLabel = (sandboxClient: SandboxClientId) =>
    SANDBOX_CLIENTS.find((entry) => entry.id === sandboxClient)?.label ?? sandboxClient;

type PluginTemplateConfig = {
    importNames: string[];
    setup: string;
    envLines?: string[];
};

const getSandboxPluginConfig = (sandboxClient?: SandboxClientId): PluginTemplateConfig => {
    if (sandboxClient === "daytona") {
        return {
            importNames: ["sandboxPlugin", "createDaytonaSandboxClient"],
            setup: [
                "sandboxPlugin({",
                "    client: createDaytonaSandboxClient({",
                '        apiKey: process.env.DAYTONA_API_KEY ?? "your-daytona-api-key",',
                '        target: process.env.DAYTONA_TARGET ?? "your-daytona-target",',
                "    }),",
                "})",
            ].join("\n"),
            envLines: [
                "DAYTONA_API_KEY=your-daytona-api-key",
                "DAYTONA_TARGET=your-daytona-target",
            ],
        };
    }

    return {
        importNames: ["sandboxPlugin", "createE2BSandboxClient"],
        setup: [
            "sandboxPlugin({",
            "    client: createE2BSandboxClient({",
            '        apiKey: process.env.E2B_API_KEY ?? "your-e2b-api-key",',
            "    }),",
            "})",
        ].join("\n"),
        envLines: ["E2B_API_KEY=your-e2b-api-key"],
    };
};

const getPluginTemplateConfig = (
    plugin: PluginId,
    sandboxClient?: SandboxClientId,
): PluginTemplateConfig =>
    plugin === "sandbox" ? getSandboxPluginConfig(sandboxClient) : pluginConfig[plugin];

const renderPluginBlock = (plugins: PluginId[], sandboxClient?: SandboxClientId) => {
    if (plugins.length === 0) return "";
    const setups = plugins.map((p) =>
        getPluginTemplateConfig(p, sandboxClient)
            .setup.split("\n")
            .map((line) => `        ${line}`)
            .join("\n"),
    );
    return ["    plugins: [", setups.join(",\n"), "    ],"].join("\n");
};

export const getFrameworkPromptOptions = () =>
    FRAMEWORKS.map((framework) => ({
        label: framework.label,
        value: framework.id,
    }));

export const supportsFrameworkStarterUi = (framework: FrameworkId) =>
    FRAMEWORK_META[framework].starterUi;

export const readTemplateFile = (
    relativePath: string,
    replacements: Record<string, string> = {},
) => {
    let content = readFileSync(path.join(TEMPLATE_ROOT, relativePath), "utf8");
    for (const [token, value] of Object.entries(replacements)) {
        content = content.replaceAll(token, value);
    }
    return content;
};

export const copyLocalTemplate = (framework: FrameworkId, cwd: string) => {
    if (!FRAMEWORK_META[framework].localTemplate) {
        throw new Error(`No local template is available for ${framework}.`);
    }

    copyDirectory(path.join(TEMPLATE_ROOT, framework, "base"), cwd);

    const packageJsonPath = path.join(cwd, "package.json");
    const packageName =
        path
            .basename(cwd)
            .toLowerCase()
            .replace(/[^a-z0-9-]+/g, "-")
            .replace(/-+/g, "-")
            .replace(/^-|-$/g, "") || "better-agent-app";
    writeFileSync(
        packageJsonPath,
        readFileSync(packageJsonPath, "utf8").replace('"__PROJECT_NAME__"', `"${packageName}"`),
        "utf8",
    );
};

export const envTemplate = (
    providers: ProviderId[],
    plugins: PluginId[],
    sandboxClient?: SandboxClientId,
) => {
    const lines = [
        "# Added by better-agent",
        ...providers.map(
            (provider) =>
                `${providerConfig[provider].envVar}=your-${providerConfig[provider].envVar.toLowerCase().replaceAll("_", "-")}`,
        ),
        "BETTER_AGENT_SECRET=your-secret-here",
    ];
    for (const plugin of plugins) {
        lines.push(...(getPluginTemplateConfig(plugin, sandboxClient).envLines ?? []));
    }
    return lines.join("\n");
};

export const genericInstructions = (providers: ProviderId[], plugins: PluginId[]) => {
    const lines = [
        "Mount `app.handler(request)` in your server runtime.",
        "Import the client from `./better-agent/client`.",
        "Update `baseURL` if Better Agent is mounted somewhere other than `/agents`.",
    ];

    lines.splice(
        1,
        0,
        `Add your ${providers.map((provider) => providerConfig[provider].envVar).join(" and ")} to \`.env\`.`,
    );
    if (plugins.length > 0) {
        lines.splice(
            2,
            0,
            "Review the generated plugin config in `better-agent/server.ts` before shipping.",
        );
    }

    return lines;
};

export const resolveFrameworkPaths = (
    framework: Exclude<FrameworkId, "generic">,
    cwd: string,
    useSrcDir: boolean,
    starterRouteMode: "root" | "chat" = "chat",
): FrameworkPaths => {
    switch (framework) {
        case "nextjs": {
            const baseDir = path.join(cwd, useSrcDir ? "src" : "");
            return {
                serverLabel: useSrcDir ? "src/better-agent/server.ts" : "better-agent/server.ts",
                serverPath: path.join(baseDir, "better-agent/server.ts"),
                clientLabel: useSrcDir ? "src/better-agent/client.ts" : "better-agent/client.ts",
                clientPath: path.join(baseDir, "better-agent/client.ts"),
                routeLabel: useSrcDir
                    ? "src/app/agents/[...path]/route.ts"
                    : "app/agents/[...path]/route.ts",
                routePath: path.join(
                    cwd,
                    useSrcDir
                        ? "src/app/agents/[...path]/route.ts"
                        : "app/agents/[...path]/route.ts",
                ),
                starterPageLabel:
                    starterRouteMode === "root"
                        ? useSrcDir
                            ? "src/app/page.tsx"
                            : "app/page.tsx"
                        : useSrcDir
                          ? "src/app/chat/page.tsx"
                          : "app/chat/page.tsx",
                starterPagePath: path.join(
                    cwd,
                    starterRouteMode === "root"
                        ? useSrcDir
                            ? "src/app/page.tsx"
                            : "app/page.tsx"
                        : useSrcDir
                          ? "src/app/chat/page.tsx"
                          : "app/chat/page.tsx",
                ),
            };
        }
        case "remix":
            return {
                serverLabel: "app/better-agent/server.ts",
                serverPath: path.join(cwd, "app/better-agent/server.ts"),
                clientLabel: "app/better-agent/client.ts",
                clientPath: path.join(cwd, "app/better-agent/client.ts"),
                routeLabel: "app/routes/agents.$.ts",
                routePath: path.join(cwd, "app/routes/agents.$.ts"),
                starterPageLabel:
                    starterRouteMode === "root" ? "app/routes/_index.tsx" : "app/routes/chat.tsx",
                starterPagePath: path.join(
                    cwd,
                    starterRouteMode === "root" ? "app/routes/_index.tsx" : "app/routes/chat.tsx",
                ),
            };
        case "sveltekit": {
            const routesRoot = useSrcDir ? "src/routes" : "routes";
            const libRoot = useSrcDir ? "src/lib" : "lib";
            return {
                serverLabel: useSrcDir
                    ? "src/lib/better-agent/server.ts"
                    : "lib/better-agent/server.ts",
                serverPath: path.join(cwd, libRoot, "better-agent/server.ts"),
                clientLabel: useSrcDir
                    ? "src/lib/better-agent/client.ts"
                    : "lib/better-agent/client.ts",
                clientPath: path.join(cwd, libRoot, "better-agent/client.ts"),
                routeLabel: useSrcDir
                    ? "src/routes/agents/[...path]/+server.ts"
                    : "routes/agents/[...path]/+server.ts",
                routePath: path.join(cwd, routesRoot, "agents/[...path]/+server.ts"),
                starterPageLabel:
                    starterRouteMode === "root"
                        ? useSrcDir
                            ? "src/routes/+page.svelte"
                            : "routes/+page.svelte"
                        : useSrcDir
                          ? "src/routes/chat/+page.svelte"
                          : "routes/chat/+page.svelte",
                starterPagePath: path.join(
                    cwd,
                    routesRoot,
                    starterRouteMode === "root" ? "+page.svelte" : "chat/+page.svelte",
                ),
            };
        }
        case "astro":
            return {
                serverLabel: "src/better-agent/server.ts",
                serverPath: path.join(cwd, "src/better-agent/server.ts"),
                clientLabel: "src/better-agent/client.ts",
                clientPath: path.join(cwd, "src/better-agent/client.ts"),
                routeLabel: "src/pages/agents/[...path].ts",
                routePath: path.join(cwd, "src/pages/agents/[...path].ts"),
                starterPageLabel:
                    starterRouteMode === "root" ? "src/pages/index.astro" : "src/pages/chat.astro",
                starterPagePath: path.join(
                    cwd,
                    starterRouteMode === "root" ? "src/pages/index.astro" : "src/pages/chat.astro",
                ),
            };
        case "nuxt":
            return {
                serverLabel: "lib/better-agent/server.ts",
                serverPath: path.join(cwd, "lib/better-agent/server.ts"),
                clientLabel: "lib/better-agent/client.ts",
                clientPath: path.join(cwd, "lib/better-agent/client.ts"),
                routeLabel: "server/api/agents/[...path].ts",
                routePath: path.join(cwd, "server/api/agents/[...path].ts"),
                starterPageLabel:
                    starterRouteMode === "root" ? "app/pages/index.vue" : "app/pages/chat.vue",
                starterPagePath: path.join(
                    cwd,
                    starterRouteMode === "root" ? "app/pages/index.vue" : "app/pages/chat.vue",
                ),
            };
        case "tanstack-start":
            return {
                serverLabel: "src/better-agent/server.ts",
                serverPath: path.join(cwd, "src/better-agent/server.ts"),
                clientLabel: "src/better-agent/client.ts",
                clientPath: path.join(cwd, "src/better-agent/client.ts"),
                routeLabel: "src/routes/agents/$.tsx",
                routePath: path.join(cwd, "src/routes/agents/$.tsx"),
                starterPageLabel:
                    starterRouteMode === "root" ? "src/routes/index.tsx" : "src/routes/chat.tsx",
                starterPagePath: path.join(
                    cwd,
                    starterRouteMode === "root" ? "src/routes/index.tsx" : "src/routes/chat.tsx",
                ),
            };
        case "solidstart":
            return {
                serverLabel: "src/better-agent/server.ts",
                serverPath: path.join(cwd, "src/better-agent/server.ts"),
                clientLabel: "src/better-agent/client.ts",
                clientPath: path.join(cwd, "src/better-agent/client.ts"),
                routeLabel: "src/routes/agents/[...path]/index.ts",
                routePath: path.join(cwd, "src/routes/agents/[...path]/index.ts"),
                starterPageLabel:
                    starterRouteMode === "root" ? "src/routes/index.tsx" : "src/routes/chat.tsx",
                starterPagePath: path.join(
                    cwd,
                    starterRouteMode === "root" ? "src/routes/index.tsx" : "src/routes/chat.tsx",
                ),
            };
        case "react-router":
            return {
                serverLabel: "app/better-agent/server.ts",
                serverPath: path.join(cwd, "app/better-agent/server.ts"),
                clientLabel: "app/better-agent/client.ts",
                clientPath: path.join(cwd, "app/better-agent/client.ts"),
                routeLabel: "app/routes/agents.$.tsx",
                routePath: path.join(cwd, "app/routes/agents.$.tsx"),
                starterPageLabel:
                    starterRouteMode === "root" ? "app/routes/home.tsx" : "app/routes/chat.tsx",
                starterPagePath: path.join(
                    cwd,
                    starterRouteMode === "root" ? "app/routes/home.tsx" : "app/routes/chat.tsx",
                ),
            };
    }
};

export const getFrameworkBaseTargetFiles = (
    cwd: string,
    framework: FrameworkId,
    useSrcDir: boolean,
    selection: {
        providers: ProviderId[];
        plugins: PluginId[];
        sandboxClient?: SandboxClientId;
    },
): TargetFile[] => {
    if (framework === "generic") {
        const envImport = "";
        const envAccessor = "process.env.";
        const secretEnv = 'process.env.BETTER_AGENT_SECRET ?? "your-secret-here"';
        const pluginImportLine =
            selection.plugins.length > 0
                ? `import { ${[
                      ...new Set(
                          selection.plugins.flatMap(
                              (plugin) =>
                                  getPluginTemplateConfig(plugin, selection.sandboxClient)
                                      .importNames,
                          ),
                      ),
                  ].join(", ")} } from "@better-agent/plugins";`
                : "";
        const pluginBlock = renderPluginBlock(selection.plugins, selection.sandboxClient);

        return [
            {
                label: "better-agent/server.ts",
                path: path.join(cwd, "better-agent/server.ts"),
                content: readTemplateFile("generated/runtime/server.ts", {
                    __BASE_URL__: "/agents",
                    __ENV_IMPORT__: envImport,
                    __PROVIDER_IMPORTS__: selection.providers
                        .map((provider) => providerConfig[provider].importLine)
                        .join("\n"),
                    __PLUGIN_IMPORTS__: pluginImportLine,
                    __PROVIDER_SETUPS__: selection.providers
                        .map((provider) => providerConfig[provider].setup)
                        .join("\n\n"),
                    __AGENT_DEFINITIONS__: selection.providers
                        .map((provider) =>
                            [
                                `const ${provider} = defineAgent({`,
                                `    name: "${provider}",`,
                                `    model: ${providerConfig[provider].model},`,
                                '    instruction: "You are a concise, practical assistant. Keep answers clear and direct.",',
                                "});",
                            ].join("\n"),
                        )
                        .join("\n\n"),
                    __AGENT_LIST__: selection.providers.join(", "),
                    __PLUGIN_BLOCK__: pluginBlock,
                    __SECRET_ENV__: secretEnv,
                })
                    .replaceAll("process.env.", envAccessor)
                    .replace(/\n{3,}/g, "\n\n"),
            },
            {
                label: "better-agent/client.ts",
                path: path.join(cwd, "better-agent/client.ts"),
                content: readTemplateFile("generated/runtime/client.ts", {
                    __BASE_URL__: "/agents",
                    __CLIENT_SECRET__: '"your-secret-here"',
                }),
            },
            {
                label: "tsconfig.json",
                path: path.join(cwd, "tsconfig.json"),
                content: JSON.stringify(
                    {
                        compilerOptions: {
                            target: "ES2022",
                            module: "ESNext",
                            moduleResolution: "Bundler",
                            strict: true,
                            skipLibCheck: true,
                            types: ["node"],
                        },
                        include: ["better-agent/**/*.ts"],
                    },
                    null,
                    2,
                ).concat("\n"),
            },
        ] satisfies TargetFile[];
    }

    const paths = resolveFrameworkPaths(framework, cwd, useSrcDir);
    const envImport =
        framework === "sveltekit" ? 'import { env } from "$env/dynamic/private";' : "";
    const envAccessor =
        framework === "sveltekit"
            ? "env."
            : framework === "astro"
              ? "import.meta.env."
              : "process.env.";
    const secretEnv =
        framework === "sveltekit"
            ? 'env.BETTER_AGENT_SECRET ?? "your-secret-here"'
            : framework === "astro"
              ? 'import.meta.env.BETTER_AGENT_SECRET ?? "your-secret-here"'
              : 'process.env.BETTER_AGENT_SECRET ?? "your-secret-here"';
    const pluginImportLine =
        selection.plugins.length > 0
            ? `import { ${[
                  ...new Set(
                      selection.plugins.flatMap(
                          (plugin) =>
                              getPluginTemplateConfig(plugin, selection.sandboxClient).importNames,
                      ),
                  ),
              ].join(", ")} } from "@better-agent/plugins";`
            : "";
    const pluginBlock = renderPluginBlock(selection.plugins, selection.sandboxClient);

    return [
        {
            label: paths.serverLabel,
            path: paths.serverPath,
            content: readTemplateFile("generated/runtime/server.ts", {
                __BASE_URL__: framework === "nuxt" ? "/api/agents" : "/agents",
                __ENV_IMPORT__: envImport,
                __PROVIDER_IMPORTS__: selection.providers
                    .map((provider) => providerConfig[provider].importLine)
                    .join("\n"),
                __PLUGIN_IMPORTS__: pluginImportLine,
                __PROVIDER_SETUPS__: selection.providers
                    .map((provider) => providerConfig[provider].setup)
                    .join("\n\n"),
                __AGENT_DEFINITIONS__: selection.providers
                    .map((provider) =>
                        [
                            `const ${provider} = defineAgent({`,
                            `    name: "${provider}",`,
                            `    model: ${providerConfig[provider].model},`,
                            '    instruction: "You are a concise, practical assistant. Keep answers clear and direct.",',
                            "});",
                        ].join("\n"),
                    )
                    .join("\n\n"),
                __AGENT_LIST__: selection.providers.join(", "),
                __PLUGIN_BLOCK__: pluginBlock,
                __SECRET_ENV__: secretEnv,
            })
                .replaceAll("process.env.", envAccessor)
                .replace(/\n{3,}/g, "\n\n"),
        },
        {
            label: paths.clientLabel,
            path: paths.clientPath,
            content: readTemplateFile("generated/runtime/client.ts", {
                __BASE_URL__: framework === "nuxt" ? "/api/agents" : "/agents",
                __CLIENT_SECRET__: '"your-secret-here"',
            }),
        },
        {
            label: paths.routeLabel,
            path: paths.routePath,
            content: readTemplateFile(
                {
                    nextjs: "generated/routes/nextjs.ts",
                    remix: "generated/routes/remix.ts",
                    sveltekit: "generated/routes/sveltekit.ts",
                    astro: "generated/routes/astro.ts",
                    nuxt: "generated/routes/nuxt.ts",
                    "tanstack-start": "generated/routes/tanstack-start.tsx",
                    solidstart: "generated/routes/solidstart.ts",
                    "react-router": "generated/routes/react-router.tsx",
                }[framework],
            ),
        },
    ] satisfies TargetFile[];
};

export const getFrameworkStarterUiFiles = (
    cwd: string,
    framework: FrameworkId,
    useSrcDir: boolean,
    provider: ProviderId,
    overwriteEntry: boolean,
    mode: InitMode,
) => {
    if (framework === "generic") {
        return [] as TargetFile[];
    }

    const starterRouteMode = mode === "create" ? "root" : "chat";
    const paths = resolveFrameworkPaths(framework, cwd, useSrcDir, starterRouteMode);
    const title = `${frameworkLabel(framework)} Starter Chat`;
    const routePath = starterRouteMode === "root" ? "/" : "/chat";

    switch (framework) {
        case "nextjs":
            return [
                {
                    label: paths.starterPageLabel,
                    path: paths.starterPagePath,
                    content: readTemplateFile("generated/starter-ui/nextjs.tsx", {
                        __PROVIDER__: provider,
                        __FRAMEWORK_TITLE__: title,
                    }),
                    overwrite: overwriteEntry,
                },
            ] satisfies TargetFile[];
        case "remix":
            return [
                {
                    label: paths.starterPageLabel,
                    path: paths.starterPagePath,
                    content: readTemplateFile("generated/starter-ui/remix.tsx", {
                        __PROVIDER__: provider,
                        __FRAMEWORK_TITLE__: title,
                    }),
                    overwrite: overwriteEntry,
                },
            ] satisfies TargetFile[];
        case "sveltekit":
            return [
                {
                    label: paths.starterPageLabel,
                    path: paths.starterPagePath,
                    content: readTemplateFile("generated/starter-ui/sveltekit.svelte", {
                        __PROVIDER__: provider,
                        __FRAMEWORK_TITLE__: title,
                    }),
                    overwrite: overwriteEntry,
                },
            ] satisfies TargetFile[];
        case "astro":
            return [
                {
                    label: paths.starterPageLabel,
                    path: paths.starterPagePath,
                    content: readTemplateFile("generated/starter-ui/astro-page.astro", {
                        __FRAMEWORK_TITLE__: title,
                    }),
                    overwrite: overwriteEntry,
                },
                {
                    label: "src/components/better-agent-chat.tsx",
                    path: path.join(cwd, "src/components/better-agent-chat.tsx"),
                    content: readTemplateFile("generated/starter-ui/astro-component.tsx", {
                        __PROVIDER__: provider,
                        __FRAMEWORK_TITLE__: title,
                    }),
                    overwrite: overwriteEntry,
                },
            ] satisfies TargetFile[];
        case "nuxt":
            return [
                {
                    label: paths.starterPageLabel,
                    path: paths.starterPagePath,
                    content: readTemplateFile("generated/starter-ui/nuxt.vue", {
                        __PROVIDER__: provider,
                        __FRAMEWORK_TITLE__: title,
                    }),
                    overwrite: overwriteEntry,
                },
            ] satisfies TargetFile[];
        case "tanstack-start":
            return [
                {
                    label: paths.starterPageLabel,
                    path: paths.starterPagePath,
                    content: readTemplateFile("generated/starter-ui/tanstack-start.tsx", {
                        __PROVIDER__: provider,
                        __FRAMEWORK_TITLE__: title,
                        __ROUTE_PATH__: routePath,
                    }),
                    overwrite: overwriteEntry,
                },
                ...(starterRouteMode === "chat"
                    ? ([
                          {
                              label: "src/routeTree.gen.ts",
                              path: path.join(cwd, "src/routeTree.gen.ts"),
                              content: [
                                  "/* eslint-disable */",
                                  "// @ts-nocheck",
                                  "",
                                  'import { Route as rootRouteImport } from "./routes/__root";',
                                  'import { Route as AgentsSplatRouteImport } from "./routes/agents/$";',
                                  'import { Route as ChatRouteImport } from "./routes/chat";',
                                  'import { Route as IndexRouteImport } from "./routes/index";',
                                  "",
                                  "const IndexRoute = IndexRouteImport.update({",
                                  '    id: "/",',
                                  '    path: "/",',
                                  "    getParentRoute: () => rootRouteImport,",
                                  "} as never);",
                                  "const ChatRoute = ChatRouteImport.update({",
                                  '    id: "/chat",',
                                  '    path: "/chat",',
                                  "    getParentRoute: () => rootRouteImport,",
                                  "} as never);",
                                  "const AgentsSplatRoute = AgentsSplatRouteImport.update({",
                                  '    id: "/agents/$",',
                                  '    path: "/agents/$",',
                                  "    getParentRoute: () => rootRouteImport,",
                                  "} as never);",
                                  "",
                                  'declare module "@tanstack/react-router" {',
                                  "    interface FileRoutesByPath {",
                                  '        "/": {',
                                  '            id: "/";',
                                  '            path: "/";',
                                  '            fullPath: "/";',
                                  "            preLoaderRoute: typeof IndexRouteImport;",
                                  "            parentRoute: typeof rootRouteImport;",
                                  "        };",
                                  '        "/chat": {',
                                  '            id: "/chat";',
                                  '            path: "/chat";',
                                  '            fullPath: "/chat";',
                                  "            preLoaderRoute: typeof ChatRouteImport;",
                                  "            parentRoute: typeof rootRouteImport;",
                                  "        };",
                                  '        "/agents/$": {',
                                  '            id: "/agents/$";',
                                  '            path: "/agents/$";',
                                  '            fullPath: "/agents/$";',
                                  "            preLoaderRoute: typeof AgentsSplatRouteImport;",
                                  "            parentRoute: typeof rootRouteImport;",
                                  "        };",
                                  "    }",
                                  "}",
                                  "",
                                  "export const routeTree = rootRouteImport._addFileChildren({",
                                  "    IndexRoute,",
                                  "    ChatRoute,",
                                  "    AgentsSplatRoute,",
                                  "});",
                                  "",
                                  'import type { getRouter } from "./router.tsx";',
                                  'declare module "@tanstack/react-start" {',
                                  "    interface Register {",
                                  "        ssr: true;",
                                  "        router: Awaited<ReturnType<typeof getRouter>>;",
                                  "    }",
                                  "}",
                                  "",
                              ].join("\n"),
                              overwrite: true,
                          },
                      ] satisfies TargetFile[])
                    : []),
            ] satisfies TargetFile[];
        case "solidstart":
            return [
                {
                    label: paths.starterPageLabel,
                    path: paths.starterPagePath,
                    content: readTemplateFile("generated/starter-ui/solidstart.tsx", {
                        __PROVIDER__: provider,
                        __FRAMEWORK_TITLE__: title,
                    }),
                    overwrite: overwriteEntry,
                },
            ] satisfies TargetFile[];
        case "react-router":
            return [
                {
                    label: paths.starterPageLabel,
                    path: paths.starterPagePath,
                    content: readTemplateFile("generated/starter-ui/react-router.tsx", {
                        __PROVIDER__: provider,
                        __FRAMEWORK_TITLE__: title,
                    }),
                    overwrite: overwriteEntry,
                },
                ...(starterRouteMode === "chat"
                    ? ([
                          {
                              label: "app/routes.ts",
                              path: path.join(cwd, "app/routes.ts"),
                              content: [
                                  'import { type RouteConfig, index, route } from "@react-router/dev/routes";',
                                  "",
                                  "export default [",
                                  '    index("routes/home.tsx"),',
                                  '    route("chat", "routes/chat.tsx"),',
                                  '    route("agents/*", "routes/agents.$.tsx"),',
                                  "] satisfies RouteConfig;",
                                  "",
                              ].join("\n"),
                              overwrite: true,
                          },
                      ] satisfies TargetFile[])
                    : []),
            ] satisfies TargetFile[];
    }
};
