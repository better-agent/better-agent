import { BetterAgentError } from "@better-agent/shared/errors";
import { logger } from "@better-agent/shared/logger";
import { safeJsonParse } from "@better-agent/shared/utils";
import { type Event, Events } from "../events";
import type { PluginRuntime } from "../plugins";
import type { GenerativeModelToolCallRequest, GenerativeModelToolCallResult } from "../providers";
import { validateInput } from "../schema";
import type {
    AgentToolDefinition,
    ExecutionToolError,
    OnToolError,
    ParseToolError,
    ToolApprovalConfig,
    ToolErrorContext,
    ToolErrorMode,
    ToolErrorPayload,
    ToolErrorResultFor,
    ValidationToolError,
} from "../tools";
import type { PendingToolRuntime } from "./pending-tools";
import type { RunAdvancedOptions } from "./types";

const MAX_TOOL_ERROR_REPAIR_DEPTH = 2;
const MAX_TOOL_ERROR_RETRY_ATTEMPTS = 3;

type RecoverableToolErrorKind = ToolErrorPayload["errorKind"];
type ExecutableToolDefinition = Exclude<AgentToolDefinition, { kind: "hosted" }>;

type ToolExecutionOutcome = {
    result: unknown;
    isError?: boolean;
    errorKind?: RecoverableToolErrorKind;
};

type ResolvedApproval = {
    required?: boolean;
    timeoutMs?: number;
    meta?: Record<string, unknown>;
};

type PreparedToolCall = {
    toolCall: GenerativeModelToolCallRequest;
    tool: ExecutableToolDefinition;
    toolTarget: "server" | "client";
    args?: unknown;
    validatedInput?: unknown;
    resolvedApproval?: ResolvedApproval;
    skip: boolean;
    skipResult?: unknown;
    parseError?: BetterAgentError;
    validationError?: BetterAgentError;
    shouldEmitToolCallEnd: boolean;
};

const getToolRunName = (tool: AgentToolDefinition): string | undefined =>
    tool.kind === "hosted"
        ? typeof tool.name === "string" && tool.name.length > 0
            ? tool.name
            : typeof tool.type === "string" && tool.type.length > 0
              ? tool.type
              : undefined
        : typeof tool.name === "string" && tool.name.length > 0
          ? tool.name
          : undefined;

/** Executes the next batch of tool calls. */
export const executeToolCalls = async <TContext>(params: {
    runId: string;
    agentName: string;
    conversationId?: string;
    parentMessageId: string;
    toolCalls: readonly GenerativeModelToolCallRequest[];
    tools: readonly AgentToolDefinition[];
    toolErrorMode?: ToolErrorMode;
    onToolError?: OnToolError;
    signal: AbortSignal;
    emit: (event: Event) => Promise<void>;
    advanced?: RunAdvancedOptions;
    pendingToolRuntime?: PendingToolRuntime;
    context?: TContext;
    pluginRuntime?: PluginRuntime | null;
}): Promise<{
    results: GenerativeModelToolCallResult[];
}> => {
    const results: GenerativeModelToolCallResult[] = [];

    const throwIfAborted = () => {
        if (params.signal.aborted) {
            throw BetterAgentError.fromCode("ABORTED", "Tool execution was aborted.", {
                trace: [{ at: "core.run.executeToolCalls.aborted" }],
            });
        }
    };

    const isAbortError = (error: unknown): boolean =>
        params.signal.aborted === true ||
        (error instanceof BetterAgentError && error.code === "ABORTED");

    const waitForRetryBackoff = async (ms: number) => {
        if (ms <= 0) {
            throwIfAborted();
            return;
        }

        await new Promise<void>((resolve, reject) => {
            const timer = setTimeout(() => {
                params.signal.removeEventListener("abort", onAbort);
                resolve();
            }, ms);

            const onAbort = () => {
                clearTimeout(timer);
                reject(
                    BetterAgentError.fromCode("ABORTED", "Tool execution was aborted.", {
                        trace: [{ at: "core.run.executeToolCalls.retryBackoff" }],
                    }),
                );
            };

            if (params.signal.aborted) {
                onAbort();
                return;
            }

            params.signal.addEventListener("abort", onAbort, { once: true });
        });
    };

    const extractToolErrorMessage = (
        error: unknown,
        errorKind: RecoverableToolErrorKind,
    ): string => {
        const rawMessage =
            error instanceof BetterAgentError || error instanceof Error
                ? error.message
                : typeof error === "string"
                  ? error
                  : "Unknown tool error";

        if (errorKind === "parse") {
            return `Tool arguments could not be parsed as valid JSON. ${rawMessage}`.trim();
        }

        if (errorKind === "validation") {
            return `Tool arguments failed schema validation. ${rawMessage}`.trim();
        }

        return rawMessage;
    };

    const createToolErrorOutcome = (args: {
        toolName: string;
        errorKind: RecoverableToolErrorKind;
        message: string;
        retryable?: boolean;
    }): ToolExecutionOutcome => ({
        result: {
            type: "tool_error",
            toolName: args.toolName,
            errorKind: args.errorKind,
            message: args.message,
            retryable: args.retryable,
        } satisfies ToolErrorPayload,
        isError: true,
        errorKind: args.errorKind,
    });

    const createToolErrorOutcomeFromError = (args: {
        toolName: string;
        error: unknown;
        errorKind: RecoverableToolErrorKind;
        message?: string;
        retryable?: boolean;
    }): ToolExecutionOutcome =>
        createToolErrorOutcome({
            toolName: args.toolName,
            errorKind: args.errorKind,
            message: args.message ?? extractToolErrorMessage(args.error, args.errorKind),
            retryable:
                args.retryable ??
                (args.error instanceof BetterAgentError ? args.error.retryable : undefined),
        });

    const emitToolCallStart = async (prepared: {
        toolCall: GenerativeModelToolCallRequest;
        toolTarget: "server" | "client";
    }) => {
        await params.emit({
            type: Events.TOOL_CALL_START,
            runId: params.runId,
            agentName: params.agentName,
            parentMessageId: params.parentMessageId,
            toolCallId: prepared.toolCall.callId,
            toolCallName: prepared.toolCall.name,
            toolTarget: prepared.toolTarget,
            timestamp: Date.now(),
        });
    };

    const emitToolCallArgs = async (prepared: {
        toolCall: GenerativeModelToolCallRequest;
        toolTarget: "server" | "client";
    }) => {
        await params.emit({
            type: Events.TOOL_CALL_ARGS,
            runId: params.runId,
            agentName: params.agentName,
            parentMessageId: params.parentMessageId,
            toolCallId: prepared.toolCall.callId,
            toolCallName: prepared.toolCall.name,
            delta: prepared.toolCall.arguments,
            toolTarget: prepared.toolTarget,
            timestamp: Date.now(),
        });
    };

    const emitToolCallEnd = async (prepared: {
        toolCall: GenerativeModelToolCallRequest;
        toolTarget: "server" | "client";
    }) => {
        await params.emit({
            type: Events.TOOL_CALL_END,
            runId: params.runId,
            agentName: params.agentName,
            parentMessageId: params.parentMessageId,
            toolCallId: prepared.toolCall.callId,
            toolCallName: prepared.toolCall.name,
            toolTarget: prepared.toolTarget,
            timestamp: Date.now(),
        });
    };

    const emitToolCallResult = async (
        prepared: PreparedToolCall,
        outcome: ToolExecutionOutcome,
    ) => {
        await params.emit({
            type: Events.TOOL_CALL_RESULT,
            runId: params.runId,
            agentName: params.agentName,
            parentMessageId: params.parentMessageId,
            toolCallId: prepared.toolCall.callId,
            toolCallName: prepared.toolCall.name,
            result: outcome.result,
            isError: outcome.isError,
            errorKind: outcome.errorKind,
            toolTarget: prepared.toolTarget,
            timestamp: Date.now(),
        });
    };

    const resolveExecutableTool = (
        toolCall: GenerativeModelToolCallRequest,
    ): { tool: ExecutableToolDefinition; toolTarget: "server" | "client" } => {
        const tool = params.tools.find((candidate) => getToolRunName(candidate) === toolCall.name);
        if (!tool) {
            throw BetterAgentError.fromCode(
                "VALIDATION_FAILED",
                `Tool '${toolCall.name}' was requested by the model but is not available for this run.`,
                {
                    context: {
                        runId: params.runId,
                        agentName: params.agentName,
                        toolName: toolCall.name,
                    },
                    trace: [{ at: "core.run.executeToolCalls.missingTool" }],
                },
            );
        }

        if (tool.kind === "hosted") {
            throw BetterAgentError.fromCode(
                "NOT_IMPLEMENTED",
                `Hosted tool '${getToolRunName(tool) ?? toolCall.name}' reached the in-process tool executor, but hosted tools must be executed by the provider during model invocation.`,
                {
                    context: {
                        runId: params.runId,
                        agentName: params.agentName,
                        toolName: getToolRunName(tool) ?? toolCall.name,
                        toolTarget: tool.kind,
                        provider: tool.provider,
                        toolType: tool.type,
                    },
                    trace: [{ at: "core.run.executeToolCalls.hostedToolInvariant" }],
                },
            );
        }

        return {
            tool,
            toolTarget: tool.kind === "client" ? "client" : "server",
        };
    };

    const resolveApprovalConfig = async <TInput>(args: {
        approval?: ToolApprovalConfig<unknown, TInput>;
        input: TInput;
        toolCall: GenerativeModelToolCallRequest;
        tool: ExecutableToolDefinition;
        toolTarget: "server" | "client";
    }): Promise<ResolvedApproval | undefined> => {
        const approval = args.approval;
        if (!approval) {
            return undefined;
        }

        let resolved: ResolvedApproval = {
            required: approval.required,
            timeoutMs: approval.timeoutMs,
            meta: approval.meta,
        };

        if (approval.resolve) {
            const runtimeResolved = await approval.resolve({
                context: params.context,
                input: args.input,
                runId: params.runId,
                toolCallId: args.toolCall.callId,
                toolName: args.tool.name,
                toolTarget: args.toolTarget,
            });

            resolved = {
                required: runtimeResolved.required ?? resolved.required,
                timeoutMs: runtimeResolved.timeoutMs ?? resolved.timeoutMs,
                meta: runtimeResolved.meta ?? resolved.meta,
            };
        }

        return resolved;
    };

    const emitApprovalRequested = async (prepared: PreparedToolCall) => {
        await params.emit({
            type: Events.TOOL_APPROVAL_REQUIRED,
            runId: params.runId,
            agentName: params.agentName,
            parentMessageId: params.parentMessageId,
            toolCallId: prepared.toolCall.callId,
            toolCallName: prepared.toolCall.name,
            toolTarget: prepared.toolTarget,
            toolInput: prepared.validatedInput,
            state: "requested",
            timestamp: Date.now(),
            meta: prepared.resolvedApproval?.meta,
        });

        await params.emit({
            type: Events.TOOL_APPROVAL_UPDATED,
            runId: params.runId,
            agentName: params.agentName,
            parentMessageId: params.parentMessageId,
            toolCallId: prepared.toolCall.callId,
            toolCallName: prepared.toolCall.name,
            toolTarget: prepared.toolTarget,
            state: "requested",
            toolInput: prepared.validatedInput,
            timestamp: Date.now(),
            meta: prepared.resolvedApproval?.meta,
        });
    };

    const awaitApprovalIfNeeded = async (
        prepared: PreparedToolCall,
    ): Promise<{ approved: true } | { approved: false; note?: string }> => {
        if (!prepared.resolvedApproval?.required) {
            return { approved: true };
        }

        if (!params.pendingToolRuntime) {
            throw BetterAgentError.fromCode(
                "NOT_IMPLEMENTED",
                `Tool '${prepared.tool.name}' requires approval, but no approval runtime is configured.`,
                {
                    context: {
                        runId: params.runId,
                        toolName: prepared.tool.name,
                        toolCallId: prepared.toolCall.callId,
                        toolTarget: prepared.toolTarget,
                    },
                    trace: [{ at: "core.run.executeTools.awaitApprovalIfNeeded" }],
                },
            );
        }

        try {
            const decision = await params.pendingToolRuntime.awaitToolApproval({
                runId: params.runId,
                toolCallId: prepared.toolCall.callId,
                toolName: prepared.tool.name,
                timeoutMs:
                    prepared.resolvedApproval.timeoutMs ?? params.advanced?.toolApprovalTimeoutMs,
                signal: params.signal,
            });

            await params.emit({
                type: Events.TOOL_APPROVAL_UPDATED,
                runId: params.runId,
                agentName: params.agentName,
                parentMessageId: params.parentMessageId,
                toolCallId: prepared.toolCall.callId,
                toolCallName: prepared.toolCall.name,
                toolTarget: prepared.toolTarget,
                state: decision.decision,
                toolInput: prepared.validatedInput,
                timestamp: Date.now(),
                meta: prepared.resolvedApproval.meta,
                note: decision.note,
                actorId: decision.actorId,
            });

            if (decision.decision === "denied") {
                return decision.note !== undefined
                    ? { approved: false, note: decision.note }
                    : { approved: false };
            }

            return { approved: true };
        } catch (error) {
            if (error instanceof BetterAgentError && error.code === "TIMEOUT") {
                await params.emit({
                    type: Events.TOOL_APPROVAL_UPDATED,
                    runId: params.runId,
                    agentName: params.agentName,
                    parentMessageId: params.parentMessageId,
                    toolCallId: prepared.toolCall.callId,
                    toolCallName: prepared.toolCall.name,
                    toolTarget: prepared.toolTarget,
                    state: "expired",
                    toolInput: prepared.validatedInput,
                    timestamp: Date.now(),
                    meta: prepared.resolvedApproval.meta,
                });
            }

            throw error;
        }
    };

    for (const toolCall of params.toolCalls) {
        throwIfAborted();

        const { tool, toolTarget } = resolveExecutableTool(toolCall);
        const resolvedToolErrorMode = tool.toolErrorMode ?? params.toolErrorMode ?? "tool_error";

        const defaultToolErrorOutcome = (args: {
            error: unknown;
            errorKind: RecoverableToolErrorKind;
            retryable?: boolean;
        }): ToolExecutionOutcome => {
            if (isAbortError(args.error)) {
                throw args.error;
            }

            if (resolvedToolErrorMode === "throw") {
                throw args.error;
            }

            return createToolErrorOutcomeFromError({
                toolName: toolCall.name,
                error: args.error,
                errorKind: args.errorKind,
                retryable: args.retryable,
            });
        };

        const runToolHandler = async (input: unknown) => {
            if (tool.kind === "server") {
                return await tool.handler(input, {
                    runId: params.runId,
                    agentName: params.agentName,
                    ...(params.conversationId !== undefined
                        ? { conversationId: params.conversationId }
                        : {}),
                    parentMessageId: params.parentMessageId,
                    signal: params.signal,
                    ...(params.context !== undefined ? { context: params.context } : {}),
                    emit: params.emit,
                });
            }

            if (!params.pendingToolRuntime) {
                throw BetterAgentError.fromCode(
                    "NOT_IMPLEMENTED",
                    `Client tool '${tool.name}' requires a live runtime capable of accepting tool results.`,
                    {
                        context: {
                            runId: params.runId,
                            agentName: params.agentName,
                            toolName: tool.name,
                            toolCallId: toolCall.callId,
                        },
                        trace: [{ at: "core.run.executeToolCalls.awaitClientToolResult" }],
                    },
                );
            }

            return await params.pendingToolRuntime.awaitClientToolResult({
                runId: params.runId,
                toolCallId: toolCall.callId,
                toolName: toolCall.name,
                timeoutMs: params.advanced?.clientToolResultTimeoutMs,
                signal: params.signal,
            });
        };

        const resolveHookAction = async <T extends ToolErrorContext>(
            context: T,
        ): Promise<ToolErrorResultFor<T> | undefined> => {
            const toolAction = await tool.onToolError?.(context);
            if (toolAction !== undefined) {
                if (toolAction.action !== "skip") {
                    return toolAction;
                }
            } else {
                return undefined;
            }

            const agentAction = await params.onToolError?.(context);
            if (agentAction !== undefined && agentAction.action !== "skip") {
                return agentAction;
            }

            return undefined;
        };

        const resolveToolError = async (args: {
            error: unknown;
            errorKind: RecoverableToolErrorKind;
            input?: unknown;
            recoveryDepth: number;
        }): Promise<ToolExecutionOutcome> => {
            if (isAbortError(args.error)) {
                throw args.error;
            }

            if (args.recoveryDepth >= MAX_TOOL_ERROR_REPAIR_DEPTH) {
                return defaultToolErrorOutcome({
                    error: args.error,
                    errorKind: args.errorKind,
                });
            }

            const context =
                args.errorKind === "parse"
                    ? ({
                          toolName: toolCall.name,
                          toolCallId: toolCall.callId,
                          error: args.error,
                          rawArguments: toolCall.arguments,
                          errorKind: "parse",
                      } satisfies ParseToolError)
                    : args.errorKind === "validation"
                      ? ({
                            toolName: toolCall.name,
                            toolCallId: toolCall.callId,
                            error: args.error,
                            rawArguments: toolCall.arguments,
                            input: args.input,
                            errorKind: "validation",
                        } satisfies ValidationToolError)
                      : ({
                            toolName: toolCall.name,
                            toolCallId: toolCall.callId,
                            error: args.error,
                            rawArguments: toolCall.arguments,
                            input: args.input,
                            errorKind: "execution",
                        } satisfies ExecutionToolError);

            const action = await resolveHookAction(context);
            if (action === undefined) {
                return defaultToolErrorOutcome({
                    error: args.error,
                    errorKind: args.errorKind,
                });
            }

            switch (action.action) {
                case "send_to_model":
                    return createToolErrorOutcomeFromError({
                        toolName: toolCall.name,
                        error: args.error,
                        errorKind: args.errorKind,
                        message:
                            action.message ?? extractToolErrorMessage(args.error, args.errorKind),
                        retryable: action.retryable,
                    });

                case "throw":
                    throw args.error;

                case "skip":
                    return defaultToolErrorOutcome({
                        error: args.error,
                        errorKind: args.errorKind,
                    });

                case "repair":
                    return await validateAndExecuteInput(action.input, args.recoveryDepth + 1);

                case "retry": {
                    if (args.errorKind !== "execution" || args.input === undefined) {
                        logger.warn(
                            `[better-agent] Ignoring invalid onToolError action '${action.action}' for tool '${toolCall.name}' (${args.errorKind} error).`,
                        );
                        return createToolErrorOutcomeFromError({
                            toolName: toolCall.name,
                            error: args.error,
                            errorKind: args.errorKind,
                        });
                    }

                    const attempts = Math.max(
                        1,
                        Math.min(action.maxAttempts ?? 1, MAX_TOOL_ERROR_RETRY_ATTEMPTS),
                    );

                    let lastError = args.error;
                    for (let attempt = 0; attempt < attempts; attempt += 1) {
                        throwIfAborted();
                        try {
                            return { result: await runToolHandler(args.input) };
                        } catch (retryError) {
                            if (isAbortError(retryError)) {
                                throw retryError;
                            }

                            lastError = retryError;
                            if (attempt < attempts - 1) {
                                await waitForRetryBackoff((attempt + 1) * 500);
                            }
                        }
                    }

                    return await resolveToolError({
                        error: lastError,
                        errorKind: "execution",
                        input: args.input,
                        recoveryDepth: args.recoveryDepth + 1,
                    });
                }

                case "result":
                    if (args.errorKind !== "execution") {
                        logger.warn(
                            `[better-agent] Ignoring invalid onToolError action '${action.action}' for tool '${toolCall.name}' (${args.errorKind} error).`,
                        );
                        return createToolErrorOutcomeFromError({
                            toolName: toolCall.name,
                            error: args.error,
                            errorKind: args.errorKind,
                        });
                    }

                    return { result: action.value };

                default:
                    return defaultToolErrorOutcome({
                        error: args.error,
                        errorKind: args.errorKind,
                    });
            }
        };

        const executeApprovedInput = async (
            prepared: PreparedToolCall,
            input: unknown,
            recoveryDepth: number,
        ): Promise<ToolExecutionOutcome> => {
            const approval = await awaitApprovalIfNeeded(prepared);
            if (!approval.approved) {
                const denialReason = approval.note ? ` Reason: ${approval.note}` : "";
                return {
                    result: `Tool '${toolCall.name}' was denied by the operator.${denialReason}`,
                };
            }

            try {
                return { result: await runToolHandler(input) };
            } catch (error) {
                if (isAbortError(error)) {
                    throw error;
                }

                return await resolveToolError({
                    error,
                    errorKind: "execution",
                    input,
                    recoveryDepth,
                });
            }
        };

        const validateAndExecuteInput = async (
            input: unknown,
            recoveryDepth: number,
        ): Promise<ToolExecutionOutcome> => {
            const validatedInput = await validateInput(tool.schema, input);
            if (validatedInput.isErr()) {
                return await resolveToolError({
                    error: validatedInput.error.at({
                        at: "core.run.executeToolCalls.validateToolInput",
                    }),
                    errorKind: "validation",
                    input,
                    recoveryDepth,
                });
            }

            const prepared: PreparedToolCall = {
                toolCall,
                tool,
                toolTarget,
                args: input,
                validatedInput: validatedInput.value,
                resolvedApproval: await resolveApprovalConfig({
                    approval: tool.approval,
                    input: validatedInput.value,
                    toolCall,
                    tool,
                    toolTarget,
                }),
                skip: false,
                shouldEmitToolCallEnd: false,
            };

            return await executeApprovedInput(prepared, validatedInput.value, recoveryDepth);
        };

        const prepareToolCall = async (): Promise<PreparedToolCall> => {
            const parsed = safeJsonParse(toolCall.arguments);
            if (parsed.isErr()) {
                return {
                    toolCall,
                    tool,
                    toolTarget,
                    skip: false,
                    shouldEmitToolCallEnd: false,
                    parseError: BetterAgentError.wrap({
                        err: parsed.error,
                        message: `Failed to parse arguments for tool '${toolCall.name}'`,
                        opts: {
                            code: "VALIDATION_FAILED",
                            context: {
                                toolName: toolCall.name,
                                toolCallId: toolCall.callId,
                            },
                            trace: [{ at: "core.run.executeToolCalls.parseToolArguments" }],
                        },
                    }),
                };
            }

            const beforeHook =
                params.pluginRuntime?.hasToolHooks === true
                    ? await params.pluginRuntime.applyBeforeToolCall({
                          runId: params.runId,
                          agentName: params.agentName,
                          toolName: toolCall.name,
                          toolCallId: toolCall.callId,
                          args: parsed.value,
                          conversationId: params.conversationId,
                      })
                    : { args: parsed.value };

            if (beforeHook?.decision?.skip === true) {
                return {
                    toolCall,
                    tool,
                    toolTarget,
                    args: beforeHook.args,
                    skip: true,
                    skipResult: beforeHook.decision.result,
                    shouldEmitToolCallEnd: true,
                };
            }

            const validatedInput = await validateInput(tool.schema, beforeHook.args);
            if (validatedInput.isErr()) {
                return {
                    toolCall,
                    tool,
                    toolTarget,
                    args: beforeHook.args,
                    skip: false,
                    shouldEmitToolCallEnd: false,
                    validationError: validatedInput.error.at({
                        at: "core.run.executeToolCalls.validateToolInput",
                    }),
                };
            }

            const prepared: PreparedToolCall = {
                toolCall,
                tool,
                toolTarget,
                args: beforeHook.args,
                validatedInput: validatedInput.value,
                resolvedApproval: await resolveApprovalConfig({
                    approval: tool.approval,
                    input: validatedInput.value,
                    toolCall,
                    tool,
                    toolTarget,
                }),
                skip: false,
                shouldEmitToolCallEnd: true,
            };

            if (prepared.resolvedApproval?.required) {
                await emitApprovalRequested(prepared);
            }

            return prepared;
        };

        const executePreparedTool = async (
            prepared: PreparedToolCall,
        ): Promise<ToolExecutionOutcome> => {
            if (prepared.parseError) {
                return await resolveToolError({
                    error: prepared.parseError,
                    errorKind: "parse",
                    recoveryDepth: 0,
                });
            }

            if (prepared.skip) {
                return { result: prepared.skipResult };
            }

            if (prepared.validationError) {
                return await resolveToolError({
                    error: prepared.validationError,
                    errorKind: "validation",
                    input: prepared.args,
                    recoveryDepth: 0,
                });
            }

            return await executeApprovedInput(prepared, prepared.validatedInput, 0);
        };

        const applyAfterToolCall = async (
            prepared: PreparedToolCall,
            outcome: ToolExecutionOutcome,
        ): Promise<ToolExecutionOutcome> => {
            if (params.pluginRuntime?.hasToolHooks !== true) {
                return outcome;
            }

            const afterHook = await params.pluginRuntime.applyAfterToolCall({
                runId: params.runId,
                agentName: params.agentName,
                toolName: toolCall.name,
                toolCallId: toolCall.callId,
                args: prepared.args,
                result: outcome.result,
                conversationId: params.conversationId,
                error:
                    outcome.isError === true &&
                    typeof outcome.result === "object" &&
                    outcome.result !== null &&
                    "message" in outcome.result &&
                    typeof outcome.result.message === "string"
                        ? outcome.result.message
                        : undefined,
            });

            return {
                ...outcome,
                result: afterHook.result,
            };
        };

        await emitToolCallStart({ toolCall, toolTarget });
        await emitToolCallArgs({ toolCall, toolTarget });

        const prepared = await prepareToolCall();
        if (prepared.shouldEmitToolCallEnd) {
            await emitToolCallEnd(prepared);
        }

        const outcome = await executePreparedTool(prepared);
        const finalOutcome = await applyAfterToolCall(prepared, outcome);

        await emitToolCallResult(prepared, finalOutcome);

        results.push({
            type: "tool-call",
            callId: toolCall.callId,
            name: toolCall.name,
            arguments: toolCall.arguments,
            result: finalOutcome.result,
            isError: finalOutcome.isError,
        });
    }

    return { results };
};
