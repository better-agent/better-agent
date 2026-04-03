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
    agent: string | AnyAgentDefinition,
    traceAt: string,
): AnyAgentDefinition {
    const resolved =
        typeof agent === "string" ? agents.get(agent) : (agents.get(agent.name) ?? agent);
    if (resolved) {
        return resolved;
    }

    const agentName = typeof agent === "string" ? agent : agent.name;
    throw BetterAgentError.fromCode("NOT_FOUND", `Agent '${agentName}' does not exist.`, {
        context: { agentName },
        trace: [{ at: traceAt }],
    });
}
