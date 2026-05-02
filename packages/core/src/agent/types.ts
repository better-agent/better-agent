import type { BivariantFn } from "@better-agent/shared/types";
import type { AuthContext } from "../auth/types";
import type { AgentMemory } from "../memory";
import type { AgentModel, AgentModelLike, AgentToolChoice } from "../models";
import type {
    RuntimeOnState,
    RuntimeOnStep,
    RuntimeOnStepFinish,
    RuntimeStopWhen,
} from "../runtime/hooks";
import type { AgentOutput, InferSchemaInput, ResolvableSchema } from "../schema";
import type { ToolSource } from "../tools/types";

export type AgentContextFromSchema<TSchema> = [TSchema] extends [undefined]
    ? unknown
    : InferSchemaInput<NonNullable<TSchema>>;

export type AgentContextOf<TAgent> = TAgent extends { contextSchema: infer TSchema }
    ? AgentContextFromSchema<TSchema>
    : unknown;

export type AgentInstruction<TContext = unknown> =
    | string
    | BivariantFn<[TContext], string | Promise<string>>;

export type AgentAccess =
    | "public"
    | "authenticated"
    | BivariantFn<
          [
              {
                  auth: AuthContext | null;
                  agentName: string;
                  request: Request;
              },
          ],
          boolean | Promise<boolean>
      >;

export interface AgentDefinition<
    TName extends string = string,
    TModel extends AgentModelLike = AgentModel,
    TContextSchema extends ResolvableSchema | undefined = undefined,
    TContext = AgentContextFromSchema<TContextSchema>,
    TTools extends ToolSource<TContext> | undefined = undefined,
    TOutputSchema extends ResolvableSchema = ResolvableSchema,
> {
    name: TName;
    description?: string;
    model: TModel;
    instruction?: AgentInstruction<TContext>;
    contextSchema?: TContextSchema;
    tools?: TTools;
    output?: AgentOutput<TOutputSchema>;
    maxSteps?: number;
    toolChoice?: AgentToolChoice;
    memory?: AgentMemory | false;
    access?: AgentAccess;
    stopWhen?: RuntimeStopWhen<unknown, AgentContextFromSchema<TContextSchema>>;
    onStep?: RuntimeOnStep<unknown, AgentContextFromSchema<TContextSchema>>;
    onStepFinish?: RuntimeOnStepFinish<unknown, AgentContextFromSchema<TContextSchema>>;
    onState?: RuntimeOnState<unknown>;
}

export interface AnyDefinedAgent {
    name: string;
    description?: string;
    model: AgentModelLike;
    instruction?: AgentInstruction<unknown>;
    contextSchema?: ResolvableSchema | undefined;
    tools?: ToolSource<unknown> | undefined;
    output?: AgentOutput | undefined;
    maxSteps?: number;
    toolChoice?: AgentToolChoice;
    memory?: AgentMemory | false;
    access?: AgentAccess;
    stopWhen?: RuntimeStopWhen<unknown, unknown>;
    onStep?: RuntimeOnStep<unknown, unknown>;
    onStepFinish?: RuntimeOnStepFinish<unknown, unknown>;
    onState?: RuntimeOnState<unknown>;
}
