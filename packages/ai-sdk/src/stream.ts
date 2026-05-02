import {
    type AgentAssistantMessage,
    type AgentEvent,
    type AgentMessageContent,
    type AgentModelGenerateResult,
    type AgentModelStreamResult,
    type AgentReasoningMessage,
    type AgentRunContext,
    type AgentSource,
    EventType,
} from "@better-agent/core";
import type { streamText } from "ai";
import { wrapAiSdkError } from "./errors";
import { type AiSdkGeneratedFile, filesToContentParts } from "./files";
import { toBetterAgentFinishReason, toBetterAgentUsage } from "./results";

type AiSdkStreamTextResult = ReturnType<typeof streamText>;

interface StreamState {
    text: string;
    started: boolean;
    finished: boolean;
    reasoningStarted: boolean;
    reasoningFinished: boolean;
    reasoningMessageId?: string;
    reasoningText: string;
    toolCalls: Map<
        string,
        {
            id: string;
            name?: string;
            argsText: string;
            providerExecuted?: boolean;
        }
    >;
    files: AiSdkGeneratedFile[];
    sources: AgentSource[];
    finishReason?: AgentModelGenerateResult["finishReason"];
    usage?: AgentModelGenerateResult["usage"];
}

const createTextStartEvent = (messageId: string): AgentEvent => ({
    type: EventType.TEXT_MESSAGE_START,
    timestamp: Date.now(),
    messageId,
    role: "assistant",
});

const createTextContentEvent = (messageId: string, delta: string): AgentEvent => ({
    type: EventType.TEXT_MESSAGE_CONTENT,
    timestamp: Date.now(),
    messageId,
    delta,
});

const createTextEndEvent = (messageId: string): AgentEvent => ({
    type: EventType.TEXT_MESSAGE_END,
    timestamp: Date.now(),
    messageId,
});

const createSourceEvent = (input: {
    messageId: string;
    source: AgentSource;
}): AgentEvent => ({
    type: EventType.CUSTOM,
    timestamp: Date.now(),
    name: "source",
    value: {
        messageId: input.messageId,
        source: input.source,
    },
});

const createReasoningStartEvent = (messageId: string): AgentEvent => ({
    type: EventType.REASONING_START,
    timestamp: Date.now(),
    messageId,
});

const createReasoningMessageStartEvent = (messageId: string): AgentEvent => ({
    type: EventType.REASONING_MESSAGE_START,
    timestamp: Date.now(),
    messageId,
    role: "reasoning",
});

const createReasoningMessageContentEvent = (messageId: string, delta: string): AgentEvent => ({
    type: EventType.REASONING_MESSAGE_CONTENT,
    timestamp: Date.now(),
    messageId,
    delta,
});

const createReasoningMessageEndEvent = (messageId: string): AgentEvent => ({
    type: EventType.REASONING_MESSAGE_END,
    timestamp: Date.now(),
    messageId,
});

const createReasoningEndEvent = (messageId: string): AgentEvent => ({
    type: EventType.REASONING_END,
    timestamp: Date.now(),
    messageId,
});

const createToolCallStartEvent = (input: {
    toolCallId: string;
    toolCallName: string;
    parentMessageId: string;
    providerExecuted?: boolean;
}): AgentEvent => ({
    type: EventType.TOOL_CALL_START,
    timestamp: Date.now(),
    toolCallId: input.toolCallId,
    toolCallName: input.toolCallName,
    parentMessageId: input.parentMessageId,
    ...(input.providerExecuted !== undefined ? { providerExecuted: input.providerExecuted } : {}),
});

const createToolCallArgsEvent = (toolCallId: string, delta: string): AgentEvent => ({
    type: EventType.TOOL_CALL_ARGS,
    timestamp: Date.now(),
    toolCallId,
    delta,
});

const createToolCallEndEvent = (input: {
    toolCallId: string;
    providerExecuted?: boolean;
}): AgentEvent => ({
    type: EventType.TOOL_CALL_END,
    timestamp: Date.now(),
    toolCallId: input.toolCallId,
    ...(input.providerExecuted !== undefined ? { providerExecuted: input.providerExecuted } : {}),
});

const createToolCallResultEvent = (input: {
    messageId: string;
    toolCallId: string;
    content: string;
    status: "success" | "error";
    providerExecuted?: boolean;
}): AgentEvent => ({
    type: EventType.TOOL_CALL_RESULT,
    timestamp: Date.now(),
    messageId: input.messageId,
    toolCallId: input.toolCallId,
    content: input.content,
    role: "tool",
    status: input.status,
    ...(input.providerExecuted !== undefined ? { providerExecuted: input.providerExecuted } : {}),
});

function toToolResultContent(content: unknown): string {
    if (typeof content === "string") {
        return content;
    }

    if (typeof content === "undefined") {
        return "null";
    }

    return JSON.stringify(content);
}

const getToolCalls = (state: StreamState): AgentAssistantMessage["toolCalls"] => {
    const toolCalls = Array.from(state.toolCalls.values()).flatMap((toolCall) => {
        if (!toolCall.name) {
            return [];
        }

        return [
            {
                id: toolCall.id,
                type: "function" as const,
                function: {
                    name: toolCall.name,
                    arguments: toolCall.argsText || "{}",
                },
                ...(toolCall.providerExecuted ? { providerExecuted: true } : {}),
            },
        ];
    });

    return toolCalls.length > 0 ? toolCalls : undefined;
};

function finalMessageContent(state: StreamState): AgentMessageContent {
    const fileParts = filesToContentParts(state.files);
    if (fileParts.length === 0) {
        return state.text;
    }

    return [...(state.text ? [{ type: "text" as const, text: state.text }] : []), ...fileParts];
}

function getReasoningMessageId(
    parentMessageId: string,
    state: StreamState,
    context?: Pick<AgentRunContext, "generateId">,
): string {
    if (state.reasoningMessageId) {
        return state.reasoningMessageId;
    }

    const reasoningMessageId =
        context?.generateId("message", {
            role: "reasoning",
            parentMessageId,
        }) ?? `${parentMessageId}_reasoning`;

    state.reasoningMessageId = reasoningMessageId;
    return reasoningMessageId;
}

const createFinalResult = (
    messageId: string,
    state: StreamState,
    structured: unknown,
    context?: Pick<AgentRunContext, "generateId">,
): AgentModelGenerateResult => ({
    messages: [
        ...(state.reasoningText
            ? [
                  {
                      id: getReasoningMessageId(messageId, state, context),
                      role: "reasoning",
                      content: state.reasoningText,
                  } satisfies AgentReasoningMessage,
              ]
            : []),
        {
            id: messageId,
            role: "assistant",
            content: finalMessageContent(state),
            ...(getToolCalls(state) ? { toolCalls: getToolCalls(state) } : {}),
            ...(state.sources.length > 0 ? { sources: state.sources } : {}),
        } satisfies AgentAssistantMessage,
    ],
    structured,
    finishReason: state.finishReason,
    usage: state.usage,
});

function* startReasoningIfNeeded(
    messageId: string,
    state: StreamState,
    context?: Pick<AgentRunContext, "generateId">,
): Iterable<AgentEvent> {
    if (state.reasoningStarted) {
        return;
    }

    state.reasoningStarted = true;
    getReasoningMessageId(messageId, state, context);
    yield createReasoningStartEvent(messageId);
    yield createReasoningMessageStartEvent(messageId);
}

function* finishReasoningIfNeeded(
    messageId: string,
    state: StreamState,
    context?: Pick<AgentRunContext, "generateId">,
): Iterable<AgentEvent> {
    if (!state.reasoningStarted || state.reasoningFinished) {
        return;
    }

    state.reasoningFinished = true;
    getReasoningMessageId(messageId, state, context);
    yield createReasoningMessageEndEvent(messageId);
    yield createReasoningEndEvent(messageId);
}

async function* streamEvents(
    result: AiSdkStreamTextResult,
    messageId: string,
    state: StreamState,
    context?: Pick<AgentRunContext, "generateId">,
): AsyncIterable<AgentEvent> {
    for await (const part of result.fullStream) {
        switch (part.type) {
            case "text-start":
                if (!state.started) {
                    state.started = true;
                    yield createTextStartEvent(messageId);
                }
                break;

            case "text-delta":
                if (!state.started) {
                    state.started = true;
                    yield createTextStartEvent(messageId);
                }

                state.text += part.text;
                yield createTextContentEvent(messageId, part.text);
                break;

            case "text-end":
                if (state.started && !state.finished) {
                    state.finished = true;
                    yield createTextEndEvent(messageId);
                }
                break;

            case "reasoning-start":
                yield* startReasoningIfNeeded(messageId, state, context);
                break;

            case "reasoning-delta":
                yield* startReasoningIfNeeded(messageId, state, context);
                state.reasoningText += part.text;
                yield createReasoningMessageContentEvent(messageId, part.text);
                break;

            case "reasoning-end":
                yield* finishReasoningIfNeeded(messageId, state, context);
                break;

            case "source":
                if (part.sourceType === "url") {
                    const source: AgentSource = {
                        id: part.id,
                        sourceType: "url",
                        url: part.url,
                        ...(part.title ? { title: part.title } : {}),
                        ...(part.providerMetadata !== undefined
                            ? { providerMetadata: part.providerMetadata }
                            : {}),
                    };
                    state.sources.push(source);
                    yield createSourceEvent({
                        messageId,
                        source,
                    });
                }
                break;

            case "file":
                state.files.push({
                    ...part.file,
                    providerMetadata: part.providerMetadata,
                } as AiSdkGeneratedFile);
                break;

            case "tool-input-start":
                state.toolCalls.set(part.id, {
                    id: part.id,
                    name: part.toolName,
                    argsText: "",
                    providerExecuted: part.providerExecuted,
                });
                if (part.providerExecuted) {
                    break;
                }
                yield createToolCallStartEvent({
                    toolCallId: part.id,
                    toolCallName: part.toolName,
                    parentMessageId: messageId,
                    providerExecuted: part.providerExecuted,
                });
                break;

            case "tool-input-delta": {
                const current = state.toolCalls.get(part.id) ?? {
                    id: part.id,
                    argsText: "",
                };

                current.argsText += part.delta;
                state.toolCalls.set(part.id, current);
                if (current.providerExecuted) {
                    break;
                }
                yield createToolCallArgsEvent(part.id, part.delta);
                break;
            }

            case "tool-input-end":
                if (state.toolCalls.get(part.id)?.providerExecuted) {
                    break;
                }
                yield createToolCallEndEvent({
                    toolCallId: part.id,
                    providerExecuted: state.toolCalls.get(part.id)?.providerExecuted,
                });
                break;

            case "tool-call": {
                const current = state.toolCalls.get(part.toolCallId) ?? {
                    id: part.toolCallId,
                    argsText: "",
                };
                const argsText = current.argsText || JSON.stringify(part.input ?? {});
                const toolName = part.toolName;

                state.toolCalls.set(part.toolCallId, {
                    ...current,
                    name: toolName,
                    argsText,
                    providerExecuted: part.providerExecuted,
                });

                if (toolName) {
                    yield createToolCallStartEvent({
                        toolCallId: part.toolCallId,
                        toolCallName: toolName,
                        parentMessageId: messageId,
                        providerExecuted: part.providerExecuted,
                    });
                    yield createToolCallArgsEvent(part.toolCallId, argsText);
                    yield createToolCallEndEvent({
                        toolCallId: part.toolCallId,
                        providerExecuted: part.providerExecuted,
                    });
                }
                break;
            }

            case "tool-result":
                yield createToolCallResultEvent({
                    messageId:
                        context?.generateId("toolResult", {
                            toolCallId: part.toolCallId,
                            role: "tool",
                        }) ?? `tool_${part.toolCallId}`,
                    toolCallId: part.toolCallId,
                    content: toToolResultContent(part.output),
                    status: "success",
                    providerExecuted: part.providerExecuted,
                });
                break;

            case "tool-error":
                yield createToolCallResultEvent({
                    messageId:
                        context?.generateId("toolResult", {
                            toolCallId: part.toolCallId,
                            role: "tool",
                        }) ?? `tool_${part.toolCallId}`,
                    toolCallId: part.toolCallId,
                    content: toToolResultContent(part.error),
                    status: "error",
                    providerExecuted: part.providerExecuted,
                });
                break;

            case "finish":
                state.finishReason = toBetterAgentFinishReason(part.finishReason);
                state.usage = toBetterAgentUsage(part.totalUsage);
                break;

            case "error":
                throw wrapAiSdkError(part.error);

            default:
                break;
        }
    }

    if (state.started && !state.finished) {
        state.finished = true;
        yield createTextEndEvent(messageId);
    }

    yield* finishReasoningIfNeeded(messageId, state, context);
}

export const toBetterAgentStreamResult = (
    result: AiSdkStreamTextResult,
    messageId: string,
    contextOrHasStructured?: Pick<AgentRunContext, "generateId"> | boolean,
    hasStructuredOutput = false,
): AgentModelStreamResult => {
    const context =
        typeof contextOrHasStructured === "boolean" ? undefined : contextOrHasStructured;
    const shouldReadStructured =
        typeof contextOrHasStructured === "boolean" ? contextOrHasStructured : hasStructuredOutput;
    const state: StreamState = {
        text: "",
        started: false,
        finished: false,
        reasoningStarted: false,
        reasoningFinished: false,
        reasoningText: "",
        toolCalls: new Map(),
        files: [],
        sources: [],
    };

    let resolveFinal!: (value: AgentModelGenerateResult) => void;
    let rejectFinal!: (error: unknown) => void;

    const final = new Promise<AgentModelGenerateResult>((resolve, reject) => {
        resolveFinal = resolve;
        rejectFinal = reject;
    });

    async function* events(): AsyncIterable<AgentEvent> {
        try {
            yield* streamEvents(result, messageId, state, context);
            const structured =
                shouldReadStructured && "output" in result ? await result.output : undefined;
            resolveFinal(createFinalResult(messageId, state, structured, context));
        } catch (error) {
            rejectFinal(error);
            throw error;
        }
    }

    return {
        events: events(),
        final,
    };
};
