import type { AgentModelLike } from "../models";
import type { PluginRuntime } from "../plugins";
import {
    isDefinedTool,
    isProviderTool,
    resolveTools,
    toModelToolDefinitions,
    toProviderToolSet,
} from "../tools/resolve-tools";
import type { ToolSource } from "../tools/types";
import type { RuntimeControl } from "./control";
import type { RuntimeHooks } from "./hooks";
import { run } from "./run";
import { stream } from "./stream";
import type { RunInput, RunResult, StreamResult } from "./types";
import { type BetterAgentIdGenerator, mergeAbortSignals } from "./utils";

export interface CreateRuntimeOptions<TContext = unknown, TState = unknown> {
    model: AgentModelLike;
    tools?: ToolSource<TContext>;
    context?: TContext;
    generateId?: BetterAgentIdGenerator;
    hooks?: RuntimeHooks<TState, TContext>;
    agentName?: string;
    pluginRuntime?: PluginRuntime;
    checkAbort?: (message: string) => Promise<void> | void;
}

export function createRuntime<TState = unknown, TContext = unknown>(
    options: CreateRuntimeOptions<TContext, TState>,
): RuntimeControl<TState> {
    const activeRuns = new Map<string, AbortController>();

    const createRunAbortController = (runId: string) => {
        const controller = new AbortController();
        activeRuns.set(runId, controller);
        return controller;
    };

    const clearRunAbortController = (runId: string) => {
        activeRuns.delete(runId);
    };

    const resolveExecutionOptions = async (
        input: RunInput<TState>,
        controller: AbortController,
    ) => {
        const resolvedTools = await resolveTools(options.tools, options.context as TContext);
        const executableTools = resolvedTools.filter(isDefinedTool);
        const providerTools = toProviderToolSet(resolvedTools.filter(isProviderTool));

        return {
            signal: mergeAbortSignals(input.signal, controller.signal),
            executableTools,
            modelToolDefinitions: toModelToolDefinitions(executableTools),
            providerTools,
            idGenerator: options.generateId,
            agentName: options.agentName,
            context: options.context,
            checkAbort: options.checkAbort,
            resume: input.resume,
            hooks: options.hooks,
            pluginRuntime: options.pluginRuntime,
        };
    };

    return {
        async run(request): Promise<RunResult<TState>> {
            const { runId, input } = request;
            const controller = createRunAbortController(runId);

            try {
                const executionOptions = await resolveExecutionOptions(input, controller);

                return await run(options.model, runId, input, executionOptions);
            } finally {
                clearRunAbortController(runId);
            }
        },

        async stream(request): Promise<StreamResult<TState>> {
            const { runId, input } = request;
            const controller = createRunAbortController(runId);

            try {
                const executionOptions = await resolveExecutionOptions(input, controller);
                const streamed = await stream(options.model, runId, input, executionOptions);

                const wrappedFinal = (async () => {
                    try {
                        return await streamed.final;
                    } finally {
                        clearRunAbortController(runId);
                    }
                })();

                return {
                    ...streamed,
                    final: wrappedFinal,
                };
            } catch (error) {
                clearRunAbortController(runId);
                throw error;
            }
        },

        async abortRun(runId: string): Promise<void> {
            const controller = activeRuns.get(runId);

            if (!controller) {
                return;
            }

            controller.abort();
            activeRuns.delete(runId);
        },
    };
}
