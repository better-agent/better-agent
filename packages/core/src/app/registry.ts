import type { AgentTools, AnyAgentDefinition } from "../agent";
import type { Plugin } from "../plugins";

/**
 * Builds an app registry from config.
 */
export function buildRegistryFromConfig(config: {
    agents: readonly AnyAgentDefinition[];
    tools?: AgentTools<unknown> | undefined;
    plugins?: readonly Plugin[] | undefined;
}): AppRegistry {
    const registry = createAppRegistry();

    for (const agent of config.agents) {
        registerAgent(registry, agent);
    }

    if (config.tools !== undefined) {
        registerTools(registry, config.tools);
    }

    if (config.plugins !== undefined && config.plugins.length > 0) {
        registerPlugins(registry, config.plugins);
    }

    return registry;
}

/**
 * Registry for app components.
 */
export interface AppRegistry {
    /** Agents by name. */
    agents: Map<string, AnyAgentDefinition>;
    /** Shared tools available to all agents. */
    tools: AgentTools<unknown> | undefined;
    /** Registered plugins. */
    plugins: Plugin[];
}

/**
 * Creates an empty app registry.
 */
export function createAppRegistry(): AppRegistry {
    return {
        agents: new Map(),
        tools: undefined,
        plugins: [],
    };
}

/**
 * Registers an agent.
 */
export function registerAgent(registry: AppRegistry, agent: AnyAgentDefinition): void {
    registry.agents.set(agent.name, agent);
}

/**
 * Looks up an agent by name.
 */
export function lookupAgent(registry: AppRegistry, name: string): AnyAgentDefinition | undefined {
    return registry.agents.get(name);
}

/**
 * Registers shared tools.
 */
export function registerTools(registry: AppRegistry, tools: AgentTools<unknown>): void {
    registry.tools = tools;
}

/**
 * Registers a plugin.
 */
export function registerPlugin(registry: AppRegistry, plugin: Plugin): void {
    registry.plugins.push(plugin);
}

/**
 * Registers multiple plugins.
 */
export function registerPlugins(registry: AppRegistry, plugins: readonly Plugin[]): void {
    registry.plugins.push(...plugins);
}
