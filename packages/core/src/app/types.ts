import type { AgentEvent, AgentState } from "../ag-ui";
import type { AgentInputMessage } from "../ag-ui/messages";
import type { AgentContextOf, AnyDefinedAgent } from "../agent/types";
import type { AuthResolver } from "../auth/types";
import type { AgentMemory } from "../memory";
import type { AgentProviderOptionsFor, AgentToolChoice } from "../models";
import type { Plugin } from "../plugins";
import type { RunResult, StreamResult } from "../runtime/types";
import type { BetterAgentIdGenerator } from "../runtime/utils";
import type { AgentOutput, InferAgentOutput } from "../schema";
import type { BetterAgentStorage } from "../storage";

export interface BetterAgentConfig<
    TAgents extends readonly AnyDefinedAgent[] = readonly AnyDefinedAgent[],
> {
    agents: TAgents;
    plugins?: readonly Plugin[];
    auth?: AuthResolver;
    storage?: BetterAgentStorage;
    memory?: AgentMemory;
    advanced?: {
        generateId?: BetterAgentIdGenerator;
        stream?: {
            abortOnDisconnect?: boolean;
        };
    };
    basePath?: string;
}

export interface AppRunInput<
    TContext = unknown,
    TState = unknown,
    TProviderOptions = unknown,
    TOutput extends AgentOutput | undefined = AgentOutput | undefined,
> {
    threadId?: string;
    messages?: AgentInputMessage[];
    context?: TContext;
    state?: TState;
    toolChoice?: AgentToolChoice;
    output?: TOutput;
    providerOptions?: TProviderOptions;
    maxSteps?: number;
    signal?: AbortSignal;
    resume?: Array<{
        interruptId: string;
        status: "resolved" | "cancelled";
        payload?: unknown;
    }>;
}

export type AgentByName<
    TAgents extends readonly AnyDefinedAgent[],
    TName extends TAgents[number]["name"],
> = Extract<TAgents[number], { name: TName }>;

export type ProviderOptionsForAgent<TAgent> = TAgent extends { model: infer TModel }
    ? AgentProviderOptionsFor<TModel>
    : never;

export type OutputForAgent<TAgent> = TAgent extends { output?: infer TOutput }
    ? TOutput extends AgentOutput
        ? TOutput
        : undefined
    : undefined;

export type StructuredOutputForAgent<TAgent, TOutput> = TOutput extends AgentOutput
    ? InferAgentOutput<TOutput>
    : InferAgentOutput<OutputForAgent<TAgent>>;

export interface BetterAgentRuns {
    /**
     * @deprecated Use `agent("name").abort(runId)` instead.
     */
    abort(runId: string): Promise<void>;
    /**
     * @deprecated Use `agent("name").resumeStream({ runId })` instead.
     */
    resumeStream(input: {
        runId: string;
        afterSequence?: number;
        signal?: AbortSignal;
    }): AsyncIterable<AgentEvent & { seq: number }>;
}

export type BaseAgentHandle<TAgent extends AnyDefinedAgent> = {
    name: TAgent["name"];
    definition: TAgent;
    run<TState = AgentState, TOutput extends AgentOutput | undefined = undefined>(
        input: AppRunInput<
            AgentContextOf<TAgent>,
            TState,
            ProviderOptionsForAgent<TAgent>,
            TOutput
        >,
    ): Promise<RunResult<TState, StructuredOutputForAgent<TAgent, TOutput>>>;
    stream<TState = AgentState, TOutput extends AgentOutput | undefined = undefined>(
        input: AppRunInput<
            AgentContextOf<TAgent>,
            TState,
            ProviderOptionsForAgent<TAgent>,
            TOutput
        >,
    ): Promise<StreamResult<TState, StructuredOutputForAgent<TAgent, TOutput>>>;
    abort(runId?: string): Promise<void>;
    resumeStream(input: {
        runId?: string;
        afterSequence?: number;
        signal?: AbortSignal;
    }): AsyncIterable<AgentEvent & { seq: number }>;
};

export type AgentHandle<
    TAgent extends AnyDefinedAgent,
    TConfig extends BetterAgentConfig = BetterAgentConfig,
> = BaseAgentHandle<TAgent> &
    (TAgent extends { memory: false }
        ? Record<never, never>
        : TAgent extends { memory: AgentMemory }
          ? { memory: AgentMemory }
          : TConfig extends { memory: AgentMemory }
            ? { memory: AgentMemory }
            : Record<never, never>);

export interface BetterAgentApp<
    TAgents extends readonly AnyDefinedAgent[] = readonly AnyDefinedAgent[],
    TConfig extends BetterAgentConfig<TAgents> = BetterAgentConfig<TAgents>,
> {
    config: TConfig;
    handler(request: Request): Promise<Response>;
    agent<TName extends TAgents[number]["name"]>(
        name: TName,
    ): AgentHandle<AgentByName<TAgents, TName>, TConfig>;
    /**
     * @deprecated Use agent-scoped methods instead:
     * - `agent("name").abort(runId)`
     * - `agent("name").resumeStream({ runId })`
     */
    runs: BetterAgentRuns;
}
