import type { AnyDefinedAgent } from "../agent/types";
import { bindMemoryStorage } from "../memory";
import type { AgentMemory } from "../memory";
import { type PluginRuntime, createPluginRuntime } from "../plugins";
import type { RuntimeControl } from "../runtime/control";
import { type BetterAgentIdGenerator, defaultGenerateId } from "../runtime/utils";
import type { BetterAgentConfig } from "./types";

export interface AppContext {
    // biome-ignore lint/suspicious/noExplicitAny:
    config: BetterAgentConfig<any>;
    generateId: BetterAgentIdGenerator;
    activeRuntimes: Map<string, RuntimeControl<unknown>>;
    pluginRuntime: PluginRuntime;
    getAgentMemory(agent: AnyDefinedAgent): AgentMemory | undefined;
}

// biome-ignore lint/suspicious/noExplicitAny:
export function createAppContext(config: BetterAgentConfig<any>): AppContext {
    return {
        config,
        generateId: config.advanced?.generateId ?? defaultGenerateId,
        activeRuntimes: new Map<string, RuntimeControl<unknown>>(),
        pluginRuntime: createPluginRuntime(config.plugins),
        getAgentMemory(agent) {
            if (agent.memory === false) {
                return undefined;
            }

            const memory = agent.memory ?? config.memory;
            if (!memory) {
                return undefined;
            }

            return bindMemoryStorage(memory, config.storage);
        },
    };
}
