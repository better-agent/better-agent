import type { AgentModelToolDefinition } from "../models";
import { type ResolvableSchema, toJsonSchema } from "../schema";
import type {
    AnyDefinedTool,
    AnyToolDefinition,
    ClientToolDefinition,
    ProviderToolDefinition,
    ServerToolDefinition,
    ToolSource,
} from "./types";

type ResolvableTools<TContext = unknown> = ToolSource<TContext> | undefined;

export async function resolveTools<TContext = unknown>(
    input: ResolvableTools<TContext>,
    context: TContext,
): Promise<AnyToolDefinition[]> {
    if (!input) {
        return [];
    }

    if (typeof input === "function") {
        return [...(await input(context))];
    }

    return [...input];
}

export function dedupeToolsByName(tools: AnyToolDefinition[]): AnyToolDefinition[] {
    const named = new Map<string, AnyToolDefinition>();
    const anonymous: AnyToolDefinition[] = [];

    for (const tool of tools) {
        const name = getToolName(tool);
        if (!name) {
            anonymous.push(tool);
            continue;
        }

        named.delete(name);
        named.set(name, tool);
    }

    return [...anonymous, ...named.values()];
}

function getToolName(tool: AnyToolDefinition): string | undefined {
    if (typeof tool !== "object" || tool === null) {
        return undefined;
    }

    const name = (tool as { name?: unknown }).name;
    if (typeof name === "string" && name.length > 0) {
        return name;
    }

    const id = (tool as { id?: unknown }).id;
    if (typeof id === "string" && id.includes(".")) {
        return id.split(".").at(-1);
    }

    return undefined;
}

export function toModelToolDefinitions(
    tools: readonly AnyDefinedTool[],
): AgentModelToolDefinition[] {
    return tools.map((tool) => ({
        name: tool.name,
        description: tool.description ?? "",
        parameters: toJsonSchema(tool.inputSchema),
        ...(tool.strict !== undefined ? { strict: tool.strict } : {}),
    }));
}

export function toProviderToolSet(
    tools: readonly ProviderToolDefinition[],
): Record<string, ProviderToolDefinition> | undefined {
    const namedTools = tools.flatMap((tool) => {
        const nameValue = tool.name;
        const idValue = tool.id;
        const name =
            typeof nameValue === "string" && nameValue.length > 0
                ? nameValue
                : typeof idValue === "string" && idValue.includes(".")
                  ? idValue.split(".").at(-1)
                  : undefined;

        return name ? [{ ...tool, name }] : [];
    });

    if (namedTools.length === 0) {
        return undefined;
    }

    return Object.fromEntries(namedTools.map((tool) => [tool.name, tool]));
}

export function isDefinedTool(tool: AnyToolDefinition): tool is AnyDefinedTool {
    return !isProviderTool(tool);
}

export function isProviderTool(tool: AnyToolDefinition): tool is ProviderToolDefinition {
    if (typeof tool !== "object" || tool === null) {
        return false;
    }

    const target = (tool as Record<string, unknown>).target;

    return target !== "client" && target !== "server";
}

export function isClientTool(
    tool: AnyDefinedTool,
): tool is ClientToolDefinition<ResolvableSchema, ResolvableSchema | undefined, unknown> {
    return tool.target === "client";
}

export function isServerTool(
    tool: AnyDefinedTool,
): tool is ServerToolDefinition<ResolvableSchema, ResolvableSchema | undefined, unknown> {
    return tool.target === "server";
}
