import type { Awaitable } from "@better-agent/shared/types";
import type { AgentEvent } from "../ag-ui/events";
import type { AgentMessage, AgentToolResultStatus } from "../ag-ui/messages";
import type { AgentStateHandle } from "../ag-ui/state";
import type { AuthContext } from "../auth/types";
import type { AgentModelGenerateResult, AgentToolChoice } from "../models";
import type { RuntimeInterrupt } from "../runtime/interrupts";
import type { FinishReason, TokenUsage } from "../runtime/results";
import type { AnyDefinedTool, AnyToolDefinition, ToolSource } from "../tools/types";

export type PluginEndpointMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "OPTIONS";

export interface Plugin {
    id: string;
    guards?: PluginGuard[];
    endpoints?: PluginEndpoint[];
    events?: {
        subscribe?: AgentEvent["type"][];
        middleware?: PluginEventMiddleware[];
    };
    onEvent?: (event: AgentEvent, ctx: PluginEventContext) => Awaitable<void>;
    tools?: ToolSource<unknown>;
    onStep?: (ctx: PluginStepContext) => Awaitable<void>;
    onStepFinish?: (ctx: PluginStepFinishContext) => Awaitable<void>;
    onBeforeModelCall?: (ctx: PluginModelCallContext) => Awaitable<void>;
    onAfterModelCall?: (ctx: PluginModelResponseContext) => Awaitable<void>;
    onBeforeToolCall?: (ctx: PluginToolCallContext) => Awaitable<PluginToolCallDecision>;
    onAfterToolCall?: (ctx: PluginToolResultContext) => Awaitable<void>;
}

export interface PluginEndpoint {
    method: PluginEndpointMethod | PluginEndpointMethod[];
    path: string;
    handler: PluginEndpointHandler;
}

export type PluginEndpointHandler = (ctx: {
    request: Request;
    params: Record<string, string>;
    query: URLSearchParams;
    auth: AuthContext | null;
}) => Awaitable<Response>;

export type PluginEventMiddleware = (
    event: AgentEvent,
    ctx: PluginEventContext,
    next: (event: AgentEvent) => Promise<AgentEvent | null>,
) => Promise<AgentEvent | null>;

export interface PluginEventContext {
    runId: string;
    agentName: string;
    threadId?: string;
    control: {
        abortRun: () => Promise<void>;
    };
}

export interface PluginBaseRunContext {
    runId: string;
    agentName: string;
    threadId?: string;
    context?: unknown;
}

export interface PluginStepContext extends PluginBaseRunContext {
    stepIndex: number;
    maxSteps?: number;
    signal: AbortSignal;
    messages: readonly AgentMessage[];
    registeredTools: readonly AnyDefinedTool[];
    activeTools: readonly string[] | undefined;
    state: AgentStateHandle;
    updateMessages(updater: (messages: readonly AgentMessage[]) => AgentMessage[]): void;
    setActiveTools(toolNames: readonly string[]): void;
}

export interface PluginStepFinishContext extends PluginBaseRunContext {
    stepIndex: number;
    maxSteps?: number;
    signal: AbortSignal;
    messages: readonly AgentMessage[];
    state: AgentStateHandle;
    result: {
        outcome: "continue" | "success" | "interrupt";
        interrupts?: RuntimeInterrupt[];
        usage?: TokenUsage;
        finishReason?: FinishReason;
        toolCallCount: number;
    };
}

export interface PluginModelCallContext extends PluginBaseRunContext {
    stepIndex: number;
    messages: AgentMessage[];
    tools: AnyDefinedTool[];
    toolChoice?: AgentToolChoice;
    providerTools?: Record<string, unknown>;
    providerOptions?: unknown;
    setMessages(messages: AgentMessage[]): void;
    setTools(tools: AnyDefinedTool[]): void;
    setToolChoice(toolChoice: AgentToolChoice | undefined): void;
    setProviderTools(providerTools: Record<string, unknown> | undefined): void;
    setProviderOptions(providerOptions: unknown): void;
}

export interface PluginModelResponseContext extends PluginBaseRunContext {
    stepIndex: number;
    response: AgentModelGenerateResult;
}

export interface PluginToolCallContext extends PluginBaseRunContext {
    toolName: string;
    toolCallId: string;
    input: unknown;
    setInput(input: unknown): void;
}

export type PluginToolCallDecision =
    | undefined
    | {
          skip: true;
          status?: AgentToolResultStatus;
          result?: unknown;
          error?: string;
      };

export interface PluginToolResultContext extends PluginBaseRunContext {
    toolName: string;
    toolCallId: string;
    input: unknown;
    status: AgentToolResultStatus;
    result: unknown;
    error?: string;
    setStatus(status: AgentToolResultStatus): void;
    setResult(result: unknown): void;
    setError(error: string | undefined): void;
}

export type PluginGuard = (ctx: PluginGuardContext) => Awaitable<Response | null>;

export interface PluginGuardContext {
    agentName: string;
    input: Record<string, unknown>;
    request: Request;
    auth: AuthContext | null;
}

export interface PluginRuntimeEndpoint {
    pluginId: string;
    method: PluginEndpointMethod;
    path: string;
    handler: PluginEndpointHandler;
}

export interface PluginRuntime {
    plugins: readonly Plugin[];
    endpoints: readonly PluginRuntimeEndpoint[];
    hasGuards: boolean;
    hasEndpoints: boolean;
    hasEventMiddleware: boolean;
    hasOnEvent: boolean;
    hasTools: boolean;
    hasStepHooks: boolean;
    hasModelHooks: boolean;
    hasToolHooks: boolean;
    dispatchGuard(ctx: PluginGuardContext): Promise<Response | null>;
    dispatchEvent(event: AgentEvent, ctx: PluginEventContext): Promise<AgentEvent | null>;
    dispatchOnEvent(event: AgentEvent, ctx: PluginEventContext): Promise<void>;
    resolveTools(context?: unknown): Promise<AnyToolDefinition[]>;
    applyOnStep(ctx: PluginStepContext): Promise<void>;
    applyOnStepFinish(ctx: PluginStepFinishContext): Promise<void>;
    applyBeforeModelCall(ctx: PluginModelCallContext): Promise<void>;
    applyAfterModelCall(ctx: PluginModelResponseContext): Promise<void>;
    applyBeforeToolCall(ctx: PluginToolCallContext): Promise<PluginToolCallDecision>;
    applyAfterToolCall(ctx: PluginToolResultContext): Promise<void>;
}
