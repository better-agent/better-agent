import type { BivariantFn } from "@better-agent/shared/types";
import type { AgentStateHandle } from "../ag-ui/state";
import type { InferSchemaOutput, ResolvableSchema } from "../schema";

export type ToolTarget = "server" | "client";

export type ToolErrorMode = "send_to_model" | "throw";

export interface ToolInterruptConfig {
    timeoutMs?: number;
    approval?: {
        timeoutMs?: number;
    };
    clientTool?: {
        timeoutMs?: number;
    };
}

export interface ToolApprovalConfig<TInput = unknown, TContext = unknown> {
    enabled?: boolean;
    resolve?: BivariantFn<
        [
            {
                toolInput: TInput;
                context: TContext;
                runId: string;
                toolCallId: string;
                toolName: string;
                toolTarget: ToolTarget;
            },
        ],
        | boolean
        | {
              enabled?: boolean;
              metadata?: Record<string, unknown>;
          }
        | Promise<
              | boolean
              | {
                    enabled?: boolean;
                    metadata?: Record<string, unknown>;
                }
          >
    >;
}

export interface ToolExecutionContext<TContext = unknown> {
    context: TContext;
    runId: string;
    agentName?: string;
    threadId?: string;
    toolCallId: string;
    toolName: string;
    signal: AbortSignal;
    state: AgentStateHandle;
}

export interface BaseToolDefinition<
    TInputSchema extends ResolvableSchema = ResolvableSchema,
    TOutputSchema extends ResolvableSchema | undefined = undefined,
    TContext = unknown,
> {
    name: string;
    description?: string;
    inputSchema: TInputSchema;
    strict?: boolean;
    outputSchema?: TOutputSchema;
    interrupt?: ToolInterruptConfig;
    approval?: ToolApprovalConfig<InferSchemaOutput<TInputSchema>, TContext>;
    toolErrorMode?: ToolErrorMode;
    toModelOutput?: BivariantFn<[output: InferToolOutput<TOutputSchema>], unknown>;
}

export interface ServerToolDefinition<
    TInputSchema extends ResolvableSchema = ResolvableSchema,
    TOutputSchema extends ResolvableSchema | undefined = undefined,
    TContext = unknown,
> extends BaseToolDefinition<TInputSchema, TOutputSchema, TContext> {
    target: "server";
    execute: BivariantFn<
        [input: InferSchemaOutput<TInputSchema>, context: ToolExecutionContext<TContext>],
        Promise<InferToolOutput<TOutputSchema>> | InferToolOutput<TOutputSchema>
    >;
}

export interface ClientToolDefinition<
    TInputSchema extends ResolvableSchema = ResolvableSchema,
    TOutputSchema extends ResolvableSchema | undefined = undefined,
    TContext = unknown,
> extends BaseToolDefinition<TInputSchema, TOutputSchema, TContext> {
    target: "client";
}

export interface ToolDefinitionInput<
    TName extends string,
    TInputSchema extends ResolvableSchema = ResolvableSchema,
    TOutputSchema extends ResolvableSchema | undefined = undefined,
    TContext = unknown,
    TTarget extends ToolTarget = ToolTarget,
> {
    name: TName;
    description?: string;
    target: TTarget;
    inputSchema: TInputSchema;
    strict?: boolean;
    outputSchema?: TOutputSchema;
    interrupt?: ToolInterruptConfig;
    approval?: ToolApprovalConfig<InferSchemaOutput<TInputSchema>, TContext>;
    toolErrorMode?: ToolErrorMode;
    toModelOutput?: BivariantFn<[output: InferToolOutput<TOutputSchema>], unknown>;
    execute?:
        | BivariantFn<
              [input: InferSchemaOutput<TInputSchema>, context: ToolExecutionContext<TContext>],
              Promise<InferToolOutput<TOutputSchema>> | InferToolOutput<TOutputSchema>
          >
        | undefined;
}

export type InferToolOutput<TSchema extends ResolvableSchema | undefined = undefined> =
    TSchema extends ResolvableSchema ? InferSchemaOutput<TSchema> : unknown;

export interface AnyDefinedTool {
    name: string;
    description?: string;
    target: ToolTarget;
    inputSchema: ResolvableSchema;
    strict?: boolean;
    outputSchema?: ResolvableSchema;
    interrupt?: ToolInterruptConfig;
    approval?: ToolApprovalConfig<unknown, unknown>;
    toolErrorMode?: ToolErrorMode;
    toModelOutput?: BivariantFn<[output: unknown], unknown>;
    execute?: BivariantFn<
        [input: unknown, context: ToolExecutionContext<unknown>],
        Promise<unknown> | unknown
    >;
}

export type ProviderToolDefinition = Record<string, unknown>;

export type AnyToolDefinition = AnyDefinedTool | ProviderToolDefinition;

export type ToolList = ReadonlyArray<AnyToolDefinition>;

export type ToolSource<TContext = unknown> =
    | ToolList
    | BivariantFn<[context: TContext], ToolList | Promise<ToolList>>;
