import type {
    AgentContextOf,
    AgentMemory,
    AnyDefinedAgent,
    BetterAgentApp,
    BetterAgentConfig,
    InferSchemaOutput,
} from "@better-agent/core";

type AgentsOf<TApp> = TApp extends BetterAgentApp<infer TAgents extends readonly AnyDefinedAgent[]>
    ? TAgents
    : readonly AnyDefinedAgent[];

type ConfigOf<TApp> = TApp extends BetterAgentApp<
    readonly AnyDefinedAgent[],
    // biome-ignore lint/suspicious/noExplicitAny: Extracting the app config shape only.
    infer TConfig extends BetterAgentConfig<any>
>
    ? TConfig
    : BetterAgentConfig;

export type AgentByName<TApp, TName extends string> = Extract<
    AgentsOf<TApp>[number],
    { name: TName }
>;

export type AgentHasMemory<TApp, TName extends string> = unknown extends TApp
    ? true
    : AgentByName<TApp, TName> extends { memory: false }
      ? false
      : AgentByName<TApp, TName> extends { memory: AgentMemory }
        ? true
        : ConfigOf<TApp> extends { memory: AgentMemory }
          ? true
          : false;

type ToolsOf<TAgent> = TAgent extends { tools?: infer TTools } ? TTools : undefined;

type StaticToolList<TTools> = TTools extends readonly unknown[] ? TTools : never;

type ExtractClientToolDefs<TTools> = StaticToolList<TTools>[number] extends infer TTool
    ? TTool extends {
          target: "client";
          name: infer TName extends string;
          inputSchema: infer TInputSchema;
      }
        ? {
              name: TName;
              inputSchema: TInputSchema;
          }
        : never
    : never;

type ClientToolRecord<TTools> = [ExtractClientToolDefs<TTools>] extends [never]
    ? Record<string, { input: unknown }>
    : {
          [K in ExtractClientToolDefs<TTools>["name"]]: {
              input: InferSchemaOutput<
                  Extract<ExtractClientToolDefs<TTools>, { name: K }>["inputSchema"]
              >;
          };
      };

type ClientToolsOf<TApp, TName extends AgentNameOf<TApp>> = ToolsOf<
    AgentByName<TApp, TName>
> extends readonly unknown[]
    ? ClientToolRecord<ToolsOf<AgentByName<TApp, TName>>>
    : Record<string, { input: unknown }>;

export type AgentNameOf<TApp> = Extract<AgentsOf<TApp>[number]["name"], string>;

export type AgentContextFor<TApp, TName extends AgentNameOf<TApp>> = AgentContextOf<
    AgentByName<TApp, TName>
>;

export type ToolHandlersFor<TApp, TName extends AgentNameOf<TApp>> = {
    [K in keyof ClientToolsOf<TApp, TName>]?: (
        input: ClientToolsOf<TApp, TName>[K]["input"],
    ) => unknown | Promise<unknown>;
};
