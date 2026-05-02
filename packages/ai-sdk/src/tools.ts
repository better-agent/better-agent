import type { AgentModelToolDefinition } from "@better-agent/core";
import { type ToolSet, jsonSchema, tool } from "ai";

export const toAiSdkTools = (
    tools: readonly AgentModelToolDefinition[] | undefined,
): ToolSet | undefined => {
    if (!tools || tools.length === 0) {
        return undefined;
    }

    return Object.fromEntries(
        tools.map((definition) => [
            definition.name,
            tool({
                description: definition.description,
                inputSchema: jsonSchema(definition.parameters),
                strict: definition.strict,
            }),
        ]),
    );
};

export const mergeAiSdkTools = (
    tools: readonly AgentModelToolDefinition[] | undefined,
    providerTools: Record<string, unknown> | undefined,
): ToolSet | undefined => {
    const resolvedTools = toAiSdkTools(tools);

    if (!resolvedTools && !providerTools) {
        return undefined;
    }

    return {
        ...(resolvedTools ?? {}),
        ...(providerTools ?? {}),
    } as ToolSet;
};
