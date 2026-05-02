import { type Framework, getFramework } from "./frameworks";
import { buildPluginTemplateData } from "./plugin-template";
import type { Plugin, Provider } from "./schema";
import type { ProviderTemplateConfig, ServerTemplateData } from "./types";

const providerTemplateConfig: Record<Provider, ProviderTemplateConfig> = {
    openai: {
        label: "OpenAI",
        identifier: "openai",
        envOptions: [{ envVar: "OPENAI_API_KEY", option: "apiKey" }],
        importPath: "@better-agent/openai",
        factoryName: "createOpenAI",
        modelExpression: 'provider("gpt-5.1")',
    },
    anthropic: {
        label: "Anthropic",
        identifier: "anthropic",
        envOptions: [{ envVar: "ANTHROPIC_API_KEY", option: "apiKey" }],
        importPath: "@better-agent/anthropic",
        factoryName: "createAnthropic",
        modelExpression: 'provider("claude-sonnet-4-6")',
    },
    gemini: {
        label: "Gemini",
        identifier: "gemini",
        envOptions: [{ envVar: "GOOGLE_GENERATIVE_AI_API_KEY", option: "apiKey" }],
        importPath: "@better-agent/gemini",
        factoryName: "createGemini",
        modelExpression: 'provider("gemini-2.5-flash")',
    },
    xai: {
        label: "xAI",
        identifier: "xai",
        envOptions: [{ envVar: "XAI_API_KEY", option: "apiKey" }],
        importPath: "@better-agent/xai",
        factoryName: "createXai",
        modelExpression: 'provider("grok-4")',
    },
    ollama: {
        label: "Ollama",
        identifier: "ollama",
        envOptions: [
            {
                envVar: "OLLAMA_BASE_URL",
                option: "baseURL",
                envExampleValue: "http://127.0.0.1:11434",
            },
        ],
        importPath: "@better-agent/ollama",
        factoryName: "createOllama",
        modelExpression: 'provider("llama3.2")',
    },
    openrouter: {
        label: "OpenRouter",
        identifier: "openrouter",
        envOptions: [{ envVar: "OPENROUTER_API_KEY", option: "apiKey" }],
        importPath: "@better-agent/openrouter",
        factoryName: "createOpenRouter",
        modelExpression: 'provider("openai/gpt-5.5")',
    },
    "workers-ai": {
        label: "Workers AI",
        identifier: "workersAI",
        envOptions: [
            {
                envVar: "CLOUDFLARE_ACCOUNT_ID",
                option: "accountId",
                envExampleValue: "your-cloudflare-account-id",
            },
            {
                envVar: "CLOUDFLARE_API_TOKEN",
                option: "apiKey",
                envExampleValue: "your-cloudflare-api-token",
            },
        ],
        importPath: "@better-agent/workers-ai",
        factoryName: "createWorkersAI",
        modelExpression: 'provider("@cf/moonshotai/kimi-k2.5")',
    },
};

export const providerEntries = Object.entries(providerTemplateConfig) as [
    Provider,
    ProviderTemplateConfig,
][];

export const buildServerTemplateData = (
    framework: Framework,
    providers: Provider[],
    plugins: Plugin[],
): ServerTemplateData => {
    const uniqueProviders = [...new Set(providers)];
    const pluginTemplateData = buildPluginTemplateData(framework, plugins);
    const frameworkConfig = getFramework(framework);
    const envAccessor =
        frameworkConfig.envMode === "sveltekit-private"
            ? "env"
            : frameworkConfig.envMode === "astro"
              ? "import.meta.env"
              : "process.env";
    const envImport =
        frameworkConfig.envMode === "sveltekit-private"
            ? 'import { env } from "$env/dynamic/private";'
            : "";

    const providerImports = [
        envImport,
        ...uniqueProviders.map((provider) => {
            const providerConfig = providerTemplateConfig[provider];
            return `import { ${providerConfig.factoryName} } from "${providerConfig.importPath}";`;
        }),
    ]
        .filter(Boolean)
        .join("\n");

    const providerInitializers = uniqueProviders
        .map((provider) => {
            const providerConfig = providerTemplateConfig[provider];
            const envOptions = providerConfig.envOptions
                .map((envOption) => `  ${envOption.option}: ${envAccessor}.${envOption.envVar},`)
                .join("\n");
            return `const ${providerConfig.identifier}Provider = ${providerConfig.factoryName}({
${envOptions}
});`;
        })
        .join("\n\n");

    const agentDefinitions = uniqueProviders
        .map((provider) => {
            const providerConfig = providerTemplateConfig[provider];
            return `const ${providerConfig.identifier} = defineAgent({
  name: "${provider}",
  model: ${providerConfig.modelExpression.replaceAll("provider", `${providerConfig.identifier}Provider`)},
  instruction: "You are helpful agent."
});`;
        })
        .join("\n\n");

    const providerEnvExample = uniqueProviders
        .map((provider) => {
            const providerConfig = providerTemplateConfig[provider];
            return providerConfig.envOptions
                .map((envOption) => {
                    const envValue = envOption.envExampleValue ?? `your-${provider}-api-key`;
                    return `${envOption.envVar}=${envValue}`;
                })
                .join("\n");
        })
        .join("\n");

    const envExample = [providerEnvExample, pluginTemplateData.pluginEnvExample]
        .filter(Boolean)
        .join("\n");

    return {
        providerImports,
        providerInitializers,
        agentDefinitions,
        agentNames: uniqueProviders
            .map((provider) => providerTemplateConfig[provider].identifier)
            .join(", "),
        ...pluginTemplateData,
        baseUrl: frameworkConfig.baseUrl,
        providerEnvExample: envExample,
    };
};
