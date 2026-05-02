import type { AgentModelLike } from "../models";
import type { ResolvableSchema } from "../schema";
import type { ToolSource } from "../tools/types";
import type { AgentContextFromSchema, AgentDefinition } from "./types";

export function defineAgent<
    const TName extends string,
    TModel extends AgentModelLike,
    const TContextSchema extends ResolvableSchema | undefined = undefined,
    TTools extends ToolSource<AgentContextFromSchema<TContextSchema>> | undefined = undefined,
    const TOutputSchema extends ResolvableSchema = ResolvableSchema,
>(
    config: AgentDefinition<
        TName,
        TModel,
        TContextSchema,
        AgentContextFromSchema<TContextSchema>,
        TTools,
        TOutputSchema
    >,
): AgentDefinition<
    TName,
    TModel,
    TContextSchema,
    AgentContextFromSchema<TContextSchema>,
    TTools,
    TOutputSchema
> {
    return config;
}
