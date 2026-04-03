import { BetterAgentError } from "@better-agent/shared/errors";
import type { AnyBetterAgentConfig } from "./types";

/**
 * Validates app configuration.
 */
export function validateConfig<const TConfig extends AnyBetterAgentConfig>(
    config: TConfig,
): TConfig {
    const validateOptionalPositiveNumber = (value: number | undefined, field: string) => {
        if (value !== undefined && (!Number.isFinite(value) || value <= 0)) {
            throw BetterAgentError.fromCode(
                "VALIDATION_FAILED",
                `${field} must be a positive number.`,
                {
                    context: { [field]: value },
                    trace: [{ at: "core.app.validateConfig" }],
                },
            );
        }
    };

    // Validate required agents field
    if (!config.agents || config.agents.length === 0) {
        throw BetterAgentError.fromCode(
            "VALIDATION_FAILED",
            "App configuration must include at least one agent.",
            {
                trace: [{ at: "core.app.validateConfig" }],
            },
        );
    }

    // Validate app-level agent defaults that only make sense in app assembly.
    for (const agent of config.agents) {
        if (typeof agent.name !== "string" || agent.name.length === 0) {
            throw BetterAgentError.fromCode("VALIDATION_FAILED", "All agents must have a name.", {
                trace: [{ at: "core.app.validateConfig" }],
            });
        }
    }

    // Validate unique agent names
    const seenNames = new Set<string>();
    for (const agent of config.agents) {
        if (seenNames.has(agent.name)) {
            throw BetterAgentError.fromCode(
                "VALIDATION_FAILED",
                `Duplicate agent name '${agent.name}'.`,
                {
                    context: { agentName: agent.name },
                    trace: [{ at: "core.app.validateConfig" }],
                },
            );
        }
        seenNames.add(agent.name);
    }

    // Validate unique plugin ids
    if (config.plugins) {
        const seenPluginIds = new Set<string>();
        for (const plugin of config.plugins) {
            if (seenPluginIds.has(plugin.id)) {
                throw BetterAgentError.fromCode(
                    "VALIDATION_FAILED",
                    `Duplicate plugin id '${plugin.id}' in app config.`,
                    {
                        context: { pluginId: plugin.id },
                        trace: [{ at: "core.app.validateConfig" }],
                    },
                );
            }
            seenPluginIds.add(plugin.id);
        }
    }

    // Normalize optional fields
    validateOptionalPositiveNumber(
        config.advanced?.clientToolResultTimeoutMs,
        "advanced.clientToolResultTimeoutMs",
    );
    validateOptionalPositiveNumber(
        config.advanced?.toolApprovalTimeoutMs,
        "advanced.toolApprovalTimeoutMs",
    );
    validateOptionalPositiveNumber(config.advanced?.sseHeartbeatMs, "advanced.sseHeartbeatMs");

    if (config.advanced?.onRequestDisconnect === "continue" && !config.persistence?.stream) {
        throw BetterAgentError.fromCode(
            "VALIDATION_FAILED",
            "advanced.onRequestDisconnect='continue' requires persistence.stream to be configured.",
            {
                trace: [{ at: "core.app.validateConfig" }],
            },
        );
    }

    return config;
}
