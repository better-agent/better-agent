import type { AgentDefinition, AgentModelCaps, AnyAgentDefinition } from "../agent";
import type {
    ConversationRuntimeStateStore,
    ConversationStore,
    StreamEvent,
    StreamStore,
} from "../persistence";
import type { Plugin, PluginRuntime } from "../plugins";
import type { ConversationItem, InferOutputSchema, OutputSchemaForCaps } from "../providers";
import type {
    ResumeConversationOptions,
    ResumeStreamOptions,
    RunOptionsForAgent,
    RunOutputOverrideForAgent,
    RunResultForAgent,
    StreamResultForAgent,
    SubmitToolApprovalParams,
    SubmitToolResultParams,
} from "../run";
import type { InferSchemaInput } from "../schema";
import type { AgentToolDefinition } from "../tools";

export interface BetterAgentAdvancedConfig {
    /**
     * Default timeout for waiting on client tool results.
     */
    clientToolResultTimeoutMs?: number;
    /**
     * Default timeout for waiting on tool approvals.
     */
    toolApprovalTimeoutMs?: number;
    /**
     * Controls what the built-in HTTP handler does when the original request disconnects.
     *
     * - `abort`: abort the run with the request.
     * - `continue`: keep the run executing on the server and only stop the disconnected reader.
     *
     * This only affects Better Agent's built-in HTTP/server layer.
     */
    onRequestDisconnect?: "abort" | "continue";
    /** Heartbeat interval for built-in SSE responses.
     *
     * This only affects Better Agent's built-in HTTP/server layer.
     */
    sseHeartbeatMs?: number;
}

/**
 * App configuration.
 *
 * @typeParam TAgents Agents bundled into the app.
 * @typeParam TPlugins Plugins registered on the app.
 * @typeParam TTools Shared tools available to agents.
 */
export interface BetterAgentConfig<
    TAgents extends readonly AnyAgentDefinition[] = readonly AnyAgentDefinition[],
    TPlugins extends readonly Plugin[] = readonly Plugin[],
    TTools extends readonly AgentToolDefinition[] = readonly AgentToolDefinition[],
> {
    /** Built-in runtime and HTTP behavior. */
    readonly advanced?: BetterAgentAdvancedConfig;

    /** Agents included in the app. */
    readonly agents: TAgents;

    /**
     * Shared tools available to agents in this app.
     *
     * Agents can still declare their own tools.
     */
    readonly tools?: TTools;

    /**
     * Plugins applied to the app.
     *
     * Use plugins for cross-cutting behavior such as logging, auth, or rate limiting.
     */
    readonly plugins?: TPlugins;

    /** Persistence configuration for runs and streams. */
    readonly persistence?: {
        /** Stream store for event resumption. */
        stream?: StreamStore;
        /** Conversation store. */
        conversations?: ConversationStore;
        /** Optional conversation runtime-state store for conversation-based stream resume. */
        runtimeState?: ConversationRuntimeStateStore;
    };

    /**
     * Optional bearer secret for the built-in HTTP server.
     * When set, built-in server routes require `Authorization: Bearer <secret>`
     * unless a plugin endpoint is marked `public: true`.
     */
    readonly secret?: string;

    /**
     * Optional base URL for the app's API, used by clients and framework integrations.
     *
     * If set, the URL pathname is also used as the built-in server `basePath`.
     * For example, `https://example.com/api` makes the built-in server available under `/api`.
     */
    readonly baseURL?: string;
}

/**
 * App configuration with erased generic detail.
 */
export type AnyBetterAgentConfig = BetterAgentConfig<
    readonly AnyAgentDefinition[],
    readonly Plugin[],
    readonly AgentToolDefinition[]
>;

/**
 * HTTP request handler used by framework integrations.
 */
export type BetterAgentHandler = (request: Request) => Promise<Response>;

/**
 * Looks up one agent type by its name.
 */
export type AgentByName<
    TAgents extends readonly AnyAgentDefinition[],
    TName extends TAgents[number]["name"],
> = Extract<TAgents[number], { name: TName }>;

type PublicAgentForApp<TAgent> = TAgent extends AgentDefinition<
    infer TName,
    infer TModel,
    infer TContextSchema,
    infer TContext,
    infer TTools,
    infer TOutputSchema,
    infer _TDefaultModalities
>
    ? {
          readonly name: TName;
          readonly model: TModel;
          readonly tools: PublicToolsForApp<TTools>;
      } & ([TContextSchema] extends [undefined]
          ? { contextSchema?: undefined }
          : { contextSchema: PublicSchemaMarker<TContext> }) &
          ([TOutputSchema] extends [undefined]
              ? { outputSchema?: undefined }
              : { outputSchema: PublicOutputSchema<TModel, TOutputSchema> })
    : TAgent;

export type PublicAgentsForApp<TAgents extends readonly AnyAgentDefinition[]> = {
    readonly [TIndex in keyof TAgents]: PublicAgentForApp<TAgents[TIndex]>;
};

type PublicSchemaMarker<TInput> = {
    readonly "~standard"?: {
        readonly types?: {
            readonly input?: TInput;
            readonly output?: TInput;
        };
    };
};

type PublicOutputSchema<TModel, TOutputSchema> = [TOutputSchema] extends [undefined]
    ? undefined
    : OutputSchemaForCaps<
          AgentModelCaps<TModel>,
          PublicSchemaMarker<InferOutputSchema<TOutputSchema>>
      >;

type PublicToolForApp<TTool> = TTool extends {
    kind: infer TKind;
    name: infer TName extends string;
    schema: infer TSchema;
}
    ? {
          kind: TKind;
          name: TName;
          schema: PublicSchemaMarker<InferSchemaInput<TSchema>>;
      }
    : TTool;

type PublicToolsForApp<TTools> = TTools extends readonly unknown[]
    ? {
          readonly [TIndex in keyof TTools]: PublicToolForApp<TTools[TIndex]>;
      }
    : TTools extends undefined
      ? undefined
      : PublicToolForApp<TTools>;

/** Shared app-level input for `run()` and `stream()`. */
export type AppRunInput<
    TAgent extends AnyAgentDefinition = AnyAgentDefinition,
    TOutput extends RunOutputOverrideForAgent<TAgent> | undefined = undefined,
> = RunOptionsForAgent<TAgent, TOutput>;

/** Run options for `app.run()`. */
export type AppRunOptions<
    TAgent extends AnyAgentDefinition = AnyAgentDefinition,
    TOutput extends RunOutputOverrideForAgent<TAgent> | undefined = undefined,
> = AppRunInput<TAgent, TOutput>;

/** Stream options for `app.stream()`. */
export type AppStreamOptions<
    TAgent extends AnyAgentDefinition = AnyAgentDefinition,
    TOutput extends RunOutputOverrideForAgent<TAgent> | undefined = undefined,
> = AppRunInput<TAgent, TOutput>;

/**
 * Better Agent app bundle.
 *
 * @typeParam TAgents Agents bundled into the app.
 * @typeParam TPlugins Plugins registered on the app.
 */
export interface BetterAgentApp<
    TAgents extends readonly AnyAgentDefinition[] = readonly AnyAgentDefinition[],
    TPlugins extends readonly Plugin[] = readonly Plugin[],
> {
    /** App configuration used to construct this instance. */
    readonly config: BetterAgentConfig<TAgents, TPlugins>;

    /**
     * Runs an agent and waits for the final result.
     */
    run: <
        TName extends TAgents[number]["name"],
        TOutput extends
            | RunOutputOverrideForAgent<AgentByName<TAgents, TName>>
            | undefined = undefined,
    >(
        agentName: TName,
        options: AppRunOptions<AgentByName<TAgents, TName>, TOutput>,
    ) => Promise<RunResultForAgent<AgentByName<TAgents, TName>, TOutput>>;

    /**
     * Streams agent execution events.
     */
    stream: <
        TName extends TAgents[number]["name"],
        TOutput extends
            | RunOutputOverrideForAgent<AgentByName<TAgents, TName>>
            | undefined = undefined,
    >(
        agentName: TName,
        options: AppStreamOptions<AgentByName<TAgents, TName>, TOutput>,
    ) => StreamResultForAgent<AgentByName<TAgents, TName>, TOutput>;

    /**
     * Resumes a stored stream by stream id.
     */
    resumeStream: (params: ResumeStreamOptions) => Promise<AsyncIterable<StreamEvent> | null>;

    /**
     * Resumes the active stream for a conversation.
     */
    resumeConversation: <TName extends TAgents[number]["name"]>(
        agentName: TName,
        params: ResumeConversationOptions,
    ) => Promise<AsyncIterable<StreamEvent> | null>;

    /** Aborts an active run by id. */
    abortRun: (runId: string) => Promise<boolean>;

    /**
     * Load the persisted durable history for one conversation.
     *
     * Returns `null` when no stored conversation exists.
     */
    loadConversation: <TName extends TAgents[number]["name"]>(
        agentName: TName,
        conversationId: string,
    ) => Promise<{ items: ConversationItem[] } | null>;

    /**
     * Submits a result for a pending client tool call.
     */
    submitToolResult: (params: SubmitToolResultParams) => Promise<boolean>;

    /**
     * Submits a tool approval decision.
     */
    submitToolApproval: (params: SubmitToolApprovalParams) => Promise<boolean>;

    /**
     * HTTP handler for framework integration.
     */
    handler: BetterAgentHandler;
}

/**
 * Internal app context used while wiring components together.
 *
 * @internal
 */
export interface AppContext {
    /** The app configuration */
    config: AnyBetterAgentConfig;
    /** Registry of all components */
    registry: {
        agents: Map<string, AnyAgentDefinition>;
        tools: AgentToolDefinition[];
    };
    /** Plugin runtime for executing middleware and guards */
    pluginRuntime: PluginRuntime | null;
}
