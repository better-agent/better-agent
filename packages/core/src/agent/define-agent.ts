import type { Capabilities, ModalitiesParam, OutputSchemaForCaps } from "../providers";
import type { ResolvableSchema } from "../schema";
import type {
    AgentContextFromSchema,
    AgentModelCaps,
    DefineAgentConfig,
    DefinedAgent,
} from "./types";
import { validateAgentDefinition } from "./validation";

/**
 * Defines an agent.
 *
 * @param config Agent configuration.
 * @returns The defined agent.
 *
 * @example
 * ```ts
 * const supportAgent = defineAgent({
 *   name: "support",
 *   model: openai.model("gpt-5"),
 *   instruction: "You are a helpful support agent.",
 *   tools: [getWeather],
 * });
 * ```
 */
export function defineAgent<
    const TName extends string,
    const TModel extends { providerId: string; modelId: string; caps: Capabilities },
    const TContextSchema extends ResolvableSchema | undefined = undefined,
    const TContext = AgentContextFromSchema<TContextSchema>,
    const TTools = undefined,
    const TOutputSchema extends OutputSchemaForCaps<AgentModelCaps<TModel>> | undefined = undefined,
    const TDefaultModalities extends
        | ModalitiesParam<AgentModelCaps<TModel>>
        | undefined = undefined,
>(
    config: DefineAgentConfig<
        TName,
        TModel,
        TContextSchema,
        TContext,
        TTools,
        TOutputSchema,
        TDefaultModalities
    >,
): DefinedAgent<
    TName,
    TModel,
    TContextSchema,
    TContext,
    TTools,
    TOutputSchema,
    TDefaultModalities
> {
    validateAgentDefinition(config);

    return config as DefinedAgent<
        TName,
        TModel,
        TContextSchema,
        TContext,
        TTools,
        TOutputSchema,
        TDefaultModalities
    >;
}
