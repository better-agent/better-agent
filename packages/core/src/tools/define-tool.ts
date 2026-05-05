import type { ResolvableSchema } from "../schema";
import type { ToolDefinitionInput, ToolTarget } from "./types";

export function defineTool<
    const TName extends string,
    const TInputSchema extends ResolvableSchema,
    const TOutputSchema extends ResolvableSchema | undefined = undefined,
    TContext = unknown,
    const TTarget extends ToolTarget = ToolTarget,
>(
    tool: ToolDefinitionInput<TName, TInputSchema, TOutputSchema, TContext, TTarget>,
): ToolDefinitionInput<TName, TInputSchema, TOutputSchema, TContext, TTarget> {
    return tool;
}
