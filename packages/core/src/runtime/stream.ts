import { type AgentEvent, EventType } from "../ag-ui/events";
import type { AgentMessage, AgentSource, AgentToolMessage } from "../ag-ui/messages";
import { prepareMessagesForCapabilities, supportsToolCalls } from "../capabilities";
import type { AgentModelLike } from "../models";
import type { AgentOutput, InferAgentOutput } from "../schema";
import { toModelToolDefinitions } from "../tools/resolve-tools";
import { createAsyncIterableQueue } from "./async-iterable";
import { createRuntimeError } from "./errors";
import {
    createMessagesSnapshotEvent,
    createRunErrorEvent,
    createRunFinishedEvent,
    createRunStartedEvent,
    createStateSnapshotEvent,
    createStepFinishedEvent,
    createStepStartedEvent,
} from "./events";
import {
    finishRuntimeStep,
    notifyRuntimeStateChange,
    prepareRuntimeStep,
    shouldStopAfterStep,
} from "./hooks";
import {
    validateModelSupportsStructuredOutput,
    validateModelSupportsTextOutput,
} from "./model-validation";
import type { FinishReason } from "./results";
import { createRuntimeStateControl } from "./state";
import { finalizeStructuredOutput } from "./structured-output";
import {
    collectAssistantToolCalls,
    collectToolCallEvent,
    createToolCallBuffer,
    executeBufferedToolCalls,
    getCompletedToolCallIds,
    getPendingAssistantToolMessage,
    prepareModelMessagesForTools,
} from "./tool-execution";
import type { RunInput, RunResult, RuntimeExecutionOptions, StreamResult } from "./types";
import { defaultGenerateId, ensureAbortSignal } from "./utils";

function getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
        return error.message;
    }

    return "Unknown runtime error";
}

function getErrorCode(error: unknown): string | undefined {
    if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        typeof error.code === "string"
    ) {
        return error.code;
    }

    return undefined;
}

function shouldEmitMessagesSnapshot(message: AgentMessage | undefined): boolean {
    return (
        message?.role === "assistant" &&
        Array.isArray(message.content) &&
        message.content.some((part) => part.type !== "text")
    );
}

function hasProviderTools(tools: Record<string, unknown> | undefined): boolean {
    return tools !== undefined && Object.keys(tools).length > 0;
}

export async function stream<
    TState,
    TOutput extends AgentOutput | undefined = AgentOutput | undefined,
>(
    model: AgentModelLike,
    runId: string,
    input: RunInput<TState, TOutput>,
    options: RuntimeExecutionOptions = {},
): Promise<StreamResult<TState, InferAgentOutput<TOutput>>> {
    const generateId = options.idGenerator ?? defaultGenerateId;
    const signal = ensureAbortSignal(options.signal);
    const maxSteps = input.maxSteps;

    if (signal.aborted) {
        throw createRuntimeError("ABORTED", "Run aborted before streaming started.");
    }
    await options.checkAbort?.("Run aborted before streaming started.");
    validateModelSupportsTextOutput(model);
    validateModelSupportsStructuredOutput(model, input.output);

    const started = createRunStartedEvent({
        runId,
        threadId: input.threadId,
        resume: input.resume,
        messages: input.messages,
        tools: options.modelToolDefinitions,
        state: input.state,
    });

    const eventStream = createAsyncIterableQueue<AgentEvent>();

    const final = (async (): Promise<RunResult<TState, InferAgentOutput<TOutput>>> => {
        eventStream.push(started);

        const baseMessageCount = input.messages.length;
        let historyMessages: AgentMessage[] = [...input.messages];
        let modelMessages: AgentMessage[] = await prepareModelMessagesForTools({
            messages: input.messages,
            tools: options.executableTools,
        });
        let stepIndex = 0;
        let lastUsage: RunResult<TState>["usage"];
        let lastFinishReason: FinishReason | undefined;
        let lastStructured: unknown;
        const state = createRuntimeStateControl(input.state);

        try {
            while (true) {
                if (signal.aborted) {
                    throw createRuntimeError("ABORTED", "Run aborted between steps.");
                }
                await options.checkAbort?.("Run aborted between steps.");

                stepIndex += 1;

                const hookEvents: AgentEvent[] = [];
                const prepared = await prepareRuntimeStep({
                    hooks: options.hooks,
                    runId,
                    threadId: input.threadId,
                    stepIndex,
                    maxSteps,
                    context: options.context,
                    signal,
                    messages: historyMessages,
                    modelMessages,
                    tools: options.executableTools ?? [],
                    state,
                    emitEvent: (event) => {
                        hookEvents.push(event);
                    },
                });
                historyMessages = prepared.messages;
                modelMessages = prepared.modelMessages;

                const pendingAssistantMessage = getPendingAssistantToolMessage(modelMessages);

                if (pendingAssistantMessage) {
                    const stepName = `tools:${stepIndex}`;

                    eventStream.push(
                        createStepStartedEvent({
                            stepName,
                        }),
                    );
                    for (const event of hookEvents) {
                        eventStream.push(event);
                    }

                    const buffer = createToolCallBuffer();
                    const toolCallCount = collectAssistantToolCalls(
                        buffer,
                        pendingAssistantMessage,
                    );

                    const executed = await executeBufferedToolCalls({
                        buffer,
                        runId,
                        tools: prepared.tools,
                        context: options.context,
                        signal,
                        checkAbort: options.checkAbort,
                        state,
                        resume: options.resume,
                        completedToolCallIds: getCompletedToolCallIds(modelMessages),
                        hooks: options.hooks,
                        agentName: options.agentName,
                        threadId: input.threadId,
                        pluginRuntime: options.pluginRuntime,
                        generateId,
                    });

                    if (signal.aborted) {
                        throw createRuntimeError("ABORTED", "Run aborted after tool execution.");
                    }
                    await options.checkAbort?.("Run aborted after tool execution.");

                    for (const event of executed.events) {
                        eventStream.push(event);
                    }

                    historyMessages.push(...executed.messages);
                    modelMessages.push(...executed.modelMessages);

                    if (executed.interrupts?.length) {
                        await finishRuntimeStep({
                            hooks: options.hooks,
                            runId,
                            threadId: input.threadId,
                            stepIndex,
                            maxSteps,
                            context: options.context,
                            signal,
                            messages: historyMessages,
                            state,
                            emitEvent: (event) => {
                                eventStream.push(event);
                            },
                            result: {
                                outcome: "interrupt",
                                interrupts: executed.interrupts,
                                usage: lastUsage,
                                finishReason: lastFinishReason,
                                toolCallCount,
                            },
                        });

                        const interruptState = state.get();
                        if (interruptState !== undefined) {
                            eventStream.push(
                                createStateSnapshotEvent({
                                    state: interruptState,
                                }),
                            );
                        }
                        eventStream.push(
                            createMessagesSnapshotEvent({
                                messages: historyMessages,
                            }),
                        );

                        eventStream.push(
                            createStepFinishedEvent({
                                stepName,
                            }),
                        );

                        eventStream.push(
                            createRunFinishedEvent({
                                runId,
                                threadId: input.threadId,
                                outcome: "interrupt",
                                interrupts: executed.interrupts,
                            }),
                        );

                        return {
                            runId,
                            threadId: input.threadId,
                            messages: historyMessages.slice(baseMessageCount),
                            state: state.get(),
                            outcome: "interrupt",
                            interrupts: executed.interrupts,
                            usage: lastUsage,
                            finishReason: lastFinishReason,
                            stepCount: stepIndex,
                        };
                    }

                    const shouldStop = await shouldStopAfterStep({
                        hooks: options.hooks,
                        runId,
                        threadId: input.threadId,
                        stepIndex,
                        maxSteps,
                        context: options.context,
                        messages: historyMessages,
                        state,
                        usage: lastUsage,
                        finishReason: lastFinishReason,
                        toolCallCount,
                    });

                    await finishRuntimeStep({
                        hooks: options.hooks,
                        runId,
                        threadId: input.threadId,
                        stepIndex,
                        maxSteps,
                        context: options.context,
                        signal,
                        messages: historyMessages,
                        state,
                        emitEvent: (event) => {
                            eventStream.push(event);
                        },
                        result: {
                            outcome: shouldStop ? "success" : "continue",
                            usage: lastUsage,
                            finishReason: lastFinishReason,
                            toolCallCount,
                        },
                    });

                    eventStream.push(
                        createStepFinishedEvent({
                            stepName,
                        }),
                    );

                    if (shouldStop) {
                        eventStream.push(
                            createRunFinishedEvent({
                                runId,
                                threadId: input.threadId,
                                outcome: "success",
                                result: {
                                    finishReason: lastFinishReason,
                                    usage: lastUsage,
                                    stepCount: stepIndex,
                                },
                            }),
                        );

                        return {
                            runId,
                            threadId: input.threadId,
                            messages: historyMessages.slice(baseMessageCount),
                            state: state.get(),
                            outcome: "success",
                            usage: lastUsage,
                            finishReason: lastFinishReason,
                            stepCount: stepIndex,
                        };
                    }

                    continue;
                }

                const stepName = `model:${stepIndex}`;

                eventStream.push(
                    createStepStartedEvent({
                        stepName,
                    }),
                );
                for (const event of hookEvents) {
                    eventStream.push(event);
                }

                let modelInputMessages = modelMessages;
                let executableModelTools = prepared.tools;
                let toolChoice = input.toolChoice;
                let providerTools = options.providerTools;
                let providerOptions = input.providerOptions;

                if (options.pluginRuntime?.hasModelHooks) {
                    const hookContext = {
                        runId,
                        agentName: options.agentName ?? "",
                        threadId: input.threadId,
                        context: options.context,
                        stepIndex,
                        messages: modelInputMessages,
                        tools: executableModelTools,
                        toolChoice,
                        providerTools,
                        providerOptions,
                        setMessages(messages: typeof modelMessages) {
                            modelInputMessages = [...messages];
                            hookContext.messages = modelInputMessages;
                        },
                        setTools(tools: typeof executableModelTools) {
                            executableModelTools = [...tools];
                            hookContext.tools = executableModelTools;
                        },
                        setToolChoice(nextToolChoice: typeof toolChoice) {
                            toolChoice = nextToolChoice;
                            hookContext.toolChoice = toolChoice;
                        },
                        setProviderTools(nextProviderTools: typeof providerTools) {
                            providerTools = nextProviderTools;
                            hookContext.providerTools = providerTools;
                        },
                        setProviderOptions(nextProviderOptions: typeof providerOptions) {
                            providerOptions = nextProviderOptions;
                            hookContext.providerOptions = providerOptions;
                        },
                    };

                    await options.pluginRuntime.applyBeforeModelCall(hookContext);
                }

                const safeModelMessages = prepareMessagesForCapabilities({
                    messages: modelInputMessages,
                    capabilities: model.capabilities,
                });
                const modelTools =
                    options.executableTools !== undefined
                        ? toModelToolDefinitions(executableModelTools)
                        : options.modelToolDefinitions;

                if (
                    ((modelTools && modelTools.length > 0) || hasProviderTools(providerTools)) &&
                    !supportsToolCalls(model.capabilities)
                ) {
                    throw createRuntimeError(
                        "VALIDATION_FAILED",
                        "Model does not support tool calls.",
                    );
                }

                const streamResult = await model.stream(
                    {
                        messages: safeModelMessages,
                        tools: modelTools,
                        toolChoice,
                        output: input.output,
                        providerTools,
                        providerOptions: providerOptions as never,
                    },
                    {
                        runId,
                        threadId: input.threadId,
                        signal,
                        generateId: (kind, context) =>
                            generateId(kind, {
                                agentName: options.agentName,
                                runId,
                                threadId: input.threadId,
                                ...context,
                            }),
                    },
                );

                const buffer = createToolCallBuffer();
                const providerToolMessages = new Map<string, AgentToolMessage>();
                const stepSources: AgentSource[] = [];
                for await (const event of streamResult.events) {
                    collectToolCallEvent(buffer, event);
                    if (event.type === EventType.TOOL_CALL_RESULT && event.providerExecuted) {
                        providerToolMessages.set(event.toolCallId, {
                            id: event.messageId,
                            role: "tool",
                            toolCallId: event.toolCallId,
                            content: event.content,
                            status: event.status,
                        });
                    }
                    if (event.type === EventType.CUSTOM && event.name === "source" && event.value) {
                        stepSources.push((event.value as { source: AgentSource }).source);
                    }
                    state.apply(event);
                    eventStream.push(event);
                    await notifyRuntimeStateChange({
                        hooks: options.hooks,
                        state,
                        event,
                    });
                }

                const result = await streamResult.final;
                if (options.pluginRuntime?.hasModelHooks) {
                    await options.pluginRuntime.applyAfterModelCall({
                        runId,
                        agentName: options.agentName ?? "",
                        threadId: input.threadId,
                        context: options.context,
                        stepIndex,
                        response: result,
                    });
                }

                if (signal.aborted) {
                    throw createRuntimeError("ABORTED", "Run aborted after model generation.");
                }
                await options.checkAbort?.("Run aborted after model generation.");
                lastUsage = result.usage;
                lastFinishReason = result.finishReason;
                lastStructured = result.structured;
                const resultMessages = result.messages ?? [];
                historyMessages.push(...resultMessages);
                modelMessages.push(...resultMessages);

                if (providerToolMessages.size > 0) {
                    const messages = Array.from(providerToolMessages.values());
                    historyMessages.push(...messages);
                    modelMessages.push(...messages);
                }

                if (
                    resultMessages.some(shouldEmitMessagesSnapshot) ||
                    providerToolMessages.size > 0 ||
                    stepSources.length > 0
                ) {
                    eventStream.push(
                        createMessagesSnapshotEvent({
                            messages: historyMessages,
                        }),
                    );
                }

                const executed = await executeBufferedToolCalls({
                    buffer,
                    runId,
                    tools: prepared.tools,
                    context: options.context,
                    signal,
                    checkAbort: options.checkAbort,
                    state,
                    resume: options.resume,
                    completedToolCallIds: getCompletedToolCallIds(modelMessages),
                    hooks: options.hooks,
                    agentName: options.agentName,
                    threadId: input.threadId,
                    pluginRuntime: options.pluginRuntime,
                    generateId,
                });

                if (signal.aborted) {
                    throw createRuntimeError("ABORTED", "Run aborted after tool execution.");
                }
                await options.checkAbort?.("Run aborted after tool execution.");

                let toolCallCount = 0;
                for (const [, entry] of buffer) {
                    if (entry.toolCallName) {
                        toolCallCount += 1;
                    }
                }

                for (const event of executed.events) {
                    eventStream.push(event);
                }

                historyMessages.push(...executed.messages);
                modelMessages.push(...executed.modelMessages);

                if (executed.interrupts?.length) {
                    await finishRuntimeStep({
                        hooks: options.hooks,
                        runId,
                        threadId: input.threadId,
                        stepIndex,
                        maxSteps,
                        context: options.context,
                        signal,
                        messages: historyMessages,
                        state,
                        emitEvent: (event) => {
                            eventStream.push(event);
                        },
                        result: {
                            outcome: "interrupt",
                            interrupts: executed.interrupts,
                            usage: lastUsage,
                            finishReason: lastFinishReason,
                            toolCallCount,
                        },
                    });

                    const interruptState = state.get();
                    if (interruptState !== undefined) {
                        eventStream.push(
                            createStateSnapshotEvent({
                                state: interruptState,
                            }),
                        );
                    }
                    eventStream.push(
                        createMessagesSnapshotEvent({
                            messages: historyMessages,
                        }),
                    );

                    eventStream.push(
                        createStepFinishedEvent({
                            stepName,
                        }),
                    );

                    eventStream.push(
                        createRunFinishedEvent({
                            runId,
                            threadId: input.threadId,
                            outcome: "interrupt",
                            interrupts: executed.interrupts,
                        }),
                    );

                    return {
                        runId,
                        threadId: input.threadId,
                        messages: historyMessages.slice(baseMessageCount),
                        state: state.get(),
                        outcome: "interrupt",
                        interrupts: executed.interrupts,
                        usage: lastUsage,
                        finishReason: lastFinishReason,
                        stepCount: stepIndex,
                    };
                }

                const shouldStop = await shouldStopAfterStep({
                    hooks: options.hooks,
                    runId,
                    threadId: input.threadId,
                    stepIndex,
                    maxSteps,
                    context: options.context,
                    messages: historyMessages,
                    state,
                    usage: lastUsage,
                    finishReason: lastFinishReason,
                    toolCallCount,
                });

                await finishRuntimeStep({
                    hooks: options.hooks,
                    runId,
                    threadId: input.threadId,
                    stepIndex,
                    maxSteps,
                    context: options.context,
                    signal,
                    messages: historyMessages,
                    state,
                    emitEvent: (event) => {
                        eventStream.push(event);
                    },
                    result: {
                        outcome: shouldStop ? "success" : "continue",
                        usage: lastUsage,
                        finishReason: lastFinishReason,
                        toolCallCount,
                    },
                });

                eventStream.push(
                    createStepFinishedEvent({
                        stepName,
                    }),
                );

                if (shouldStop) {
                    eventStream.push(
                        createRunFinishedEvent({
                            runId,
                            threadId: input.threadId,
                            outcome: "success",
                            result: {
                                finishReason: lastFinishReason,
                                usage: lastUsage,
                                stepCount: stepIndex,
                            },
                        }),
                    );

                    return {
                        runId,
                        threadId: input.threadId,
                        messages: historyMessages.slice(baseMessageCount),
                        state: state.get(),
                        outcome: "success",
                        usage: lastUsage,
                        finishReason: lastFinishReason,
                        stepCount: stepIndex,
                        structured: finalizeStructuredOutput({
                            output: input.output,
                            structured: lastStructured,
                        }) as InferAgentOutput<TOutput>,
                    };
                }
            }
        } catch (error) {
            eventStream.push(
                createRunErrorEvent({
                    message: getErrorMessage(error),
                    code: getErrorCode(error),
                }),
            );
            throw error;
        } finally {
            eventStream.close();
        }
    })();

    return {
        runId,
        threadId: input.threadId,
        events: eventStream.iterate(),
        final,
    };
}
