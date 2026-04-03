import type {
    AgentContext,
    AgentContextSchema,
    AgentDefinition,
    AgentModelCaps,
    AgentOutputSchema,
    AnyAgentDefinition,
} from "../agent";
import type { Event } from "../events";
import type { Awaitable, BivariantFn } from "../internal/types";
import type {
    ConversationRuntimeStateStore,
    ConversationStore,
    StreamEvent,
    StreamStore,
} from "../persistence";
import type { PluginRuntime } from "../plugins";
import type {
    Capabilities,
    ConversationItem,
    GenerativeModel,
    GenerativeModelInput,
    GenerativeModelInputItem,
    GenerativeModelInputMessageContent,
    GenerativeModelResponse,
    InferOutputSchema,
    InstructionEnabled,
    ModalitiesParam,
    ModalityOptionsFor,
    ModelOptions,
    OutputSchemaDefinition,
    OutputSchemaForCaps,
    StructuredOutput,
    ToolChoice,
} from "../providers";
import type { ResolvableSchema } from "../schema";
import type { AgentToolDefinition } from "../tools";
import type { PendingToolRuntime } from "./pending-tools";

/**
 * Conditional `context` field based on whether a schema is defined.
 */
export type ConditionalContextField<
    TContextSchema extends ResolvableSchema | undefined,
    TContext,
> = [TContextSchema] extends [undefined]
    ? Record<never, never>
    : undefined extends TContextSchema
      ? { context?: TContext }
      : { context: TContext };

/**
 * Final result returned when a run completes.
 */
export interface RunResult<TStructured = unknown> {
    /** Final model response for the run. */
    response: GenerativeModelResponse;
    /** Parsed and validated structured output, when requested. */
    structured?: TStructured;
}

/**
 * Live stream handle returned by `.stream()`.
 */
export interface StreamResult<TStructured = unknown> {
    /** Unique id for this run. */
    runId: string;
    /** Live event stream for the run. */
    events: AsyncGenerator<Event>;
    /** Final result once the run finishes. */
    result: Promise<RunResult<TStructured>>;
}

/** Options for resuming a stream by its known stream id. */
export interface ResumeStreamOptions {
    /** Stream id to resume. */
    streamId: string;
    /** Optional sequence number to continue after. */
    afterSeq?: number;
}

/** Options for resuming the active stream for a conversation. */
export interface ResumeConversationOptions {
    /** Conversation id used to resolve the active stream. */
    conversationId: string;
    /** Optional sequence number to continue after. */
    afterSeq?: number;
}

/**
 * Runtime customization for replaying stored conversation history.
 */
export interface ConversationReplayOptions {
    /**
     * When true, removes message parts that the current model cannot accept as
     * input before replaying stored conversation history.
     *
     * Defaults to `true`.
     */
    omitUnsupportedParts?: boolean;
    /**
     * Customizes the provider input built from stored conversation items for
     * this run.
     *
     * When provided, this fully replaces the default projection and
     * capability-based pruning behavior. Set this to `null` on a run to
     * disable an inherited agent-level hook.
     */
    prepareInput?:
        | ((params: {
              items: ConversationItem[];
              caps: Capabilities;
              agentName: string;
              conversationId: string;
          }) => Awaitable<GenerativeModelInputItem[]>)
        | null;
}

/**
 * Payload used to submit a pending client tool result.
 */
export type SubmitToolResultParams =
    | {
          /** Run id that owns the pending tool call. */
          runId: string;
          /** Tool call id to resolve. */
          toolCallId: string;
          /** Submit a successful result for the tool call. */
          status: "success";
          /** Result payload to send back to the run. */
          result: unknown;
      }
    | {
          /** Run id that owns the pending tool call. */
          runId: string;
          /** Tool call id to resolve. */
          toolCallId: string;
          /** Submit an execution error for the tool call. */
          status: "error";
          /** Error message to send back instead of a result. */
          error: string;
      };

/**
 * Payload used to submit a pending tool approval decision.
 */
export interface SubmitToolApprovalParams {
    /** Run id that owns the pending approval. */
    runId: string;
    /** Tool call id to approve or deny. */
    toolCallId: string;
    /** Approval decision. */
    decision: "approved" | "denied";
    /** Optional note about the decision. */
    note?: string;
    /** Optional actor id for audit trails. */
    actorId?: string;
}

type RuntimeAgentByName<
    TAgents extends readonly AnyAgentDefinition[],
    TName extends TAgents[number]["name"],
> = Extract<TAgents[number], { name: TName }>;

/**
 * Structured output override accepted by one agent's model.
 */
export type RunOutputOverrideForAgent<TAgent extends AnyAgentDefinition> = OutputSchemaForCaps<
    AgentModelCaps<TAgent["model"]>
>;

type StructuredRunResult<TStructured> = Omit<RunResult<TStructured>, "structured"> & {
    structured: TStructured;
};

type UnstructuredRunResult = Omit<RunResult<never>, "structured">;

type StructuredStreamResult<TStructured> = Omit<StreamResult<TStructured>, "result"> & {
    result: Promise<StructuredRunResult<TStructured>>;
};

type UnstructuredStreamResult = Omit<StreamResult<never>, "result"> & {
    result: Promise<UnstructuredRunResult>;
};

type AgentDefaultStructuredOutput<TAgent extends AnyAgentDefinition> = [
    AgentOutputSchema<TAgent>,
] extends [undefined]
    ? never
    : InferOutputSchema<AgentOutputSchema<TAgent>>;

type RunOutputField<
    TAgent extends AnyAgentDefinition,
    TOutput extends RunOutputOverrideForAgent<TAgent> | undefined,
> = [RunOutputOverrideForAgent<TAgent>] extends [never]
    ? object
    : {
          /** Optional structured output schema override for this run. */
          output?: TOutput;
      };

/**
 * Structured output type produced for one agent run.
 */
export type StructuredOutputForAgentRun<
    TAgent extends AnyAgentDefinition,
    TOutput extends RunOutputOverrideForAgent<TAgent> | undefined = undefined,
> = [TOutput] extends [undefined]
    ? AgentDefaultStructuredOutput<TAgent>
    : InferOutputSchema<TOutput>;

type AgentModelOptions<TAgent extends AnyAgentDefinition> = TAgent["model"] extends GenerativeModel<
    infer TOptions,
    infer _TProviderId,
    infer _TModelId,
    infer _TCaps
>
    ? ModelOptions<TOptions>
    : TAgent["model"] extends {
            options: infer TOptions extends Record<string, unknown>;
        }
      ? ModelOptions<TOptions>
      : Record<never, never>;

/**
 * Agent-aware run options with capability-gated structured output overrides.
 */
export type RunOptionsForAgent<
    TAgent extends AnyAgentDefinition,
    TOutput extends RunOutputOverrideForAgent<TAgent> | undefined =
        | RunOutputOverrideForAgent<TAgent>
        | undefined,
    TModalities extends ModalitiesParam<AgentModelCaps<TAgent["model"]>> | undefined = undefined,
> = Omit<
    RunOptions<
        AgentContext<TAgent>,
        TOutput,
        AgentModelCaps<TAgent["model"]>,
        AgentModelOptions<TAgent>,
        TModalities
    >,
    "output" | "context"
> &
    ConditionalContextField<AgentContextSchema<TAgent>, AgentContext<TAgent>> &
    RunOutputField<TAgent, TOutput>;

/**
 * Final run result for one agent.
 */
export type RunResultForAgent<
    TAgent extends AnyAgentDefinition,
    TOutput extends RunOutputOverrideForAgent<TAgent> | undefined = undefined,
> = [StructuredOutputForAgentRun<TAgent, TOutput>] extends [never]
    ? UnstructuredRunResult
    : StructuredRunResult<StructuredOutputForAgentRun<TAgent, TOutput>>;

/**
 * Stream handle for one agent and optional structured output override.
 */
export type StreamResultForAgent<
    TAgent extends AnyAgentDefinition,
    TOutput extends RunOutputOverrideForAgent<TAgent> | undefined = undefined,
> = [StructuredOutputForAgentRun<TAgent, TOutput>] extends [never]
    ? UnstructuredStreamResult
    : StructuredStreamResult<StructuredOutputForAgentRun<TAgent, TOutput>>;

/**
 * Runtime interface used by the app and HTTP server.
 */
export interface BetterAgentRuntime<
    TAgents extends readonly AnyAgentDefinition[] = readonly AnyAgentDefinition[],
> {
    /** Runs an agent and returns the final result. */
    run<
        TName extends TAgents[number]["name"],
        TAgent extends RuntimeAgentByName<TAgents, TName>,
        TOutput extends RunOutputOverrideForAgent<TAgent> | undefined = undefined,
    >(
        agent: TName,
        runOptions: RunOptionsForAgent<TAgent, TOutput>,
    ): Promise<RunResultForAgent<TAgent, TOutput>>;
    /** Runs an agent and streams events as they happen. */
    stream<
        TName extends TAgents[number]["name"],
        TAgent extends RuntimeAgentByName<TAgents, TName>,
        TOutput extends RunOutputOverrideForAgent<TAgent> | undefined = undefined,
    >(
        agent: TName,
        runOptions: RunOptionsForAgent<TAgent, TOutput>,
    ): StreamResultForAgent<TAgent, TOutput>;
    /** Resumes a stream from a known stream id. */
    resumeStream(params: ResumeStreamOptions): Promise<AsyncIterable<StreamEvent> | null>;
    /**
     * Resume the active stream for a conversation when runtime-state lookup is configured.
     *
     * Returns `null` when runtime-state lookup is not configured, no active
     * stream exists, or the stored stream cannot be resumed.
     */
    resumeConversation<TName extends TAgents[number]["name"]>(
        agent: TName,
        params: ResumeConversationOptions,
    ): Promise<AsyncIterable<StreamEvent> | null>;
    /** Aborts an active run by id. Returns `false` when no active run is found. */
    abortRun(runId: string): Promise<boolean>;
    /**
     * Load the persisted message history for one conversation.
     *
     * Returns `null` when no stored conversation exists.
     */
    loadConversation<TName extends TAgents[number]["name"]>(
        agent: TName,
        conversationId: string,
    ): Promise<{ items: ConversationItem[] } | null>;
    /** Submits a result for a pending client tool call. */
    submitToolResult(params: SubmitToolResultParams): Promise<boolean>;
    /** Submits an approval decision for a pending tool call. */
    submitToolApproval(params: SubmitToolApprovalParams): Promise<boolean>;
    /** Effective lifecycle for streaming runs created by this runtime. */
    streamLifecycle?: "request_bound" | "detached";
}

/**
 * Function used to stop the loop based on the latest completed step.
 */
export type StopWhen<
    TContextSchema extends ResolvableSchema | undefined = undefined,
    TContext = unknown,
    TModelCaps extends Capabilities = Capabilities,
> = BivariantFn<[StopWhenContext<TContextSchema, TContext, TModelCaps>], boolean>;

/**
 * Conditional tool-control fields.
 */
export type ConditionalToolControlField<TModelCaps extends Capabilities = Capabilities> =
    TModelCaps["tools"] extends true
        ? {
              setToolChoice(choice: ToolChoice): void;
              setActiveTools(names: readonly string[]): void;
          }
        : Record<never, never>;

/**
 * Conditional instruction-control fields.
 */
export type ConditionalInstructionControlField<TModelCaps extends Capabilities = Capabilities> =
    InstructionEnabled<TModelCaps> extends true
        ? {
              setSystemInstruction(
                  instruction: GenerativeModelInputMessageContent<TModelCaps>,
              ): void;
          }
        : Record<never, never>;

/**
 * Base context passed to `onStep`.
 */
export interface OnStepContextBase<TModelCaps extends Capabilities = Capabilities> {
    /** Unique id for this run. */
    runId: string;
    /** Name of the active agent. */
    agentName: string;
    /** Shared conversation id, if this run uses one. */
    conversationId?: string;
    /** Zero-based step number for the next step. */
    stepIndex: number;
    /** Maximum number of steps allowed for this run. */
    maxSteps: number | undefined;
    /** Current message history before the next model call. */
    messages: GenerativeModelInputItem<TModelCaps>[];
    /** Result from the last completed step, if one exists. */
    previousStep?: PreviousStepResult;
    /** Replace the current messages before the next step runs. */
    updateMessages(
        updater: (
            messages: GenerativeModelInputItem<TModelCaps>[],
        ) => GenerativeModelInputItem<TModelCaps>[],
    ): void;
}

/**
 * Context passed to `onStep`.
 */
export type OnStepContext<
    TContextSchema extends ResolvableSchema | undefined = undefined,
    TContext = unknown,
    TModelCaps extends Capabilities = Capabilities,
> = OnStepContextBase<TModelCaps> &
    ConditionalInstructionControlField<TModelCaps> &
    ConditionalContextField<TContextSchema, TContext> &
    ConditionalToolControlField<TModelCaps>;

/**
 * Base context passed to `onStepFinish`.
 */
export interface OnStepFinishContextBase {
    /** Unique id for this run. */
    runId: string;
    /** Name of the active agent. */
    agentName: string;
    /** Shared conversation id, if this run uses one. */
    conversationId?: string;
    /** Zero-based step number that just finished. */
    stepIndex: number;
    /** Maximum number of steps allowed for this run. */
    maxSteps: number | undefined;
    /** Result from the step that just finished. */
    result: PreviousStepResult;
}

/**
 * Context passed to `onStepFinish`.
 */
export type OnStepFinishContext<
    TContextSchema extends ResolvableSchema | undefined = undefined,
    TContext = unknown,
> = OnStepFinishContextBase & ConditionalContextField<TContextSchema, TContext>;

/**
 * Base context passed to `stopWhen`.
 */
export interface StopWhenContextBase<TModelCaps extends Capabilities = Capabilities> {
    /** Zero-based index of the current step. */
    stepIndex: number;
    /** Maximum number of steps allowed for this run. If undefined, no limit. */
    maxSteps: number | undefined;
    /** Result from the most recent completed step. */
    lastStep: PreviousStepResult;
    /** Results from all completed steps so far. */
    steps: PreviousStepResult[];
    /** Current message history after the last step. */
    messages: GenerativeModelInputItem<TModelCaps>[];
}

/**
 * Context passed to `stopWhen`.
 */
export type StopWhenContext<
    TContextSchema extends ResolvableSchema | undefined = undefined,
    TContext = unknown,
    TModelCaps extends Capabilities = Capabilities,
> = StopWhenContextBase<TModelCaps> & ConditionalContextField<TContextSchema, TContext>;

/**
 * Summary of the most recently completed loop step.
 */
export interface PreviousStepResult {
    /** Model response produced by that step. */
    response: GenerativeModelResponse;
}

/**
 * Basic runtime context for the current run.
 */
export interface RunContext {
    /** Unique id for this run. */
    runId: string;
    /** Name of the active agent. */
    agentName: string;
    /** Provider identifier for the model being used. */
    providerId: string;
    /** Model identifier within the provider. */
    modelId: string;
    /** Shared conversation id, if this run uses one. */
    conversationId?: string;
    /** Abort signal for canceling work. */
    signal: AbortSignal;
    /** Generate a stable message id for provider-authored model events. */
    generateMessageId: () => string;
}

/**
 * Persistence overrides for one run.
 */
export interface RunPersistenceOptions {
    /** Advanced: override the stream store for this run. */
    stream?: StreamStore;
    /** Advanced: override the conversation store for this run. */
    conversations?: ConversationStore;
    /** Advanced: override the conversation runtime-state store for this run. */
    runtimeState?: ConversationRuntimeStateStore;
}

/**
 * Advanced runtime controls for interactive runs.
 */
export interface RunAdvancedOptions {
    /**
     * Default timeout for waiting on client tool results when the tool itself
     * does not provide a more specific timeout.
     */
    clientToolResultTimeoutMs?: number;
    /**
     * Default timeout for waiting on tool approvals when the tool itself does
     * not provide a more specific timeout.
     */
    toolApprovalTimeoutMs?: number;
}

/**
 * Options for running an agent.
 *
 * Prefer {@link RunOptionsForAgent} for agent-aware APIs.
 */
export type RunOptions<
    TContext = unknown,
    TOutput extends OutputSchemaDefinition | undefined = undefined,
    TModelCaps extends Capabilities = Capabilities,
    TModelOptions extends object = Record<never, never>,
    TModalities extends ModalitiesParam<TModelCaps> | undefined = undefined,
> = {
    /** Input to send to the agent. */
    input: GenerativeModelInput<TModelCaps>;
    /** Extra agent context to validate and use during the run. */
    context?: TContext;
    /** Optional structured output schema override for this run. */
    output?: TOutput;
    /** Optional output modalities to request for this run. */
    modalities?: TModalities;
    /** Optional provider-specific model options for this run. Unknown keys are passed through to the provider. */
    modelOptions?: TModelOptions &
        ModalityOptionsFor<TModelCaps, TModalities> &
        Record<string, unknown>;
    /** Conversation id to load and save message history. */
    conversationId?: string;
    /** Controls how stored conversation history is prepared for replay in this run. */
    conversationReplay?: ConversationReplayOptions;
    /**
     * When true, array input replaces stored conversation history instead of being
     * prepended with it.
     *
     * This is primarily used when a client submits the full conversation history
     * together with a `conversationId`, for example during retry/regenerate flows.
     * String or single-message inputs should usually leave this unset.
     */
    replaceHistory?: boolean;
    /** Abort signal for canceling the run. */
    signal?: AbortSignal;
    /** Called for each event emitted during the run. */
    onEvent?: (event: Event) => void | Promise<void>;
    /** Max loop steps for this run. Overrides the agent default. */
    maxSteps?: number;
    /** Advanced interactive runtime options for this run. */
    advanced?: RunAdvancedOptions;
    /** Advanced: override persistence stores for this run. */
    persistence?: RunPersistenceOptions;
};

/**
 * Internal agent shape used by the run loop after context binding.
 * @internal
 */
export type ContextBoundAgent<TContext> = AgentDefinition<
    string,
    GenerativeModel,
    // biome-ignore lint/suspicious/noExplicitAny: runtime bridges heterogeneous schemas internally
    any,
    TContext,
    // biome-ignore lint/suspicious/noExplicitAny: runtime bridges heterogeneous tool sets internally
    any,
    OutputSchemaDefinition | undefined,
    ModalitiesParam<Capabilities> | undefined
>;

/**
 * State maintained during loop execution.
 * @internal
 */
export interface LoopState<TContext = unknown> {
    runId: string;
    agentName: string;
    conversationId?: string;
    items: ConversationItem[];
    replayStartIndex: number;
    steps: Array<{ response: GenerativeModelResponse }>;
    stepIndex: number;
    maxSteps: number | undefined;
    context?: TContext;
}

/**
 * Shared options for loop execution in both run and stream modes.
 * @internal
 */
export interface SharedRunLoopOptions<TContext> {
    agent: ContextBoundAgent<TContext>;
    items: ConversationItem[];
    replayStartIndex?: number;
    conversationReplayActive?: boolean;
    conversationReplay?: ConversationReplayOptions;
    modelOptions?: Record<string, unknown>;
    modalities?: ModalitiesParam<Capabilities>;
    runId: string;
    signal: AbortSignal;
    emit: (event: Event) => Promise<void>;
    generateMessageId: () => string;
    conversationId?: string;
    context?: TContext;
    structuredOutput?: StructuredOutput;
    maxSteps: number | undefined;
    advanced?: RunAdvancedOptions;
    toolChoice?: ToolChoice;
    appTools?: AgentToolDefinition[];
    pendingToolRuntime?: PendingToolRuntime;
    pluginRuntime?: PluginRuntime | null;
}

/**
 * Executes one model call for the run loop in either `run` or `stream` mode.
 * Returns the provider response plus the assistant message id for emitted items.
 * @internal
 */
export interface ModelCallStrategy<TContext> {
    mode: "run" | "stream";
    call(params: {
        options: SharedRunLoopOptions<TContext>;
        modelInput: GenerativeModelInputItem[];
        tools: AgentToolDefinition[];
        toolChoice?: ToolChoice;
        stepIndex: number;
        runId: string;
        agentName: string;
        conversationId?: string;
    }): Promise<{
        response: GenerativeModelResponse;
        assistantMessageId: string;
    }>;
}
