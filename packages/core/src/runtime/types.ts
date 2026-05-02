import type { AgentEvent } from "../ag-ui/events";
import type { AgentMessage } from "../ag-ui/messages";
import type { AgentState } from "../ag-ui/state";
import type { AgentModelToolDefinition } from "../models";
import type { AgentToolChoice } from "../models";
import type { PluginRuntime } from "../plugins";
import type { AgentOutput } from "../schema";
import type { AnyDefinedTool } from "../tools/types";
import type { RuntimeHooks } from "./hooks";
import type { RuntimeInterrupt, RuntimeResumeEntry } from "./interrupts";
import type { FinishReason, TokenUsage } from "./results";
import type { BetterAgentIdContext, BetterAgentIdGenerator, BetterAgentIdKind } from "./utils";

export interface AgentRunContext {
    runId: string;
    threadId?: string;
    signal: AbortSignal;
    generateId(kind: BetterAgentIdKind, context?: BetterAgentIdContext): string;
}

export interface RunInput<
    TState = AgentState,
    TOutput extends AgentOutput | undefined = AgentOutput | undefined,
> {
    threadId?: string;
    messages: AgentMessage[];
    state?: TState;
    toolChoice?: AgentToolChoice;
    output?: TOutput;
    providerOptions?: unknown;
    maxSteps?: number;
    signal?: AbortSignal;
    resume?: RuntimeResumeEntry[];
}

export interface BaseRunResult<TState = AgentState, TStructured = unknown> {
    runId: string;
    threadId?: string;
    messages: AgentMessage[];
    state?: TState;
    usage?: TokenUsage;
    finishReason?: FinishReason;
    stepCount?: number;
    structured?: TStructured;
}

export type SuccessfulRunResult<TState = AgentState, TStructured = unknown> = BaseRunResult<
    TState,
    TStructured
> & {
    outcome: "success";
    interrupts?: undefined;
};

export type InterruptedRunResult<TState = AgentState, TStructured = unknown> = BaseRunResult<
    TState,
    TStructured
> & {
    outcome: "interrupt";
    interrupts: RuntimeInterrupt[];
};

export type RunResult<TState = AgentState, TStructured = unknown> =
    | SuccessfulRunResult<TState, TStructured>
    | InterruptedRunResult<TState, TStructured>;

export interface StreamResult<TState = AgentState, TStructured = unknown> {
    runId: string;
    threadId?: string;
    events: AsyncIterable<AgentEvent>;
    final: Promise<RunResult<TState, TStructured>>;
}

export interface RuntimeExecutionOptions {
    signal?: AbortSignal;
    checkAbort?: (message: string) => Promise<void> | void;
    executableTools?: AnyDefinedTool[];
    modelToolDefinitions?: AgentModelToolDefinition[];
    providerTools?: Record<string, unknown>;
    idGenerator?: BetterAgentIdGenerator;
    agentName?: string;
    context?: unknown;
    resume?: RuntimeResumeEntry[];
    hooks?: RuntimeHooks;
    pluginRuntime?: PluginRuntime;
}
