import { prepareMessagesForCapabilities, supportsToolCalls } from "../capabilities";
import type { AgentModelLike } from "../models";
import type { AgentOutput, InferAgentOutput } from "../schema";
import { toModelToolDefinitions } from "../tools/resolve-tools";
import { createRuntimeError } from "./errors";
import { finishRuntimeStep, prepareRuntimeStep, shouldStopAfterStep } from "./hooks";
import {
    validateModelSupportsStructuredOutput,
    validateModelSupportsTextOutput,
} from "./model-validation";
import type { FinishReason } from "./results";
import { createRuntimeStateControl } from "./state";
import { finalizeStructuredOutput } from "./structured-output";
import {
    collectAssistantToolCalls,
    createToolCallBuffer,
    executeBufferedToolCalls,
    getCompletedToolCallIds,
    getPendingAssistantToolMessage,
    prepareModelMessagesForTools,
} from "./tool-execution";
import type { RunInput, RunResult, RuntimeExecutionOptions } from "./types";
import { defaultGenerateId, ensureAbortSignal } from "./utils";

function hasProviderTools(tools: Record<string, unknown> | undefined): boolean {
    return tools !== undefined && Object.keys(tools).length > 0;
}

export async function run<
    TState,
    TOutput extends AgentOutput | undefined = AgentOutput | undefined,
>(
    model: AgentModelLike,
    runId: string,
    input: RunInput<TState, TOutput>,
    options: RuntimeExecutionOptions = {},
): Promise<RunResult<TState, InferAgentOutput<TOutput>>> {
    const generateId = options.idGenerator ?? defaultGenerateId;
    const signal = ensureAbortSignal(options.signal);
    const maxSteps = input.maxSteps;

    if (signal.aborted) {
        throw createRuntimeError("ABORTED", "Run aborted before execution started.");
    }
    await options.checkAbort?.("Run aborted before execution started.");
    validateModelSupportsTextOutput(model);
    validateModelSupportsStructuredOutput(model, input.output);

    const baseMessageCount = input.messages.length;
    let historyMessages = [...input.messages];
    let modelMessages = await prepareModelMessagesForTools({
        messages: input.messages,
        tools: options.executableTools,
    });
    let lastUsage: RunResult<TState>["usage"];
    let lastFinishReason: FinishReason | undefined;
    let lastStructured: unknown;
    let stepIndex = 0;
    const state = createRuntimeStateControl(input.state);
    while (true) {
        if (signal.aborted) {
            throw createRuntimeError("ABORTED", "Run aborted between steps.");
        }
        await options.checkAbort?.("Run aborted between steps.");

        stepIndex += 1;

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
        });
        historyMessages = prepared.messages;
        modelMessages = prepared.modelMessages;

        const pendingAssistantMessage = getPendingAssistantToolMessage(modelMessages);

        if (pendingAssistantMessage) {
            const buffer = createToolCallBuffer();
            const toolCallCount = collectAssistantToolCalls(buffer, pendingAssistantMessage);

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
                    result: {
                        outcome: "interrupt",
                        interrupts: executed.interrupts,
                        usage: lastUsage,
                        finishReason: lastFinishReason,
                        toolCallCount,
                    },
                });

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
                    structured: finalizeStructuredOutput({
                        output: input.output,
                        structured: lastStructured,
                    }) as InferAgentOutput<TOutput>,
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
                result: {
                    outcome: shouldStop ? "success" : "continue",
                    usage: lastUsage,
                    finishReason: lastFinishReason,
                    toolCallCount,
                },
            });

            if (shouldStop) {
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
            throw createRuntimeError("VALIDATION_FAILED", "Model does not support tool calls.");
        }

        const result = await model.generate(
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

        let toolCallCount = 0;
        const stepAssistantMessage = getPendingAssistantToolMessage(resultMessages);

        if (stepAssistantMessage) {
            const buffer = createToolCallBuffer();
            toolCallCount = collectAssistantToolCalls(buffer, stepAssistantMessage);

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
                    result: {
                        outcome: "interrupt",
                        interrupts: executed.interrupts,
                        usage: lastUsage,
                        finishReason: lastFinishReason,
                        toolCallCount,
                    },
                });

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
            result: {
                outcome: shouldStop ? "success" : "continue",
                usage: lastUsage,
                finishReason: lastFinishReason,
                toolCallCount,
            },
        });

        if (shouldStop) {
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
}
