import type { Readable } from "svelte/store";
import type { AgentController } from "../core/controller";
import type { AgentHasMemory, AgentNameOf } from "../core/inference";
import type {
    AgentControllerOptions,
    AgentControllerSnapshot,
    AgentInterruptState,
    AgentMessageInput,
    AgentStreamResume,
    SendOptions,
} from "../types";

export interface AgentChatOptions<
    TApp = unknown,
    TName extends AgentNameOf<TApp> = AgentNameOf<TApp>,
> extends Pick<
        AgentControllerOptions<TApp, TName>,
        "context" | "threadId" | "toolHandlers" | "onEvent" | "onFinish" | "onError"
    > {
    initialMessages?: AgentControllerOptions<TApp, TName>["initialMessages"];
    initialState?: unknown;
    resume?: AgentStreamResume;
    initialInterruptState?: AgentInterruptState;
}

export type AgentChatState = AgentControllerSnapshot;

export type AgentChatStore<
    TApp = unknown,
    TName extends AgentNameOf<TApp> = AgentNameOf<TApp>,
> = Readable<AgentControllerSnapshot> & {
    sendMessage(input: AgentMessageInput, options?: SendOptions<TApp, TName>): Promise<void>;
    stop(): void;
    resume(input?: AgentStreamResume): Promise<void>;
    approveToolCall(interruptId: string, metadata?: Record<string, unknown>): Promise<void>;
    rejectToolCall(interruptId: string, metadata?: Record<string, unknown> | string): Promise<void>;
    setMessages: AgentController<TApp, TName>["setMessages"];
} & (AgentHasMemory<TApp, TName> extends true
        ? {
              loadMessages(threadId?: string): Promise<void>;
              selectThread(threadId: string): Promise<void>;
              clearThread(): void;
          }
        : Record<never, never>);
