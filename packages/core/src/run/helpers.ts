import { BetterAgentError } from "@better-agent/shared/errors";
import { isPlainRecord, safeJsonParse } from "@better-agent/shared/utils";
import type { AnyAgentDefinition } from "../agent";
import { getPreflightedOutputSchema } from "../agent/validation";
import type { Event } from "../events";
import { createIdGenerator } from "../internal/id";
import type { Awaitable } from "../internal/types";
import type {
    ConversationStore,
    LoadedConversation,
    StreamEvent,
    StreamStore,
} from "../persistence";
import type {
    Capabilities,
    ConversationItem,
    GenerativeModelInput,
    GenerativeModelInputItem,
    GenerativeModelInputMessageContent,
    GenerativeModelOutputMessage,
    Modality,
    OutputSchemaDefinition,
    StructuredOutput,
} from "../providers";
import { resolveToJsonSchema, validateInput } from "../schema";
import {
    normalizeInputToConversationItems,
    normalizeInputToMessages,
    projectConversationItemsToInput,
    pruneInputByCapabilities,
} from "./messages";
import type { OnOutputError, OutputErrorContext, OutputErrorMode } from "./output-errors";
import type { ContextBoundAgent, ConversationReplayOptions, RunOptions, RunResult } from "./types";

const MAX_OUTPUT_REPAIR_DEPTH = 2;
type NonTextInputModality = Exclude<Modality, "text">;

const isJsonSchemaRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value);

const normalizeStructuredOutputJsonSchema = (
    schema: Record<string, unknown>,
): Record<string, unknown> => {
    const normalized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(schema)) {
        if (Array.isArray(value)) {
            normalized[key] = value.map((item) =>
                isJsonSchemaRecord(item) ? normalizeStructuredOutputJsonSchema(item) : item,
            );
            continue;
        }

        normalized[key] = isJsonSchemaRecord(value)
            ? normalizeStructuredOutputJsonSchema(value)
            : value;
    }

    const objectLike =
        normalized.type === "object" ||
        isJsonSchemaRecord(normalized.properties) ||
        Array.isArray(normalized.required);

    if (objectLike && normalized.additionalProperties === undefined) {
        normalized.additionalProperties = false;
    }

    return normalized;
};

/** Creates an emitter that persists stream events. */
export function createStreamPersistenceEmitter(params: {
    stream?: StreamStore;
    streamId: string;
}): ((event: Event) => Promise<void>) | undefined {
    const stream = params.stream;
    if (!stream) {
        return undefined;
    }

    let nextSeq = 0;

    return async (event: Event) => {
        const streamEvent: StreamEvent = {
            ...event,
            seq: nextSeq++,
            timestamp: event.timestamp ?? Date.now(),
        };
        try {
            await stream.append(params.streamId, streamEvent);
        } catch (error) {
            if (error instanceof Error && error.message.includes("not found")) {
                return;
            }
            throw error;
        }
    };
}

/** Converts `onEvent` into an internal emitter. */
export function toEventEmitter(onEvent?: RunOptions["onEvent"]): (event: Event) => Promise<void> {
    if (!onEvent) {
        return async () => {};
    }

    return async (event) => {
        await onEvent(event);
    };
}

/** Validates run context against the agent schema. */
export async function validateAgentContext<TContext>(
    agent: ContextBoundAgent<TContext>,
    context: TContext | undefined,
): Promise<TContext | undefined> {
    if (!agent.contextSchema) {
        return context;
    }

    const validated = await validateInput<TContext>(agent.contextSchema, context, {
        invalidMessage: "The provided data is invalid according to context schema.",
    });
    if (validated.isErr()) {
        throw validated.error.at({ at: "core.run.validateAgentContext" });
    }

    return validated.value;
}

/** Minimal model info for runtime validation. */
type AgentModelInfo = {
    name: string;
    model: {
        modelId: string;
        caps: Capabilities;
    };
};

const throwInvalidStoredConversationItem = (conversationId: string, index: number): never => {
    throw BetterAgentError.fromCode("VALIDATION_FAILED", "Loaded conversation items are invalid.", {
        context: { conversationId, index },
        trace: [{ at: "core.run.validateStoredConversationItems" }],
    });
};

const isConversationPart = (part: unknown): boolean => {
    if (!isPlainRecord(part) || typeof part.type !== "string") {
        return false;
    }

    switch (part.type) {
        case "text":
            return typeof part.text === "string";
        case "reasoning":
            return (
                typeof part.text === "string" &&
                (part.visibility === "summary" || part.visibility === "full") &&
                (part.provider === undefined || typeof part.provider === "string")
            );
        case "transcript":
            return (
                typeof part.text === "string" &&
                (part.segments === undefined ||
                    (Array.isArray(part.segments) &&
                        part.segments.every(
                            (segment) =>
                                isPlainRecord(segment) &&
                                typeof segment.id === "string" &&
                                typeof segment.start === "number" &&
                                typeof segment.end === "number" &&
                                typeof segment.text === "string" &&
                                (segment.speaker === undefined ||
                                    typeof segment.speaker === "string"),
                        )))
            );
        case "image":
        case "audio":
        case "video":
        case "file":
            return isPlainRecord(part.source);
        case "embedding":
            return Array.isArray(part.embedding);
        default:
            return false;
    }
};

export const validateStoredConversationItems = (
    items: ConversationItem[],
    conversationId: string,
): void => {
    for (const [index, item] of items.entries()) {
        if (!isPlainRecord(item) || typeof item.type !== "string") {
            throwInvalidStoredConversationItem(conversationId, index);
        }

        if (item.type === "message") {
            if (
                typeof item.role !== "string" ||
                !(
                    typeof item.content === "string" ||
                    (Array.isArray(item.content) &&
                        item.content.every((part) => isConversationPart(part)))
                )
            ) {
                throwInvalidStoredConversationItem(conversationId, index);
            }
            continue;
        }

        if (item.type === "tool-call") {
            if (
                typeof item.name !== "string" ||
                typeof item.callId !== "string" ||
                (!("result" in item) && typeof item.arguments !== "string")
            ) {
                throwInvalidStoredConversationItem(conversationId, index);
            }
            continue;
        }

        if (
            item.type === "provider-tool-result" &&
            typeof item.name === "string" &&
            typeof item.callId === "string"
        ) {
            continue;
        }

        throwInvalidStoredConversationItem(conversationId, index);
    }
};

const throwUnsupportedInputModality = (params: {
    agent: AgentModelInfo;
    modality: "text" | "image" | "audio" | "video" | "file" | "embedding";
    location: string;
    traceAt: string;
}): never => {
    throw BetterAgentError.fromCode(
        "VALIDATION_FAILED",
        `Agent '${params.agent.name}' model does not accept ${params.modality} input at ${params.location}.`,
        {
            context: {
                agentName: params.agent.name,
                modelId: params.agent.model.modelId,
                modality: params.modality,
                location: params.location,
            },
            trace: [{ at: params.traceAt }],
        },
    );
};

const validateMessageContentCapabilities = (params: {
    agent: AgentModelInfo;
    content: GenerativeModelInputMessageContent;
    itemIndex: number;
    traceAt: string;
}): void => {
    const caps = params.agent.model.caps;

    if (typeof params.content === "string") {
        if (caps.inputModalities?.text === false) {
            throwUnsupportedInputModality({
                agent: params.agent,
                modality: "text",
                location: `input[${params.itemIndex}].content`,
                traceAt: params.traceAt,
            });
        }
        return;
    }

    if (!Array.isArray(params.content)) {
        return;
    }

    for (const [partIndex, part] of params.content.entries()) {
        if (typeof part !== "object" || part === null || !("type" in part)) {
            continue;
        }

        const partType = (part as { type: string }).type;

        if (partType === "text" || partType === "transcript" || partType === "reasoning") {
            if (caps.inputModalities?.text === false) {
                throwUnsupportedInputModality({
                    agent: params.agent,
                    modality: "text",
                    location: `input[${params.itemIndex}].content[${partIndex}]`,
                    traceAt: params.traceAt,
                });
            }
            continue;
        }

        if (
            partType === "image" ||
            partType === "audio" ||
            partType === "video" ||
            partType === "file" ||
            partType === "embedding"
        ) {
            const modality = partType as NonTextInputModality;
            if (caps.inputModalities?.[modality] !== true) {
                throwUnsupportedInputModality({
                    agent: params.agent,
                    modality,
                    location: `input[${params.itemIndex}].content[${partIndex}]`,
                    traceAt: params.traceAt,
                });
            }
        }
    }
};

const isReplayInputPart = (part: unknown): boolean => {
    if (!isPlainRecord(part) || typeof part.type !== "string") {
        return false;
    }

    switch (part.type) {
        case "text":
            return typeof part.text === "string";
        case "reasoning":
            return (
                typeof part.text === "string" &&
                (part.visibility === "summary" || part.visibility === "full") &&
                (part.provider === undefined || typeof part.provider === "string")
            );
        case "transcript":
            return (
                typeof part.text === "string" &&
                (part.segments === undefined ||
                    (Array.isArray(part.segments) &&
                        part.segments.every(
                            (segment) =>
                                isPlainRecord(segment) &&
                                typeof segment.id === "string" &&
                                typeof segment.start === "number" &&
                                typeof segment.end === "number" &&
                                typeof segment.text === "string" &&
                                (segment.speaker === undefined ||
                                    typeof segment.speaker === "string"),
                        )))
            );
        case "image":
        case "audio":
        case "video":
        case "file":
            return isPlainRecord(part.source);
        case "embedding":
            return (
                Array.isArray(part.embedding) &&
                part.embedding.every((value) => typeof value === "number")
            );
        default:
            return false;
    }
};

const isReplayInputItem = (item: unknown): item is GenerativeModelInputItem => {
    if (!isPlainRecord(item) || typeof item.type !== "string") {
        return false;
    }

    if (item.type === "message") {
        if (item.role !== undefined && typeof item.role !== "string") {
            return false;
        }

        if (typeof item.content === "string") {
            return true;
        }

        return Array.isArray(item.content) && item.content.every(isReplayInputPart);
    }

    if (item.type === "tool-call") {
        return typeof item.name === "string" && typeof item.callId === "string" && "result" in item;
    }

    return (
        item.type === "provider-tool-result" &&
        typeof item.name === "string" &&
        typeof item.callId === "string" &&
        "result" in item
    );
};

const validatePreparedReplayInput = (params: {
    input: unknown;
    caps: Capabilities;
    agentName: string;
    conversationId: string;
}): GenerativeModelInputItem[] => {
    if (!Array.isArray(params.input) || !params.input.every(isReplayInputItem)) {
        throw BetterAgentError.fromCode(
            "VALIDATION_FAILED",
            "conversationReplay.prepareInput must return a valid array of model input items.",
            {
                context: {
                    agentName: params.agentName,
                    conversationId: params.conversationId,
                },
                trace: [{ at: "core.run.prepareConversationReplayInput.validatePreparedInput" }],
            },
        );
    }

    for (const item of params.input) {
        if (item.type !== "message") {
            continue;
        }

        if (params.caps.inputShape === "prompt") {
            if ("role" in item && item.role !== undefined) {
                throw BetterAgentError.fromCode(
                    "VALIDATION_FAILED",
                    "conversationReplay.prepareInput returned a role-bearing message for a prompt-shaped model.",
                    {
                        context: {
                            agentName: params.agentName,
                            conversationId: params.conversationId,
                        },
                        trace: [
                            {
                                at: "core.run.prepareConversationReplayInput.validatePreparedInput.promptRole",
                            },
                        ],
                    },
                );
            }
            continue;
        }

        if (!("role" in item) || typeof item.role !== "string") {
            throw BetterAgentError.fromCode(
                "VALIDATION_FAILED",
                "conversationReplay.prepareInput returned a role-less message for a chat-shaped model.",
                {
                    context: {
                        agentName: params.agentName,
                        conversationId: params.conversationId,
                    },
                    trace: [
                        {
                            at: "core.run.prepareConversationReplayInput.validatePreparedInput.chatRole",
                        },
                    ],
                },
            );
        }
    }

    return params.input;
};

/**
 * Validates that run input only uses modalities supported by the target model.
 */
export function validateRunInputCapabilities(params: {
    agent: AgentModelInfo;
    input: GenerativeModelInput;
    traceAt: string;
}): void {
    const caps = params.agent.model.caps;

    if (typeof params.input === "string") {
        if (caps.inputModalities?.text === false) {
            throwUnsupportedInputModality({
                agent: params.agent,
                modality: "text",
                location: "input",
                traceAt: params.traceAt,
            });
        }
        return;
    }

    for (const [itemIndex, item] of params.input.entries()) {
        if (item.type !== "message") {
            continue;
        }

        validateMessageContentCapabilities({
            agent: params.agent,
            content: item.content,
            itemIndex,
            traceAt: params.traceAt,
        });
    }
}

/**
 * Validates requested output modalities against the target model's capabilities.
 */
export function validateRunModalities(params: {
    agent: AgentModelInfo;
    modalities: readonly Modality[] | undefined;
    output: OutputSchemaDefinition | undefined;
    traceAt: string;
}): void {
    if (!params.modalities || params.modalities.length === 0) {
        return;
    }

    const caps = params.agent.model.caps;

    for (const modality of params.modalities) {
        if (caps.outputModalities?.[modality] !== undefined) {
            continue;
        }

        throw BetterAgentError.fromCode(
            "VALIDATION_FAILED",
            `Agent '${params.agent.name}' model does not support ${modality} output.`,
            {
                context: {
                    agentName: params.agent.name,
                    modelId: params.agent.model.modelId,
                    modality,
                },
                trace: [{ at: params.traceAt }],
            },
        );
    }

    if (params.output !== undefined && !params.modalities.includes("text")) {
        throw BetterAgentError.fromCode(
            "VALIDATION_FAILED",
            `Structured output requires text output for agent '${params.agent.name}'.`,
            {
                context: {
                    agentName: params.agent.name,
                    modelId: params.agent.model.modelId,
                    modalities: [...params.modalities],
                },
                trace: [{ at: params.traceAt }],
            },
        );
    }
}

/**
 * Prepares replayable model input from durable conversation items for a run.
 *
 * Stored history is projected losslessly first. The run can then override that
 * projection with `prepareInput`, or fall back to capability-based pruning.
 */
export function prepareConversationReplayInput(params: {
    items: ConversationItem[];
    caps: Capabilities;
    agentName: string;
    conversationId: string;
    conversationReplay?: ConversationReplayOptions;
}): Awaitable<GenerativeModelInputItem[]> {
    const projected = projectConversationItemsToInput(params.items, params.caps);
    const replay = params.conversationReplay;

    if (typeof replay?.prepareInput === "function") {
        return Promise.resolve(
            replay.prepareInput({
                items: params.items,
                caps: params.caps,
                agentName: params.agentName,
                conversationId: params.conversationId,
            }),
        ).then((input) =>
            validatePreparedReplayInput({
                input,
                caps: params.caps,
                agentName: params.agentName,
                conversationId: params.conversationId,
            }),
        );
    }

    if (replay?.omitUnsupportedParts === false) {
        return projected;
    }

    return pruneInputByCapabilities(projected, params.caps);
}

/**
 * Converts a public output schema definition into a provider request.
 */
export function toStructuredOutputRequest(
    agent: Pick<AnyAgentDefinition, "model" | "name" | "outputSchema">,
    output: OutputSchemaDefinition | undefined,
): StructuredOutput | undefined {
    if (output === undefined) {
        return undefined;
    }

    const modelCaps = agent.model.caps;
    if (!modelCaps.structured_output) {
        throw BetterAgentError.fromCode(
            "NOT_IMPLEMENTED",
            `Model '${agent.model.modelId}' does not support structured output.`,
            {
                context: {
                    agentName: agent.name,
                    modelId: agent.model.modelId,
                },
                trace: [{ at: "core.run.toStructuredOutputRequest.capability" }],
            },
        );
    }

    const preflightedSchema =
        output === agent.outputSchema ? getPreflightedOutputSchema(agent) : undefined;
    if (preflightedSchema !== undefined) {
        return {
            name: output.name ?? `${agent.name}_output`,
            schema: normalizeStructuredOutputJsonSchema(preflightedSchema),
            strict: output.strict,
        };
    }

    const runtimeResolvedSchema = resolveToJsonSchema(output.schema as never);
    if (runtimeResolvedSchema.isErr()) {
        throw runtimeResolvedSchema.error.at({
            at: "core.run.toStructuredOutputRequest.resolveSchema",
        });
    }

    return {
        name: output.name ?? `${agent.name}_output`,
        schema: normalizeStructuredOutputJsonSchema(runtimeResolvedSchema.value),
        strict: output.strict,
    };
}

/**
 * Parses and validates structured output from a provider response.
 *
 * Structured output currently requires text output.
 */
export async function finalizeRunResult(
    result: RunResult & { items: ConversationItem[] },
    output: OutputSchemaDefinition | undefined,
    options?: {
        outputErrorMode?: OutputErrorMode;
        onOutputError?: OnOutputError;
    },
): Promise<RunResult & { items: ConversationItem[] }> {
    if (output === undefined) {
        return result;
    }

    const outputMessages = result.response.output.filter(
        (item): item is GenerativeModelOutputMessage => item.type === "message",
    );
    const resolvedOutputErrorMode = options?.outputErrorMode ?? "throw";

    const getLastStructuredText = () =>
        outputMessages
            .map((message) =>
                typeof message.content === "string"
                    ? message.content
                    : message.content
                          .filter(
                              (
                                  part,
                              ): part is Extract<
                                  (typeof message.content)[number],
                                  { type: "text" }
                              > => part.type === "text",
                          )
                          .map((part) => part.text)
                          .join(""),
            )
            .filter((text) => text.trim().length > 0)
            .at(-1);

    const defaultOutputErrorBehavior = (error: unknown): never => {
        throw error;
    };

    const validateStructuredValue = async (
        value: unknown,
        text: string,
        repairDepth: number,
    ): Promise<unknown> => {
        const validated = await validateInput(output.schema, value);
        if (validated.isErr()) {
            return await resolveOutputError(
                {
                    errorKind: "validation",
                    error: validated.error.at({ at: "core.run.finalizeRunResult.validateSchema" }),
                    text,
                    value,
                },
                repairDepth,
            );
        }

        return validated.value;
    };

    const parseStructuredText = async (text: string, repairDepth: number): Promise<unknown> => {
        const parsed = safeJsonParse(text);
        if (parsed.isErr()) {
            return await resolveOutputError(
                {
                    errorKind: "parse",
                    error: BetterAgentError.wrap({
                        err: parsed.error,
                        message:
                            "Structured output was requested, but the model returned invalid JSON.",
                        opts: {
                            code: "VALIDATION_FAILED",
                            context: {
                                preview: text.slice(0, 200),
                            },
                            trace: [{ at: "core.run.finalizeRunResult.parseJson" }],
                        },
                    }),
                    text,
                },
                repairDepth,
            );
        }

        return await validateStructuredValue(parsed.value, text, repairDepth);
    };

    const resolveOutputError = async (
        context: OutputErrorContext,
        repairDepth: number,
    ): Promise<unknown> => {
        if (resolvedOutputErrorMode === "throw" || repairDepth >= MAX_OUTPUT_REPAIR_DEPTH) {
            return defaultOutputErrorBehavior(context.error);
        }

        const action = await options?.onOutputError?.(context);

        switch (action?.action) {
            case "repair_text":
                return await parseStructuredText(action.text, repairDepth + 1);
            case "repair_value":
                return await validateStructuredValue(
                    action.value,
                    "text" in context ? context.text : "",
                    repairDepth + 1,
                );
            case "throw":
                throw context.error;
            default:
                return defaultOutputErrorBehavior(context.error);
        }
    };

    const lastText = getLastStructuredText();
    if (!lastText) {
        const missingTextError = BetterAgentError.fromCode(
            "VALIDATION_FAILED",
            "Structured output was requested, but the model did not return JSON text.",
            {
                trace: [{ at: "core.run.finalizeRunResult.noStructuredText" }],
            },
        );

        const structured = await resolveOutputError(
            {
                errorKind: "missing_text",
                error: missingTextError,
            },
            0,
        );

        return {
            ...result,
            structured,
        };
    }

    const structured = await parseStructuredText(lastText, 0);

    return {
        ...result,
        structured,
    };
}

/**
 * Shared id generator for runs and messages.
 */
export const generateId = createIdGenerator({
    prefixes: {
        run: "run",
        message: "msg",
    },
});

/**
 * Loads persisted conversation history and returns:
 * - `input`: the model-facing input for this run
 * - `items`: the durable conversation state to mutate and save
 * - `loaded`: the original persisted record for save concurrency
 * - `replayStartIndex`: where the current run's replay window starts in `items`
 *
 * `replayStartIndex` is `loaded.items.length` when older history should be kept in
 * durable state but excluded from per-step replay, otherwise it is `0`.
 */
export async function loadConversationMessages(params: {
    conversations?: ConversationStore;
    conversationId?: string;
    agentName?: string;
    input: GenerativeModelInput;
    caps?: Capabilities;
    replaceHistory?: boolean;
    conversationReplay?: ConversationReplayOptions;
}): Promise<{
    input: GenerativeModelInput;
    items: ConversationItem[];
    replayStartIndex: number;
    conversationReplayActive: boolean;
    loaded?: LoadedConversation;
}> {
    const inputItems = normalizeInputToMessages(
        params.input,
        params.caps ?? { inputShape: "chat" },
    );
    const durableInputItems = normalizeInputToConversationItems(
        params.input,
        params.caps ?? { inputShape: "chat" },
    );

    if (!params.conversations || params.conversationId === undefined) {
        return {
            input: params.input,
            items: durableInputItems,
            replayStartIndex: 0,
            conversationReplayActive: false,
        };
    }

    if (!params.agentName) {
        throw BetterAgentError.fromCode(
            "INTERNAL",
            "agentName is required when loading conversation messages.",
            {
                context: { conversationId: params.conversationId },
                trace: [{ at: "core.run.loadConversationMessages.missingAgentName" }],
            },
        );
    }

    const loaded = await params.conversations.load({
        conversationId: params.conversationId,
        agentName: params.agentName,
    });
    if (!loaded) {
        return {
            input: params.input,
            items: durableInputItems,
            replayStartIndex: 0,
            conversationReplayActive: false,
        };
    }

    validateStoredConversationItems(loaded.items, params.conversationId);

    if (params.replaceHistory) {
        return {
            input: params.input,
            items: durableInputItems,
            replayStartIndex: 0,
            conversationReplayActive: false,
            loaded,
        };
    }

    const caps = params.caps ?? { inputShape: "chat" };
    const replayMode =
        caps.replayMode ?? (caps.inputShape === "prompt" ? "single_turn_persistent" : "multi_turn");

    if (replayMode !== "multi_turn") {
        return {
            input: params.input,
            items: [...loaded.items, ...durableInputItems],
            replayStartIndex: loaded.items.length,
            conversationReplayActive: false,
            loaded,
        };
    }

    const loadedMessages = await prepareConversationReplayInput({
        items: loaded.items,
        caps,
        agentName: params.agentName,
        conversationId: params.conversationId,
        conversationReplay: params.conversationReplay,
    });

    return {
        input: [...loadedMessages, ...inputItems],
        items: [...loaded.items, ...durableInputItems],
        replayStartIndex: 0,
        conversationReplayActive: true,
        loaded,
    };
}

/**
 * Saves durable conversation items after a run completes.
 */
export async function saveConversationMessages(params: {
    conversations?: ConversationStore;
    conversationId?: string;
    agentName?: string;
    result: RunResult & { items: ConversationItem[] };
    loaded?: LoadedConversation;
}): Promise<void> {
    if (!params.conversations || params.conversationId === undefined) {
        return;
    }

    if (!params.agentName) {
        throw BetterAgentError.fromCode(
            "INTERNAL",
            "agentName is required when saving conversation messages.",
            {
                context: { conversationId: params.conversationId },
                trace: [{ at: "core.run.saveConversationMessages.missingAgentName" }],
            },
        );
    }

    try {
        validateStoredConversationItems(params.result.items, params.conversationId);
        await params.conversations.save({
            conversationId: params.conversationId,
            agentName: params.agentName,
            items: params.result.items,
            ...(params.loaded?.cursor !== undefined
                ? { expectedCursor: params.loaded.cursor }
                : {}),
        });
    } catch (error) {
        throw BetterAgentError.wrap({
            err: error,
            message: "Failed to save conversation messages.",
            opts: {
                code:
                    error instanceof BetterAgentError && error.code !== undefined
                        ? error.code
                        : typeof (error as { code?: unknown })?.code === "string"
                          ? ((error as { code: string }).code as BetterAgentError["code"])
                          : "INTERNAL",
                ...(typeof (error as { status?: unknown })?.status === "number"
                    ? { status: (error as { status: number }).status }
                    : {}),
                context: {
                    conversationId: params.conversationId,
                    agentName: params.agentName,
                },
                trace: [{ at: "core.run.saveConversationMessages" }],
            },
        });
    }
}
