import type {
    AgentEvent,
    AgentMessage,
    AppRunInput,
    MemoryMessage,
    RunResult,
    RuntimeInterrupt,
} from "@better-agent/core";
import type { AgentContextFor, AgentHasMemory, AgentNameOf } from "../core/inference";

export interface BetterAgentClientConfig {
    baseURL: string;
    fetch?: typeof fetch;
    headers?: HeadersInit | (() => HeadersInit | Promise<HeadersInit>);
    credentials?: RequestCredentials;
    prepareRequest?: (
        request: PreparedRequest,
    ) => PreparedRequest | undefined | Promise<PreparedRequest | undefined>;
}

export interface PreparedRequest {
    url: string;
    method: string;
    headers: Headers;
    body?: BodyInit | null;
}

export interface RequestOptions {
    headers?: HeadersInit;
    signal?: AbortSignal | null;
}

type ClientInputMessage = AgentMessage extends infer T
    ? T extends { id: string }
        ? Omit<T, "id"> & { id?: string }
        : T
    : never;

export type ClientRunInput<
    TApp = unknown,
    TName extends AgentNameOf<TApp> = AgentNameOf<TApp>,
> = Omit<AppRunInput, "messages" | "signal" | "context"> & {
    messages?: ClientInputMessage[];
    context?: AgentContextFor<TApp, TName>;
};

export interface BetterAgentClientAgentHandle<
    TApp = unknown,
    TName extends AgentNameOf<TApp> = AgentNameOf<TApp>,
> {
    runs: BetterAgentClientRuns;
    run(input: ClientRunInput<TApp, TName>, options?: RequestOptions): Promise<RunResult>;
    stream(input: ClientRunInput<TApp, TName>, options?: RequestOptions): AsyncIterable<AgentEvent>;
    abort(runId?: string, options?: RequestOptions): Promise<void>;
    resumeStream(
        input: {
            runId?: string;
            afterSequence?: number;
        },
        options?: RequestOptions,
    ): AsyncIterable<AgentEvent>;
}

export type BetterAgentClientAgentMemoryHandle<
    TApp = unknown,
    TName extends AgentNameOf<TApp> = AgentNameOf<TApp>,
> = BetterAgentClientAgentHandle<TApp, TName> & {
    memory: BetterAgentClientMemory;
};

export type ClientMemoryThreadCreateInput = {
    title?: string;
    metadata?: Record<string, unknown>;
};

export type ClientMemoryThreadUpdateInput = {
    title?: string;
    metadata?: Record<string, unknown>;
};

export type ClientMemoryThread = {
    id: string;
    agentName: string;
    title?: string;
    state?: unknown;
    metadata?: Record<string, unknown>;
    createdAt: number;
    updatedAt: number;
};

export type ClientThreadRuntime = {
    interrupted?: {
        runId: string;
        interrupts: RuntimeInterrupt[];
    };
    resumable?: {
        runId: string;
        afterSequence: 0;
    };
};

export interface BetterAgentClientMemory {
    threads: {
        list(input?: { limit?: number }, options?: RequestOptions): Promise<ClientMemoryThread[]>;
        create(
            input?: ClientMemoryThreadCreateInput,
            options?: RequestOptions,
        ): Promise<ClientMemoryThread>;
        get(threadId: string, options?: RequestOptions): Promise<ClientMemoryThread>;
        update(
            threadId: string,
            input: ClientMemoryThreadUpdateInput,
            options?: RequestOptions,
        ): Promise<ClientMemoryThread>;
        delete(threadId: string, options?: RequestOptions): Promise<void>;
        runtime(threadId: string, options?: RequestOptions): Promise<ClientThreadRuntime>;
    };
    messages: {
        list(
            threadId: string,
            input?: { limit?: number; beforeRunId?: string },
            options?: RequestOptions,
        ): Promise<MemoryMessage[]>;
    };
}

export interface BetterAgentClientRuns {
    /**
     * @deprecated Use `agent("name").abort(runId)` instead.
     */
    abort(runId: string, options?: RequestOptions): Promise<void>;
    /**
     * @deprecated Use `agent("name").resumeStream({ runId })` instead.
     */
    resumeStream(
        input: {
            runId: string;
            afterSequence?: number;
        },
        options?: RequestOptions,
    ): AsyncIterable<AgentEvent>;
}

export interface BetterAgentClient<TApp = unknown> {
    agent<TName extends AgentNameOf<TApp>>(
        agentName: TName,
    ): AgentHasMemory<TApp, TName> extends true
        ? BetterAgentClientAgentMemoryHandle<TApp, TName>
        : BetterAgentClientAgentHandle<TApp, TName>;
    /**
     * @deprecated Use agent-scoped methods instead:
     * - `agent("name").abort(runId)`
     * - `agent("name").resumeStream({ runId })`
     */
    runs: BetterAgentClientRuns;
}
