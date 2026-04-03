import { BetterAgentError } from "@better-agent/shared/errors";
import type { DiscoveredApp, TypegenAppReference } from "./types";

const isRecord = (value: unknown): value is Record<PropertyKey, unknown> =>
    value !== null && typeof value === "object";

const hasNamedAgents = (value: unknown) =>
    Array.isArray(value) &&
    value.some(
        (agent) => isRecord(agent) && typeof agent.name === "string" && agent.name.length > 0,
    );

export const normalizeDiscoveredApp = (candidate: DiscoveredApp): TypegenAppReference => {
    if (!hasNamedAgents(candidate.app.config.agents)) {
        throw BetterAgentError.fromCode("VALIDATION_FAILED", "App has no serializable agents.", {
            trace: [{ at: "cli.typegen.normalize.normalizeDiscoveredApp" }],
            stackFrom: normalizeDiscoveredApp,
        });
    }

    return {
        configFile: candidate.configFile,
        exportPath: candidate.exportPath,
        label: candidate.label,
    };
};
