import type { AgentEvent, Plugin, PluginStepContext } from "@better-agent/core";
import { shouldLog } from "./format";
import { redactHeaders } from "./redact";
import type { LogEntry, LoggingConfig } from "./types";

function safeInvoke(fn: ((...args: unknown[]) => void) | undefined, payload: unknown): void {
    if (!fn) return;
    try {
        fn(payload);
    } catch {
        // Logging must never affect runtime execution.
    }
}

function safeMap<TInput, TOutput>(
    fn: ((input: TInput) => TOutput) | undefined,
    input: TInput,
): TInput | TOutput {
    if (!fn) return input;
    try {
        return fn(input);
    } catch {
        // Logging customization must never affect runtime execution.
        return input;
    }
}

/** Resolves the logger methods for the configured sink. */
function getLoggerMethods(config: LoggingConfig) {
    return {
        debug: config.logger?.debug ?? console.debug,
        info: config.logger?.info ?? console.info,
        warn: config.logger?.warn ?? console.warn,
        error: config.logger?.error ?? console.error,
    };
}

/** Emits one log entry. */
function emitLog(config: LoggingConfig, entry: LogEntry): void {
    const level = config.level ?? "info";
    if (!shouldLog(level, entry)) return;

    const output = safeMap(config.format, entry);
    const logger = getLoggerMethods(config);
    safeInvoke(logger[entry.level], output);
}

/** Maps one runtime event to a log level. */
function getEventLevel(event: AgentEvent): LogEntry["level"] {
    if (event.type.endsWith("_ERROR")) return "error";
    return "info";
}

function createRedactedRequestData(
    ctx: Parameters<NonNullable<Plugin["guards"]>[number]>[0],
    config: LoggingConfig,
) {
    return {
        url: ctx.request.url,
        method: ctx.request.method,
        headers: redactHeaders(ctx.request.headers, config.redactHeaders),
        input: ctx.input,
    };
}

function redactBody(
    config: LoggingConfig,
    phase: Parameters<NonNullable<LoggingConfig["redactBody"]>>[0]["phase"],
    body: unknown,
): unknown {
    if (!config.redactBody) return body;
    try {
        return config.redactBody({ body, phase });
    } catch {
        // Logging customization must never affect runtime execution.
        return body;
    }
}

/** Creates step log data. */
function createStepData(ctx: PluginStepContext) {
    return {
        stepIndex: ctx.stepIndex,
        maxSteps: ctx.maxSteps,
        messageCount: ctx.messages.length,
    };
}

/**
 * Creates a logging plugin.
 *
 * @example
 * ```ts
 * const plugin = logging({
 *   level: "info",
 *   include: { requests: true, toolCalls: true },
 * });
 * ```
 */
export const logging = (config: LoggingConfig = {}): Plugin => {
    const include = {
        requests: config.include?.requests ?? true,
        events: config.include?.events ?? true,
        steps: config.include?.steps ?? true,
        modelCalls: config.include?.modelCalls ?? true,
        toolCalls: config.include?.toolCalls ?? true,
        errors: config.include?.errors ?? true,
    };

    const plugin: Plugin = {
        id: config.id ?? "logging",
    };

    if (include.requests) {
        plugin.guards = [
            async (ctx) => {
                const body = config.redactBody
                    ? redactBody(config, "request", ctx.input)
                    : ctx.input;

                emitLog(config, {
                    level: "info",
                    event: "request.received",
                    timestamp: new Date().toISOString(),
                    agentName: ctx.agentName,
                    data: {
                        ...createRedactedRequestData(ctx, config),
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
                timestamp: new Date(event.timestamp ?? Date.now()).toISOString(),
                agentName: ctx.agentName,
                runId: ctx.runId,
                conversationId: ctx.threadId,
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
                conversationId: ctx.threadId,
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
                conversationId: ctx.threadId,
                data: {
                    stepIndex: ctx.stepIndex,
                    inputCount: ctx.messages.length,
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
                conversationId: ctx.threadId,
                data: {
                    stepIndex: ctx.stepIndex,
                    response: config.redactBody
                        ? redactBody(config, "response", ctx.response)
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
                conversationId: ctx.threadId,
                data: {
                    toolName: ctx.toolName,
                    toolCallId: ctx.toolCallId,
                    args: config.redactBody
                        ? redactBody(config, "tool_args", ctx.input)
                        : ctx.input,
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
                conversationId: ctx.threadId,
                data: {
                    toolName: ctx.toolName,
                    toolCallId: ctx.toolCallId,
                    error: ctx.error,
                    result: config.redactBody
                        ? redactBody(config, "tool_result", ctx.result)
                        : ctx.result,
                },
            });
        };
    }

    return plugin;
};
