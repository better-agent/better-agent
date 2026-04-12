import { BetterAgentError } from "@better-agent/shared/errors";
import type { AnyAgentDefinition } from "../agent";

/** Builds a read-only agent registry. */
export function createAgentRegistry(
    agents: readonly AnyAgentDefinition[],
): ReadonlyMap<string, AnyAgentDefinition> {
    const registry = new Map<string, AnyAgentDefinition>();

    for (const agent of agents) {
        registry.set(agent.name, agent);
    }

    return registry;
}

export function resolveAgentFromRegistry(
    agents: ReadonlyMap<string, AnyAgentDefinition>,
    agentName: string,
    traceAt: string,
): AnyAgentDefinition {
    const resolved = agents.get(agentName);
    if (resolved) {
        return resolved;
    }

    throw BetterAgentError.fromCode("NOT_FOUND", `Agent '${agentName}' does not exist.`, {
        context: { agentName },
        trace: [{ at: traceAt }],
    });
}
