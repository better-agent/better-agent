/**
 * Framework-agnostic Better Agent client entrypoint.
 *
 * Framework wrappers live under the `react`, `preact`, `vue`, `solid`, and
 * `svelte` subpaths.
 */
export { createClient } from "./core/client";
export { createAgentChatController } from "./core/controller";
export type { AgentChatController } from "./core/controller";
export { getEventErrorMessage, toAgentClientError } from "./core/error";
export type { AgentClientError } from "./core/error";
export { pruneInputByCapabilities } from "@better-agent/core";
export { fromConversationItems, fromModelMessages, toModelMessages } from "./core/utils";

export type {
    InferClient,
    BetterAgentClient,
    ClientConfig,
    ClientEvent,
    ToolHandlers,
    OnToolCall,
    ReplayInput,
    RequestOptions,
    StreamRequestOptions,
    SubmitToolResultRequest,
    SubmitToolApprovalRequest,
    ToolCallContext,
    ToolCallRequest,
} from "./types/client";
export type {
    AgentContext,
    AgentRunInput,
    AgentNameFromApp,
    AgentsFromApp,
    ModalitiesForAgent,
    NormalizeClientApp,
    RunInputForAgent,
    TextInputShorthandForAgent,
} from "./types/client-type-helpers";

export type {
    AgentChatSnapshot,
    AgentChatControllerOptions,
    AgentStatus,
    PrepareMessages,
    SendResult,
    RetryResult,
    ApproveToolCallParams,
    OnFinishParams,
    ResumeOption,
    SendMessageOptions,
    SetMessagesInput,
    SubmitInput,
    UIMessageInput,
} from "./types/controller";

export type {
    UIMessage,
    UIMessagePart,
    PendingToolApproval,
    TextPart,
    AudioPart,
    ImagePart,
    FilePart,
    VideoPart,
    EmbeddingPart,
    TranscriptPart,
    ReasoningPart,
    ToolCallPart,
    ToolResultPart,
} from "./types/ui";
