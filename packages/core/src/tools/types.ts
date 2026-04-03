import type { Event } from "../events";
import type { Awaitable, BivariantFn } from "../internal/types";
import type { InferSchemaInput, ResolvableSchema } from "../schema";
import { TOOL_CLEANUP, TOOL_JSON_SCHEMA } from "./constants";

/**
 * Runtime location where a tool executes.
 */
export type ToolTarget = "server" | "client" | "hosted";

/**
 * Approval state for a tool call.
 */
export type ToolApprovalState = "requested" | "approved" | "denied" | "expired";

/**
 * Approval decisions that can be submitted for a pending tool call.
 */
export type ToolApprovalDecision = Extract<ToolApprovalState, "approved" | "denied">;

/**
 * Default handling mode for recoverable tool failures.
 */
export type ToolErrorMode = "tool_error" | "throw";

/**
 * Preserves autocomplete for known string literals while allowing arbitrary strings.
 */
export type OpenString<TKnown extends string> = TKnown | (string & {});

/**
 * Extracts the static `name` from a tool definition.
 */
export type ToolNameOf<TTool> = TTool extends { name: infer TName extends string } ? TName : never;

type AwaitedToolValue<TValue> = TValue extends PromiseLike<infer TResolved>
    ? AwaitedToolValue<TResolved>
    : TValue;

/**
 * Extracts tool-name literals from tool definitions or factories.
 */
export type ToolNamesOf<TValue> = AwaitedToolValue<TValue> extends readonly (infer TItem)[]
    ? ToolNamesOf<TItem>
    : AwaitedToolValue<TValue> extends (...args: infer _TArgs) => infer TResult
      ? ToolNamesOf<TResult>
      : ToolNameOf<AwaitedToolValue<TValue>>;

/**
 * Tool error payload sent back to the model.
 */
export interface ToolErrorPayload {
    type: "tool_error";
    toolName: string;
    errorKind: "parse" | "validation" | "execution";
    message: string;
    retryable?: boolean;
}

/**
 * Shared context available to all tool error hooks.
 */
export interface ToolErrorBase {
    toolName: string;
    toolCallId: string;
    error: unknown;
    rawArguments: string;
}

/**
 * Parse error context for tool argument JSON failures.
 */
export interface ParseToolError extends ToolErrorBase {
    errorKind: "parse";
}

/**
 * Validation error context for schema validation failures.
 */
export interface ValidationToolError extends ToolErrorBase {
    errorKind: "validation";
    input: unknown;
}

/**
 * Execution error context for handler, client, or MCP failures.
 */
export interface ExecutionToolError extends ToolErrorBase {
    errorKind: "execution";
    input: unknown;
}

/**
 * Union of all recoverable tool error contexts.
 */
export type ToolErrorContext = ParseToolError | ValidationToolError | ExecutionToolError;

/**
 * Sends a structured tool error result back to the model.
 */
export interface SendToModelAction {
    action: "send_to_model";
    message?: string;
    retryable?: boolean;
}

/**
 * Skips the current hook layer and falls through.
 */
export interface SkipAction {
    action: "skip";
}

/**
 * Re-throws the original recoverable tool failure and stops the run.
 */
export interface ThrowAction {
    action: "throw";
}

/**
 * Provides replacement tool input to validate and execute again.
 */
export interface RepairAction {
    action: "repair";
    input: unknown;
}

/**
 * Retries the tool handler with the same validated input.
 *
 * Valid only for execution errors.
 */
export interface RetryAction {
    action: "retry";
    maxAttempts?: number;
}

/**
 * Provides a successful fallback tool result.
 *
 * Valid only for execution errors.
 */
export interface ResultAction {
    action: "result";
    value: unknown;
}

/**
 * Allowed return values for parse error hooks.
 */
export type ParseToolErrorResult =
    | SendToModelAction
    | ThrowAction
    | RepairAction
    | SkipAction
    | undefined;
/**
 * Allowed return values for schema validation error hooks.
 */
export type ValidationToolErrorResult =
    | SendToModelAction
    | ThrowAction
    | RepairAction
    | SkipAction
    | undefined;
/**
 * Allowed return values for execution error hooks.
 */
export type ExecutionToolErrorResult =
    | SendToModelAction
    | SkipAction
    | ThrowAction
    | RepairAction
    | RetryAction
    | ResultAction
    | undefined;

export type ToolErrorResultFor<T extends ToolErrorContext> = T extends ParseToolError
    ? ParseToolErrorResult
    : T extends ValidationToolError
      ? ValidationToolErrorResult
      : T extends ExecutionToolError
        ? ExecutionToolErrorResult
        : never;

/**
 * Hook for customizing recoverable tool error behavior.
 */
export type OnToolError = <T extends ToolErrorContext>(
    context: T,
) => Awaitable<ToolErrorResultFor<T>>;

/**
 * Approval policy for a tool.
 */
// biome-ignore lint/suspicious/noExplicitAny: reusable tools default to loose run context unless explicitly narrowed
export type ToolApprovalConfig<TContext = any, TInput = unknown> = {
    /** Whether approval is required before executing this tool. */
    required?: boolean;
    /** Optional timeout for approval in milliseconds. */
    timeoutMs?: number;
    /** Optional metadata forwarded to approval UI or policy systems. */
    meta?: Record<string, unknown>;
    /** Dynamic approval resolver based on context and input. */
    resolve?: BivariantFn<
        [
            {
                context: TContext;
                input: TInput;
                runId: string;
                toolCallId: string;
                toolName: string;
                toolTarget: Exclude<ToolTarget, "hosted">;
            },
        ],
        Awaitable<{
            required?: boolean;
            timeoutMs?: number;
            meta?: Record<string, unknown>;
        }>
    >;
};

/**
 * Approval config specialized to a validated tool input schema and run context.
 */
export type BoundToolApprovalConfig<
    TContext,
    TSchema extends ResolvableSchema,
> = ToolApprovalConfig<TContext, InferSchemaInput<TSchema>>;

/**
 * Extra context passed to a tool handler at call time.
 */
export interface ToolRunContext {
    /** Abort signal for cancelling the active run. */
    signal: AbortSignal;
    /** Emits runtime events while the tool is running. */
    emit: (event: Event) => Awaitable<void>;
}

/**
 * Tool handler.
 *
 * @typeParam TInput Parsed and validated tool input type.
 */
export type ToolHandler<TInput, TResult = unknown> = BivariantFn<
    [TInput, ToolRunContext],
    Awaitable<TResult>
>;

/**
 * Shared tool contract shape without a concrete runtime implementation.
 */
export interface ToolContractConfig<
    TSchema extends ResolvableSchema,
    TName extends string = string,
    // biome-ignore lint/suspicious/noExplicitAny: reusable tools default to loose run context unless explicitly narrowed
    TContext = any,
> {
    /** Stable tool name exposed to the model. */
    name: TName;

    /** Short description shown to the model. */
    description?: string;

    /** Input schema used for validation and model-facing tool definitions. */
    schema: TSchema;

    /** When true, input validation should be strict when supported by the runtime. */
    strict?: boolean;

    /** Optional approval policy for this tool call. */
    approval?: BoundToolApprovalConfig<TContext, TSchema>;

    /** Optional default handling mode for recoverable tool failures. */
    toolErrorMode?: ToolErrorMode;

    /** Optional hook for customizing recoverable tool failures. */
    onToolError?: OnToolError;

    /** Optional per-run cleanup hook collected via {@link TOOL_CLEANUP}. */
    [TOOL_CLEANUP]?: () => Awaitable<void>;

    /** Optional pre-resolved JSON Schema. Skips conversion when present. */
    [TOOL_JSON_SCHEMA]?: Record<string, unknown>;
}

/**
 * Tool contract returned by `defineTool(...)`.
 */
export type ToolContract<
    TSchema extends ResolvableSchema,
    TName extends string = string,
    // biome-ignore lint/suspicious/noExplicitAny: reusable tools default to loose run context unless explicitly narrowed
    TContext = any,
> = ToolContractConfig<TSchema, TName, TContext> & {
    [TOOL_JSON_SCHEMA]: Record<string, unknown>;

    /**
     * Creates a server-executed implementation.
     */
    server: <TAs extends string | undefined = undefined, TResult = unknown>(
        handler: ToolHandler<InferSchemaInput<TSchema>, TResult>,
        options?: {
            /**
             * Override for the final tool `name`.
             */
            as?: TAs;
        },
    ) => ServerToolDefinition<TSchema, TAs extends string ? TAs : TName, TResult, TContext>;

    /**
     * Creates a client-executed declaration.
     */
    client: <TAs extends string | undefined = undefined>(options?: {
        /**
         * Override for the final tool `name`.
         */
        as?: TAs;
    }) => ClientToolDefinition<TSchema, TAs extends string ? TAs : TName, TContext>;
};

/**
 * Server tool definition executed by the Better Agent runtime.
 */
export type ServerToolDefinition<
    TSchema extends ResolvableSchema = ResolvableSchema,
    TName extends string = string,
    TResult = unknown,
    // biome-ignore lint/suspicious/noExplicitAny: reusable tools default to loose run context unless explicitly narrowed
    TContext = any,
> = {
    /** Discriminator for server-executed tools. */
    kind: "server";
    /** Stable tool name exposed to the model. */
    name: TName;
    /** Short description shown to the model. */
    description?: string;
    /** Original schema value kept for reference. */
    schema: TSchema;
    /** When true, input validation should be strict when supported by the runtime. */
    strict?: boolean;
    /** Optional approval policy for this tool call. */
    approval?: BoundToolApprovalConfig<TContext, TSchema>;
    /** Optional default handling mode for recoverable tool failures. */
    toolErrorMode?: ToolErrorMode;
    /** Optional hook for customizing recoverable tool failures. */
    onToolError?: OnToolError;
    /** Tool implementation. Receives validated input and runtime context. */
    handler: ToolHandler<InferSchemaInput<TSchema>, TResult>;
    /** Optional per-run cleanup hook collected via {@link TOOL_CLEANUP}. */
    [TOOL_CLEANUP]?: () => Awaitable<void>;
    /** Resolved JSON Schema for the tool input. */
    [TOOL_JSON_SCHEMA]: Record<string, unknown>;
};

/**
 * Provider-hosted tool definition.
 */
export type HostedToolDefinition<
    TProvider extends string = string,
    TType extends string = string,
    TConfig extends Record<string, unknown> = Record<string, unknown>,
> = {
    /** Discriminator for provider-executed tools. */
    kind: "hosted";
    /** Provider id that understands this hosted tool shape. */
    provider: TProvider;
    /** Provider-native tool type identifier. */
    type: TType;
    /** Provider-native config payload forwarded by provider mappers. */
    config: TConfig;
    /** Optional display or metadata name. */
    name?: string;
    /** Optional display or metadata description. */
    description?: string;
    /** Optional per-run cleanup hook collected via {@link TOOL_CLEANUP}. */
    [TOOL_CLEANUP]?: () => Awaitable<void>;
};

/**
 * Client tool definition exposed by the server runtime and executed by the client app.
 */
export type ClientToolDefinition<
    TSchema extends ResolvableSchema = ResolvableSchema,
    TName extends string = string,
    // biome-ignore lint/suspicious/noExplicitAny: reusable tools default to loose run context unless explicitly narrowed
    TContext = any,
> = {
    /** Discriminator for client-executed tools. */
    kind: "client";
    /** Stable tool name exposed to the model. */
    name: TName;
    /** Short description shown to the model. */
    description?: string;
    /** Original schema value kept for reference. */
    schema: TSchema;
    /** When true, input validation should be strict when supported by the runtime. */
    strict?: boolean;
    /** Optional approval policy for this tool call. */
    approval?: BoundToolApprovalConfig<TContext, TSchema>;
    /** Optional default handling mode for recoverable tool failures. */
    toolErrorMode?: ToolErrorMode;
    /** Optional hook for customizing recoverable tool failures. */
    onToolError?: OnToolError;
    /** Optional per-run cleanup hook collected via {@link TOOL_CLEANUP}. */
    [TOOL_CLEANUP]?: () => Awaitable<void>;
    /** Resolved JSON Schema for the tool input. */
    [TOOL_JSON_SCHEMA]: Record<string, unknown>;
};

/**
 * Tool union used by agent and runtime APIs.
 */
export type AgentToolDefinition<
    // biome-ignore lint/suspicious/noExplicitAny: umbrella tool type defaults to loose run context
    TContext = any,
> =
    // biome-ignore lint/suspicious/noExplicitAny: schema type is intentionally erased in the umbrella union
    | ServerToolDefinition<any, string, unknown, TContext>
    // biome-ignore lint/suspicious/noExplicitAny: schema type is intentionally erased in the umbrella union
    | ClientToolDefinition<any, string, TContext>
    | HostedToolDefinition;

/**
 * Tool definitions returned by one source.
 */
export type ToolSourceResult = readonly AgentToolDefinition[] | AgentToolDefinition;

/**
 * Tool definitions plus optional provider-lifecycle disposal.
 */
export interface LazyToolSourceResult {
    tools: ToolSourceResult;
    /** Optional disposer for cached provider resources such as MCP clients. */
    dispose?: () => Awaitable<void>;
}

/**
 * Loader used by {@link LazyToolSource} to populate and cache tools.
 */
export type LazyToolLoader<TContext = unknown> = BivariantFn<
    [] | [TContext | undefined],
    Awaitable<ToolSourceResult | LazyToolSourceResult>
>;

/**
 * Lifecycle-aware tool source that caches a resolved tool set across runs.
 */
export interface LazyToolSource<TContext = unknown> {
    /** Internal discriminator for lazy tool sources. */
    readonly kind: "lazy";
    /** Resolves and caches tool definitions. Concurrent calls share one load. */
    resolve(context: TContext | undefined): Promise<LazyToolSourceResult>;
    /** Disposes cached resources and clears the cache. Safe to call multiple times. */
    dispose(): Promise<void>;
    /** Forces a reload by disposing the current cache before resolving again. */
    reload(context: TContext | undefined): Promise<LazyToolSourceResult>;
}

/**
 * Creates tool definitions from context.
 */
export type ToolListFactory<TContext> = BivariantFn<
    [TContext | undefined],
    Awaitable<ToolSourceResult>
>;

/**
 * Tool source accepted by agents and runtimes.
 */
export type ToolSource<TContext> =
    | LazyToolSource<TContext>
    | ToolListFactory<TContext>
    | Awaitable<ToolSourceResult>;

/**
 * Resolves the runtime target for a tool definition.
 */
export type ToolDefinitionTarget<TTool extends AgentToolDefinition = AgentToolDefinition> =
    TTool["kind"] extends ToolTarget ? TTool["kind"] : ToolTarget;
