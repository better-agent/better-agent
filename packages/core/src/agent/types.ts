import type { Awaitable, BivariantFn } from "../internal/types";
import type {
    Capabilities,
    GenerativeModel,
    GenerativeModelInputMessageContent,
    InferOutputSchema,
    InstructionEnabled,
    ModalitiesParam,
    ModalityOptionsFor,
    ModelOptions,
    OutputSchemaDefinition,
    OutputSchemaForCaps,
} from "../providers";
import type {
    ConversationReplayOptions,
    OnOutputError,
    OnStepContext,
    OnStepFinishContext,
    OutputErrorMode,
    RunAdvancedOptions,
    StopWhen,
} from "../run";
import type { InferSchemaInput, ResolvableSchema } from "../schema";
import type { OnToolError, OpenString, ToolErrorMode, ToolNamesOf, ToolSource } from "../tools";

/**
 * Defines an agent.
 */
export type AgentConversationReplayOptions = Omit<ConversationReplayOptions, "prepareInput"> & {
    prepareInput?: Exclude<ConversationReplayOptions["prepareInput"], null>;
};

/**
 * Defines an agent.
 */
export interface AgentDefinition<
    TName extends string = string,
    TModel extends AnyAgentModel = AnyAgentModel,
    TContextSchema extends ResolvableSchema | undefined = undefined,
    TContext = AgentContextFromSchema<TContextSchema>,
    TTools = undefined,
    TOutputSchema extends OutputSchemaForCaps<AgentModelCaps<TModel>> | undefined = undefined,
    TDefaultModalities extends ModalitiesParam<AgentModelCaps<TModel>> | undefined = undefined,
> {
    /** Stable agent name. */
    name: TName;
    /** Short description for humans. */
    description?: string;
    /** Model used for runs. */
    model: TModel;
    /**
     * Default model options for this agent's runs.
     *
     * Per-run overrides always win.
     */
    defaultModelOptions?: AgentModelOptions<TModel> &
        ModalityOptionsFor<AgentModelCaps<TModel>, TDefaultModalities>;
    /**
     * Default output modalities for this agent's runs.
     *
     * Per-run modalities always win.
     */
    defaultModalities?: TDefaultModalities;
    /**
     * Default system instruction.
     *
     * Can be static or derived from validated context.
     */
    instruction?: AgentInstruction<TContext, AgentModelCaps<TModel>>;
    /** Optional schema used to validate run context. */
    contextSchema?: TContextSchema;
    /**
     * Default structured output schema.
     *
     * Requires model with `outputModalities: { text: true }`.
     */
    outputSchema?: TOutputSchema;
    /** Tools available to the agent. */
    tools?: TTools;
    /** Default handling mode for recoverable tool failures. */
    toolErrorMode?: ToolErrorMode;
    /** Optional hook for customizing recoverable tool failures. */
    onToolError?: OnToolError;
    /** Default handling mode for structured output finalization failures. */
    outputErrorMode?: OutputErrorMode;
    /** Optional hook for customizing structured output finalization failures. */
    onOutputError?: OnOutputError;
    /**
     * Maximum number of loop steps per run.
     *
     * When omitted, a run stops naturally or when `stopWhen` returns `true`.
     */
    maxSteps?: number;
    /** Advanced runtime defaults for interactive flows. */
    advanced?: RunAdvancedOptions;
    /** Default replay shaping for stored conversation history used by this agent. */
    conversationReplay?: AgentConversationReplayOptions;
    /** Optional stop condition checked after each completed step. */
    stopWhen?: StopWhen<TContextSchema, TContext>;
    /** Optional hook called before each step starts. */
    onStep?: AgentOnStep<TContextSchema, TContext>;
    /** Optional hook called after each step completes. */
    onStepFinish?: AgentOnStepFinish<TContextSchema, TContext>;
}

/**
 * Broad agent definition type for heterogeneous collections.
 */
export type AnyAgentDefinition = {
    name: string;
    description?: string;
    // biome-ignore lint/suspicious/noExplicitAny: broad umbrella type for heterogeneous agents
    model: any;
    defaultModelOptions?: Record<string, unknown>;
    defaultModalities?: ModalitiesParam<Capabilities>;
    instruction?: unknown;
    contextSchema?: ResolvableSchema | undefined;
    outputSchema?: OutputSchemaDefinition | undefined;
    tools?: unknown;
    toolErrorMode?: ToolErrorMode;
    onToolError?: OnToolError;
    outputErrorMode?: OutputErrorMode;
    onOutputError?: OnOutputError;
    maxSteps?: number;
    advanced?: RunAdvancedOptions;
    conversationReplay?: AgentConversationReplayOptions;
    // biome-ignore lint/suspicious/noExplicitAny: erased agent definitions intentionally drop context specifics.
    stopWhen?: StopWhen<any, any>;
    // biome-ignore lint/suspicious/noExplicitAny: erased agent definitions intentionally drop context specifics.
    onStep?: AgentOnStep<any, any, Capabilities>;
    // biome-ignore lint/suspicious/noExplicitAny: erased agent definitions intentionally drop context specifics.
    onStepFinish?: AgentOnStepFinish<any, any>;
};

/**
 * Concrete agent shape after all generics are resolved.
 */
export type DefinedAgent<
    TName extends string,
    TModel extends AnyAgentModel,
    TContextSchema extends ResolvableSchema | undefined,
    TContext,
    TTools,
    TOutputSchema extends OutputSchemaForCaps<AgentModelCaps<TModel>> | undefined,
    TDefaultModalities extends ModalitiesParam<AgentModelCaps<TModel>> | undefined,
> = {
    name: TName;
    description?: string;
    model: TModel;
    defaultModelOptions?: AgentModelOptions<TModel> &
        ModalityOptionsFor<AgentModelCaps<TModel>, TDefaultModalities>;
    defaultModalities?: TDefaultModalities;
    instruction?: AgentInstruction<TContext, AgentModelCaps<TModel>>;
    tools?: TTools;
    toolErrorMode?: ToolErrorMode;
    onToolError?: OnToolError;
    outputErrorMode?: OutputErrorMode;
    onOutputError?: OnOutputError;
    maxSteps?: number;
    advanced?: RunAdvancedOptions;
    conversationReplay?: AgentConversationReplayOptions;
    stopWhen?: StopWhen<TContextSchema, TContext>;
    // biome-ignore lint/suspicious/noExplicitAny: widen caps to match AnyAgentDefinition's onStep signature
    onStep?: AgentOnStep<TContextSchema, TContext, any>;
    onStepFinish?: AgentOnStepFinish<TContextSchema, TContext>;
} & ([TContextSchema] extends [undefined]
    ? { contextSchema?: undefined }
    : { contextSchema: TContextSchema }) &
    ([TOutputSchema] extends [undefined]
        ? { outputSchema?: undefined }
        : { outputSchema: TOutputSchema });

export type DefineAgentConfig<
    TName extends string,
    TModel extends AnyAgentModel,
    TContextSchema extends ResolvableSchema | undefined,
    TContext,
    TTools,
    TOutputSchema extends OutputSchemaForCaps<AgentModelCaps<TModel>> | undefined,
    TDefaultModalities extends ModalitiesParam<AgentModelCaps<TModel>> | undefined,
> = Omit<
    AgentDefinition<
        TName,
        TModel,
        TContextSchema,
        TContext,
        TTools,
        TOutputSchema,
        TDefaultModalities
    >,
    | "outputSchema"
    | "outputErrorMode"
    | "onOutputError"
    | "tools"
    | "toolErrorMode"
    | "onToolError"
    | "instruction"
    | "onStep"
> &
    DefineAgentInstructionField<TModel, TContext> &
    DefineAgentToolFields<TModel, TContext, TTools> &
    DefineAgentHookFields<TModel, TContextSchema, TContext> &
    DefineAgentOutputSchemaField<TModel, TOutputSchema> &
    DefineAgentOutputErrorFields<TModel>;

/**
 * Instruction value accepted by an agent.
 */
export type AgentInstruction<
    TContext = unknown,
    TModelCaps extends Capabilities = Capabilities,
> = InstructionEnabled<TModelCaps> extends true
    ?
          | GenerativeModelInputMessageContent<TModelCaps>
          | BivariantFn<[TContext], GenerativeModelInputMessageContent<TModelCaps>>
    : never;

/**
 * Tool sources accepted by an agent.
 */
export type AgentTools<TContext = unknown> = ToolSource<TContext> | readonly ToolSource<TContext>[];

export type NormalizeAgentTools<TTools> = TTools extends readonly unknown[] ? TTools : TTools;

/**
 * `onStep` hook for an agent.
 */
export type AgentOnStep<
    TContextSchema extends ResolvableSchema | undefined = undefined,
    TContext = unknown,
    TModelCaps extends Capabilities = Capabilities,
> = BivariantFn<[OnStepContext<TContextSchema, TContext, TModelCaps>], Awaitable<void>>;

/**
 * `onStepFinish` hook for an agent.
 */
export type AgentOnStepFinish<
    TContextSchema extends ResolvableSchema | undefined = undefined,
    TContext = unknown,
> = (context: OnStepFinishContext<TContextSchema, TContext>) => Awaitable<void>;

/**
 * Provider-specific model options accepted by an agent's model.
 */
export type AgentModelOptions<TModel> = TModel extends GenerativeModel<
    infer TOptions,
    infer _TProviderId,
    infer _TModelId,
    infer _TCaps
>
    ? ModelOptions<TOptions>
    : Record<never, never>;

/**
 * Infers the validated context type from a context schema.
 */
export type AgentContextFromSchema<TSchema> = [TSchema] extends [undefined]
    ? unknown
    : InferSchemaInput<NonNullable<TSchema>>;

/**
 * Extracts the validated context type from an agent.
 */
export type AgentContext<TAgent> = TAgent extends AgentDefinition<
    infer _TName,
    infer _TModel,
    infer _TContextSchema,
    infer TContext,
    infer _TTools,
    infer _TOutputSchema,
    infer _TDefaultModalities
>
    ? TContext
    : unknown;

/**
 * Extracts the declared context schema from an agent.
 */
export type AgentContextSchema<TAgent> = TAgent extends AgentDefinition<
    infer _TName,
    infer _TModel,
    infer _TContextSchema,
    infer _TContext,
    infer _TTools,
    infer _TOutputSchema,
    infer _TDefaultModalities
>
    ? TAgent extends { contextSchema: infer TContextSchema }
        ? TContextSchema
        : undefined
    : undefined;

/**
 * Extracts the default output schema from an agent.
 */
export type AgentOutputSchema<TAgent> = TAgent extends AgentDefinition<
    infer _TName,
    infer _TModel,
    infer _TContextSchema,
    infer _TContext,
    infer _TTools,
    infer _TOutputSchema,
    infer _TDefaultModalities
>
    ? TAgent extends { outputSchema: infer TOutputSchema }
        ? TOutputSchema
        : undefined
    : undefined;

/**
 * Extracts the default output modalities from an agent.
 */
export type AgentDefaultModalities<TAgent> = TAgent extends AgentDefinition<
    infer _TName,
    infer _TModel,
    infer _TContextSchema,
    infer _TContext,
    infer _TTools,
    infer _TOutputSchema,
    infer TDefaultModalities
>
    ? TDefaultModalities
    : undefined;

/**
 * Infers the structured output payload produced by an agent.
 */
export type AgentStructuredOutput<TAgent> = InferOutputSchema<AgentOutputSchema<TAgent>>;

/**
 * Static tool-name union for an agent.
 */
export type AgentKnownToolName<TAgent> = TAgent extends AgentDefinition<
    infer _TName,
    infer _TModel,
    infer _TContextSchema,
    infer _TContext,
    infer TTools,
    infer _TOutputSchema,
    infer _TDefaultModalities
>
    ? OpenString<ToolNamesOf<NonNullable<TTools>>>
    : string;

type AnyAgentModel = {
    readonly providerId: string;
    readonly modelId: string;
    readonly caps: Capabilities;
    // biome-ignore lint/suspicious/noExplicitAny: broad bridge type for heterogeneous model implementations
    doGenerate?(...args: any[]): unknown;
    // biome-ignore lint/suspicious/noExplicitAny: broad bridge type for heterogeneous model implementations
    doGenerateStream?(...args: any[]): unknown;
};

export type AgentModelCaps<TModel> = TModel extends {
    caps: infer TCaps extends Capabilities;
}
    ? TCaps
    : Capabilities;

type DefineAgentOutputSchemaField<
    TModel extends AnyAgentModel,
    TOutputSchema extends OutputSchemaForCaps<AgentModelCaps<TModel>> | undefined,
> = [OutputSchemaForCaps<AgentModelCaps<TModel>>] extends [never]
    ? object
    : {
          /** Optional default structured output schema for runs that do not override `output`. */
          outputSchema?: TOutputSchema;
      };

type DefineAgentOutputErrorFields<TModel extends AnyAgentModel> = [
    OutputSchemaForCaps<AgentModelCaps<TModel>>,
] extends [never]
    ? object
    : {
          /** Default handling mode for structured output finalization failures. */
          outputErrorMode?: OutputErrorMode;
          /** Optional hook for customizing structured output finalization failures. */
          onOutputError?: OnOutputError;
      };

type DefineAgentInstructionField<TModel extends AnyAgentModel, TContext> = InstructionEnabled<
    AgentModelCaps<TModel>
> extends true
    ? {
          /**
           * Main instruction for the agent.
           * Can be static or derived from validated context.
           */
          instruction?: AgentInstruction<TContext, AgentModelCaps<TModel>>;
      }
    : object;

type DefineAgentToolFields<
    TModel extends AnyAgentModel,
    _TContext,
    TTools,
> = AgentModelCaps<TModel>["tools"] extends true
    ? {
          /** Tools available to the agent. */
          tools?: TTools;
          /** Default handling mode for recoverable tool failures. */
          toolErrorMode?: ToolErrorMode;
          /** Optional hook for customizing recoverable tool failures. */
          onToolError?: OnToolError;
      }
    : object;

type DefineAgentHookFields<
    TModel extends AnyAgentModel,
    TContextSchema extends ResolvableSchema | undefined,
    TContext,
> = {
    /** Optional hook called before each step starts. */
    onStep?: AgentOnStep<TContextSchema, TContext, AgentModelCaps<TModel>>;
};
