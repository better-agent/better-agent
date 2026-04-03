import type {
    BetterAgentApp,
    ConversationReplayOptions,
    InferSchemaInput,
    RunAdvancedOptions,
    RunResult,
} from "@better-agent/core";
import type {
    Capabilities,
    GenerativeModel,
    GenerativeModelInput,
    InputEnabled,
    ModalitiesParam,
    Modality,
    ModalityOptionsFor,
    ModelOptions,
    OutputSchemaForCaps,
} from "@better-agent/core/providers";

type InferPortableOrSchemaInput<TValue> = TValue extends {
    "~standard"?: { types?: { input?: unknown } };
}
    ? InferSchemaInput<TValue>
    : TValue extends { type: unknown }
      ? InferSchemaInput<TValue>
      : TValue;

type InferPortableOrSchemaOutput<TValue> = TValue extends { schema: infer TSchema }
    ? InferPortableOrSchemaInput<NonNullable<TSchema>>
    : TValue;

/** Extracts `config.agents` from the typed app config. */
export type AgentsFromApp<TApp> = TApp extends {
    __appTypes?: {
        agents: infer TAgents;
    };
}
    ? TAgents extends readonly { name: string }[]
        ? TAgents
        : never
    : TApp extends {
            config: {
                agents: infer TAgents;
            };
        }
      ? TAgents extends readonly { name: string }[]
          ? TAgents
          : never
      : TApp extends BetterAgentApp<infer TAgents, infer _TPlugins>
        ? TAgents extends readonly { name: string }[]
            ? TAgents
            : never
        : never;

/**
 * Agent names available from the typed server app.
 *
 * Falls back to `string` for untyped clients.
 */
export type AgentNameFromApp<TApp> = [AgentsFromApp<TApp>] extends [never]
    ? string
    : AgentsFromApp<TApp>[number]["name"];

type AgentsRawFromApp<TApp> = TApp extends {
    __appTypes?: {
        agents: infer TAgents;
    };
}
    ? TAgents extends readonly unknown[]
        ? TAgents
        : never
    : TApp extends {
            config: {
                agents: infer TAgents;
            };
        }
      ? TAgents extends readonly unknown[]
          ? TAgents
          : never
      : TApp extends BetterAgentApp<infer TAgents, infer _TPlugins>
        ? TAgents extends readonly unknown[]
            ? TAgents
            : never
        : never;

type AppToolsArrayFromApp<TApp> = TApp extends {
    __appTypes?: {
        tools: infer TTools extends readonly unknown[];
    };
}
    ? TTools
    : TApp extends {
            config: {
                tools?: infer TTools extends readonly unknown[];
            };
        }
      ? TTools
      : never;

type SlimAgentForClient<TAgent> = TAgent extends { name: infer TName extends string }
    ? {
          name: TName;
      } & (TAgent extends { model: infer TModel }
          ? { model: TModel }
          : Record<never, never>) & {} & (TAgent extends { contextSchema: infer TContextSchema }
              ? { contextSchema: TContextSchema }
              : Record<never, never>) &
          (TAgent extends { outputSchema: infer TOutputSchema }
              ? { outputSchema: TOutputSchema }
              : Record<never, never>) &
          (TAgent extends { execution?: infer TExecution }
              ? { execution: TExecution }
              : Record<never, never>) &
          (TAgent extends { tools?: infer TTools } ? { tools: TTools } : Record<never, never>)
    : never;

type SlimAgentsForClient<TAgents extends readonly unknown[]> = {
    readonly [TIndex in keyof TAgents]: SlimAgentForClient<TAgents[TIndex]>;
};

/** Normalized app shape used for client-side type inference. */
export type NormalizeClientApp<TApp> = [AgentsRawFromApp<TApp>] extends [never]
    ? unknown
    : {
          config: {
              agents: SlimAgentsForClient<AgentsRawFromApp<TApp>>;
              tools?: AppToolsArrayFromApp<TApp>;
          };
      };

type AppLevelToolsFromApp<TApp> = TApp extends {
    __appTypes?: {
        tools: infer TTools extends readonly unknown[];
    };
}
    ? TTools[number]
    : TApp extends {
            config: {
                tools?: infer TTools extends readonly unknown[];
            };
        }
      ? TTools[number]
      : never;

type AgentStaticToolsFromAgent<TAgent> = TAgent extends { tools?: infer TTools }
    ? TTools extends readonly unknown[]
        ? TTools[number]
        : never
    : never;

type AgentStaticToolsFromApp<TApp> = [AgentsFromApp<TApp>] extends [never]
    ? never
    : AgentStaticToolsFromAgent<AgentsRawFromApp<TApp>[number]>;

type ClientToolFromApp<TApp> = Extract<
    AppLevelToolsFromApp<TApp> | AgentStaticToolsFromApp<TApp>,
    {
        kind: "client";
        name: string;
        schema: unknown;
    }
>;

/** Keeps only named client tools with literal names. */
type LiteralClientToolFromApp<TApp> = ClientToolFromApp<TApp> extends infer TTool
    ? TTool extends { kind: "client"; name: string; schema: unknown }
        ? string extends TTool["name"]
            ? never
            : TTool
        : never
    : never;

type KnownToolNameFromApp<TApp> = LiteralClientToolFromApp<TApp>["name"];

type ToolNameFromApp<TApp> = [KnownToolNameFromApp<TApp>] extends [never]
    ? string
    : KnownToolNameFromApp<TApp>;

type ToolByName<TApp, TToolName extends ToolNameFromApp<TApp>> = Extract<
    LiteralClientToolFromApp<TApp>,
    { name: TToolName }
>;

/** Input type for a specific client tool. */
export type ToolInputFromApp<TApp, TToolName extends ToolNameFromApp<TApp>> = [
    ToolByName<TApp, TToolName>,
] extends [never]
    ? unknown
    : ToolByName<TApp, TToolName>["schema"] extends infer TSchema
      ? TSchema extends object
          ? InferPortableOrSchemaInput<TSchema>
          : unknown
      : unknown;

/** Client tool names available from the typed server app. */
export type ToolNameForApp<TApp> = ToolNameFromApp<TApp>;

type UntypedRunInput = {
    input: unknown;
    context?: unknown;
    output?: unknown;
    modalities?: readonly Modality[];
    modelOptions?: Record<string, unknown>;
    maxSteps?: number;
    conversationId?: string;
    [key: string]: unknown;
};

type AgentByNameFromApp<TApp, TAgentName extends AgentNameFromApp<TApp>> = Extract<
    AgentsFromApp<TApp>[number],
    { name: TAgentName }
>;

type AgentFromApp<TApp, TAgentName extends AgentNameFromApp<TApp>> = AgentByNameFromApp<
    TApp,
    TAgentName
>;

type AgentModelFromApp<TApp, TAgentName extends AgentNameFromApp<TApp>> = AgentFromApp<
    TApp,
    TAgentName
> extends { model: infer TModel }
    ? TModel
    : never;

type AgentOutputSchemaFromApp<TApp, TAgentName extends AgentNameFromApp<TApp>> = AgentFromApp<
    TApp,
    TAgentName
> extends { outputSchema: infer TOutputSchema }
    ? TOutputSchema
    : never;

type AgentCapsFromApp<TApp, TAgentName extends AgentNameFromApp<TApp>> = AgentModelFromApp<
    TApp,
    TAgentName
> extends { caps: infer TCaps extends Capabilities }
    ? TCaps
    : Capabilities;

type AgentModelOptionsFromApp<TApp, TAgentName extends AgentNameFromApp<TApp>> = AgentModelFromApp<
    TApp,
    TAgentName
> extends GenerativeModel<infer TOptions, infer _TProviderId, infer _TModelId, infer _TCaps>
    ? ModelOptions<TOptions>
    : AgentModelFromApp<TApp, TAgentName> extends {
            options: infer TOptions extends Record<string, unknown>;
        }
      ? ModelOptions<TOptions>
      : Record<never, never>;

type AgentOutputOverrideForApp<
    TApp,
    TAgentName extends AgentNameFromApp<TApp>,
> = OutputSchemaForCaps<AgentCapsFromApp<TApp, TAgentName>>;

type TypedModalitiesForAgent<TApp, TAgentName extends AgentNameFromApp<TApp>> = ModalitiesParam<
    AgentCapsFromApp<TApp, TAgentName>
>;

export type ModalitiesForAgent<TApp, TAgentName extends AgentNameFromApp<TApp>> = [
    AgentsFromApp<TApp>,
] extends [never]
    ? readonly Modality[]
    : TypedModalitiesForAgent<TApp, TAgentName>;

export type TextInputShorthandForAgent<TApp, TAgentName extends AgentNameFromApp<TApp>> = [
    AgentsFromApp<TApp>,
] extends [never]
    ? string
    : InputEnabled<AgentCapsFromApp<TApp, TAgentName>, "text"> extends true
      ? string
      : never;

type StructuredOutputForAgent<TApp, TAgentName extends AgentNameFromApp<TApp>, TOutput> = [
    AgentsFromApp<TApp>,
] extends [never]
    ? unknown
    : [TOutput] extends [undefined]
      ? InferPortableOrSchemaOutput<AgentOutputSchemaFromApp<TApp, TAgentName>>
      : InferPortableOrSchemaOutput<TOutput>;

export type DefaultStructuredOutputForAgent<
    TApp,
    TAgentName extends AgentNameFromApp<TApp>,
> = StructuredOutputForAgent<TApp, TAgentName, undefined>;

type StructuredRunResult<TStructured> = Omit<RunResult<TStructured>, "structured"> & {
    structured: TStructured;
};

type UnstructuredRunResult = Omit<RunResult<never>, "structured">;

type TypedContextInput<TApp, TAgentName extends AgentNameFromApp<TApp>> = [
    AgentsFromApp<TApp>,
] extends [never]
    ? { context?: unknown }
    : AgentByNameFromApp<TApp, TAgentName> extends { contextSchema: infer TContextSchema }
      ? { context: InferPortableOrSchemaInput<TContextSchema> }
      : { context?: never };

type TypedRunnerInputForAgent<
    TApp,
    TAgentName extends AgentNameFromApp<TApp>,
    TModalities extends TypedModalitiesForAgent<TApp, TAgentName> | undefined = undefined,
> = [AgentsFromApp<TApp>] extends [never]
    ? UntypedRunInput
    : {
          input: GenerativeModelInput<AgentCapsFromApp<TApp, TAgentName>>;
          modalities?: TModalities;
          modelOptions?: AgentModelOptionsFromApp<TApp, TAgentName> &
              ModalityOptionsFor<AgentCapsFromApp<TApp, TAgentName>, TModalities> &
              Record<string, unknown>;
          conversationId?: string;
          conversationReplay?: ConversationReplayOptions;
          replaceHistory?: boolean;
          maxSteps?: number;
          advanced?: RunAdvancedOptions;
      } & TypedContextInput<TApp, TAgentName>;

/**
 * Typed run input for one agent.
 *
 * This excludes `onClientToolCall`, client-side tool handling is configured through stream request options.
 */
export type RunInputForAgent<
    TApp = unknown,
    TAgentName extends AgentNameFromApp<TApp> = AgentNameFromApp<TApp>,
    TModalities = undefined,
> = [AgentsFromApp<TApp>] extends [never]
    ? UntypedRunInput
    : TypedRunnerInputForAgent<
          TApp,
          TAgentName,
          Extract<TModalities, TypedModalitiesForAgent<TApp, TAgentName> | undefined>
      >;

export type RunResultForAgent<TApp, TAgentName extends AgentNameFromApp<TApp>, TOutput> = [
    AgentsFromApp<TApp>,
] extends [never]
    ? RunResult<unknown>
    : [
            StructuredOutputForAgent<
                TApp,
                TAgentName,
                Extract<TOutput, AgentOutputOverrideForApp<TApp, TAgentName> | undefined>
            >,
        ] extends [never]
      ? UnstructuredRunResult
      : StructuredRunResult<
            StructuredOutputForAgent<
                TApp,
                TAgentName,
                Extract<TOutput, AgentOutputOverrideForApp<TApp, TAgentName> | undefined>
            >
        >;

export type AgentRunInput<TApp, TAgentName extends AgentNameFromApp<TApp>> = RunInputForAgent<
    TApp,
    TAgentName
>;

export type AgentContext<TApp, TAgentName extends AgentNameFromApp<TApp>> = AgentByNameFromApp<
    TApp,
    TAgentName
> extends { contextSchema: infer TContextSchema }
    ? InferPortableOrSchemaInput<TContextSchema>
    : [AgentsFromApp<TApp>] extends [never]
      ? unknown
      : never;

export type AgentContextInputField<TApp, TAgentName extends AgentNameFromApp<TApp>> = [
    AgentsFromApp<TApp>,
] extends [never]
    ? { context?: unknown }
    : AgentByNameFromApp<TApp, TAgentName> extends { contextSchema: infer TContextSchema }
      ? { context: InferPortableOrSchemaInput<TContextSchema> }
      : { context?: AgentContext<TApp, TAgentName> };
