import { type AgentEvent, EventType } from "@better-agent/core";
import type { UIMessage, UIMessagePart } from "../types";
import { fromAgentMessages } from "./convert";
import { toMessageRole } from "./helpers";

export interface UIReducerState {
    messages: UIMessage[];
}

const updateMessage = (
    messages: UIMessage[],
    messageId: string,
    update: (message: UIMessage) => UIMessage,
): UIMessage[] => {
    return messages.map((message) => (message.id === messageId ? update(message) : message));
};

const upsertMessage = (
    messages: UIMessage[],
    message: UIMessage,
    update: (message: UIMessage) => UIMessage,
): UIMessage[] => {
    return messages.some((current) => current.id === message.id)
        ? updateMessage(messages, message.id, update)
        : [...messages, update(message)];
};

const updateToolPart = (
    messages: UIMessage[],
    toolCallId: string,
    update: (
        part: Extract<UIMessagePart, { type: "tool-call" }>,
    ) => Extract<UIMessagePart, { type: "tool-call" }>,
): UIMessage[] => {
    return messages.map((message) => ({
        ...message,
        parts: message.parts.map((part) =>
            part.type === "tool-call" && part.toolCallId === toolCallId ? update(part) : part,
        ),
    }));
};

const upsertToolResultPartByToolCallId = (
    messages: UIMessage[],
    toolCallId: string,
    update: (
        part: Extract<UIMessagePart, { type: "tool-result" }>,
    ) => Extract<UIMessagePart, { type: "tool-result" }>,
): UIMessage[] => {
    return messages.map((message) => {
        const existingResultIndex = message.parts.findIndex(
            (part) => part.type === "tool-result" && part.toolCallId === toolCallId,
        );

        if (existingResultIndex !== -1) {
            return {
                ...message,
                parts: message.parts.map((part, index) =>
                    index === existingResultIndex && part.type === "tool-result"
                        ? update(part)
                        : part,
                ),
            };
        }

        const toolCallIndex = message.parts.findIndex(
            (part) => part.type === "tool-call" && part.toolCallId === toolCallId,
        );

        if (toolCallIndex === -1) {
            return message;
        }

        const parts = [...message.parts];
        parts.splice(
            toolCallIndex + 1,
            0,
            update({
                type: "tool-result",
                toolCallId,
                state: "output-available",
            }),
        );

        return {
            ...message,
            parts,
        };
    });
};

const upsertSourcePart = (
    messages: UIMessage[],
    messageId: string,
    part: Extract<UIMessagePart, { type: "source" }>,
): UIMessage[] => {
    return upsertMessage(
        messages,
        {
            id: messageId,
            role: "assistant",
            parts: [],
        },
        (message) => {
            const exists = message.parts.some(
                (current) => current.type === "source" && current.sourceId === part.sourceId,
            );

            return exists
                ? message
                : {
                      ...message,
                      parts: [...message.parts, part],
                  };
        },
    );
};

const parseToolContent = (content: string): unknown => {
    if (!content.trim()) {
        return "";
    }

    try {
        return JSON.parse(content);
    } catch {
        return content;
    }
};

export const createUIReducerState = (messages: UIMessage[] = []): UIReducerState => {
    return {
        messages: messages,
    };
};

export const applyUIEvent = (state: UIReducerState, event: AgentEvent): UIReducerState => {
    if (event.type === EventType.RUN_STARTED) {
        const messages = event.input?.messages?.filter((message) => message.role !== "system");

        if (!messages || messages.length === 0) {
            return state;
        }

        return {
            ...state,
            messages: fromAgentMessages(messages),
        };
    }

    if (event.type === EventType.TEXT_MESSAGE_START) {
        if (state.messages.some((message) => message.id === event.messageId)) {
            return state;
        }

        return {
            ...state,
            messages: [
                ...state.messages,
                {
                    id: event.messageId,
                    role: toMessageRole(event.role),
                    parts: [],
                },
            ],
        };
    }

    if (event.type === EventType.TEXT_MESSAGE_CONTENT) {
        const messageIndex = state.messages.findIndex((message) => message.id === event.messageId);
        const targetMessage: UIMessage =
            messageIndex === -1
                ? {
                      id: event.messageId,
                      role: "assistant" as const,
                      parts: [],
                  }
                : (state.messages[messageIndex] as UIMessage);

        const parts: UIMessagePart[] = [...targetMessage.parts];
        const lastPart = parts[parts.length - 1];

        if (lastPart?.type === "text") {
            parts[parts.length - 1] = {
                ...lastPart,
                text: lastPart.text + event.delta,
            };
        } else {
            parts.push({ type: "text", text: event.delta });
        }

        const nextMessage = {
            ...targetMessage,
            parts,
        };

        return {
            ...state,
            messages:
                messageIndex === -1
                    ? [...state.messages, nextMessage]
                    : state.messages.map((message, index) =>
                          index === messageIndex ? nextMessage : message,
                      ),
        };
    }

    if (event.type === EventType.REASONING_MESSAGE_START) {
        if (state.messages.some((message) => message.id === event.messageId)) {
            return state;
        }

        return {
            ...state,
            messages: [
                ...state.messages,
                {
                    id: event.messageId,
                    role: "assistant",
                    parts: [],
                },
            ],
        };
    }

    if (event.type === EventType.REASONING_MESSAGE_CONTENT) {
        const messageIndex = state.messages.findIndex((message) => message.id === event.messageId);
        const targetMessage: UIMessage =
            messageIndex === -1
                ? {
                      id: event.messageId,
                      role: "assistant" as const,
                      parts: [],
                  }
                : (state.messages[messageIndex] as UIMessage);

        const parts: UIMessagePart[] = [...targetMessage.parts];
        const lastPart = parts[parts.length - 1];

        if (lastPart?.type === "reasoning") {
            parts[parts.length - 1] = {
                ...lastPart,
                text: lastPart.text + event.delta,
            };
        } else {
            parts.push({ type: "reasoning", text: event.delta });
        }

        const nextMessage = {
            ...targetMessage,
            parts,
        };

        return {
            ...state,
            messages:
                messageIndex === -1
                    ? [...state.messages, nextMessage]
                    : state.messages.map((message, index) =>
                          index === messageIndex ? nextMessage : message,
                      ),
        };
    }

    if (event.type === EventType.REASONING_MESSAGE_END) {
        return state;
    }

    if (event.type === EventType.MESSAGES_SNAPSHOT) {
        return {
            ...state,
            messages: fromAgentMessages(event.messages),
        };
    }

    if (event.type === EventType.CUSTOM && event.name === "source" && event.value) {
        const value = event.value as {
            messageId: string;
            source: {
                id: string;
                sourceType: "url";
                url: string;
                title?: string;
            };
        };

        return {
            ...state,
            messages: upsertSourcePart(state.messages, value.messageId, {
                type: "source",
                sourceId: value.source.id,
                sourceType: "url",
                url: value.source.url,
                ...(value.source.title ? { title: value.source.title } : {}),
            }),
        };
    }

    if (event.type === EventType.TOOL_CALL_START) {
        if (!event.parentMessageId) return state;

        const alreadyExists = state.messages.some((message) =>
            message.parts.some(
                (part) => part.type === "tool-call" && part.toolCallId === event.toolCallId,
            ),
        );

        if (alreadyExists) {
            return state;
        }

        return {
            ...state,
            messages: upsertMessage(
                state.messages,
                {
                    id: event.parentMessageId,
                    role: "assistant",
                    parts: [],
                },
                (message) => ({
                    ...message,
                    parts: [
                        ...message.parts,
                        {
                            type: "tool-call",
                            state: "input-streaming",
                            toolCallId: event.toolCallId,
                            toolName: event.toolCallName,
                            inputText: "",
                            ...(event.providerExecuted !== undefined
                                ? { providerExecuted: event.providerExecuted }
                                : {}),
                        },
                    ],
                }),
            ),
        };
    }

    if (event.type === EventType.TOOL_CALL_ARGS) {
        return {
            ...state,
            messages: updateToolPart(state.messages, event.toolCallId, (part) => ({
                ...part,
                inputText:
                    part.inputText.length === 0
                        ? event.delta
                        : event.delta.startsWith(part.inputText)
                          ? event.delta
                          : part.inputText.endsWith(event.delta)
                            ? part.inputText
                            : part.inputText + event.delta,
            })),
        };
    }

    if (event.type === EventType.TOOL_CALL_CHUNK) {
        if (!event.toolCallId || !event.input || typeof event.input !== "string") return state;

        return {
            ...state,
            messages: updateToolPart(state.messages, event.toolCallId, (part) => ({
                ...part,
                inputText:
                    part.inputText.length === 0
                        ? (event.input as string)
                        : (event.input as string).startsWith(part.inputText)
                          ? (event.input as string)
                          : part.inputText.startsWith(event.input as string)
                            ? part.inputText
                            : (event.input as string),
            })),
        };
    }

    if (event.type === EventType.TOOL_CALL_END) {
        return {
            ...state,
            messages: updateToolPart(state.messages, event.toolCallId, (part) => ({
                ...part,
                state: "input-available",
                input:
                    typeof part.inputText === "string" && part.inputText.length > 0
                        ? (() => {
                              try {
                                  return JSON.parse(part.inputText);
                              } catch {
                                  return part.input;
                              }
                          })()
                        : part.input,
            })),
        };
    }

    if (event.type === EventType.TOOL_CALL_RESULT) {
        const status = "status" in event ? event.status : undefined;
        const parsedContent = parseToolContent(event.content);
        const deniedResult =
            status === "denied" && typeof parsedContent !== "string" ? undefined : parsedContent;

        return {
            ...state,
            messages: upsertToolResultPartByToolCallId(
                state.messages,
                event.toolCallId,
                (part) => ({
                    ...part,
                    state:
                        status === "denied"
                            ? "output-denied"
                            : status === "error"
                              ? "output-error"
                              : "output-available",
                    ...(status === "error"
                        ? { error: event.content, result: undefined }
                        : { result: deniedResult, error: undefined }),
                }),
            ),
        };
    }

    return {
        ...state,
    };
};
