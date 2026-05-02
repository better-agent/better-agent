import type { Framework } from "./frameworks";
import type { Plugin } from "./schema";
import type { PluginTemplateConfig } from "./types";

const getEnvAccessor = (framework: Framework) =>
    framework === "sveltekit" ? "env" : "process.env";

const pluginTemplateConfig: Record<Plugin, PluginTemplateConfig> = {
    "ip-allowlist": {
        importName: "ipAllowlist",
        createExpression: 'ipAllowlist({ allow: ["127.0.0.1", "::1"], trustProxy: true })',
    },
    logging: {
        importName: "logging",
        createExpression: "logging()",
    },
    "rate-limit": {
        importName: "rateLimit",
        createExpression: "rateLimit({ windowMs: 60_000, max: 30 })",
    },
    sandbox: {
        importName: "sandbox",
        createExpression: "",
        envLines: ["E2B_API_KEY=e2b_***"],
        commentedImport:
            '// import { createE2BSandboxClient, sandbox } from "@better-agent/plugins";',
        commentedRegistration: `// sandbox({
//   client: createE2BSandboxClient({
//     apiKey: __ENV__.E2B_API_KEY,
//   }),
// }),`,
    },
};

export const buildPluginTemplateData = (framework: Framework, plugins: Plugin[]) => {
    const envAccessor = getEnvAccessor(framework);
    const uniquePlugins = [...new Set(plugins)];

    const adjustedConfig: PluginTemplateConfig[] = uniquePlugins.map((plugin) => {
        const config = pluginTemplateConfig[plugin];
        return {
            ...config,
            createExpression: config.createExpression.replaceAll("__ENV__", envAccessor),
            commentedRegistration: config.commentedRegistration?.replaceAll("__ENV__", envAccessor),
        };
    });

    const livePluginImport = adjustedConfig.some((plugin) => plugin.createExpression)
        ? `import { ${adjustedConfig
              .filter((plugin) => plugin.createExpression)
              .map((plugin) => plugin.importName)
              .join(", ")} } from "@better-agent/plugins";`
        : "";

    const pluginRegistrations = adjustedConfig
        .map((plugin) => plugin.createExpression)
        .filter(Boolean)
        .join(", ");

    const commentedPluginImports = adjustedConfig
        .map((plugin) => plugin.commentedImport)
        .filter(Boolean)
        .join("\n");

    const pluginImports = [livePluginImport, commentedPluginImports].filter(Boolean).join("\n");

    const commentedPluginRegistrations = adjustedConfig
        .map((plugin) => plugin.commentedRegistration)
        .filter(Boolean)
        .join("\n");

    return {
        pluginImports,
        pluginRegistrations,
        commentedPluginRegistrations,
        pluginEnvExample: uniquePlugins
            .flatMap((plugin) => pluginTemplateConfig[plugin].envLines ?? [])
            .join("\n"),
    };
};
