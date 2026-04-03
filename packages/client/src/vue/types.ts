import type { ComputedRef } from "vue";
import type { AgentClientError } from "../core/error";
import type { AgentNameFromApp, ModalitiesForAgent } from "../types/client-type-helpers";
import type {
    AgentChatControllerOptions,
    AgentStatus,
    ApproveToolCallParams,
    RetryResult,
    SendMessageInputForAgent,
    SendResult,
    SetMessagesInput,
} from "../types/controller";
import type { PendingToolApproval, UIMessage } from "../types/ui";

export type { SetMessagesInput, SubmitInput } from "../types/controller";

/** Options for `useAgent`. */
export type UseAgentOptions<
    TApp = unknown,
    TAgentName extends AgentNameFromApp<TApp> = AgentNameFromApp<TApp>,
> = AgentChatControllerOptions<TApp, TAgentName>;

/** Return type of `useAgent`. */
export interface UseAgentResult<
    TApp = unknown,
    TAgentName extends AgentNameFromApp<TApp> = AgentNameFromApp<TApp>,
> {
    /** Stable local chat id. */
    id: ComputedRef<string>;
    /** Conversation messages. */
    messages: ComputedRef<UIMessage[]>;
    /** Current request status. */
    status: ComputedRef<AgentStatus>;
    /** Latest client error. */
    error: ComputedRef<AgentClientError | undefined>;
    /** Latest stream id. */
    streamId: ComputedRef<string | undefined>;
    /** Latest run id. */
    runId: ComputedRef<string | undefined>;
    /** Conversation id, when configured. */
    conversationId: ComputedRef<string | undefined>;
    /** True while a request is active. */
    isLoading: ComputedRef<boolean>;
    /** True while streaming events are being consumed. */
    isStreaming: ComputedRef<boolean>;
    /** Pending tool approvals. */
    pendingToolApprovals: ComputedRef<PendingToolApproval[]>;
    /** Sends a message. */
    sendMessage<
        const TModalities extends ModalitiesForAgent<TApp, TAgentName> | undefined = undefined,
    >(
        input: SendMessageInputForAgent<TApp, TAgentName, TModalities>,
        options?: { signal?: AbortSignal },
    ): Promise<SendResult>;
    /** Retries the most recent user message. */
    regenerate(): Promise<void>;
    /** Retries one user message. */
    retryMessage(localId: string): Promise<RetryResult>;
    /** Stops the active run or stream. */
    stop(): void;
    /** Resumes one stream. */
    resumeStream(options: { streamId: string; afterSeq?: number }): Promise<void>;
    /** Resumes the active conversation stream. */
    resumeConversation(options?: { afterSeq?: number }): Promise<void>;
    /** Approves or denies a tool call. */
    approveToolCall(params: ApproveToolCallParams): Promise<void>;
    /** Clears the latest error. */
    clearError(): void;
    /** Resets local state. */
    reset(): void;
    /** Replaces the local messages. */
    setMessages(input: SetMessagesInput): void;
}
