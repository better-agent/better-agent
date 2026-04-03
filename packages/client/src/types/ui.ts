import type { ToolTarget } from "@better-agent/core";
import type {
    AudioContentBase,
    EmbeddingContentBase,
    FileContentBase,
    ImageContentBase,
    TextContentBase,
    VideoContentBase,
} from "@better-agent/core/providers";

export interface TextPart extends TextContentBase {
    /** Present when the part is complete. */
    state?: "complete";
}

export interface AudioPart extends AudioContentBase {
    /** Present when the part is complete. */
    state?: "complete";
}

export interface ImagePart extends ImageContentBase {
    /** Present when the part is complete. */
    state?: "complete";
}

export interface FilePart extends FileContentBase {
    /** Present when the part is complete. */
    state?: "complete";
}

export interface VideoPart extends VideoContentBase {
    /** Present when the part is complete. */
    state?: "complete";
}

export interface EmbeddingPart extends EmbeddingContentBase {
    /** Present when the part is complete. */
    state?: "complete";
}

export interface TranscriptPart {
    /** Part type. */
    type: "transcript";
    /** Transcript text. */
    text: string;
    /** Transcript segments. */
    segments?: Array<{
        /** Segment id. */
        id: string;
        /** Segment start time in seconds. */
        start: number;
        /** Segment end time in seconds. */
        end: number;
        /** Segment text. */
        text: string;
        /** Speaker label. */
        speaker?: string;
    }>;
    /** Provider metadata. */
    providerMetadata?: Record<string, unknown>;
    /** Present when the part is complete. */
    state?: "complete";
}

export interface ReasoningPart {
    /** Part type. */
    type: "reasoning";
    /** Reasoning text. */
    text: string;
    /** Reasoning visibility. */
    visibility: "summary" | "full";
    /** Provider name. */
    provider?: string;
    /** Provider metadata. */
    providerMetadata?: Record<string, unknown>;
    /** Present when the part is complete. */
    state?: "complete";
}

export interface ToolCallPart {
    /** Part type. */
    type: "tool-call";
    /** Tool-call id. */
    callId: string;
    /** Tool name. */
    name?: string;
    /** Tool arguments as JSON. */
    args?: string;
    /** Tool location. */
    toolTarget?: ToolTarget;
    /** Approval details. */
    approval?: {
        /** Approval input. */
        input?: unknown;
        /** Approval metadata. */
        meta?: Record<string, unknown>;
        /** Approval note. */
        note?: string;
        /** Actor id. */
        actorId?: string;
    };
    /** Tool-call status. */
    status: "pending" | "success" | "error";
    /** Tool-call lifecycle state. */
    state?:
        | "awaiting-input"
        | "input-streaming"
        | "input-complete"
        | "approval-requested"
        | "approval-approved"
        | "approval-denied"
        | "approval-expired"
        | "completed";
}

export interface ToolResultPart {
    /** Part type. */
    type: "tool-result";
    /** Tool-call id. */
    callId: string;
    /** Tool result payload. */
    result?: unknown;
    /** Tool-result status. */
    status: "pending" | "success" | "error";
}

/** One part inside a `UIMessage`. */
export type UIMessagePart =
    | TextPart
    | AudioPart
    | ImagePart
    | FilePart
    | VideoPart
    | EmbeddingPart
    | TranscriptPart
    | ReasoningPart
    | ToolCallPart
    | ToolResultPart;

export interface UIMessage {
    /**
     * Local message id.
     *
     * `setMessages` may omit this field; Better Agent will generate one.
     */
    localId: string;
    /** Server message id. */
    id?: string;
    /** Message role. */
    role: "system" | "assistant" | "user" | (string & {});
    /** Message parts. */
    parts: UIMessagePart[];
    /** Local delivery state. */
    status?: "pending" | "sent" | "failed";
    /** Local error message. */
    error?: string;
}

/** Pending approval extracted from the current message state. */
export interface PendingToolApproval {
    /** Tool-call id. */
    toolCallId: string;
    /** Tool name. */
    toolName?: string;
    /** Tool arguments as JSON. */
    args?: string;
    /** Tool location. */
    toolTarget?: ToolTarget;
    /** Approval input. */
    input?: unknown;
    /** Approval metadata. */
    meta?: Record<string, unknown>;
    /** Approval note. */
    note?: string;
    /** Actor id. */
    actorId?: string;
}
