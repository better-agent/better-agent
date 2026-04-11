import type { Event as EventTypes, Role } from "@better-agent/core/events";
import type { GenerativeModelInputItem } from "@better-agent/core/providers";
import type { ToolCallPart, ToolResultPart, UIMessage } from "../types/ui";
import { fromModelMessages } from "./utils";

/** Message array plus a local-id index. */
export interface MessageState {
    /** Messages in order. */
    messages: UIMessage[];
    /** Local message id to message index. */
    byLocalId: Map<string, number>;
}

export interface ApplyEventOptions {
    /** Rebuilds the user turn from replayed `RUN_STARTED`. */
    synthesizeReplayUserMessage?: boolean;
}

/** Applies one core event to the current message state. */
export const applyEvent = (
    state: MessageState,
    event: EventTypes,
    options?: ApplyEventOptions,
): MessageState => {
    switch (event.type) {
        case "RUN_STARTED": {
            if (!options?.synthesizeReplayUserMessage) {
                return state;
            }

            return maybeInsertReplayUserMessage(state, event.runInput, event.runId);
        }

        // Message parts.
        case "TEXT_MESSAGE_START": {
            const role = event.role ?? "assistant";
            return ensureMessage(state, event.messageId, role);
        }
        case "TEXT_MESSAGE_CONTENT": {
            return updateAssistantMessage(state, event.messageId, (msg) =>
                appendText(msg, event.delta),
            );
        }
        case "TEXT_MESSAGE_END": {
            return updateAssistantMessage(state, event.messageId, (msg) =>
                markLatestPartComplete(msg, "text"),
            );
        }
        case "AUDIO_MESSAGE_START": {
            const role = event.role ?? "assistant";
            return ensureMessage(state, event.messageId, role);
        }
        case "AUDIO_MESSAGE_CONTENT": {
            return updateAssistantMessage(state, event.messageId, (msg) =>
                appendAudio(msg, event.delta),
            );
        }
        case "AUDIO_MESSAGE_END": {
            return updateAssistantMessage(state, event.messageId, (msg) =>
                markLatestPartComplete(msg, "audio"),
            );
        }
        case "IMAGE_MESSAGE_START": {
            const role = event.role ?? "assistant";
            return ensureMessage(state, event.messageId, role);
        }
        case "IMAGE_MESSAGE_CONTENT": {
            return updateAssistantMessage(state, event.messageId, (msg) =>
                appendImage(msg, event.delta),
            );
        }
        case "IMAGE_MESSAGE_END": {
            return updateAssistantMessage(state, event.messageId, (msg) =>
                markLatestPartComplete(msg, "image"),
            );
        }
        case "VIDEO_MESSAGE_START": {
            const role = event.role ?? "assistant";
            return ensureMessage(state, event.messageId, role);
        }
        case "VIDEO_MESSAGE_CONTENT": {
            return updateAssistantMessage(state, event.messageId, (msg) =>
                appendVideo(msg, event.delta),
            );
        }
        case "VIDEO_MESSAGE_END": {
            return updateAssistantMessage(state, event.messageId, (msg) =>
                markLatestPartComplete(msg, "video"),
            );
        }
        case "EMBEDDING_MESSAGE_START": {
            const role = event.role ?? "assistant";
            return ensureMessage(state, event.messageId, role);
        }
        case "EMBEDDING_MESSAGE_CONTENT": {
            return updateAssistantMessage(state, event.messageId, (msg) =>
                appendEmbedding(msg, event.delta),
            );
        }
        case "EMBEDDING_MESSAGE_END": {
            return updateAssistantMessage(state, event.messageId, (msg) =>
                markLatestPartComplete(msg, "embedding"),
            );
        }

        // Streamed transcript/reasoning parts.
        case "TRANSCRIPT_MESSAGE_START": {
            const role = event.role ?? "assistant";
            return ensureMessage(state, event.messageId, role);
        }
        case "TRANSCRIPT_MESSAGE_CONTENT": {
            return updateAssistantMessage(state, event.messageId, (msg) =>
                appendTranscriptText(msg, event.delta),
            );
        }
        case "TRANSCRIPT_MESSAGE_SEGMENT": {
            return updateAssistantMessage(state, event.messageId, (msg) =>
                upsertTranscriptSegment(msg, event.segment),
            );
        }
        case "TRANSCRIPT_MESSAGE_END": {
            return updateAssistantMessage(state, event.messageId, (msg) =>
                markLatestPartComplete(msg, "transcript"),
            );
        }
        case "REASONING_MESSAGE_START": {
            const role = event.role ?? "assistant";
            return ensureAndUpdateMessage(state, event.messageId, role, (msg) =>
                appendReasoningText(msg, "", event.visibility),
            );
        }
        case "REASONING_MESSAGE_CONTENT": {
            return updateAssistantMessage(state, event.messageId, (msg) =>
                appendReasoningText(msg, event.delta, event.visibility),
            );
        }
        case "REASONING_MESSAGE_END": {
            return updateAssistantMessage(state, event.messageId, (msg) =>
                markLatestPartComplete(msg, "reasoning"),
            );
        }

        // Tool lifecycle on the current assistant turn.
        case "TOOL_CALL_START": {
            return updateResolvedToolMessage(
                state,
                event.parentMessageId,
                event.toolCallId,
                (msg) =>
                    isToolCallCompleted(msg, event.toolCallId)
                        ? msg
                        : upsertToolPart(msg, "tool-call", event.toolCallId, {
                              name: event.toolCallName,
                              ...(event.toolTarget !== undefined
                                  ? { toolTarget: event.toolTarget }
                                  : {}),
                              status: "pending",
                              state: "awaiting-input",
                          }),
            );
        }
        case "TOOL_CALL_ARGS": {
            return updateResolvedToolMessage(
                state,
                event.parentMessageId,
                event.toolCallId,
                (msg) => {
                    if (isToolCallCompleted(msg, event.toolCallId)) {
                        return msg;
                    }

                    const existing = findToolCallPart(msg, event.toolCallId);
                    if (
                        existing?.args === event.delta &&
                        (existing.state === "input-complete" || existing.state === "completed")
                    ) {
                        return msg;
                    }

                    return upsertToolPart(
                        msg,
                        "tool-call",
                        event.toolCallId,
                        {
                            name: event.toolCallName,
                            ...(event.toolTarget !== undefined
                                ? { toolTarget: event.toolTarget }
                                : {}),
                            status: "pending",
                            state: "input-streaming",
                        },
                        (part) =>
                            part.type === "tool-call"
                                ? { ...part, args: (part.args ?? "") + event.delta }
                                : part,
                    );
                },
            );
        }
        case "TOOL_CALL_END": {
            return updateResolvedToolMessage(
                state,
                event.parentMessageId,
                event.toolCallId,
                (msg) => {
                    if (isToolCallCompleted(msg, event.toolCallId)) {
                        return msg;
                    }

                    const existing = findToolCallPart(msg, event.toolCallId);
                    if (isApprovalLifecycleState(existing?.state)) {
                        return msg;
                    }

                    return upsertToolPart(msg, "tool-call", event.toolCallId, {
                        name: event.toolCallName,
                        ...(event.toolTarget !== undefined ? { toolTarget: event.toolTarget } : {}),
                        status: "pending",
                        state: "input-complete",
                    });
                },
            );
        }
        case "TOOL_CALL_RESULT": {
            return updateResolvedToolMessage(
                state,
                event.parentMessageId,
                event.toolCallId,
                (msg) => {
                    const status = event.isError ? "error" : "success";
                    const withResult = upsertToolPart(msg, "tool-result", event.toolCallId, {
                        result: event.result,
                        status,
                    });
                    return upsertToolPart(withResult, "tool-call", event.toolCallId, {
                        name: event.toolCallName,
                        ...(event.toolTarget !== undefined ? { toolTarget: event.toolTarget } : {}),
                        status,
                        state: "completed",
                    });
                },
            );
        }

        // Approval updates extend the tool call.
        case "TOOL_APPROVAL_REQUIRED": {
            return updateResolvedToolMessage(
                state,
                event.parentMessageId,
                event.toolCallId,
                (msg) => {
                    const withState = upsertToolPart(msg, "tool-call", event.toolCallId, {
                        name: event.toolCallName,
                        ...(event.toolTarget !== undefined ? { toolTarget: event.toolTarget } : {}),
                        status: "pending",
                        state: "approval-requested",
                    });
                    return updateToolApprovalMeta(withState, event.toolCallId, {
                        input: event.toolInput,
                        ...(event.meta !== undefined ? { meta: event.meta } : {}),
                    });
                },
            );
        }
        case "TOOL_APPROVAL_UPDATED": {
            return updateResolvedToolMessage(
                state,
                event.parentMessageId,
                event.toolCallId,
                (msg) => {
                    const withState = upsertToolPart(msg, "tool-call", event.toolCallId, {
                        name: event.toolCallName,
                        ...(event.toolTarget !== undefined ? { toolTarget: event.toolTarget } : {}),
                        status: getApprovalStatus(event.state),
                        state: getApprovalPartState(event.state),
                    });
                    return updateToolApprovalMeta(withState, event.toolCallId, {
                        ...(event.toolInput !== undefined ? { input: event.toolInput } : {}),
                        ...(event.meta !== undefined ? { meta: event.meta } : {}),
                        ...(event.note !== undefined ? { note: event.note } : {}),
                        ...(event.actorId !== undefined ? { actorId: event.actorId } : {}),
                    });
                },
            );
        }
        default:
            return state;
    }
};

/** Creates message state from UI messages. */
export const createMessageState = (initial: UIMessage[] = []): MessageState => {
    const byLocalId = new Map<string, number>();
    initial.forEach((m, i) => byLocalId.set(m.localId, i));
    return { messages: initial, byLocalId };
};

// Replay helpers.

const findMessageLocalIdByToolCallId = (
    state: MessageState,
    toolCallId: string,
): string | undefined => {
    for (let i = state.messages.length - 1; i >= 0; i -= 1) {
        const message = state.messages[i];
        if (!message) continue;
        const hasToolPart = message.parts.some(
            (part) =>
                (part.type === "tool-call" || part.type === "tool-result") &&
                part.callId === toolCallId,
        );
        if (hasToolPart) return message.localId;
    }
    return undefined;
};

const findLatestAssistantMessageLocalId = (state: MessageState): string | undefined => {
    for (let i = state.messages.length - 1; i >= 0; i -= 1) {
        const message = state.messages[i];
        if (message?.role === "assistant") return message.localId;
    }
    return undefined;
};

const resolveCurrentTurnAssistantLocalId = (state: MessageState): string | undefined => {
    for (let i = state.messages.length - 1; i >= 0; i -= 1) {
        const message = state.messages[i];
        if (message?.role !== "user") continue;
        const userLocalId = message.localId;
        let latestAssistantAfterUser: string | undefined;
        for (let j = i + 1; j < state.messages.length; j += 1) {
            const candidate = state.messages[j];
            if (candidate?.role === "assistant") latestAssistantAfterUser = candidate.localId;
        }

        return latestAssistantAfterUser ?? `assistant_turn:${userLocalId}`;
    }
    return undefined;
};

// Resolve tool state to the best assistant message.
const resolveToolMessageLocalId = (
    state: MessageState,
    parentMessageId: string | undefined,
    toolCallId: string,
): string | undefined => {
    if (parentMessageId) {
        if (state.byLocalId.has(parentMessageId)) return parentMessageId;
    }
    return (
        findMessageLocalIdByToolCallId(state, toolCallId) ??
        resolveCurrentTurnAssistantLocalId(state) ??
        findLatestAssistantMessageLocalId(state)
    );
};

const maybeInsertReplayUserMessage = (
    state: MessageState,
    runInput: Record<string, unknown>,
    runId: string,
): MessageState => {
    const synthesized = toReplayUserMessage(runInput, runId);
    if (!synthesized) {
        return state;
    }

    // Dedupe by replay id, not text.
    if (state.byLocalId.has(synthesized.localId)) {
        return state;
    }

    const latestUserMessage = findLatestUserMessage(state);
    if (latestUserMessage && latestUserMessage.localId === synthesized.localId) {
        return state;
    }

    return {
        ...state,
        messages: [...state.messages, synthesized],
        byLocalId: new Map(state.byLocalId).set(synthesized.localId, state.messages.length),
    };
};

const toReplayUserMessage = (
    runInput: Record<string, unknown>,
    runId: string,
): UIMessage | undefined => {
    const input = runInput.input;

    if (typeof input === "string") {
        return {
            localId: `user_run:${runId}`,
            id: `user_run:${runId}`,
            role: "user",
            parts: [{ type: "text", text: input, state: "complete" }],
            status: "sent",
        };
    }

    if (isReplayInputArray(input)) {
        return toLatestReplayUserMessage(input, runId);
    }

    if (isSingleReplayMessageItem(input)) {
        return toLatestReplayUserMessage([input as GenerativeModelInputItem], runId);
    }

    return undefined;
};

const toLatestReplayUserMessage = (
    input: GenerativeModelInputItem[],
    runId: string,
): UIMessage | undefined => {
    const replayMessages = fromModelMessages(input, {
        generateId: (() => {
            let index = 0;
            return () => `user_run:${runId}:${(index++).toString(36)}`;
        })(),
    });
    const latestUserMessage = [...replayMessages]
        .reverse()
        .find((message) => message.role === "user");

    if (!latestUserMessage) {
        return undefined;
    }

    return {
        ...latestUserMessage,
        status: "sent",
    };
};

const findLatestUserMessage = (state: MessageState): UIMessage | undefined =>
    [...state.messages].reverse().find((message) => message.role === "user");

const isSingleReplayMessageItem = (
    input: unknown,
): input is {
    type: "message";
    role?: string;
    content: string | unknown[];
} => {
    if (typeof input !== "object" || input === null) {
        return false;
    }

    const record = input as {
        type?: unknown;
        role?: unknown;
        content?: unknown;
    };

    return (
        record.type === "message" &&
        (record.role === undefined || typeof record.role === "string") &&
        (typeof record.content === "string" || Array.isArray(record.content))
    );
};

const isReplayInputArray = (input: unknown): input is GenerativeModelInputItem[] =>
    Array.isArray(input);

// Message mutation helpers.
const ensureMessage = (state: MessageState, localId: string, role: Role): MessageState => {
    if (state.byLocalId.has(localId)) return state;

    const next: UIMessage = {
        localId,
        id: localId,
        role,
        parts: [],
    };

    return {
        ...state,
        messages: [...state.messages, next],
        byLocalId: new Map(state.byLocalId).set(localId, state.messages.length),
    };
};

const updateMessage = (
    state: MessageState,
    localId: string,
    updater: (msg: UIMessage) => UIMessage,
): MessageState => {
    const idx = state.byLocalId.get(localId);
    if (idx === undefined) return state;

    const nextMessages = state.messages.slice();
    const current = nextMessages[idx];
    if (!current) return state;
    nextMessages[idx] = updater(current);

    return { ...state, messages: nextMessages };
};

const ensureAndUpdateMessage = (
    state: MessageState,
    localId: string,
    role: Role,
    updater: (msg: UIMessage) => UIMessage,
): MessageState => updateMessage(ensureMessage(state, localId, role), localId, updater);

const appendText = (msg: UIMessage, delta: string): UIMessage => {
    // Extend the last open text part when possible.
    const parts = msg.parts.slice();
    const last = parts[parts.length - 1];
    if (last && last.type === "text" && last.state !== "complete") {
        parts[parts.length - 1] = { ...last, text: last.text + delta };
    } else {
        parts.push({ type: "text", text: delta });
    }
    return { ...msg, parts };
};

const appendAudio = (
    msg: UIMessage,
    delta: {
        kind: "base64";
        data: string;
        mimeType: string;
    },
): UIMessage => {
    const parts = msg.parts.slice();
    const last = parts[parts.length - 1];
    if (last?.type === "audio" && last.source.kind === "base64" && last.state !== "complete") {
        parts[parts.length - 1] = {
            ...last,
            source: {
                kind: "base64",
                data: `${last.source.data}${delta.data}`,
                mimeType: delta.mimeType,
            },
        };
    } else {
        parts.push({
            type: "audio",
            source: {
                kind: "base64",
                data: delta.data,
                mimeType: delta.mimeType,
            },
        });
    }
    return { ...msg, parts };
};

const appendImage = (
    msg: UIMessage,
    delta:
        | {
              kind: "url";
              url: string;
          }
        | {
              kind: "base64";
              data: string;
              mimeType: string;
          },
): UIMessage => {
    const parts = msg.parts.slice();
    const last = parts[parts.length - 1];
    if (
        delta.kind === "base64" &&
        last?.type === "image" &&
        last.source.kind === "base64" &&
        last.state !== "complete"
    ) {
        parts[parts.length - 1] = {
            ...last,
            source: {
                kind: "base64",
                data: `${last.source.data}${delta.data}`,
                mimeType: delta.mimeType,
            },
        };
    } else if (delta.kind === "url") {
        parts.push({
            type: "image",
            source: {
                kind: "url",
                url: delta.url,
            },
        });
    } else {
        parts.push({
            type: "image",
            source: {
                kind: "base64",
                data: delta.data,
                mimeType: delta.mimeType,
            },
        });
    }
    return { ...msg, parts };
};

const appendVideo = (
    msg: UIMessage,
    delta:
        | {
              kind: "url";
              url: string;
          }
        | {
              kind: "base64";
              data: string;
              mimeType: string;
          },
): UIMessage => {
    const parts = msg.parts.slice();
    const last = parts[parts.length - 1];
    if (
        delta.kind === "base64" &&
        last?.type === "video" &&
        last.source.kind === "base64" &&
        last.state !== "complete"
    ) {
        parts[parts.length - 1] = {
            ...last,
            source: {
                kind: "base64",
                data: `${last.source.data}${delta.data}`,
                mimeType: delta.mimeType,
            },
        };
    } else if (delta.kind === "url") {
        parts.push({
            type: "video",
            source: {
                kind: "url",
                url: delta.url,
            },
        });
    } else {
        parts.push({
            type: "video",
            source: {
                kind: "base64",
                data: delta.data,
                mimeType: delta.mimeType,
            },
        });
    }
    return { ...msg, parts };
};

const appendEmbedding = (msg: UIMessage, delta: number[]): UIMessage => {
    const parts = msg.parts.slice();
    const last = parts[parts.length - 1];
    if (last?.type === "embedding" && last.state !== "complete") {
        parts[parts.length - 1] = {
            ...last,
            embedding: [...last.embedding, ...delta],
        };
    } else {
        parts.push({
            type: "embedding",
            embedding: delta,
        });
    }
    return { ...msg, parts };
};

const appendTranscriptText = (msg: UIMessage, delta: string): UIMessage => {
    const parts = msg.parts.slice();
    const last = parts[parts.length - 1];
    if (last?.type === "transcript" && last.state !== "complete") {
        parts[parts.length - 1] = { ...last, text: last.text + delta };
    } else {
        parts.push({
            type: "transcript",
            text: delta,
        });
    }
    return { ...msg, parts };
};

const appendReasoningText = (
    msg: UIMessage,
    delta: string,
    visibility: "summary" | "full",
    provider?: string,
): UIMessage => {
    const parts = msg.parts.slice();
    const last = parts[parts.length - 1];
    if (
        last?.type === "reasoning" &&
        last.state !== "complete" &&
        last.visibility === visibility &&
        (last.provider ?? undefined) === (provider ?? undefined)
    ) {
        parts[parts.length - 1] = { ...last, text: last.text + delta };
    } else {
        parts.push({
            type: "reasoning",
            text: delta,
            visibility,
            ...(provider !== undefined ? { provider } : {}),
        });
    }
    return { ...msg, parts };
};

const upsertTranscriptSegment = (
    msg: UIMessage,
    segment: {
        id: string;
        start: number;
        end: number;
        text: string;
        speaker?: string;
    },
): UIMessage => {
    const parts = msg.parts.slice();
    const last = parts[parts.length - 1];
    if (last?.type === "transcript" && last.state !== "complete") {
        const segments = last.segments ? [...last.segments] : [];
        const idx = segments.findIndex((item) => item.id === segment.id);
        if (idx === -1) {
            segments.push(segment);
        } else {
            segments[idx] = segment;
        }
        parts[parts.length - 1] = { ...last, segments };
    } else {
        parts.push({
            type: "transcript",
            text: "",
            segments: [segment],
        });
    }
    return { ...msg, parts };
};

const markLatestPartComplete = (
    msg: UIMessage,
    partType: "text" | "audio" | "image" | "video" | "embedding" | "transcript" | "reasoning",
): UIMessage => {
    const parts = msg.parts.slice();
    for (let i = parts.length - 1; i >= 0; i -= 1) {
        const part = parts[i];
        if (!part || part.type !== partType) continue;
        parts[i] = { ...part, state: "complete" };
        return { ...msg, parts };
    }
    return msg;
};

// Tool helpers.
const isApprovalLifecycleState = (state: ToolCallPart["state"] | undefined): boolean =>
    state === "approval-requested" ||
    state === "approval-approved" ||
    state === "approval-denied" ||
    state === "approval-expired";

const getApprovalPartState = (
    state: "requested" | "approved" | "denied" | "expired",
): NonNullable<ToolCallPart["state"]> =>
    state === "requested"
        ? "approval-requested"
        : state === "approved"
          ? "approval-approved"
          : state === "denied"
            ? "approval-denied"
            : "approval-expired";

const getApprovalStatus = (
    state: "requested" | "approved" | "denied" | "expired",
): ToolCallPart["status"] => (state === "denied" || state === "expired" ? "error" : "pending");

const updateToolApprovalMeta = (
    msg: UIMessage,
    toolCallId: string,
    patch: {
        input?: unknown;
        meta?: Record<string, unknown>;
        note?: string;
        actorId?: string;
    },
): UIMessage =>
    upsertToolPart(msg, "tool-call", toolCallId, {}, (part) =>
        part.type === "tool-call"
            ? {
                  ...part,
                  approval: {
                      ...(part.approval ?? {}),
                      ...(patch.input !== undefined ? { input: patch.input } : {}),
                      ...(patch.meta !== undefined ? { meta: patch.meta } : {}),
                      ...(patch.note !== undefined ? { note: patch.note } : {}),
                      ...(patch.actorId !== undefined ? { actorId: patch.actorId } : {}),
                  },
              }
            : part,
    );

const isToolCallCompleted = (msg: UIMessage, toolCallId: string): boolean =>
    msg.parts.some(
        (part) =>
            part.type === "tool-call" &&
            part.callId === toolCallId &&
            (part.status === "success" ||
                part.state === "completed" ||
                part.state === "approval-denied" ||
                part.state === "approval-expired"),
    );

const findToolCallPart = (msg: UIMessage, toolCallId: string): ToolCallPart | undefined =>
    msg.parts.find(
        (part): part is ToolCallPart => part.type === "tool-call" && part.callId === toolCallId,
    );

const upsertToolPart = (
    msg: UIMessage,
    kind: "tool-call" | "tool-result",
    toolCallId: string,
    patch: Partial<ToolCallPart> | Partial<ToolResultPart>,
    updater?: (part: ToolCallPart | ToolResultPart) => ToolCallPart | ToolResultPart,
): UIMessage => {
    // Reuse the same tool part instead of duplicating it.
    const parts = msg.parts.slice();
    const idx = parts.findIndex((p) => p.type === kind && "callId" in p && p.callId === toolCallId);

    if (idx === -1) {
        if (kind === "tool-call") {
            parts.push({
                type: "tool-call",
                callId: toolCallId,
                status: "pending",
                ...(patch as Partial<ToolCallPart>),
            });
        } else {
            parts.push({
                type: "tool-result",
                callId: toolCallId,
                status: "pending",
                ...(patch as Partial<ToolResultPart>),
            });
        }
        return { ...msg, parts };
    }

    const existing = parts[idx];
    if (!existing) return { ...msg, parts };
    if (kind === "tool-call" && existing.type === "tool-call") {
        const merged: ToolCallPart = {
            ...existing,
            ...(patch as Partial<ToolCallPart>),
            type: "tool-call",
        };
        parts[idx] = updater ? (updater(merged) as ToolCallPart) : merged;
    } else if (kind === "tool-result" && existing.type === "tool-result") {
        const merged: ToolResultPart = {
            ...existing,
            ...(patch as Partial<ToolResultPart>),
            type: "tool-result",
        };
        parts[idx] = updater ? (updater(merged) as ToolResultPart) : merged;
    }

    return { ...msg, parts };
};

const updateAssistantMessage = (
    state: MessageState,
    messageId: string,
    updater: (msg: UIMessage) => UIMessage,
): MessageState => ensureAndUpdateMessage(state, messageId, "assistant", updater);

const updateResolvedToolMessage = (
    state: MessageState,
    parentMessageId: string | undefined,
    toolCallId: string,
    updater: (msg: UIMessage) => UIMessage,
): MessageState => {
    const targetMessageLocalId = resolveToolMessageLocalId(state, parentMessageId, toolCallId);
    if (!targetMessageLocalId) {
        return state;
    }

    return ensureAndUpdateMessage(state, targetMessageLocalId, "assistant", updater);
};
