import type {
    ActivityMessage,
    AssistantMessage,
    DeveloperMessage,
    InputContent,
    ReasoningMessage,
    Role,
    SystemMessage,
    ToolMessage,
    UserMessage,
} from "@ag-ui/core";

export type AgentMessageContent = string | InputContent[];
export type AgentMessageRole = Role;
export type AgentToolResultStatus = "success" | "error" | "denied";
export type AgentSource = {
    id: string;
    sourceType: "url";
    url: string;
    title?: string;
    providerMetadata?: unknown;
};
export type AgentDeveloperMessage = DeveloperMessage;
export type AgentSystemMessage = SystemMessage;
export type AgentUserMessage = UserMessage;
export type AgentAssistantToolCall = NonNullable<AssistantMessage["toolCalls"]>[number] & {
    providerExecuted?: boolean;
};
export type AgentAssistantMessage = Omit<AssistantMessage, "content" | "toolCalls"> & {
    content?: AgentMessageContent;
    toolCalls?: AgentAssistantToolCall[];
    sources?: AgentSource[];
};
export type AgentToolMessage = ToolMessage & {
    status?: AgentToolResultStatus;
    approval?: {
        approved?: boolean;
        metadata?: Record<string, unknown>;
    };
};
export type AgentActivityMessage = ActivityMessage;
export type AgentReasoningMessage = ReasoningMessage;
export type AgentMessage =
    | AgentDeveloperMessage
    | AgentSystemMessage
    | AgentUserMessage
    | AgentToolMessage
    | AgentActivityMessage
    | AgentReasoningMessage
    | AgentAssistantMessage;

type OptionalMessageId<T> = T extends { id: string } ? Omit<T, "id"> & { id?: string } : T;

export type AgentInputMessage = OptionalMessageId<AgentMessage>;
