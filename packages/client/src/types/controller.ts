import type { AgentEvent } from "@better-agent/core";

import type { BetterAgentClientError } from "../core/errors";
import type { AgentContextFor, AgentNameOf, ToolHandlersFor } from "../core/inference";
import type { UIMessage } from "./ui";

export type AgentControllerStatus = "ready" | "submitted" | "streaming" | "error" | "interrupted";

export interface AgentStreamResume {
    runId: string;
    afterSequence?: number;
}

export interface AgentInterruptState {
    runId?: string;
    status?: Extract<AgentControllerStatus, "ready" | "interrupted">;
    pendingClientTools?: PendingClientTool[];
    pendingToolApprovals?: PendingToolApproval[];
}
export type AgentMessageInput = string | UIMessage[];

export interface PendingClientTool {
    interruptId: string;
    runId: string;
    toolCallId: string;
    toolName: string;
    input: unknown;
    expiresAt?: string;
}

export interface PendingToolApproval {
    interruptId: string;
    runId: string;
    toolCallId: string;
    toolName: string;
    input: unknown;
    metadata?: Record<string, unknown>;
    approved?: boolean;
    responseMetadata?: Record<string, unknown>;
    expiresAt?: string;
}

export interface AgentControllerFinish {
    generatedMessages: UIMessage[];
    messages: UIMessage[];
    runId?: string;
    threadId?: string;
    isAbort: boolean;
    isDisconnect: boolean;
    isError: boolean;
    isInterrupted: boolean;
    error?: BetterAgentClientError;
    interruptReason?: "client_tool_pending" | "tool_approval_pending" | "other";
    pendingClientTools: PendingClientTool[];
    pendingToolApprovals: PendingToolApproval[];
}

export interface AgentControllerLifecycleHooks {
    onEvent?: (event: AgentEvent) => void | Promise<void>;
    onFinish?: (finish: AgentControllerFinish) => void | Promise<void>;
    onError?: (error: BetterAgentClientError) => void | Promise<void>;
}

export interface SendOptions<TApp = unknown, TName extends AgentNameOf<TApp> = AgentNameOf<TApp>> {
    context?: AgentContextFor<TApp, TName>;
    signal?: AbortSignal | null;
}

export interface AgentControllerOptions<
    TApp = unknown,
    TName extends AgentNameOf<TApp> = AgentNameOf<TApp>,
> extends AgentControllerLifecycleHooks {
    initialMessages?: UIMessage[];
    initialState?: unknown;
    initialInterruptState?: AgentInterruptState;
    context?: AgentContextFor<TApp, TName>;
    resume?: AgentStreamResume;
    threadId?: string;
    toolHandlers?: ToolHandlersFor<TApp, TName>;
}

export interface AgentControllerSnapshot {
    messages: UIMessage[];
    state?: unknown;
    status: AgentControllerStatus;
    error?: BetterAgentClientError;
    runId?: string;
    threadId?: string;
    isRunning: boolean;
    pendingClientTools: PendingClientTool[];
    pendingToolApprovals: PendingToolApproval[];
}
