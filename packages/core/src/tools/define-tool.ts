import type { ResolvableSchema } from "../schema";
import { TOOL_CLEANUP, TOOL_JSON_SCHEMA } from "./constants";
import type { ToolContract, ToolContractConfig } from "./types";
import { validateToolDefinition } from "./validation";

/**
 * Defines a tool contract.
 *
 * Call `.server(...)` for server execution or `.client()` for client-handled tools.
 *
 * @param def Tool definition.
 * @returns A tool contract.
 *
 * @example
 * ```ts
 * const getWeather = defineTool({
 *   name: "get_weather",
 *   description: "Get current weather",
 *   schema: { type: "object", properties: { city: { type: "string" } } },
 * }).server(async ({ city }) => ({ city, temperature: 26 }));
 * ```
 */
export const defineTool = <
    const N extends string,
    const S extends ResolvableSchema,
    // biome-ignore lint/suspicious/noExplicitAny: reusable tools default to loose run context unless explicitly narrowed
    TContext = any,
>(
    def: ToolContractConfig<S, N, TContext>,
): ToolContract<S, N, TContext> => {
    // Resolve once at definition time so server/client variants share the same schema payload.
    const resolvedSchema = validateToolDefinition(def);
    const name = def.name;
    const description = def.description;
    const schema = def.schema;
    const strict = def.strict;
    const approval = def.approval;
    const toolErrorMode = def.toolErrorMode;
    const onToolError = def.onToolError;
    const cleanup = def[TOOL_CLEANUP];

    return {
        name,
        description,
        schema,
        [TOOL_JSON_SCHEMA]: resolvedSchema,
        server: ((handler, options) => {
            const toolName = options?.as ?? name;
            return {
                name: toolName,
                kind: "server" as const,
                description,
                schema,
                strict,
                approval,
                toolErrorMode,
                onToolError,
                handler,
                [TOOL_CLEANUP]: cleanup,
                [TOOL_JSON_SCHEMA]: resolvedSchema,
            };
        }) as ToolContract<S, N, TContext>["server"],
        client: ((options) => {
            const toolName = options?.as ?? name;
            return {
                name: toolName,
                kind: "client" as const,
                description,
                schema,
                strict,
                approval,
                toolErrorMode,
                onToolError,
                [TOOL_CLEANUP]: cleanup,
                [TOOL_JSON_SCHEMA]: resolvedSchema,
            };
        }) as ToolContract<S, N, TContext>["client"],
        strict,
        approval,
        toolErrorMode,
        onToolError,
        [TOOL_CLEANUP]: cleanup,
    };
};
