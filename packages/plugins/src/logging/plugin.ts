import type { Plugin } from "@better-agent/core";
import type { PluginOnStepContext, PluginSaveContext } from "@better-agent/core";
import type { Event } from "@better-agent/core/events";
import { shouldLog } from "./format";
import { redactHeaders } from "./redact";
import type { LogEntry, LoggingPluginConfig } from "./types";
import { validateLoggingPluginConfig } from "./validate";

function safeInvoke(fn: ((...args: unknown[]) => void) | undefined, payload: unknown): void {
    if (!fn) return;
    try {
        fn(payload);
    } catch {
        // Logging must never affect runtime execution.
    }
}

/** Resolves the logger methods for the configured sink. */
function getLoggerMethods(config: LoggingPluginConfig) {
    return {
        debug: config.logger?.debug ?? console.debug,
        info: config.logger?.info ?? console.info,
        warn: config.logger?.warn ?? console.warn,
        error: config.logger?.error ?? console.error,
    };
}

/** Emits one log entry. */
function emitLog(config: LoggingPluginConfig, entry: LogEntry): void {
    const level = config.level ?? "info";
    if (!shouldLog(level, entry)) return;

    const output = config.format ? config.format(entry) : entry;
    const logger = getLoggerMethods(config);
    safeInvoke(logger[entry.level], output);
}

/** Maps one runtime event to a log level. */
function getEventLevel(event: Event): LogEntry["level"] {
    if (event.type.endsWith("_ERROR")) return "error";
    return "info";
}

/** Creates request log data. */
function createRequestData(ctx: Parameters<NonNullable<Plugin["guards"]>[number]>[0]) {
    return {
        mode: ctx.mode,
        url: ctx.request.url,
        method: ctx.request.method,
        headers: redactHeaders(ctx.request.headers),
        input: ctx.input,
    };
}

/** Creates step log data. */
function createStepData(ctx: PluginOnStepContext) {
    return {
        stepIndex: ctx.stepIndex,
        maxSteps: ctx.maxSteps,
        messageCount: ctx.messages.length,
    };
}

/** Creates save log data. */
function createSaveData(ctx: PluginSaveContext) {
    const messageCount = ctx.items.filter((item) => item.type === "message").length;

    return {
        itemCount: ctx.items.length,
        messageCount,
    };
}

/**
 * Creates a logging plugin.
 *
 * @example
 * ```ts
 * const plugin = loggingPlugin({
 *   level: "info",
 *   include: { requests: true, toolCalls: true },
 * });
 * ```
 */
export const loggingPlugin = (config: LoggingPluginConfig = {}): Plugin => {
    validateLoggingPluginConfig(config);

    const include = {
        requests: config.include?.requests ?? true,
        events: config.include?.events ?? true,
        steps: config.include?.steps ?? true,
        modelCalls: config.include?.modelCalls ?? true,
        toolCalls: config.include?.toolCalls ?? true,
        saves: config.include?.saves ?? false,
        errors: config.include?.errors ?? true,
    };

    const plugin: Plugin = {
        id: config.id ?? "logging",
    };

    if (include.requests) {
        plugin.guards = [
            async (ctx) => {
                const body = config.redactBody
                    ? config.redactBody({ body: ctx.input, phase: "request" })
                    : ctx.input;

                emitLog(config, {
                    level: "info",
                    event: "request.received",
                    timestamp: new Date().toISOString(),
                    agentName: ctx.agentName,
                    data: {
                        ...createRequestData(ctx),
                        input: body,
                    },
                });

                return null;
            },
        ];
    }

    if (include.events) {
        plugin.onEvent = async (event, ctx) => {
            const level = getEventLevel(event);
            if (level === "error" && !include.errors) return;

            emitLog(config, {
                level,
                event: "run.event",
                timestamp: new Date(event.timestamp).toISOString(),
                agentName: ctx.agentName,
                runId: ctx.runId,
                conversationId: ctx.conversationId,
                data: {
                    type: event.type,
                },
            });
        };
    }

    if (include.steps) {
        plugin.onStep = async (ctx) => {
            emitLog(config, {
                level: "info",
                event: "step.start",
                timestamp: new Date().toISOString(),
                agentName: ctx.agentName,
                runId: ctx.runId,
                conversationId: ctx.conversationId,
                data: createStepData(ctx),
            });
        };
    }

    if (include.modelCalls) {
        plugin.onBeforeModelCall = async (ctx) => {
            emitLog(config, {
                level: "debug",
                event: "model.before",
                timestamp: new Date().toISOString(),
                agentName: ctx.agentName,
                runId: ctx.runId,
                conversationId: ctx.conversationId,
                data: {
                    stepIndex: ctx.stepIndex,
                    inputCount: ctx.input.length,
                    toolCount: ctx.tools.length,
                    toolChoice: ctx.toolChoice,
                },
            });
        };

        plugin.onAfterModelCall = async (ctx) => {
            emitLog(config, {
                level: "debug",
                event: "model.after",
                timestamp: new Date().toISOString(),
                agentName: ctx.agentName,
                runId: ctx.runId,
                conversationId: ctx.conversationId,
                data: {
                    stepIndex: ctx.stepIndex,
                    response: config.redactBody
                        ? config.redactBody({ body: ctx.response, phase: "response" })
                        : ctx.response,
                },
            });
        };
    }

    if (include.toolCalls) {
        plugin.onBeforeToolCall = async (ctx) => {
            emitLog(config, {
                level: "info",
                event: "tool.before",
                timestamp: new Date().toISOString(),
                agentName: ctx.agentName,
                runId: ctx.runId,
                conversationId: ctx.conversationId,
                data: {
                    toolName: ctx.toolName,
                    toolCallId: ctx.toolCallId,
                    args: config.redactBody
                        ? config.redactBody({ body: ctx.args, phase: "tool_args" })
                        : ctx.args,
                },
            });
            return undefined;
        };

        plugin.onAfterToolCall = async (ctx) => {
            emitLog(config, {
                level: ctx.error ? "error" : "info",
                event: "tool.after",
                timestamp: new Date().toISOString(),
                agentName: ctx.agentName,
                runId: ctx.runId,
                conversationId: ctx.conversationId,
                data: {
                    toolName: ctx.toolName,
                    toolCallId: ctx.toolCallId,
                    error: ctx.error,
                    result: config.redactBody
                        ? config.redactBody({ body: ctx.result, phase: "tool_result" })
                        : ctx.result,
                },
            });
        };
    }

    if (include.saves) {
        plugin.onBeforeSave = async (ctx) => {
            emitLog(config, {
                level: "debug",
                event: "save.before",
                timestamp: new Date().toISOString(),
                agentName: ctx.agentName,
                runId: ctx.runId,
                conversationId: ctx.conversationId,
                data: {
                    ...createSaveData(ctx),
                    items: config.redactBody
                        ? config.redactBody({ body: ctx.items, phase: "save" })
                        : ctx.items,
                },
            });
        };
    }

    return plugin;
};
