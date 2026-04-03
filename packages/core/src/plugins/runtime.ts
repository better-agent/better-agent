import { BetterAgentError } from "@better-agent/shared/errors";
import { logger } from "@better-agent/shared/logger";
import type { HttpMethod } from "../api";
import type { Event } from "../events";
import type {
    Capabilities,
    GenerativeModelInputItem,
    GenerativeModelInputMessageContent,
    ToolChoice,
} from "../providers";
import type { PreviousStepResult } from "../run";
import { resolveToolsForRun } from "../tools";
import type { AgentToolDefinition, ToolSource } from "../tools";
import type {
    Plugin,
    PluginEndpoint,
    PluginEventMiddleware,
    PluginGuard,
    PluginModelCallContext,
    PluginModelResponseContext,
    PluginOnStepContext,
    PluginRuntime,
    PluginRuntimeEndpoint,
    PluginSaveContext,
    PluginToolCallContext,
    PluginToolResultContext,
} from "./types";

/**
 * Defines a plugin.
 *
 * Plugin hook contexts are intentionally broad at authoring time. Some
 * capability-sensitive controls may be omitted at runtime for models that do
 * not support them.
 *
 * @param config Plugin configuration.
 * @returns The plugin definition with preserved literal types.
 */
export function definePlugin<const T extends Plugin>(config: T): T {
    return config;
}

/**
 * Builds validated plugin runtime metadata for the runner and server.
 */
export function createPluginRuntime(plugins?: readonly Plugin[]): PluginRuntime {
    const source = plugins ?? [];

    const seenPluginIds = new Set<string>();
    const seenEndpoints = new Set<string>();

    const eventMiddlewares: Array<{
        pluginId: string;
        subscribe?: readonly Event["type"][];
        middleware: PluginEventMiddleware;
    }> = [];
    const guards: Array<{ pluginId: string; guard: PluginGuard }> = [];
    const endpoints: PluginRuntimeEndpoint[] = [];
    const onEventHandlers: Array<NonNullable<Plugin["onEvent"]>> = [];
    const toolSources: ToolSource<unknown>[] = [];
    const onStepHooks: Array<{ pluginId: string; hook: NonNullable<Plugin["onStep"]> }> = [];
    const beforeModelHooks: Array<{
        pluginId: string;
        hook: NonNullable<Plugin["onBeforeModelCall"]>;
    }> = [];
    const afterModelHooks: Array<{
        pluginId: string;
        hook: NonNullable<Plugin["onAfterModelCall"]>;
    }> = [];
    const beforeToolHooks: Array<{
        pluginId: string;
        hook: NonNullable<Plugin["onBeforeToolCall"]>;
    }> = [];
    const afterToolHooks: Array<{
        pluginId: string;
        hook: NonNullable<Plugin["onAfterToolCall"]>;
    }> = [];
    const beforeSaveHooks: Array<{
        pluginId: string;
        hook: NonNullable<Plugin["onBeforeSave"]>;
    }> = [];

    for (const plugin of source) {
        const pluginId = plugin.id.trim();

        // Validate plugin id before any hooks are collected.
        if (pluginId.length === 0) {
            throw BetterAgentError.fromCode(
                "VALIDATION_FAILED",
                "Plugin id must be a non-empty string.",
                {
                    trace: [{ at: "core.plugins.createPluginRuntime" }],
                },
            );
        }

        if (seenPluginIds.has(pluginId)) {
            throw BetterAgentError.fromCode(
                "VALIDATION_FAILED",
                `Duplicate plugin id '${pluginId}'.`,
                {
                    context: { pluginId },
                    trace: [{ at: "core.plugins.createPluginRuntime" }],
                },
            );
        }

        seenPluginIds.add(pluginId);

        // Collect event middleware in registration order.
        if (plugin.events?.middleware) {
            for (const middleware of plugin.events.middleware) {
                eventMiddlewares.push({
                    pluginId,
                    middleware,
                    ...(plugin.events.subscribe !== undefined
                        ? { subscribe: plugin.events.subscribe }
                        : {}),
                });
            }
        }

        // Collect guards in registration order.
        if (plugin.guards) {
            for (const guard of plugin.guards) {
                guards.push({ pluginId, guard });
            }
        }

        // Collect and validate endpoints up front so the server can mount them safely.
        for (const endpoint of plugin.endpoints ?? []) {
            validateAndExpandEndpoint(endpoint, pluginId, seenEndpoints, endpoints);
        }

        if (plugin.onEvent) {
            onEventHandlers.push(plugin.onEvent);
        }

        if (plugin.tools) {
            toolSources.push(plugin.tools);
        }

        if (plugin.onStep) {
            onStepHooks.push({ pluginId, hook: plugin.onStep });
        }

        if (plugin.onBeforeModelCall) {
            beforeModelHooks.push({ pluginId, hook: plugin.onBeforeModelCall });
        }

        if (plugin.onAfterModelCall) {
            afterModelHooks.push({ pluginId, hook: plugin.onAfterModelCall });
        }

        if (plugin.onBeforeToolCall) {
            beforeToolHooks.push({ pluginId, hook: plugin.onBeforeToolCall });
        }

        if (plugin.onAfterToolCall) {
            afterToolHooks.push({ pluginId, hook: plugin.onAfterToolCall });
        }

        if (plugin.onBeforeSave) {
            beforeSaveHooks.push({ pluginId, hook: plugin.onBeforeSave });
        }
    }

    const reportPluginRuntimeError = (params: {
        pluginId: string;
        phase:
            | "event_middleware"
            | "guard"
            | "on_event"
            | "on_step"
            | "before_model_call"
            | "after_model_call"
            | "before_tool_call"
            | "after_tool_call"
            | "before_save";
        error: unknown;
    }) => {
        logger.error(
            `[better-agent] Plugin '${params.pluginId}' failed during ${params.phase}.`,
            params.error,
        );
    };

    return {
        plugins: source,
        endpoints,
        hasEventMiddleware: eventMiddlewares.length > 0,
        hasOnEvent: onEventHandlers.length > 0,
        hasGuards: guards.length > 0,
        hasTools: toolSources.length > 0,
        hasOnStep: onStepHooks.length > 0,
        hasModelHooks: beforeModelHooks.length > 0 || afterModelHooks.length > 0,
        hasToolHooks: beforeToolHooks.length > 0 || afterToolHooks.length > 0,
        hasOnBeforeSave: beforeSaveHooks.length > 0,

        async dispatchEvent(event, ctx) {
            const run = async (index: number, current: Event): Promise<Event | null> => {
                for (let i = index; i < eventMiddlewares.length; i++) {
                    const item = eventMiddlewares[i];
                    if (!item) continue;

                    if (item.subscribe && !item.subscribe.includes(current.type)) {
                        continue;
                    }

                    try {
                        const result = await item.middleware(current, ctx, async (nextEvent) => {
                            return run(i + 1, nextEvent);
                        });
                        return result;
                    } catch (error) {
                        reportPluginRuntimeError({
                            pluginId: item.pluginId,
                            phase: "event_middleware",
                            error,
                        });
                        return run(i + 1, current);
                    }
                }
                return current;
            };

            return run(0, event);
        },

        async dispatchOnEvent(event, ctx) {
            for (let i = 0; i < source.length; i += 1) {
                const plugin = source[i];
                if (!plugin?.onEvent) continue;

                try {
                    await plugin.onEvent(event, ctx);
                } catch (error) {
                    reportPluginRuntimeError({
                        pluginId: plugin.id,
                        phase: "on_event",
                        error,
                    });
                }
            }
        },

        async dispatchRun(ctx) {
            for (const entry of guards) {
                try {
                    const response = await entry.guard(ctx);
                    if (response) {
                        // Guard rejected the request
                        return response;
                    }
                } catch (error) {
                    reportPluginRuntimeError({
                        pluginId: entry.pluginId,
                        phase: "guard",
                        error,
                    });
                    throw BetterAgentError.wrap({
                        err: error,
                        message: `Plugin '${entry.pluginId}' guard failed.`,
                        opts: {
                            code: "INTERNAL",
                            context: {
                                pluginId: entry.pluginId,
                                mode: ctx.mode,
                                agentName: ctx.agentName,
                            },
                            trace: [{ at: "core.plugins.createPluginRuntime.dispatchRun" }],
                        },
                    });
                }
            }
            // All guards passed
            return null;
        },

        async resolveTools<TContext>(context?: TContext) {
            if (toolSources.length === 0) {
                return {
                    tools: [],
                    runCleanup: async () => {},
                };
            }

            const cleanupTasks: Array<() => Promise<void> | void> = [];
            const deduped = new Map<string, AgentToolDefinition>();

            for (const source of toolSources) {
                const resolved = await resolveToolsForRun<unknown>({
                    agentTools: source,
                    ...(context !== undefined ? { context: context as unknown } : {}),
                });

                cleanupTasks.push(resolved.runCleanup);
                for (const tool of resolved.tools) {
                    if (typeof tool.name !== "string") {
                        continue;
                    }

                    if (deduped.has(tool.name)) {
                        deduped.delete(tool.name);
                    }
                    deduped.set(tool.name, tool);
                }
            }

            return {
                tools: [...deduped.values()],
                runCleanup: async () => {
                    await Promise.allSettled(cleanupTasks.map(async (cleanup) => await cleanup()));
                },
            };
        },

        async applyOnStep<
            TContext,
            TToolName extends string = string,
            TModelCaps extends Capabilities = Capabilities,
        >(params: {
            runId: string;
            agentName: string;
            conversationId?: string;
            stepIndex: number;
            maxSteps: number | undefined;
            messages: GenerativeModelInputItem<TModelCaps>[];
            context?: TContext;
            previousStep?: PreviousStepResult;
            /** Model capabilities to determine if setActiveTools should work */
            modelCaps?: TModelCaps;
        }) {
            const prepared: {
                messages: typeof params.messages;
                toolChoice?: ToolChoice;
                activeTools?: TToolName[];
                systemInstruction?: GenerativeModelInputMessageContent<TModelCaps>;
            } = {
                messages: [...params.messages],
            };

            if (onStepHooks.length === 0) {
                return prepared;
            }

            // Check if model supports tools
            const supportsTools = params.modelCaps?.tools === true;
            const supportsInstructionControl =
                params.modelCaps === undefined
                    ? true
                    : params.modelCaps.inputShape !== "prompt" &&
                      params.modelCaps.supportsInstruction === true;

            const baseHookContext = {
                runId: params.runId,
                agentName: params.agentName,
                stepIndex: params.stepIndex,
                maxSteps: params.maxSteps,
                messages: prepared.messages,
                ...(params.conversationId !== undefined
                    ? { conversationId: params.conversationId }
                    : {}),
                ...(params.context !== undefined ? { context: params.context as unknown } : {}),
                ...(params.previousStep !== undefined ? { previousStep: params.previousStep } : {}),
                updateMessages: (
                    updater: (
                        messages: GenerativeModelInputItem<TModelCaps>[],
                    ) => GenerativeModelInputItem<TModelCaps>[],
                ) => {
                    prepared.messages = updater([...prepared.messages]);
                    (baseHookContext as typeof hookContext).messages = prepared.messages;
                },
            };

            const withInstructionControl = supportsInstructionControl
                ? {
                      ...baseHookContext,
                      setSystemInstruction: (
                          instruction: GenerativeModelInputMessageContent<TModelCaps>,
                      ) => {
                          prepared.systemInstruction = instruction;
                      },
                  }
                : baseHookContext;

            const hookContext = supportsTools
                ? {
                      ...withInstructionControl,
                      setToolChoice: (choice: ToolChoice) => {
                          prepared.toolChoice = choice;
                      },
                      setActiveTools: (names: readonly TToolName[]) => {
                          prepared.activeTools = [...names];
                      },
                  }
                : withInstructionControl;

            for (const entry of onStepHooks) {
                try {
                    await entry.hook(hookContext as unknown as PluginOnStepContext);
                } catch (error) {
                    reportPluginRuntimeError({
                        pluginId: entry.pluginId,
                        phase: "on_step",
                        error,
                    });
                }
            }

            return prepared;
        },

        async applyBeforeModelCall(params) {
            const prepared: {
                input: GenerativeModelInputItem[];
                tools: AgentToolDefinition[];
                toolChoice: ToolChoice | undefined;
            } = {
                input: [...params.input],
                tools: [...params.tools],
                toolChoice: params.toolChoice,
            };

            if (beforeModelHooks.length === 0) {
                return {
                    input: prepared.input,
                    tools: prepared.tools,
                    ...(prepared.toolChoice !== undefined
                        ? { toolChoice: prepared.toolChoice }
                        : {}),
                };
            }

            const supportsTools = params.modelCaps?.tools === true;

            const baseHookContext = {
                runId: params.runId,
                agentName: params.agentName,
                stepIndex: params.stepIndex,
                input: prepared.input,
                ...(params.conversationId !== undefined
                    ? { conversationId: params.conversationId }
                    : {}),
                setInput: (input: GenerativeModelInputItem[]) => {
                    prepared.input = [...input];
                    baseHookContext.input = prepared.input;
                },
            };

            if (supportsTools) {
                const toolHookContext = {
                    ...baseHookContext,
                    tools: prepared.tools,
                    ...(prepared.toolChoice !== undefined
                        ? { toolChoice: prepared.toolChoice }
                        : {}),
                    setTools: (tools: AgentToolDefinition[]) => {
                        prepared.tools = [...tools];
                        toolHookContext.tools = prepared.tools;
                    },
                    setToolChoice: (choice: ToolChoice | undefined) => {
                        prepared.toolChoice = choice;
                        if (choice === undefined) {
                            // biome-ignore lint/performance/noDelete: <explanation>
                            delete toolHookContext.toolChoice;
                        } else {
                            toolHookContext.toolChoice = choice;
                        }
                    },
                };

                for (const entry of beforeModelHooks) {
                    try {
                        await entry.hook(toolHookContext as PluginModelCallContext);
                    } catch (error) {
                        reportPluginRuntimeError({
                            pluginId: entry.pluginId,
                            phase: "before_model_call",
                            error,
                        });
                    }
                }
            } else {
                for (const entry of beforeModelHooks) {
                    try {
                        await entry.hook(baseHookContext as PluginModelCallContext);
                    } catch (error) {
                        reportPluginRuntimeError({
                            pluginId: entry.pluginId,
                            phase: "before_model_call",
                            error,
                        });
                    }
                }
            }

            return {
                input: prepared.input,
                tools: prepared.tools,
                ...(prepared.toolChoice !== undefined ? { toolChoice: prepared.toolChoice } : {}),
            };
        },

        async applyAfterModelCall(params) {
            if (afterModelHooks.length === 0) {
                return;
            }

            const hookContext: PluginModelResponseContext = {
                runId: params.runId,
                agentName: params.agentName,
                stepIndex: params.stepIndex,
                response: params.response,
                ...(params.conversationId !== undefined
                    ? { conversationId: params.conversationId }
                    : {}),
            };

            for (const entry of afterModelHooks) {
                try {
                    await entry.hook(hookContext);
                } catch (error) {
                    reportPluginRuntimeError({
                        pluginId: entry.pluginId,
                        phase: "after_model_call",
                        error,
                    });
                }
            }
        },

        async applyBeforeToolCall(params) {
            const prepared = { args: params.args };

            if (beforeToolHooks.length === 0) {
                return prepared;
            }

            const hookContext: PluginToolCallContext = {
                runId: params.runId,
                agentName: params.agentName,
                toolName: params.toolName,
                toolCallId: params.toolCallId,
                args: prepared.args,
                ...(params.conversationId !== undefined
                    ? { conversationId: params.conversationId }
                    : {}),
                setArgs: (args) => {
                    prepared.args = args;
                    hookContext.args = args;
                },
            };

            for (const entry of beforeToolHooks) {
                try {
                    const decision = await entry.hook(hookContext);
                    if (decision && decision.skip === true) {
                        return { args: prepared.args, decision };
                    }
                } catch (error) {
                    reportPluginRuntimeError({
                        pluginId: entry.pluginId,
                        phase: "before_tool_call",
                        error,
                    });
                }
            }

            return { args: prepared.args };
        },

        async applyAfterToolCall(params) {
            const prepared = { result: params.result };

            if (afterToolHooks.length === 0) {
                return prepared;
            }

            const hookContext: PluginToolResultContext = {
                runId: params.runId,
                agentName: params.agentName,
                toolName: params.toolName,
                toolCallId: params.toolCallId,
                args: params.args,
                result: prepared.result,
                ...(params.conversationId !== undefined
                    ? { conversationId: params.conversationId }
                    : {}),
                ...(params.error !== undefined ? { error: params.error } : {}),
                setResult: (result) => {
                    prepared.result = result;
                    hookContext.result = result;
                },
            };

            for (const entry of afterToolHooks) {
                try {
                    await entry.hook(hookContext);
                } catch (error) {
                    reportPluginRuntimeError({
                        pluginId: entry.pluginId,
                        phase: "after_tool_call",
                        error,
                    });
                }
            }

            return prepared;
        },

        async applyBeforeSave(params) {
            let items = [...params.items];
            if (beforeSaveHooks.length === 0) {
                return items;
            }

            const hookContext: PluginSaveContext = {
                runId: params.runId,
                agentName: params.agentName,
                items,
                ...(params.conversationId !== undefined
                    ? { conversationId: params.conversationId }
                    : {}),
                setItems: (nextItems) => {
                    items = [...nextItems];
                    hookContext.items = items;
                },
            };

            for (const entry of beforeSaveHooks) {
                try {
                    await entry.hook(hookContext);
                } catch (error) {
                    reportPluginRuntimeError({
                        pluginId: entry.pluginId,
                        phase: "before_save",
                        error,
                    });
                }
            }

            return items;
        },
    };
}

/**
 * Validates and expands a plugin endpoint definition.
 */
function validateAndExpandEndpoint(
    endpoint: PluginEndpoint,
    pluginId: string,
    seenEndpoints: Set<string>,
    endpoints: PluginRuntimeEndpoint[],
): void {
    const path = endpoint.path.trim();

    // Endpoint paths are always absolute route patterns.
    if (path.length === 0 || !path.startsWith("/")) {
        throw BetterAgentError.fromCode(
            "VALIDATION_FAILED",
            `Plugin '${pluginId}' endpoint path must start with '/'.`,
            {
                context: { pluginId, path: endpoint.path },
                trace: [{ at: "core.plugins.createPluginRuntime" }],
            },
        );
    }

    // Normalize methods into a flat list.
    const methods = Array.isArray(endpoint.method) ? endpoint.method : [endpoint.method];

    // Endpoints must declare at least one method.
    if (methods.length === 0) {
        throw BetterAgentError.fromCode(
            "VALIDATION_FAILED",
            `Plugin '${pluginId}' endpoint must declare at least one method.`,
            {
                context: { pluginId, path },
                trace: [{ at: "core.plugins.createPluginRuntime" }],
            },
        );
    }

    /** Allowed HTTP methods for plugin endpoints. */
    const ALLOWED_METHODS: Set<HttpMethod> = new Set([
        "GET",
        "POST",
        "PUT",
        "PATCH",
        "DELETE",
        "OPTIONS",
    ]);

    // Expand one endpoint per HTTP method.
    for (const method of methods) {
        if (!ALLOWED_METHODS.has(method)) {
            throw BetterAgentError.fromCode(
                "VALIDATION_FAILED",
                `Plugin '${pluginId}' endpoint has unsupported HTTP method '${method}'.`,
                {
                    context: { pluginId, path, method },
                    trace: [{ at: "core.plugins.createPluginRuntime" }],
                },
            );
        }

        // Duplicate method/path pairs are rejected at runtime construction time.
        const key = `${method} ${path}`;
        if (seenEndpoints.has(key)) {
            throw BetterAgentError.fromCode(
                "VALIDATION_FAILED",
                `Duplicate plugin endpoint '${key}'.`,
                {
                    context: { pluginId, method, path },
                    trace: [{ at: "core.plugins.createPluginRuntime" }],
                },
            );
        }

        seenEndpoints.add(key);
        endpoints.push({
            pluginId,
            method,
            path,
            ...(endpoint.public === true ? { public: true } : {}),
            handler: endpoint.handler,
        });
    }
}
