import { BetterAgentError } from "@better-agent/shared/errors";
import { logger } from "@better-agent/shared/logger";
import type { AgentEvent } from "../ag-ui/events";
import { dedupeToolsByName, resolveTools } from "../tools/resolve-tools";
import type { AnyToolDefinition } from "../tools/types";
import type {
    Plugin,
    PluginEndpoint,
    PluginEndpointMethod,
    PluginEventMiddleware,
    PluginGuard,
    PluginRuntime,
    PluginRuntimeEndpoint,
} from "./types";

export function definePlugin<const TPlugin extends Plugin>(plugin: TPlugin): TPlugin {
    return plugin;
}

export function createPluginRuntime(plugins: readonly Plugin[] = []): PluginRuntime {
    const seenPluginIds = new Set<string>();
    const seenEndpoints = new Set<string>();
    const endpoints: PluginRuntimeEndpoint[] = [];

    const guards: Array<{ pluginId: string; guard: PluginGuard }> = [];
    const eventMiddlewares: Array<{
        pluginId: string;
        subscribe?: AgentEvent["type"][];
        middleware: PluginEventMiddleware;
    }> = [];

    const tools: NonNullable<Plugin["tools"]>[] = [];

    const stepHooks: Array<{ pluginId: string; hook: NonNullable<Plugin["onStep"]> }> = [];

    const stepFinishHooks: Array<{
        pluginId: string;
        hook: NonNullable<Plugin["onStepFinish"]>;
    }> = [];
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

    const onEventHooks: Array<{ pluginId: string; hook: NonNullable<Plugin["onEvent"]> }> = [];

    for (const plugin of plugins) {
        const pluginId = plugin.id.trim();

        if (!pluginId) {
            throw BetterAgentError.fromCode(
                "VALIDATION_FAILED",
                "Plugin id must be a non-empty string.",
            );
        }

        if (seenPluginIds.has(pluginId)) {
            throw BetterAgentError.fromCode(
                "VALIDATION_FAILED",
                `Duplicate plugin id '${pluginId}'.`,
                {
                    context: { pluginId },
                },
            );
        }

        seenPluginIds.add(pluginId);

        for (const guard of plugin.guards ?? []) {
            guards.push({ pluginId, guard });
        }

        for (const endpoint of plugin.endpoints ?? []) {
            validateAndExpandEndpoint(endpoint, pluginId, seenEndpoints, endpoints);
        }

        for (const middleware of plugin.events?.middleware ?? []) {
            eventMiddlewares.push({
                pluginId,
                subscribe: plugin.events?.subscribe,
                middleware,
            });
        }

        if (plugin.tools) {
            tools.push(plugin.tools);
        }
        if (plugin.onStep) {
            stepHooks.push({ pluginId, hook: plugin.onStep });
        }
        if (plugin.onStepFinish) {
            stepFinishHooks.push({ pluginId, hook: plugin.onStepFinish });
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
        if (plugin.onEvent) {
            onEventHooks.push({ pluginId, hook: plugin.onEvent });
        }
    }

    return {
        plugins,
        endpoints,
        hasGuards: guards.length > 0,
        hasEndpoints: endpoints.length > 0,
        hasEventMiddleware: eventMiddlewares.length > 0,
        hasOnEvent: onEventHooks.length > 0,
        hasTools: tools.length > 0,
        hasStepHooks: stepHooks.length > 0 || stepFinishHooks.length > 0,
        hasModelHooks: beforeModelHooks.length > 0 || afterModelHooks.length > 0,
        hasToolHooks: beforeToolHooks.length > 0 || afterToolHooks.length > 0,

        async dispatchGuard(ctx) {
            for (const entry of guards) {
                try {
                    const response = await entry.guard(ctx);
                    if (response) {
                        return response;
                    }
                } catch (error) {
                    throw BetterAgentError.wrap({
                        err: error,
                        message: `Plugin '${entry.pluginId}' guard failed.`,
                        opts: {
                            code: "INTERNAL",
                            context: {
                                pluginId: entry.pluginId,
                                agentName: ctx.agentName,
                            },
                        },
                    });
                }
            }

            return null;
        },

        async dispatchEvent(event, ctx) {
            const run = async (
                index: number,
                current: typeof event,
            ): Promise<typeof event | null> => {
                for (let i = index; i < eventMiddlewares.length; i += 1) {
                    const entry = eventMiddlewares[i];
                    if (!entry) {
                        continue;
                    }

                    if (entry.subscribe && !entry.subscribe.includes(current.type)) {
                        continue;
                    }

                    try {
                        return await entry.middleware(current, ctx, (nextEvent) =>
                            run(i + 1, nextEvent),
                        );
                    } catch (error) {
                        reportPluginError(entry.pluginId, "event_middleware", error);
                        return run(i + 1, current);
                    }
                }

                return current;
            };

            return run(0, event);
        },

        async dispatchOnEvent(event, ctx) {
            for (const entry of onEventHooks) {
                try {
                    await entry.hook(event, ctx);
                } catch (error) {
                    reportPluginError(entry.pluginId, "on_event", error);
                }
            }
        },

        async resolveTools(context) {
            const resolved: AnyToolDefinition[] = [];

            for (const source of tools) {
                resolved.push(...(await resolveTools(source, context)));
            }

            return dedupeToolsByName(resolved);
        },

        async applyOnStep(ctx) {
            await runHooks(stepHooks, "on_step", async (hook) => {
                await hook(ctx);
            });
        },

        async applyOnStepFinish(ctx) {
            await runHooks(stepFinishHooks, "on_step_finish", async (hook) => {
                await hook(ctx);
            });
        },

        async applyBeforeModelCall(ctx) {
            await runHooks(beforeModelHooks, "before_model_call", async (hook) => {
                await hook(ctx);
            });
        },

        async applyAfterModelCall(ctx) {
            await runHooks(afterModelHooks, "after_model_call", async (hook) => {
                await hook(ctx);
            });
        },

        async applyBeforeToolCall(ctx) {
            for (const entry of beforeToolHooks) {
                try {
                    const decision = await entry.hook(ctx);
                    if (decision?.skip === true) {
                        return decision;
                    }
                } catch (error) {
                    reportPluginError(entry.pluginId, "before_tool_call", error);
                }
            }

            return undefined;
        },

        async applyAfterToolCall(ctx) {
            await runHooks(afterToolHooks, "after_tool_call", async (hook) => {
                await hook(ctx);
            });
        },
    };
}

async function runHooks<TContext>(
    hooks: Array<{ pluginId: string; hook: (ctx: TContext) => unknown | Promise<unknown> }>,
    phase: PluginRuntimePhase,
    run: (hook: (ctx: TContext) => unknown | Promise<unknown>) => Promise<void>,
): Promise<void> {
    for (const entry of hooks) {
        try {
            await run(entry.hook);
        } catch (error) {
            reportPluginError(entry.pluginId, phase, error);
        }
    }
}

type PluginRuntimePhase =
    | "event_middleware"
    | "on_event"
    | "on_step"
    | "on_step_finish"
    | "before_model_call"
    | "after_model_call"
    | "before_tool_call"
    | "after_tool_call";

function reportPluginError(pluginId: string, phase: PluginRuntimePhase, error: unknown): void {
    logger.error(`[better-agent] Plugin '${pluginId}' failed during ${phase}.`, error);
}

function validateAndExpandEndpoint(
    endpoint: PluginEndpoint,
    pluginId: string,
    seenEndpoints: Set<string>,
    endpoints: PluginRuntimeEndpoint[],
): void {
    const path = endpoint.path.trim();

    if (!path.startsWith("/")) {
        throw BetterAgentError.fromCode(
            "VALIDATION_FAILED",
            `Plugin '${pluginId}' endpoint path must start with '/'.`,
            {
                context: { pluginId, path: endpoint.path },
            },
        );
    }

    const methods = Array.isArray(endpoint.method) ? endpoint.method : [endpoint.method];

    if (methods.length === 0) {
        throw BetterAgentError.fromCode(
            "VALIDATION_FAILED",
            `Plugin '${pluginId}' endpoint must declare at least one method.`,
            {
                context: { pluginId, path },
            },
        );
    }

    for (const method of methods) {
        validateEndpointMethod(method, pluginId, path);

        const key = `${method} ${path}`;
        if (seenEndpoints.has(key)) {
            throw BetterAgentError.fromCode(
                "VALIDATION_FAILED",
                `Duplicate plugin endpoint '${key}'.`,
                {
                    context: { pluginId, method, path },
                },
            );
        }

        seenEndpoints.add(key);
        endpoints.push({
            pluginId,
            method,
            path,
            handler: endpoint.handler,
        });
    }
}

function validateEndpointMethod(
    method: PluginEndpointMethod,
    pluginId: string,
    path: string,
): void {
    const allowedMethods = new Set<PluginEndpointMethod>([
        "GET",
        "POST",
        "PUT",
        "PATCH",
        "DELETE",
        "OPTIONS",
    ]);

    if (!allowedMethods.has(method)) {
        throw BetterAgentError.fromCode(
            "VALIDATION_FAILED",
            `Plugin '${pluginId}' endpoint has unsupported HTTP method '${method}'.`,
            {
                context: { pluginId, method, path },
            },
        );
    }
}
