import type { RunResult } from "../run";
import type { ToolApprovalState, ToolErrorPayload, ToolTarget } from "../tools";
import type { EventName, Events } from "./constants";

/**
 * Minimal serializable error shape used in runtime events.
 */
export interface BetterAgentErrorLike {
    name: string;
    message: string;
    code?: string;
    cause?: unknown;
}

/**
 * Message role used in streamed events.
 */
export type Role = "system" | "assistant" | "user" | (string & {});
export type { ToolApprovalState, ToolTarget };
/** Visibility level for reasoning output. */
export type ReasoningVisibility = "summary" | "full";
/** Reason a loop step stopped the run. */
export type StepTerminationReason = "no_tool_calls" | "stop_when" | "max_steps";

/**
 * Base shape shared by all runtime events.
 */
export interface BaseEvent {
    type: EventName;
    timestamp: number;
}

export interface RunStartedEvent extends BaseEvent {
    type: typeof Events.RUN_STARTED;
    runId: string;
    agentName: string;
    conversationId?: string;
    runInput: Record<string, unknown>;
}

export interface RunFinishedEvent extends BaseEvent {
    type: typeof Events.RUN_FINISHED;
    runId: string;
    agentName: string;
    conversationId?: string;
    result: RunResult;
}

export interface RunErrorEvent extends BaseEvent {
    type: typeof Events.RUN_ERROR;
    runId: string;
    agentName: string;
    conversationId?: string;
    error: BetterAgentErrorLike;
}

export interface RunAbortedEvent extends BaseEvent {
    type: typeof Events.RUN_ABORTED;
    runId: string;
    agentName: string;
    conversationId?: string;
}

export interface DataPartEvent extends BaseEvent {
    type: typeof Events.DATA_PART;
    id?: string;
    data: unknown;
}

export interface StepStartEvent extends BaseEvent {
    type: typeof Events.STEP_START;
    runId: string;
    agentName: string;
    conversationId?: string;
    stepIndex: number;
    maxSteps: number | undefined;
}

export interface StepFinishEvent extends BaseEvent {
    type: typeof Events.STEP_FINISH;
    runId: string;
    agentName: string;
    conversationId?: string;
    stepIndex: number;
    maxSteps: number | undefined;
    toolCallCount: number;
    /** Present only when this finished step also ended the loop. */
    terminationReason?: StepTerminationReason;
}

export interface StepErrorEvent extends BaseEvent {
    type: typeof Events.STEP_ERROR;
    runId: string;
    agentName: string;
    conversationId?: string;
    stepIndex: number;
    maxSteps: number | undefined;
    error: BetterAgentErrorLike;
}

export interface ToolCallStartEvent extends BaseEvent {
    type: typeof Events.TOOL_CALL_START;
    runId: string;
    agentName: string;
    parentMessageId: string;
    toolCallId: string;
    toolCallName: string;
    toolTarget: ToolTarget;
}

export interface ToolCallArgsEvent extends BaseEvent {
    type: typeof Events.TOOL_CALL_ARGS;
    runId: string;
    agentName: string;
    parentMessageId: string;
    toolCallId: string;
    toolCallName: string;
    delta: string;
    toolTarget: ToolTarget;
}

export interface ToolCallEndEvent extends BaseEvent {
    type: typeof Events.TOOL_CALL_END;
    runId: string;
    agentName: string;
    parentMessageId: string;
    toolCallId: string;
    toolCallName: string;
    toolTarget: ToolTarget;
}

export interface ToolCallResultEvent extends BaseEvent {
    type: typeof Events.TOOL_CALL_RESULT;
    runId: string;
    agentName: string;
    parentMessageId: string;
    toolCallId: string;
    toolCallName: string;
    result: unknown;
    isError?: boolean;
    errorKind?: ToolErrorPayload["errorKind"];
    toolTarget: ToolTarget;
}

export interface ToolApprovalRequiredEvent extends BaseEvent {
    type: typeof Events.TOOL_APPROVAL_REQUIRED;
    runId: string;
    agentName: string;
    parentMessageId: string;
    toolCallId: string;
    toolCallName: string;
    toolTarget: ToolTarget;
    toolInput: unknown;
    state: "requested";
    meta?: Record<string, unknown>;
}

export interface ToolApprovalUpdatedEvent extends BaseEvent {
    type: typeof Events.TOOL_APPROVAL_UPDATED;
    runId: string;
    agentName: string;
    parentMessageId: string;
    toolCallId: string;
    toolCallName: string;
    toolTarget: ToolTarget;
    state: ToolApprovalState;
    toolInput: unknown;
    meta?: Record<string, unknown>;
    note?: string;
    actorId?: string;
}

export interface TextMessageStartEvent extends BaseEvent {
    type: typeof Events.TEXT_MESSAGE_START;
    messageId: string;
    role: Role;
}

export interface TextMessageContentEvent extends BaseEvent {
    type: typeof Events.TEXT_MESSAGE_CONTENT;
    messageId: string;
    delta: string;
}

export interface TextMessageEndEvent extends BaseEvent {
    type: typeof Events.TEXT_MESSAGE_END;
    messageId: string;
}

export interface ImageMessageStartEvent extends BaseEvent {
    type: typeof Events.IMAGE_MESSAGE_START;
    messageId: string;
    role: Role;
}

export interface ImageMessageContentEvent extends BaseEvent {
    type: typeof Events.IMAGE_MESSAGE_CONTENT;
    messageId: string;
    delta: { kind: "url"; url: string } | { kind: "base64"; data: string; mimeType: string };
}

export interface ImageMessageEndEvent extends BaseEvent {
    type: typeof Events.IMAGE_MESSAGE_END;
    messageId: string;
}

export interface VideoMessageStartEvent extends BaseEvent {
    type: typeof Events.VIDEO_MESSAGE_START;
    messageId: string;
    role: Role;
}

export interface VideoMessageContentEvent extends BaseEvent {
    type: typeof Events.VIDEO_MESSAGE_CONTENT;
    messageId: string;
    delta: { kind: "url"; url: string } | { kind: "base64"; data: string; mimeType: string };
}

export interface VideoMessageEndEvent extends BaseEvent {
    type: typeof Events.VIDEO_MESSAGE_END;
    messageId: string;
}

export interface AudioMessageStartEvent extends BaseEvent {
    type: typeof Events.AUDIO_MESSAGE_START;
    messageId: string;
    role: Role;
}

export interface AudioMessageContentEvent extends BaseEvent {
    type: typeof Events.AUDIO_MESSAGE_CONTENT;
    messageId: string;
    delta: {
        kind: "base64";
        data: string;
        mimeType: string;
    };
}

export interface AudioMessageEndEvent extends BaseEvent {
    type: typeof Events.AUDIO_MESSAGE_END;
    messageId: string;
}

export interface TranscriptMessageStartEvent extends BaseEvent {
    type: typeof Events.TRANSCRIPT_MESSAGE_START;
    messageId: string;
    role: Role;
}

export interface TranscriptMessageContentEvent extends BaseEvent {
    type: typeof Events.TRANSCRIPT_MESSAGE_CONTENT;
    messageId: string;
    delta: string;
}

export interface TranscriptMessageSegmentEvent extends BaseEvent {
    type: typeof Events.TRANSCRIPT_MESSAGE_SEGMENT;
    messageId: string;
    segment: {
        id: string;
        start: number;
        end: number;
        text: string;
        speaker?: string;
    };
}

export interface TranscriptMessageEndEvent extends BaseEvent {
    type: typeof Events.TRANSCRIPT_MESSAGE_END;
    messageId: string;
}

export interface ReasoningMessageStartEvent extends BaseEvent {
    type: typeof Events.REASONING_MESSAGE_START;
    messageId: string;
    role: Role;
    visibility: ReasoningVisibility;
}

export interface ReasoningMessageContentEvent extends BaseEvent {
    type: typeof Events.REASONING_MESSAGE_CONTENT;
    messageId: string;
    visibility: ReasoningVisibility;
    delta: string;
}

export interface ReasoningMessageEndEvent extends BaseEvent {
    type: typeof Events.REASONING_MESSAGE_END;
    messageId: string;
    visibility: ReasoningVisibility;
}

export interface EmbeddingMessageStartEvent extends BaseEvent {
    type: typeof Events.EMBEDDING_MESSAGE_START;
    messageId: string;
    role: Role;
}

export interface EmbeddingMessageContentEvent extends BaseEvent {
    type: typeof Events.EMBEDDING_MESSAGE_CONTENT;
    messageId: string;
    delta: number[];
}

export interface EmbeddingMessageEndEvent extends BaseEvent {
    type: typeof Events.EMBEDDING_MESSAGE_END;
    messageId: string;
}

export type ModelEvent =
    | TextMessageStartEvent
    | TextMessageContentEvent
    | TextMessageEndEvent
    | ImageMessageStartEvent
    | ImageMessageContentEvent
    | ImageMessageEndEvent
    | VideoMessageStartEvent
    | VideoMessageContentEvent
    | VideoMessageEndEvent
    | AudioMessageStartEvent
    | AudioMessageContentEvent
    | AudioMessageEndEvent
    | TranscriptMessageStartEvent
    | TranscriptMessageContentEvent
    | TranscriptMessageSegmentEvent
    | TranscriptMessageEndEvent
    | ReasoningMessageStartEvent
    | ReasoningMessageContentEvent
    | ReasoningMessageEndEvent
    | EmbeddingMessageStartEvent
    | EmbeddingMessageContentEvent
    | EmbeddingMessageEndEvent
    | ToolCallStartEvent
    | ToolCallArgsEvent
    | ToolCallEndEvent
    | ToolCallResultEvent;

export type Event =
    | RunStartedEvent
    | RunFinishedEvent
    | RunErrorEvent
    | RunAbortedEvent
    | DataPartEvent
    | StepStartEvent
    | StepFinishEvent
    | StepErrorEvent
    | ToolApprovalRequiredEvent
    | ToolApprovalUpdatedEvent
    | ModelEvent;
