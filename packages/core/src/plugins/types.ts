import type { HttpMethod } from "../api";
import type { Event, EventName } from "../events";
import type { Awaitable } from "../internal/types";
import type {
    Capabilities,
    ConversationItem,
    GenerativeModelInputItem,
    GenerativeModelInputMessageContent,
    GenerativeModelResponse,
    InstructionEnabled,
    ToolChoice,
} from "../providers";
import type { PreviousStepResult } from "../run";
import type { AgentToolDefinition, ToolSource } from "../tools";

/**
 * Request mode passed to plugin guards.
 *
 * - `run`: one-shot non-streaming agent execution via the built-in run route.
 * - `stream`: streaming agent execution via the built-in run route with SSE.
 * - `load_conversation`: durable conversation history lookup.
 * - `abort_run`: abort request for an active run id.
 * - `resume_stream`: stream event resumption by known stream id.
 * - `resume_conversation`: active conversation stream resumption by conversation id.
 */
export type PluginGuardMode =
    | "run"
    | "stream"
    | "load_conversation"
    | "abort_run"
    | "resume_stream"
    | "resume_conversation";

/**
 * Plugin definition.
 *
 * Plugin hook contexts are intentionally broad at authoring time. Some
 * capability-sensitive controls may be omitted at runtime for models that do
 * not support them. For example, tool-mutation helpers are only available
 * during runs whose active model supports tools.
 */
export interface Plugin {
    /** Unique plugin id. */
    id: string;
    /** Event middleware configuration. */
    events?: {
        /** Event type filter. When omitted, receives all events. */
        subscribe?: EventName[];
        /** Ordered middleware chain for matching events. */
        middleware?: PluginEventMiddleware[];
    };
    /** Request guard functions. */
    guards?: PluginGuard[];
    /** Custom HTTP endpoints. */
    endpoints?: PluginEndpoint[];
    /** Event observer that cannot mutate or drop events. */
    onEvent?: (event: Event, ctx: PluginEventContext) => Awaitable<void>;
    /** Additional tools available to all agents. */
    tools?: ToolSource<unknown>;
    /** Called before each model call, before agent.onStep. */
    onStep?: (ctx: PluginOnStepContext) => Awaitable<void>;
    /** Transform model input just before the provider call. */
    onBeforeModelCall?: (ctx: PluginModelCallContext) => Awaitable<void>;
    /** Observe model response after the provider call, before tool execution. */
    onAfterModelCall?: (ctx: PluginModelResponseContext) => Awaitable<void>;
    /** Called before a tool executes. Can skip or modify args. */
    onBeforeToolCall?: (ctx: PluginToolCallContext) => Awaitable<PluginToolCallDecision>;
    /** Called after a tool executes. Can observe or modify result. */
    onAfterToolCall?: (ctx: PluginToolResultContext) => Awaitable<void>;
    /** Transform durable items before conversation persistence. */
    onBeforeSave?: (ctx: PluginSaveContext) => Awaitable<void>;
}

/**
 * Plugin endpoint definition.
 *
 * @example
 * ```ts
 * endpoints: [
 *   {
 *     method: "GET",
 *     path: "/health",
 *     public: true,
 *     handler: () => Response.json({ ok: true }),
 *   },
 * ]
 * ```
 */
export interface PluginEndpoint {
    /** HTTP method or methods. */
    method: HttpMethod | HttpMethod[];
    /** Route path pattern. Must start with `/`. */
    path: string;
    /**
     * Bypasses the app's built-in bearer `secret` auth for this endpoint.
     *
     * This does not bypass auth outside Better Agent.
     */
    public?: boolean;
    /** Endpoint handler. */
    handler: PluginEndpointHandler;
}

/**
 * Plugin endpoint handler.
 */
export type PluginEndpointHandler = (ctx: {
    request: Request;
    params: Record<string, string>;
    query: URLSearchParams;
}) => Promise<Response> | Response;

/**
 * Plugin event middleware.
 *
 * Return the next event to continue, or `null` to drop it.
 */
export type PluginEventMiddleware = (
    event: Event,
    ctx: PluginEventContext,
    next: (event: Event) => Promise<Event | null>,
) => Promise<Event | null>;

/**
 * Context passed to plugin event middleware.
 */
export interface PluginEventContext {
    /** Active run id. */
    runId: string;
    /** Agent name for this run. */
    agentName: string;
    /** Shared conversation id, if present. */
    conversationId?: string;
    /** Run control helpers. */
    control: {
        /** Aborts the active run. */
        abortRun: () => Promise<void>;
    };
}

/**
 * Shared base for plugin hook contexts tied to a live run.
 */
export interface PluginBaseContext {
    /** Active run id. */
    runId: string;
    /** Agent name for this run. */
    agentName: string;
    /** Shared conversation id, if present. */
    conversationId?: string;
}

/**
 * Context passed to plugin onStep hooks.
 *
 * Plugins always receive `context` as `unknown`.
 */
type PluginToolControlField<TModelCaps extends Capabilities = Capabilities> =
    TModelCaps["tools"] extends true
        ? {
              setToolChoice(choice: ToolChoice): void;
              setActiveTools(names: readonly string[]): void;
          }
        : Record<never, never>;

type PluginInstructionControlField<TModelCaps extends Capabilities = Capabilities> =
    InstructionEnabled<TModelCaps> extends true
        ? {
              setSystemInstruction(
                  instruction: GenerativeModelInputMessageContent<TModelCaps>,
              ): void;
          }
        : Record<never, never>;

export type PluginOnStepContext<TModelCaps extends Capabilities = Capabilities> =
    PluginBaseContext & {
        stepIndex: number;
        maxSteps: number | undefined;
        messages: GenerativeModelInputItem<TModelCaps>[];
        /** Agent context as `unknown`. Plugins cannot assume its shape. */
        context?: unknown;
        previousStep?: PreviousStepResult;
        updateMessages(
            updater: (
                messages: GenerativeModelInputItem<TModelCaps>[],
            ) => GenerativeModelInputItem<TModelCaps>[],
        ): void;
    } & PluginInstructionControlField<TModelCaps> &
        PluginToolControlField<TModelCaps>;

/**
 * Context passed to plugin `onBeforeModelCall` hooks.
 */
export interface PluginModelCallContext extends PluginBaseContext {
    stepIndex: number;
    input: GenerativeModelInputItem[];
    tools: AgentToolDefinition[];
    toolChoice?: ToolChoice;
    setInput(input: GenerativeModelInputItem[]): void;
    setTools(tools: AgentToolDefinition[]): void;
    setToolChoice(choice: ToolChoice | undefined): void;
}

/**
 * Context passed to plugin `onAfterModelCall` hooks.
 */
export interface PluginModelResponseContext extends PluginBaseContext {
    stepIndex: number;
    response: GenerativeModelResponse;
}

/**
 * Context passed to plugin `onBeforeToolCall` hooks.
 */
export interface PluginToolCallContext extends PluginBaseContext {
    toolName: string;
    toolCallId: string;
    args: unknown;
    setArgs(args: unknown): void;
}

/**
 * Decision returned by plugin `onBeforeToolCall` hooks.
 */
export type PluginToolCallDecision = undefined | { skip: true; result?: unknown };

// TODO: In the future, we should consider explicit status mutation for plugin tool hooks.
/**
 * Context passed to plugin `onAfterToolCall` hooks.
 */
export interface PluginToolResultContext extends PluginBaseContext {
    toolName: string;
    toolCallId: string;
    args: unknown;
    result: unknown;
    error?: string;
    setResult(result: unknown): void;
}

/**
 * Context passed to plugin `onBeforeSave` hooks.
 */
export interface PluginSaveContext extends PluginBaseContext {
    items: ConversationItem[];
    setItems(items: ConversationItem[]): void;
}

/**
 * Plugin guard.
 *
 * Return `null` to allow the request, or a `Response` to reject it.
 */
export type PluginGuard = (ctx: PluginRunContext) => Promise<Response | null> | Response | null;

/**
 * Context passed to plugin guards.
 */
export interface PluginRunContext {
    /** Request mode. */
    mode: PluginGuardMode;
    /** Resolved agent name. */
    agentName: string;
    /** Parsed request body. */
    input: Record<string, unknown>;
    /** Original request object. */
    request: Request;
    /** Active plugins. */
    plugins: readonly Plugin[];
}

/**
 * Normalized plugin endpoint used at runtime.
 */
export type PluginRuntimeEndpoint = {
    /** Plugin id that owns this endpoint. */
    pluginId: string;
    /** HTTP method. */
    method: HttpMethod;
    /** Route path pattern. */
    path: string;
    /** When true, this endpoint bypasses the app's built-in bearer auth. */
    public?: boolean;
    /** Endpoint handler. */
    handler: PluginEndpointHandler;
};

/**
 * Prepared plugin runtime consumed by the runner and server.
 */
export interface PluginRuntime {
    /** Original plugin list in registration order. */
    plugins: readonly Plugin[];
    /** Expanded endpoint routes with one method per entry. */
    endpoints: readonly PluginRuntimeEndpoint[];
    /** Fast flag used to skip event middleware when unused. */
    hasEventMiddleware: boolean;
    /** Fast flag used to skip `onEvent` hooks when unused. */
    hasOnEvent: boolean;
    /** Fast flag used to skip guards when unused. */
    hasGuards: boolean;
    /** Fast flag used to skip plugin-provided tools when unused. */
    hasTools: boolean;
    /** Fast flag used to skip `onStep` hooks when unused. */
    hasOnStep: boolean;
    /** Fast flag used to skip model hooks when unused. */
    hasModelHooks: boolean;
    /** Fast flag used to skip tool hooks when unused. */
    hasToolHooks: boolean;
    /** Fast flag used to skip `onBeforeSave` hooks when unused. */
    hasOnBeforeSave: boolean;
    /** Dispatches an event through plugin middleware. */
    dispatchEvent(event: Event, ctx: PluginEventContext): Promise<Event | null>;
    /** Notifies observing plugins after the event is committed. */
    dispatchOnEvent(event: Event, ctx: PluginEventContext): Promise<void>;
    /** Dispatches a run request through the guard chain. */
    dispatchRun(ctx: PluginRunContext): Promise<Response | null>;
    /** Resolves additional plugin-provided tools for one run. */
    resolveTools<TContext>(context?: TContext): Promise<{
        tools: AgentToolDefinition[];
        runCleanup: () => Awaitable<void>;
    }>;
    /** Applies `onStep` hooks in registration order. */
    applyOnStep<
        TContext,
        TToolName extends string = string,
        TModelCaps extends Capabilities = Capabilities,
    >(params: {
        runId: string;
        agentName: string;
        conversationId?: string;
        stepIndex: number;
        maxSteps: number | undefined;
        messages: GenerativeModelInputItem<TModelCaps>[];
        context?: TContext;
        previousStep?: PreviousStepResult;
        /** Model capabilities used to determine which control helpers are valid. */
        modelCaps?: TModelCaps;
    }): Promise<{
        messages: GenerativeModelInputItem<TModelCaps>[];
        toolChoice?: ToolChoice;
        activeTools?: TToolName[];
        systemInstruction?: GenerativeModelInputMessageContent<TModelCaps>;
    }>;
    /** Applies `onBeforeModelCall` hooks in registration order. */
    applyBeforeModelCall(params: {
        runId: string;
        agentName: string;
        conversationId?: string;
        stepIndex: number;
        input: GenerativeModelInputItem[];
        tools: AgentToolDefinition[];
        toolChoice?: ToolChoice;
        /** Model capabilities used to determine which control helpers are valid. */
        modelCaps?: Capabilities;
    }): Promise<{
        input: GenerativeModelInputItem[];
        tools: AgentToolDefinition[];
        toolChoice?: ToolChoice;
    }>;
    /** Notifies plugins after a model response is available. */
    applyAfterModelCall(params: {
        runId: string;
        agentName: string;
        conversationId?: string;
        stepIndex: number;
        response: GenerativeModelResponse;
    }): Promise<void>;
    /** Applies `onBeforeToolCall` hooks in registration order. */
    applyBeforeToolCall(params: {
        runId: string;
        agentName: string;
        conversationId?: string;
        toolName: string;
        toolCallId: string;
        args: unknown;
    }): Promise<{ args: unknown; decision?: PluginToolCallDecision }>;
    /** Notifies plugins after tool execution and allows result mutation. */
    applyAfterToolCall(params: {
        runId: string;
        agentName: string;
        conversationId?: string;
        toolName: string;
        toolCallId: string;
        args: unknown;
        result: unknown;
        error?: string;
    }): Promise<{ result: unknown }>;
    /** Applies `onBeforeSave` hooks in registration order. */
    applyBeforeSave(params: {
        runId: string;
        agentName: string;
        conversationId?: string;
        items: ConversationItem[];
    }): Promise<ConversationItem[]>;
}
