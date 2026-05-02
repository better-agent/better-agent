import type { Accessor } from "solid-js";
import type { AgentController } from "../core/controller";
import type { BetterAgentClientError } from "../core/errors";
import type { AgentHasMemory, AgentNameOf } from "../core/inference";
import type {
    AgentControllerOptions,
    AgentControllerStatus,
    AgentInterruptState,
    AgentMessageInput,
    AgentStreamResume,
    PendingClientTool,
    PendingToolApproval,
    SendOptions,
    UIMessage,
} from "../types";

export type MaybeAccessor<T> = T | Accessor<T>;

export interface UseAgentOptions<
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

export type UseAgentResult<TApp = unknown, TName extends AgentNameOf<TApp> = AgentNameOf<TApp>> = {
    messages: Accessor<UIMessage[]>;
    state: Accessor<unknown>;
    status: Accessor<AgentControllerStatus>;
    error: Accessor<BetterAgentClientError | undefined>;
    runId: Accessor<string | undefined>;
    threadId: Accessor<string | undefined>;
    isRunning: Accessor<boolean>;
    pendingClientTools: Accessor<PendingClientTool[]>;
    pendingToolApprovals: Accessor<PendingToolApproval[]>;
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
