import { BetterAgentError } from "@better-agent/shared/errors";
import type { Awaitable } from "../internal/types";
import { TOOL_CLEANUP } from "./constants";
import type { AgentToolDefinition, LazyToolSourceResult, ToolSource } from "./types";

/**
 * Resolves all tools available for a run and collects cleanup hooks.
 */
export const resolveToolsForRun = async <TContext>(params: {
    appTools?: readonly AgentToolDefinition[];
    agentTools?: ToolSource<TContext> | readonly ToolSource<TContext>[];
    context?: TContext;
}): Promise<{
    /** Tools available for this run. */
    tools: AgentToolDefinition[];
    /** Runs cleanup hooks registered via {@link TOOL_CLEANUP}. */
    runCleanup: () => Awaitable<void>;
}> => {
    const cleanup = new Set<() => Promise<void> | void>();

    const normalize = (value: readonly AgentToolDefinition[] | AgentToolDefinition) =>
        Array.isArray(value) ? [...value] : [value];

    const isLazyToolSourceResult = (value: unknown): value is LazyToolSourceResult =>
        typeof value === "object" && value !== null && "tools" in value;

    const resolveSource = async (
        source: ToolSource<TContext>,
        context: TContext | undefined,
    ): Promise<AgentToolDefinition[]> => {
        const resolved =
            typeof source === "function"
                ? await (source as (context: TContext | undefined) => Awaitable<unknown>)(context)
                : typeof source === "object" &&
                    source !== null &&
                    "kind" in source &&
                    source.kind === "lazy"
                  ? await source.resolve(context)
                  : await (source as Awaitable<unknown>);

        if (isLazyToolSourceResult(resolved)) {
            return normalize(
                resolved.tools as readonly AgentToolDefinition[] | AgentToolDefinition,
            );
        }

        return normalize(resolved as readonly AgentToolDefinition[] | AgentToolDefinition);
    };

    const resolveList = async (
        sources: ToolSource<TContext> | readonly ToolSource<TContext>[] | undefined,
        context: TContext | undefined,
    ) => {
        if (!sources) return [];
        const list = Array.isArray(sources) ? sources : [sources];
        const resolved = await Promise.all(list.map((source) => resolveSource(source, context)));
        return resolved.flat();
    };

    const collectCleanup = (tools: readonly AgentToolDefinition[]) => {
        for (const tool of tools) {
            const fn = tool[TOOL_CLEANUP];
            if (fn) cleanup.add(fn);
        }
    };

    const appTools = params.appTools ?? [];
    const agentTools = await resolveList(params.agentTools, params.context);

    collectCleanup(appTools);
    collectCleanup(agentTools);

    const resolvedTools = [...appTools, ...agentTools];
    const seenToolNames = new Set<string>();

    for (const [index, tool] of resolvedTools.entries()) {
        if (
            !tool ||
            typeof tool !== "object" ||
            !("kind" in tool) ||
            (tool.kind !== "server" && tool.kind !== "client" && tool.kind !== "hosted")
        ) {
            throw BetterAgentError.fromCode(
                "VALIDATION_FAILED",
                "Invalid tool entry. Pass tool implementations, client tools, or hosted tools.",
                {
                    context: { index },
                    trace: [
                        {
                            at: "core.tools.resolveToolsForRun.validate.invalidEntry",
                            data: {
                                index,
                                toolType: typeof tool,
                            },
                        },
                    ],
                },
            );
        }

        const toolName =
            tool.kind === "hosted"
                ? typeof tool.name === "string" && tool.name.length > 0
                    ? tool.name
                    : typeof tool.type === "string" && tool.type.length > 0
                      ? tool.type
                      : undefined
                : typeof tool.name === "string" && tool.name.length > 0
                  ? tool.name
                  : undefined;

        if (!toolName) {
            throw BetterAgentError.fromCode(
                "VALIDATION_FAILED",
                tool.kind === "hosted"
                    ? "Hosted tools must define a non-empty type or name."
                    : "Tool name must be a non-empty string.",
                {
                    context: { index },
                    trace: [
                        {
                            at: "core.tools.resolveToolsForRun.validate.invalidName",
                            data: { index, kind: tool.kind },
                        },
                    ],
                },
            );
        }

        if (seenToolNames.has(toolName)) {
            throw BetterAgentError.fromCode(
                "VALIDATION_FAILED",
                `Duplicate tool name '${toolName}' in tools list.`,
                {
                    context: { toolName },
                    trace: [
                        {
                            at: "core.tools.resolveToolsForRun.validate.duplicateName",
                            data: {
                                index,
                                toolName,
                            },
                        },
                    ],
                },
            );
        }

        seenToolNames.add(toolName);
    }

    const runCleanup = async () => {
        if (cleanup.size === 0) return;
        const tasks = Array.from(cleanup, async (fn) => await fn());
        cleanup.clear();
        await Promise.allSettled(tasks);
    };

    return {
        tools: resolvedTools,
        runCleanup,
    };
};

/**
 * Checks whether a tool is a server tool definition.
 */
export const isServerToolDefinition = <TContext>(
    tool: AgentToolDefinition<TContext>,
): tool is Extract<AgentToolDefinition<TContext>, { kind: "server" }> => tool.kind === "server";

/**
 * Checks whether a tool is a client tool definition.
 */
export const isClientToolDefinition = <TContext>(
    tool: AgentToolDefinition<TContext>,
): tool is Extract<AgentToolDefinition<TContext>, { kind: "client" }> => tool.kind === "client";

/**
 * Checks whether a tool is directly callable by the runtime.
 */
export const isCallableToolDefinition = <TContext>(
    tool: AgentToolDefinition<TContext>,
): tool is Exclude<AgentToolDefinition<TContext>, { kind: "hosted" }> => tool.kind !== "hosted";
