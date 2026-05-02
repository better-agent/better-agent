import type { Framework } from "./frameworks";
import type { Plugin, Provider } from "./schema";

export interface CreateConfig {
    name?: string;
    framework?: Framework;
    providers?: Provider[];
    plugins?: Plugin[];
    install?: boolean;
}

export type PackageManager = "npm" | "yarn" | "pnpm" | "bun";

export type ProviderTemplateConfig = {
    label: string;
    identifier: string;
    envOptions: {
        envVar: string;
        option: string;
        envExampleValue?: string;
    }[];
    importPath: string;
    factoryName: string;
    modelExpression: string;
};

export type PluginTemplateConfig = {
    importName: string;
    createExpression: string;
    envLines?: string[];
    commentedImport?: string;
    commentedRegistration?: string;
};

export type ServerTemplateData = {
    providerImports: string;
    providerInitializers: string;
    agentDefinitions: string;
    agentNames: string;
    pluginImports: string;
    pluginRegistrations: string;
    commentedPluginRegistrations: string;
    baseUrl: string;
    providerEnvExample: string;
};
