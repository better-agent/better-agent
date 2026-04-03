import { BetterAgentError } from "@better-agent/shared/errors";
import { resolveToJsonSchema } from "../schema";
import type { ResolvableSchema, ValidatableSchema } from "../schema";
import { AGENT_OUTPUT_JSON_SCHEMA } from "./constants";

type AgentValidationTarget = {
    name?: unknown;
    model?: unknown;
    maxSteps?: number;
    conversationReplay?: {
        omitUnsupportedParts?: boolean;
        prepareInput?: unknown;
    };
    advanced?: {
        clientToolResultTimeoutMs?: number;
        toolApprovalTimeoutMs?: number;
    };
    contextSchema?: ValidatableSchema | undefined;
    outputSchema?: {
        schema: ResolvableSchema;
    };
    [AGENT_OUTPUT_JSON_SCHEMA]?: Record<string, unknown>;
};

const cachePreflightedOutputSchema = (
    agent: AgentValidationTarget,
    schema: Record<string, unknown>,
): void => {
    Object.defineProperty(agent, AGENT_OUTPUT_JSON_SCHEMA, {
        value: schema,
        configurable: true,
        writable: true,
    });
};

const validateOptionalPositiveNumber = (
    value: number | undefined,
    field: string,
    traceAt: string,
    context?: Record<string, unknown>,
) => {
    if (value !== undefined && (!Number.isFinite(value) || value <= 0)) {
        throw BetterAgentError.fromCode(
            "VALIDATION_FAILED",
            `${field} must be a positive number.`,
            {
                context: {
                    [field]: value,
                    ...(context ?? {}),
                },
                trace: [{ at: traceAt }],
            },
        );
    }
};

/**
 * Validates one agent definition and caches any preflighted structured output schema.
 */
export const validateAgentDefinition = <const TAgent extends AgentValidationTarget>(
    agent: TAgent,
): TAgent => {
    if (typeof agent.name !== "string" || agent.name.length === 0) {
        throw BetterAgentError.fromCode(
            "VALIDATION_FAILED",
            "Agent name must be a non-empty string.",
            {
                trace: [{ at: "core.agent.validateAgentDefinition.name" }],
            },
        );
    }

    if (agent.model === undefined || agent.model === null) {
        throw BetterAgentError.fromCode(
            "VALIDATION_FAILED",
            `Agent '${agent.name}' must have a model.`,
            {
                context: { agentName: agent.name },
                trace: [{ at: "core.agent.validateAgentDefinition.model" }],
            },
        );
    }

    validateOptionalPositiveNumber(
        agent.advanced?.clientToolResultTimeoutMs,
        "clientToolResultTimeoutMs",
        "core.agent.validateAgentDefinition.advanced.clientToolResultTimeoutMs",
        { agentName: agent.name },
    );
    validateOptionalPositiveNumber(
        agent.advanced?.toolApprovalTimeoutMs,
        "toolApprovalTimeoutMs",
        "core.agent.validateAgentDefinition.advanced.toolApprovalTimeoutMs",
        { agentName: agent.name },
    );

    if (
        agent.conversationReplay?.omitUnsupportedParts !== undefined &&
        typeof agent.conversationReplay.omitUnsupportedParts !== "boolean"
    ) {
        throw BetterAgentError.fromCode(
            "VALIDATION_FAILED",
            "conversationReplay.omitUnsupportedParts must be a boolean.",
            {
                context: { agentName: agent.name },
                trace: [
                    {
                        at: "core.agent.validateAgentDefinition.conversationReplay.omitUnsupportedParts",
                    },
                ],
            },
        );
    }

    if (
        agent.conversationReplay?.prepareInput !== undefined &&
        typeof agent.conversationReplay.prepareInput !== "function"
    ) {
        throw BetterAgentError.fromCode(
            "VALIDATION_FAILED",
            "conversationReplay.prepareInput must be a function.",
            {
                context: { agentName: agent.name },
                trace: [
                    { at: "core.agent.validateAgentDefinition.conversationReplay.prepareInput" },
                ],
            },
        );
    }

    if (agent.outputSchema !== undefined && agent[AGENT_OUTPUT_JSON_SCHEMA] === undefined) {
        const resolvedSchema = resolveToJsonSchema(agent.outputSchema.schema);
        if (resolvedSchema.isErr()) {
            throw resolvedSchema.error.at({
                at: "core.agent.validateAgentDefinition.outputSchema",
                data: { agentName: agent.name },
            });
        }

        cachePreflightedOutputSchema(agent, resolvedSchema.value);
    }

    const contextStandard = (agent.contextSchema as { "~standard"?: unknown })?.["~standard"];
    const contextJsonSchema =
        contextStandard && typeof contextStandard === "object"
            ? (contextStandard as { jsonSchema?: unknown }).jsonSchema
            : undefined;

    if (
        agent.contextSchema !== undefined &&
        (contextJsonSchema !== undefined || contextStandard === undefined)
    ) {
        const resolvedSchema = resolveToJsonSchema(agent.contextSchema as ResolvableSchema);
        if (resolvedSchema.isErr()) {
            throw resolvedSchema.error.at({
                at: "core.agent.validateAgentDefinition.contextSchema",
                data: { agentName: agent.name },
            });
        }
    }

    return agent;
};

export const getPreflightedOutputSchema = (agent: object): Record<string, unknown> | undefined =>
    (agent as { [AGENT_OUTPUT_JSON_SCHEMA]?: Record<string, unknown> })[AGENT_OUTPUT_JSON_SCHEMA];
