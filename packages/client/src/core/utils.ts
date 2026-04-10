import type {
    ConversationItem,
    GenerativeModelInputItem,
    GenerativeModelInputMessagePart,
    GenerativeModelProviderToolResult,
    GenerativeModelToolCallResult,
} from "@better-agent/core/providers";
import type { UIMessage, UIMessagePart } from "../types/ui";

const withProviderMetadata = (part: { providerMetadata?: unknown }) =>
    part.providerMetadata !== undefined &&
    typeof part.providerMetadata === "object" &&
    part.providerMetadata !== null
        ? { providerMetadata: part.providerMetadata as Record<string, unknown> }
        : {};

/** Converts one persisted part into a UI part. */
export const contentPartToUIPart = (part: unknown): UIMessagePart | null => {
    if (
        typeof part !== "object" ||
        part === null ||
        typeof (part as { type?: unknown }).type !== "string"
    ) {
        return null;
    }

    const record = part as {
        type: string;
        text?: unknown;
        source?: unknown;
        embedding?: unknown;
        segments?: unknown;
        visibility?: unknown;
        provider?: unknown;
        providerMetadata?: unknown;
    };
    switch (record.type) {
        case "text":
            return typeof record.text === "string"
                ? {
                      type: "text",
                      text: record.text,
                      ...withProviderMetadata(record),
                      state: "complete",
                  }
                : null;
        case "image":
            return {
                type: "image",
                source: record.source as Extract<UIMessagePart, { type: "image" }>["source"],
                ...withProviderMetadata(record),
                state: "complete",
            };
        case "file":
            return {
                type: "file",
                source: record.source as Extract<UIMessagePart, { type: "file" }>["source"],
                ...withProviderMetadata(record),
                state: "complete",
            };
        case "audio":
            return {
                type: "audio",
                source: record.source as Extract<UIMessagePart, { type: "audio" }>["source"],
                ...withProviderMetadata(record),
                state: "complete",
            };
        case "video":
            return {
                type: "video",
                source: record.source as Extract<UIMessagePart, { type: "video" }>["source"],
                ...withProviderMetadata(record),
                state: "complete",
            };
        case "embedding":
            return Array.isArray(record.embedding) &&
                record.embedding.every((value) => typeof value === "number")
                ? {
                      type: "embedding",
                      embedding: record.embedding,
                      ...withProviderMetadata(record),
                      state: "complete",
                  }
                : null;
        case "transcript":
            return typeof record.text === "string"
                ? {
                      type: "transcript",
                      text: record.text,
                      ...(Array.isArray(record.segments)
                          ? {
                                segments: record.segments as Extract<
                                    UIMessagePart,
                                    { type: "transcript" }
                                >["segments"],
                            }
                          : {}),
                      ...withProviderMetadata(record),
                      state: "complete",
                  }
                : null;
        case "reasoning":
            return typeof record.text === "string" &&
                (record.visibility === "summary" || record.visibility === "full")
                ? {
                      type: "reasoning",
                      text: record.text,
                      visibility: record.visibility,
                      ...(typeof record.provider === "string" ? { provider: record.provider } : {}),
                      ...withProviderMetadata(record),
                      state: "complete",
                  }
                : null;
        default:
            return null;
    }
};

// UI to model.

const toModelInputParts = (
    message: UIMessage,
): Array<
    GenerativeModelInputMessagePart<{
        inputModalities: {
            text: true;
            audio: true;
            image: true;
            file: true;
            video: true;
        };
        additionalSupportedRoles: readonly string[];
    }>
> => {
    const out: Array<
        GenerativeModelInputMessagePart<{
            inputModalities: {
                text: true;
                audio: true;
                image: true;
                file: true;
                video: true;
            };
            additionalSupportedRoles: readonly string[];
        }>
    > = [];
    for (const part of message.parts) {
        const providerMetadata = "providerMetadata" in part ? part.providerMetadata : undefined;

        if (part.type === "text") {
            out.push({
                type: "text",
                text: part.text,
                ...(providerMetadata !== undefined ? { providerMetadata } : {}),
            });
            continue;
        }
        if (part.type === "audio") {
            if (part.source.kind === "url") {
                out.push({
                    type: "audio",
                    source: {
                        kind: "url",
                        url: part.source.url,
                    },
                    ...(providerMetadata !== undefined ? { providerMetadata } : {}),
                });
                continue;
            }
            out.push({
                type: "audio",
                source: {
                    kind: "base64",
                    data: part.source.data,
                    mimeType: part.source.mimeType ?? "audio/wav",
                },
                ...(providerMetadata !== undefined ? { providerMetadata } : {}),
            });
            continue;
        }
        if (part.type === "image") {
            if (part.source.kind === "url") {
                out.push({
                    type: "image",
                    source: {
                        kind: "url",
                        url: part.source.url,
                    },
                    ...(providerMetadata !== undefined ? { providerMetadata } : {}),
                });
                continue;
            }
            out.push({
                type: "image",
                source: {
                    kind: "base64",
                    data: part.source.data,
                    mimeType: part.source.mimeType ?? "image/png",
                },
                ...(providerMetadata !== undefined ? { providerMetadata } : {}),
            });
            continue;
        }
        if (part.type === "file") {
            if (part.source.kind === "url") {
                out.push({
                    type: "file",
                    source: {
                        kind: "url",
                        url: part.source.url,
                        ...(part.source.mimeType ? { mimeType: part.source.mimeType } : {}),
                        ...(part.source.filename ? { filename: part.source.filename } : {}),
                    },
                    ...(providerMetadata !== undefined ? { providerMetadata } : {}),
                });
                continue;
            }
            if (part.source.kind === "provider-file") {
                out.push({
                    type: "file",
                    source: {
                        kind: "provider-file",
                        ref: part.source.ref,
                        ...(part.source.mimeType ? { mimeType: part.source.mimeType } : {}),
                        ...(part.source.filename ? { filename: part.source.filename } : {}),
                    },
                    ...(providerMetadata !== undefined ? { providerMetadata } : {}),
                });
                continue;
            }
            out.push({
                type: "file",
                source: {
                    kind: "base64",
                    data: part.source.data,
                    mimeType: part.source.mimeType,
                    ...(part.source.filename ? { filename: part.source.filename } : {}),
                },
                ...(providerMetadata !== undefined ? { providerMetadata } : {}),
            });
            continue;
        }
        if (part.type === "video") {
            if (part.source.kind === "url") {
                out.push({
                    type: "video",
                    source: {
                        kind: "url",
                        url: part.source.url,
                    },
                    ...(providerMetadata !== undefined ? { providerMetadata } : {}),
                });
                continue;
            }
            out.push({
                type: "video",
                source: {
                    kind: "base64",
                    data: part.source.data,
                    mimeType: part.source.mimeType ?? "video/mp4",
                },
                ...(providerMetadata !== undefined ? { providerMetadata } : {}),
            });
            continue;
        }
        if (part.type === "embedding") {
            out.push({
                type: "embedding",
                embedding: part.embedding,
                ...(providerMetadata !== undefined ? { providerMetadata } : {}),
            });
            continue;
        }
        if (part.type === "transcript") {
            out.push({
                type: "transcript",
                text: part.text,
                ...(part.segments ? { segments: part.segments } : {}),
                ...(providerMetadata !== undefined ? { providerMetadata } : {}),
            });
            continue;
        }
        if (part.type === "reasoning") {
            out.push({
                type: "reasoning",
                text: part.text,
                visibility: part.visibility,
                ...(part.provider ? { provider: part.provider } : {}),
                ...(providerMetadata !== undefined ? { providerMetadata } : {}),
            });
        }
    }
    return out;
};

/** Converts UI messages into model input messages. */
export const toModelMessages = (
    msgs: UIMessage[],
): Array<
    GenerativeModelInputItem<{
        inputModalities: {
            text: true;
            audio: true;
            image: true;
            file: true;
            video: true;
        };
        additionalSupportedRoles: readonly string[];
    }>
> =>
    msgs.flatMap((message) => {
        const parts = toModelInputParts(message);
        const items: Array<
            GenerativeModelInputItem<{
                inputModalities: {
                    text: true;
                    audio: true;
                    image: true;
                    file: true;
                    video: true;
                };
                additionalSupportedRoles: readonly string[];
            }>
        > = [];

        if (parts.length > 0) {
            const hasNonText = parts.some((part) => part.type !== "text");
            items.push({
                type: "message",
                role: message.role as never,
                content:
                    hasNonText || parts.length !== 1 || parts[0]?.type !== "text"
                        ? parts
                        : parts[0].text,
            });
        }

        const completedCalls = new Map<string, string>();
        for (const part of message.parts) {
            if (part.type !== "tool-call") {
                continue;
            }

            const toolName = part.name;
            const isCompleted =
                toolName &&
                (part.status === "success" ||
                    part.status === "error" ||
                    part.state === "completed");
            if (isCompleted) {
                completedCalls.set(part.callId, toolName);
            }
        }

        for (const part of message.parts) {
            if (part.type !== "tool-result") {
                continue;
            }

            const toolName = completedCalls.get(part.callId);
            if (!toolName || (part.status !== "success" && part.status !== "error")) {
                continue;
            }

            items.push({
                type: "tool-call",
                name: toolName,
                callId: part.callId,
                result: part.result,
                ...(part.status === "error" ? { isError: true } : {}),
            });
        }

        return items;
    });

// Model -> UI.

const contentToUIParts = (content: string | unknown[]): UIMessagePart[] => {
    if (typeof content === "string") {
        return [{ type: "text", text: content, state: "complete" }];
    }

    return content
        .map((part) => contentPartToUIPart(part))
        .filter((part): part is UIMessagePart => part !== null);
};

const isToolResultConversationItem = (
    item: ConversationItem,
): item is GenerativeModelToolCallResult | GenerativeModelProviderToolResult =>
    item.type === "provider-tool-result" ||
    (item.type === "tool-call" && Object.prototype.hasOwnProperty.call(item, "result"));

/** Converts model input messages back into UI messages. */
export const fromModelMessages = (
    messages: GenerativeModelInputItem[],
    options?: { generateId?: () => string },
): UIMessage[] => {
    const generateId = options?.generateId ?? makeLocalMessageId;
    const result: UIMessage[] = [];
    let activeAssistantMessageIndex: number | undefined;

    for (const item of messages) {
        if (item.type === "message") {
            const parts = contentToUIParts(item.content);

            if (parts.length === 0) {
                continue;
            }

            result.push({
                localId: generateId(),
                role: item.role ?? "user",
                parts,
            });
            activeAssistantMessageIndex =
                (item.role ?? "user") === "assistant" ? result.length - 1 : undefined;
            continue;
        }

        const status = item.isError ? "error" : "success";
        const toolParts: UIMessagePart[] = [
            {
                type: "tool-call",
                callId: item.callId,
                name: item.name,
                status,
                state: "completed",
            },
            {
                type: "tool-result",
                callId: item.callId,
                result: item.result,
                status,
            },
        ];

        if (activeAssistantMessageIndex !== undefined) {
            const message = result[activeAssistantMessageIndex];
            if (message?.role === "assistant") {
                result[activeAssistantMessageIndex] = {
                    ...message,
                    parts: [...message.parts, ...toolParts],
                };
                continue;
            }
        }

        result.push({
            localId: generateId(),
            role: "assistant",
            parts: toolParts,
        });
        activeAssistantMessageIndex = result.length - 1;
    }

    return result;
};

/** Converts durable conversation items back into UI messages. */
export const fromConversationItems = (
    items: ConversationItem[],
    options?: { generateId?: () => string },
): UIMessage[] => {
    const generateId = options?.generateId ?? makeLocalMessageId;
    const result: UIMessage[] = [];
    let activeAssistantMessageIndex: number | undefined;

    for (const item of items) {
        if (item.type === "message") {
            const parts = contentToUIParts(item.content);
            if (parts.length === 0) {
                continue;
            }

            result.push({
                localId: generateId(),
                role: item.role ?? "user",
                parts,
            });
            activeAssistantMessageIndex =
                (item.role ?? "user") === "assistant" ? result.length - 1 : undefined;
            continue;
        }

        if (item.type === "tool-call" && !isToolResultConversationItem(item)) {
            const part: UIMessagePart = {
                type: "tool-call",
                callId: item.callId,
                name: item.name,
                args: item.arguments,
                status: "pending",
                state: "input-complete",
            };

            if (activeAssistantMessageIndex !== undefined) {
                const message = result[activeAssistantMessageIndex];
                if (message?.role === "assistant") {
                    result[activeAssistantMessageIndex] = {
                        ...message,
                        parts: [...message.parts, part],
                    };
                    continue;
                }
            }

            result.push({
                localId: generateId(),
                role: "assistant",
                parts: [part],
            });
            activeAssistantMessageIndex = result.length - 1;
            continue;
        }

        let appendedToExistingMessage = false;
        for (let index = result.length - 1; index >= 0; index -= 1) {
            const message = result[index];
            if (!message || message.role !== "assistant") {
                continue;
            }

            const partIndex = message.parts.findIndex(
                (part) => part.type === "tool-call" && part.callId === item.callId,
            );
            if (partIndex < 0) {
                continue;
            }

            const existingPart = message.parts[partIndex];
            if (!existingPart || existingPart.type !== "tool-call") {
                break;
            }

            const status = item.isError ? "error" : "success";
            const parts = message.parts.slice();
            parts[partIndex] = {
                ...existingPart,
                ...(existingPart.name === undefined ? { name: item.name } : {}),
                status,
                state: "completed",
            };
            parts.splice(partIndex + 1, 0, {
                type: "tool-result",
                callId: item.callId,
                result: item.result,
                status,
            });
            result[index] = { ...message, parts };
            appendedToExistingMessage = true;
            break;
        }

        if (appendedToExistingMessage) {
            continue;
        }

        const status = item.isError ? "error" : "success";
        const toolParts: UIMessagePart[] = [
            {
                type: "tool-call",
                callId: item.callId,
                name: item.name,
                status,
                state: "completed",
            },
            {
                type: "tool-result",
                callId: item.callId,
                result: item.result,
                status,
            },
        ];

        if (activeAssistantMessageIndex !== undefined) {
            const message = result[activeAssistantMessageIndex];
            if (message?.role === "assistant") {
                result[activeAssistantMessageIndex] = {
                    ...message,
                    parts: [...message.parts, ...toolParts],
                };
                continue;
            }
        }

        result.push({
            localId: generateId(),
            role: "assistant",
            parts: toolParts,
        });
        activeAssistantMessageIndex = result.length - 1;
    }

    return result;
};

/** Creates a local message id. */
export const makeLocalMessageId = () =>
    globalThis.crypto?.randomUUID?.() ??
    `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

/** Normalizes optimistic message options. */
export const normalizeOptimisticUserMessageConfig = (
    optimisticUserMessage:
        | boolean
        | {
              enabled?: boolean;
              onError?: "fail" | "remove";
          }
        | undefined,
): {
    enabled: boolean;
    onError: "fail" | "remove";
} => {
    if (optimisticUserMessage === true) {
        return { enabled: true, onError: "fail" };
    }
    if (optimisticUserMessage === false) {
        return { enabled: false, onError: "fail" };
    }
    if (!optimisticUserMessage) {
        return { enabled: true, onError: "fail" };
    }
    return {
        enabled: optimisticUserMessage.enabled ?? true,
        onError: optimisticUserMessage.onError ?? "fail",
    };
};

/** Deep-merges model option objects. Arrays are replaced, not merged. */
export const mergeModelOptions = (
    ...parts: Array<Record<string, unknown> | undefined>
): Record<string, unknown> => {
    const merged: Record<string, unknown> = {};

    const mergeInto = (target: Record<string, unknown>, source: Record<string, unknown>) => {
        for (const [key, value] of Object.entries(source)) {
            const existing = target[key];
            if (
                existing !== null &&
                typeof existing === "object" &&
                !Array.isArray(existing) &&
                value !== null &&
                typeof value === "object" &&
                !Array.isArray(value)
            ) {
                target[key] = mergeInto(
                    { ...(existing as Record<string, unknown>) },
                    value as Record<string, unknown>,
                );
            } else {
                target[key] = value;
            }
        }

        return target;
    };

    for (const part of parts) {
        if (part) mergeInto(merged, part);
    }

    return merged;
};
