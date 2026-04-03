import type { Readable } from "svelte/store";
import type { BetterAgentClient } from "../types/client";
import type { AgentNameFromApp, ModalitiesForAgent } from "../types/client-type-helpers";
import type {
    AgentChatControllerOptions,
    AgentChatSnapshot,
    ApproveToolCallParams,
    RetryResult,
    SendMessageInputForAgent,
    SendResult,
    SetMessagesInput,
} from "../types/controller";

export type { SetMessagesInput, AgentChatSnapshot, SubmitInput } from "../types/controller";

/** Options for `createAgentChat`. */
export type AgentChatOptions<
    TApp = unknown,
    TAgentName extends AgentNameFromApp<TApp> = AgentNameFromApp<TApp>,
> = AgentChatControllerOptions<TApp, TAgentName>;

/** Snapshot shape exposed by the store. */
export type AgentChatState = AgentChatSnapshot;

/** Return type of `createAgentChat`. */
export interface AgentChatStore<
    TApp = unknown,
    TAgentName extends AgentNameFromApp<TApp> = AgentNameFromApp<TApp>,
> extends Readable<AgentChatSnapshot> {
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
    /** Updates controller options for future actions. */
    updateOptions(input: Partial<AgentChatControllerOptions<TApp, TAgentName>>): void;
    /** Replaces the transport client for future actions. */
    updateClient(client: BetterAgentClient<TApp>): void;
}
