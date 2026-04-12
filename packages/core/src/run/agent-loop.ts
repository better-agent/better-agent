import { BetterAgentError } from "@better-agent/shared/errors";
import { Events } from "../events";
import type { GenerativeModelInputMessage, GenerativeModelInputMessageContent } from "../providers";
import type { ConversationItem } from "../providers";
import { resolveToolsForRun } from "../tools";
import { executeToolCalls } from "./execute-tool-calls";
import { prepareConversationReplayInput } from "./helpers";
import { applyAfterModelCall, applyBeforeModelCall, applyOnStep, applyOnStepFinish } from "./hooks";
import { projectConversationItemsToInput } from "./messages";
import {
    type LoopStopDecision,
    evaluateStopConditions,
    extractToolCallRequests,
} from "./stop-conditions";
import type {
    LoopState,
    ModelCallStrategy,
    PreviousStepResult,
    RunResult,
    SharedRunLoopOptions,
} from "./types";

export const runAgentLoop = async <TContext>(
    options: SharedRunLoopOptions<TContext>,
    strategy: ModelCallStrategy<TContext>,
): Promise<RunResult & { items: ConversationItem[] }> => {
    const traceBase = strategy.mode === "stream" ? "core.run.runStreamLoop" : "core.run.runLoop";

    // Resolve plugin tools.
    const pluginToolsResult =
        options.pluginRuntime?.hasTools === true
            ? await options.pluginRuntime.resolveTools(options.context)
            : {
                  tools: [],
                  runCleanup: async () => {},
              };

    // Resolve agent tools.
    const { tools, runCleanup } = await resolveToolsForRun({
        appTools: options.appTools,
        agentTools: options.agent.tools,
        context: options.context,
    });

    const resolvedTools = [...tools, ...pluginToolsResult.tools];

    if (strategy.mode === "run") {
        const blockingTool = resolvedTools.find(
            (tool) =>
                tool.kind === "client" || (tool.kind !== "hosted" && tool.approval !== undefined),
        );

        if (blockingTool) {
            const reason =
                blockingTool.kind === "client"
                    ? `client tool '${blockingTool.name}'`
                    : `approval-gated tool '${blockingTool.name}'`;

            throw BetterAgentError.fromCode(
                "BAD_REQUEST",
                `Non-stream runs do not support interactive tools. Use stream() for ${reason}.`,
                {
                    context: {
                        agentName: options.agent.name,
                        toolName: blockingTool.name,
                        toolTarget: blockingTool.kind,
                    },
                    trace: [{ at: `${traceBase}.validateNonInteractiveRun` }],
                },
            );
        }
    }

    const state: LoopState<TContext> = {
        runId: options.runId,
        agentName: options.agent.name,
        items: [...options.items],
        replayStartIndex: options.replayStartIndex ?? 0,
        steps: [],
        stepIndex: 0,
        maxSteps: options.maxSteps,
        conversationId: options.conversationId,
        context: options.context,
    };

    const instructionField = options.agent.instruction;
    const instructionResolver = instructionField as ((context: TContext) => string) | undefined;
    const instruction =
        typeof instructionResolver === "function"
            ? instructionResolver(options.context as TContext)
            : (instructionField ?? "");

    const modelCaps = options.agent.model.caps;

    const assertInstructionSupported = (
        currentInstruction: GenerativeModelInputMessageContent<typeof modelCaps> | undefined,
        traceAt: string,
    ): void => {
        if (currentInstruction === undefined || currentInstruction === "") {
            return;
        }

        if (modelCaps.inputShape === "prompt" || modelCaps.supportsInstruction !== true) {
            throw BetterAgentError.fromCode(
                "VALIDATION_FAILED",
                `Agent '${options.agent.name}' model does not support instructions.`,
                {
                    context: {
                        agentName: options.agent.name,
                        modelId: options.agent.model.modelId,
                        inputShape: modelCaps.inputShape ?? "chat",
                        replayMode:
                            modelCaps.replayMode ??
                            (modelCaps.inputShape === "prompt"
                                ? "single_turn_persistent"
                                : "multi_turn"),
                    },
                    trace: [{ at: traceAt }],
                },
            );
        }
    };

    assertInstructionSupported(instruction, `${traceBase}.validateInstruction`);

    const stepErrorMessage =
        strategy.mode === "stream" ? "Run stream step failed" : "Run loop step failed";

    try {
        while (true) {
            const previousStep = state.steps.at(-1);
            const replayItems = state.items.slice(state.replayStartIndex);
            const projectedMessages =
                state.conversationId !== undefined && options.conversationReplayActive
                    ? await prepareConversationReplayInput({
                          items: replayItems,
                          caps: modelCaps,
                          agentName: state.agentName,
                          conversationId: state.conversationId,
                          conversationReplay: options.conversationReplay,
                      })
                    : projectConversationItemsToInput(replayItems, modelCaps);
            const prepared = await applyOnStep({
                runId: state.runId,
                agentName: state.agentName,
                stepIndex: state.stepIndex,
                maxSteps: state.maxSteps,
                messages: projectedMessages,
                modelCaps,
                conversationId: state.conversationId,
                context: options.context,
                previousStep,
                onStep: options.agent.onStep,
                pluginRuntime: options.pluginRuntime,
            });

            await options.emit({
                type: Events.STEP_START,
                runId: state.runId,
                agentName: state.agentName,
                stepIndex: state.stepIndex,
                maxSteps: state.maxSteps,
                timestamp: Date.now(),
                conversationId: state.conversationId,
            });

            try {
                const activeToolNames = prepared.activeTools;
                const activeTools =
                    activeToolNames === undefined
                        ? resolvedTools
                        : resolvedTools.filter((tool) =>
                              activeToolNames.includes(
                                  tool.kind === "hosted"
                                      ? typeof tool.name === "string" && tool.name.length > 0
                                          ? tool.name
                                          : tool.type
                                      : tool.name,
                              ),
                          );

                const effectiveInstruction = prepared.systemInstruction ?? instruction;
                assertInstructionSupported(
                    effectiveInstruction,
                    `${traceBase}.prepareModelInput.validateInstruction`,
                );
                const modelInput =
                    effectiveInstruction === undefined || effectiveInstruction === ""
                        ? [...prepared.messages]
                        : [
                              {
                                  type: "message",
                                  role: "system",
                                  content: effectiveInstruction,
                              } as GenerativeModelInputMessage<typeof modelCaps>,
                              ...prepared.messages,
                          ];

                const modelPrepared = await applyBeforeModelCall({
                    runId: state.runId,
                    agentName: state.agentName,
                    stepIndex: state.stepIndex,
                    modelCaps,
                    input: modelInput,
                    tools: activeTools,
                    conversationId: state.conversationId,
                    toolChoice: prepared.toolChoice ?? options.toolChoice,
                    pluginRuntime: options.pluginRuntime,
                });

                const { response, assistantMessageId } = await strategy.call({
                    options,
                    modelInput: modelPrepared.input,
                    tools: modelPrepared.tools,
                    toolChoice: modelPrepared.toolChoice,
                    stepIndex: state.stepIndex,
                    runId: state.runId,
                    agentName: state.agentName,
                    conversationId: state.conversationId,
                });

                await applyAfterModelCall({
                    runId: state.runId,
                    agentName: state.agentName,
                    stepIndex: state.stepIndex,
                    response,
                    conversationId: state.conversationId,
                    pluginRuntime: options.pluginRuntime,
                });

                const toolCalls = extractToolCallRequests(response);
                const toolBatch =
                    toolCalls.length > 0
                        ? await executeToolCalls({
                              runId: state.runId,
                              agentName: state.agentName,
                              conversationId: state.conversationId,
                              parentMessageId: assistantMessageId,
                              toolCalls,
                              tools: modelPrepared.tools,
                              toolErrorMode: options.agent.toolErrorMode,
                              onToolError: options.agent.onToolError,
                              signal: options.signal,
                              emit: options.emit,
                              advanced: options.advanced,
                              pendingToolRuntime: options.pendingToolRuntime,
                              context: options.context,
                              pluginRuntime: options.pluginRuntime,
                          })
                        : { results: [] };

                state.items = [...state.items, ...response.output];
                if (toolBatch.results.length > 0) {
                    state.items = [...state.items, ...toolBatch.results];
                }

                const stepResult: PreviousStepResult = { response };
                state.steps.push(stepResult);

                const stopMessages =
                    state.conversationId !== undefined && options.conversationReplayActive
                        ? await prepareConversationReplayInput({
                              items: state.items.slice(state.replayStartIndex),
                              caps: modelCaps,
                              agentName: state.agentName,
                              conversationId: state.conversationId,
                              conversationReplay: options.conversationReplay,
                          })
                        : projectConversationItemsToInput(
                              state.items.slice(state.replayStartIndex),
                              modelCaps,
                          );

                const stopDecision: LoopStopDecision = evaluateStopConditions({
                    maxSteps: state.maxSteps,
                    stepIndex: state.stepIndex,
                    steps: state.steps,
                    messages: stopMessages,
                    lastStep: stepResult,
                    stopWhen: options.agent.stopWhen,
                    context: options.context,
                });

                await options.emit({
                    type: Events.STEP_FINISH,
                    runId: state.runId,
                    agentName: state.agentName,
                    stepIndex: state.stepIndex,
                    maxSteps: state.maxSteps,
                    toolCallCount: toolCalls.length,
                    terminationReason: stopDecision.stop ? stopDecision.reason : undefined,
                    timestamp: Date.now(),
                    conversationId: state.conversationId,
                });

                await applyOnStepFinish({
                    runId: state.runId,
                    agentName: state.agentName,
                    stepIndex: state.stepIndex,
                    maxSteps: state.maxSteps,
                    result: stepResult,
                    conversationId: state.conversationId,
                    context: options.context,
                    onStepFinish: options.agent.onStepFinish,
                });

                if (stopDecision.stop) {
                    return {
                        response,
                        items: state.items,
                    };
                }

                state.stepIndex += 1;
            } catch (error) {
                const wrapped =
                    error instanceof BetterAgentError
                        ? error.at({ at: traceBase })
                        : BetterAgentError.wrap({
                              err: error,
                              message: stepErrorMessage,
                              opts: {
                                  code: "INTERNAL",
                                  trace: [{ at: traceBase }],
                              },
                          });
                await options.emit({
                    type: Events.STEP_ERROR,
                    runId: state.runId,
                    agentName: state.agentName,
                    stepIndex: state.stepIndex,
                    maxSteps: state.maxSteps,
                    error: wrapped,
                    timestamp: Date.now(),
                    conversationId: state.conversationId,
                });
                throw wrapped;
            }
        }
    } finally {
        await runCleanup();
        await pluginToolsResult.runCleanup();
    }
};
