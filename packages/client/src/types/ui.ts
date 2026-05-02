export type UIMessageRole = "user" | "assistant" | "system";

export interface UIMessage {
    id: string;
    role: UIMessageRole;
    parts: UIMessagePart[];
}

export type UIMessagePart =
    | TextUIPart
    | ReasoningUIPart
    | ToolCallUIPart
    | ToolResultUIPart
    | SourceUIPart
    | ImageUIPart
    | AudioUIPart
    | VideoUIPart
    | FileUIPart;

export type TextUIPart = {
    type: "text";
    text: string;
};

export type ReasoningUIPart = {
    type: "reasoning";
    text: string;
};

export type ToolCallUIPart = {
    type: "tool-call";
    toolCallId: string;
    toolName: string;
    inputText: string;
    input?: unknown;
    state: ToolCallState;
    approval?: {
        interruptId: string;
        needsApproval: boolean;
        approved?: boolean;
        metadata?: Record<string, unknown>;
    };
    providerExecuted?: boolean;
};

export type ToolCallState =
    | "awaiting-input"
    | "input-streaming"
    | "input-available"
    | "approval-requested"
    | "approval-responded";

export type ToolResultUIPart = {
    type: "tool-result";
    toolCallId: string;
    state: ToolResultState;
    result?: unknown;
    error?: string;
};

export type ToolResultState = "output-available" | "output-error" | "output-denied";

export type SourceUIPart = {
    type: "source";
    sourceId: string;
    sourceType: "url";
    url: string;
    title?: string;
};

export type ImageUIPart = {
    type: "image";
    url: string;
    mimeType?: string;
};

export type AudioUIPart = {
    type: "audio";
    url: string;
    mimeType?: string;
};

export type VideoUIPart = {
    type: "video";
    url: string;
    mimeType?: string;
};

export type FileUIPart = {
    type: "file";
    url: string;
    mimeType?: string;
    fileName?: string;
};
