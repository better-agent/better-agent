import type { SubmitToolApprovalParams, SubmitToolResultParams } from "@better-agent/core";
import type { Event } from "@better-agent/core/events";
import type { ConversationItem } from "@better-agent/core/providers";
import type {
    AgentNameFromApp,
    ModalitiesForAgent,
    RunInputForAgent,
    RunResultForAgent,
    ToolInputFromApp,
    ToolNameForApp,
} from "./client-type-helpers";
export type { RunInputForAgent } from "./client-type-helpers";

/** Configuration for `createClient`. */
export interface ClientConfig<TApp = unknown> {
    /** Better Agent API base URL. */
    baseURL: string;
    /** Better Agent auth secret, when the server requires bearer auth. */
    secret?: string;
    /** Default request headers. */
    headers?: Headers | Record<string, string>;
    /** Custom fetch implementation. */
    fetch?: typeof fetch;
    /** Default client tool handlers. */
    toolHandlers?: ToolHandlers<TApp>;
    /** Advanced options. */
    advanced?: {
        /** Rewrites outgoing requests. */
        prepareRequest?: (
            context: PrepareRequestContext,
        ) => PrepareRequestResult | undefined | Promise<PrepareRequestResult | undefined>;
        /** Max retries for tool results and approvals. */
        toolSubmissionMaxAttempts?: number;
        /** Base retry delay for tool results and approvals. */
        toolSubmissionRetryDelayMs?: number;
    };
}

/** Standard HTTP request methods. */
export type HttpMethod =
    | "GET"
    | "HEAD"
    | "POST"
    | "PUT"
    | "DELETE"
    | "CONNECT"
    | "OPTIONS"
    | "TRACE"
    | "PATCH";

/** Context passed to `prepareRequest`. */
export type PrepareRequestContext = {
    /** Request operation. */
    operation:
        | "run"
        | "stream"
        | "resume-stream"
        | "resume-conversation"
        | "load-conversation"
        | "abort-run"
        | "tool-result"
        | "tool-approval";
    /** Request URL before overrides. */
    url: string;
    /** Request method. */
    method: HttpMethod;
    /** Request headers before overrides. */
    headers: Headers | Record<string, string>;
    /** Request body, when present. */
    body?: BodyInit | null;
};

/** Overrides returned by `prepareRequest`. */
export type PrepareRequestResult = {
    /** URL override. */
    url?: string;
    /** Method override. */
    method?: HttpMethod;
    /** Headers override. */
    headers?: Headers | Record<string, string>;
    /** Body override. */
    body?: BodyInit | null;
};

/** Per-request transport options. */
export interface RequestOptions<_TApp = unknown> {
    /** Request-scoped headers. */
    headers?: Headers | Record<string, string>;
    /** Abort signal. */
    signal?: AbortSignal | null;
    /** Called after the HTTP response is received. */
    onResponse?: (response: Response) => void;
}

/** Options for streaming requests. */
export interface StreamRequestOptions<TApp = unknown> extends RequestOptions<TApp> {
    /** Request-scoped function tool handler. */
    onToolCall?: OnToolCall<TApp>;
    /** Request-scoped map tool handlers. */
    toolHandlers?: ToolHandlers<TApp>;
}

/** Request payload for `submitToolResult`. */
export type SubmitToolResultRequest<TApp = unknown> = {
    agent: AgentNameFromApp<TApp>;
} & SubmitToolResultParams;

/** Request payload for `submitToolApproval`. */
export type SubmitToolApprovalRequest<TApp = unknown> = {
    agent: AgentNameFromApp<TApp>;
} & SubmitToolApprovalParams;

/** Request payload for `abortRun`. */
export type AbortRunRequest<TApp = unknown> = {
    /** Agent name. */
    agent: AgentNameFromApp<TApp>;
    /** Run id. */
    runId: string;
};

export interface BetterAgentClient<TApp = unknown> {
    /**
     * Runs an agent and returns the final response.
     *
     * Use `stream()` when the agent may use client tools or approvals.
     */
    run<
        TAgentName extends AgentNameFromApp<TApp>,
        const TModalities extends ModalitiesForAgent<TApp, TAgentName> | undefined = undefined,
        TOutput = undefined,
    >(
        agent: TAgentName,
        input: RunInputForAgent<TApp, TAgentName, TModalities> & { output?: TOutput },
        options?: RequestOptions<TApp>,
    ): Promise<RunResultForAgent<TApp, TAgentName, Extract<TOutput, unknown>>>;
    /** Runs an agent and streams events. */
    stream<
        TAgentName extends AgentNameFromApp<TApp>,
        const TModalities extends ModalitiesForAgent<TApp, TAgentName> | undefined = undefined,
    >(
        agent: TAgentName,
        input: RunInputForAgent<TApp, TAgentName, TModalities>,
        options?: StreamRequestOptions<TApp>,
    ): AsyncIterable<ClientEvent>;
    /** Resumes one stream. */
    resumeStream<TAgentName extends AgentNameFromApp<TApp>>(
        agent: TAgentName,
        input: ReplayInput,
        options?: RequestOptions<TApp>,
    ): AsyncIterable<ClientEvent>;
    /** Resumes the active stream for a conversation. */
    resumeConversation<TAgentName extends AgentNameFromApp<TApp>>(
        agent: TAgentName,
        input: { conversationId: string; afterSeq?: number },
        options?: RequestOptions<TApp>,
    ): AsyncIterable<ClientEvent>;
    /**
     * Loads persisted conversation items.
     *
     * Returns `null` when no stored history exists.
     */
    loadConversation?(
        agent: AgentNameFromApp<TApp>,
        conversationId: string,
        options?: RequestOptions<TApp>,
    ): Promise<{ items: ConversationItem[] } | null>;
    /** Aborts an active run. */
    abortRun(req: AbortRunRequest<TApp>, options?: RequestOptions<TApp>): Promise<void>;
    /** Submits a client tool result. */
    submitToolResult(req: SubmitToolResultRequest<TApp>): Promise<void>;
    /** Submits a tool approval decision. */
    submitToolApproval(req: SubmitToolApprovalRequest<TApp>): Promise<void>;
}

/** Context passed to client tool handlers. */
export type ToolCallContext<TApp = unknown> = {
    /** Agent name. */
    agent: AgentNameFromApp<TApp>;
    /** Run id. */
    runId: string;
    /** Tool-call id. */
    toolCallId: string;
    /** Aborts when the run ends or disconnects. */
    signal?: AbortSignal;
};

/**
 * Map of tool handlers keyed by tool name.
 */
export type ToolHandlers<TApp = unknown> = Partial<{
    [TToolName in ToolNameForApp<TApp>]: (
        input: ToolInputFromApp<TApp, TToolName>,
        context: ToolCallContext<TApp>,
    ) => unknown | Promise<unknown>;
}>;

/**
 * Tool-call payload for function handlers.
 */
export type ToolCallRequest<TApp = unknown> = {
    /** Tool name. */
    toolName: ToolNameForApp<TApp>;
    /** Tool input. */
    input: unknown;
    /** Tool call context. */
    context: ToolCallContext<TApp>;
};

/** Function form for handling client tool calls. */
export type OnToolCall<TApp = unknown> = (
    params: ToolCallRequest<TApp>,
) => unknown | Promise<unknown>;

/** Input for replay and resume APIs. */
export type ReplayInput = {
    streamId: string;
    /**
     * Cursor to continue after.
     *
     * Use `-1` to resume from the start.
     */
    afterSeq?: number;
};

/**
 * Events emitted by client streams.
 *
 * `seq`, `streamId`, and `runId` are added by the client transport when needed.
 */
export type ClientEvent = Event & {
    seq?: number;
    streamId?: string;
    runId?: string;
};

/** Helper type for exposing the inferred client and agent-name union together. */
export type InferClient<TApp> = {
    agentNames: AgentNameFromApp<TApp>;
    client: BetterAgentClient<TApp>;
};
