import { BetterAgentError } from "@better-agent/shared/errors";
import type { AgentEvent, AgentState } from "../ag-ui";
import type { AgentContextOf, AnyDefinedAgent } from "../agent/types";
import { createRuntime } from "../runtime/create-runtime";
import { createRunFinishedEvent } from "../runtime/events";
import type { StreamResult } from "../runtime/types";
import type { AgentOutput } from "../schema";
import { type RunRecord, storageTables } from "../storage";
import type { AppContext } from "./create-app-context";
import {
    createCombinedToolSource,
    createRunAbortCheck,
    getStoredRunConfig,
    loadThreadHistory,
    persistFailedRun,
    prepareAgentMessages,
    resolveAgentInstruction,
    resolveEffectiveRunConfig,
    resolveThreadResumeState,
    tolerateUnsupportedStorageTable,
    validateAgentContext,
} from "./helpers";
import { createStreamStore } from "./stream-store";
import type {
    AgentByName,
    AppRunInput,
    ProviderOptionsForAgent,
    StructuredOutputForAgent,
} from "./types";

function createReplayableEventStream<TEvent>() {
    const events: TEvent[] = [];
    const waiters = new Set<() => void>();
    let closed = false;
    let error: unknown;

    const notify = () => {
        for (const waiter of waiters) {
            waiter();
        }
        waiters.clear();
    };

    return {
        publish(event: TEvent) {
            if (closed) {
                return;
            }

            events.push(event);
            notify();
        },
        close() {
            if (closed) {
                return;
            }

            closed = true;
            notify();
        },
        fail(cause: unknown) {
            if (closed) {
                return;
            }

            error = cause;
            closed = true;
            notify();
        },
        iterate(): AsyncIterable<TEvent> {
            return (async function* () {
                let index = 0;

                while (true) {
                    if (index < events.length) {
                        yield events[index] as TEvent;
                        index += 1;
                        continue;
                    }

                    if (error !== undefined) {
                        throw error;
                    }

                    if (closed) {
                        return;
                    }

                    await new Promise<void>((resolve) => {
                        waiters.add(resolve);
                    });
                }
            })();
        },
    };
}

export const createStreamMethod = <
    const TAgents extends readonly AnyDefinedAgent[] = readonly AnyDefinedAgent[],
>(
    context: AppContext,
): {
    stream: <
        TName extends TAgents[number]["name"],
        TState = AgentState,
        TOutput extends AgentOutput | undefined = undefined,
    >(
        agentName: TName,
        input: AppRunInput<
            AgentContextOf<AgentByName<TAgents, TName>>,
            TState,
            ProviderOptionsForAgent<AgentByName<TAgents, TName>>,
            TOutput
        >,
    ) => Promise<
        StreamResult<TState, StructuredOutputForAgent<AgentByName<TAgents, TName>, TOutput>>
    >;
    streamResolved: <
        TName extends TAgents[number]["name"],
        TState = AgentState,
        TOutput extends AgentOutput | undefined = undefined,
    >(
        agent: AgentByName<TAgents, TName>,
        input: AppRunInput<
            AgentContextOf<AgentByName<TAgents, TName>>,
            TState,
            ProviderOptionsForAgent<AgentByName<TAgents, TName>>,
            TOutput
        >,
    ) => Promise<
        StreamResult<TState, StructuredOutputForAgent<AgentByName<TAgents, TName>, TOutput>>
    >;
} => {
    async function stream<
        TName extends TAgents[number]["name"],
        TState = AgentState,
        TOutput extends AgentOutput | undefined = undefined,
    >(
        agentName: TName,
        input: AppRunInput<
            AgentContextOf<AgentByName<TAgents, TName>>,
            TState,
            ProviderOptionsForAgent<AgentByName<TAgents, TName>>,
            TOutput
        >,
        resolvedAgent?: AgentByName<TAgents, TName>,
    ): Promise<
        StreamResult<TState, StructuredOutputForAgent<AgentByName<TAgents, TName>, TOutput>>
    > {
        const streams = createStreamStore(context.config.storage);
        const runId = context.generateId("run", {
            agentName,
            threadId: input.threadId,
        });
        const startedAt = Date.now();
        const agent =
            resolvedAgent ??
            context.config.agents.find(
                (candidate: TAgents[number]): candidate is AgentByName<TAgents, TName> =>
                    candidate.name === agentName,
            );

        if (!agent) {
            throw BetterAgentError.fromCode("NOT_FOUND", `Agent '${agentName}' not found.`, {
                context: {
                    agentName,
                    availableAgents: context.config.agents.map(
                        (candidate: TAgents[number]) => candidate.name,
                    ),
                },
            });
        }

        const memory = context.getAgentMemory(agent);
        const { existingThread, latestRun } = await resolveThreadResumeState(
            context,
            input,
            memory,
        );
        const storedRunConfig = getStoredRunConfig<
            AgentContextOf<AgentByName<TAgents, TName>>,
            ProviderOptionsForAgent<AgentByName<TAgents, TName>>
        >(latestRun);
        const effectiveRunConfig = resolveEffectiveRunConfig({
            resume: input.resume,
            context: input.context,
            toolChoice: input.toolChoice,
            providerOptions: input.providerOptions,
            maxSteps: input.maxSteps,
            stored: storedRunConfig,
            defaultMaxSteps: agent.maxSteps,
            defaultToolChoice: agent.toolChoice,
        });
        const resolvedContext = validateAgentContext(agent, effectiveRunConfig.context);
        const instruction = await resolveAgentInstruction(agent, resolvedContext);
        const inputMessagesList = input.messages ?? [];
        const effectiveState = input.state ?? (existingThread?.state as TState | undefined);

        const historyMessages = await loadThreadHistory(memory, input.threadId);
        const inputMessages = prepareAgentMessages({
            messages: inputMessagesList,
            generateId: context.generateId,
            agentName: agent.name,
            runId,
            threadId: input.threadId,
        });
        const runtimeMessages = [
            ...(instruction
                ? [
                      {
                          id: context.generateId("message", {
                              agentName: agent.name,
                              runId,
                              threadId: input.threadId,
                              role: "system",
                          }),
                          role: "system" as const,
                          content: instruction,
                      },
                  ]
                : []),
            ...historyMessages,
            ...inputMessages,
        ];
        let persistedMessageCount = runtimeMessages.length;
        const runConfig = {
            context: resolvedContext,
            ...effectiveRunConfig,
        };
        const runBase = {
            runId,
            agentName: agent.name,
            threadId: input.threadId,
            scope: existingThread?.scope,
            config: runConfig,
            startedAt,
        } satisfies Omit<RunRecord, "status" | "updatedAt" | "finalEvent" | "finishedAt">;

        const storage = context.config.storage;
        if (storage) {
            const runningRecord: RunRecord = {
                ...runBase,
                status: "running",
                updatedAt: startedAt,
            };
            await tolerateUnsupportedStorageTable(() =>
                storage.set(storageTables.runs, runId, runningRecord),
            );
        }

        if (memory && input.threadId) {
            if (!existingThread) {
                await memory.threads.set(input.threadId, {
                    id: input.threadId,
                    agentName: agent.name,
                    state: effectiveState,
                    createdAt: startedAt,
                    updatedAt: startedAt,
                });
            } else {
                await memory.threads.set(input.threadId, {
                    ...existingThread,
                    updatedAt: startedAt,
                });
            }

            if (inputMessages.length > 0) {
                await memory.messages.append({
                    threadId: input.threadId,
                    runId,
                    messages: inputMessages,
                });
            }
        }

        await tolerateUnsupportedStorageTable(() => streams.open({ runId }));

        const runtime = createRuntime<TState, AgentContextOf<AgentByName<TAgents, TName>>>({
            model: agent.model,
            tools: createCombinedToolSource({
                context,
                agentTools: agent.tools,
            }),
            agentName: agent.name,
            pluginRuntime: context.pluginRuntime,
            checkAbort: createRunAbortCheck({
                runId,
                signal: input.signal,
                storage: context.config.storage,
            }),
            context: resolvedContext,
            generateId: context.generateId,
            hooks: {
                onStep: async (stepContext) => {
                    if (context.pluginRuntime.hasStepHooks) {
                        await context.pluginRuntime.applyOnStep({
                            ...stepContext,
                            agentName: agent.name,
                            context: resolvedContext,
                        });
                    }

                    await agent.onStep?.(stepContext);
                },
                onStepFinish: async (stepContext) => {
                    if (memory && input.threadId) {
                        const newMessages = stepContext.messages.slice(persistedMessageCount);
                        if (newMessages.length > 0) {
                            await memory.messages.append({
                                threadId: input.threadId,
                                runId,
                                messages: newMessages,
                            });
                            persistedMessageCount = stepContext.messages.length;
                        }
                    }

                    if (context.pluginRuntime.hasStepHooks) {
                        await context.pluginRuntime.applyOnStepFinish({
                            ...stepContext,
                            agentName: agent.name,
                            context: resolvedContext,
                        });
                    }

                    await agent.onStepFinish?.(stepContext);
                },
                onState: async (stateContext) => {
                    if (memory && input.threadId) {
                        const currentThread = await memory.threads.get(input.threadId);
                        await memory.threads.set(input.threadId, {
                            id: input.threadId,
                            agentName: agent.name,
                            scope: currentThread?.scope,
                            createdAt: currentThread?.createdAt ?? startedAt,
                            updatedAt: Date.now(),
                            title: currentThread?.title,
                            metadata: currentThread?.metadata,
                            state: stateContext.state,
                        });
                    }

                    await agent.onState?.(stateContext);
                },
                stopWhen: agent.stopWhen,
            },
        });

        context.activeRuntimes.set(runId, runtime);

        try {
            const streamed = await runtime.stream({
                runId,
                input: {
                    threadId: input.threadId,
                    messages: runtimeMessages,
                    state: effectiveState,
                    toolChoice: effectiveRunConfig.toolChoice,
                    output: input.output ?? agent.output,
                    providerOptions: effectiveRunConfig.providerOptions,
                    maxSteps: effectiveRunConfig.maxSteps,
                    signal: input.signal,
                    resume: input.resume,
                },
            });

            const events = createReplayableEventStream<AgentEvent>();
            const eventPump = (async () => {
                try {
                    for await (const event of streamed.events) {
                        const nextEvent = context.pluginRuntime.hasEventMiddleware
                            ? await context.pluginRuntime.dispatchEvent(event, {
                                  runId,
                                  agentName: agent.name,
                                  threadId: input.threadId,
                                  control: {
                                      abortRun: () => runtime.abortRun(runId),
                                  },
                              })
                            : event;

                        if (!nextEvent) {
                            continue;
                        }

                        await tolerateUnsupportedStorageTable(() =>
                            streams.append({ runId, event: nextEvent }),
                        );

                        if (context.pluginRuntime.hasOnEvent) {
                            await context.pluginRuntime.dispatchOnEvent(nextEvent, {
                                runId,
                                agentName: agent.name,
                                threadId: input.threadId,
                                control: {
                                    abortRun: () => runtime.abortRun(runId),
                                },
                            });
                        }

                        events.publish(nextEvent);
                    }
                    events.close();
                } catch (error) {
                    events.fail(error);
                    throw error;
                }
            })();

            void eventPump.catch(() => {});

            const final = (async () => {
                try {
                    const result = await streamed.final;
                    await eventPump.catch(() => {});

                    if (memory && input.threadId) {
                        const currentThread = await memory.threads.get(input.threadId);
                        await memory.threads.set(input.threadId, {
                            id: input.threadId,
                            agentName: agent.name,
                            scope: currentThread?.scope,
                            createdAt: currentThread?.createdAt ?? startedAt,
                            updatedAt: Date.now(),
                            title: currentThread?.title,
                            metadata: currentThread?.metadata,
                            state: result.state,
                        });
                    }

                    if (storage) {
                        const finishedAt = Date.now();
                        await tolerateUnsupportedStorageTable(() =>
                            storage.set(storageTables.runs, runId, {
                                ...runBase,
                                status:
                                    result.outcome === "interrupt" ? "interrupted" : "completed",
                                finalEvent: createRunFinishedEvent({
                                    runId,
                                    threadId: input.threadId,
                                    outcome: result.outcome,
                                    ...(result.outcome === "interrupt"
                                        ? { interrupts: result.interrupts }
                                        : {
                                              result: {
                                                  finishReason: result.finishReason,
                                                  usage: result.usage,
                                                  stepCount: result.stepCount,
                                              },
                                          }),
                                }),
                                updatedAt: finishedAt,
                                finishedAt,
                            }),
                        );
                    }

                    await tolerateUnsupportedStorageTable(() => streams.close(runId, "closed"));

                    return result;
                } catch (error) {
                    await eventPump.catch(() => {});
                    await persistFailedRun({
                        storage: context.config.storage,
                        runBase,
                        error,
                    });
                    await tolerateUnsupportedStorageTable(() => streams.close(runId, "closed"));

                    throw error;
                } finally {
                    context.activeRuntimes.delete(runId);
                }
            })();

            return {
                ...streamed,
                events: events.iterate(),
                final,
            } as StreamResult<
                TState,
                StructuredOutputForAgent<AgentByName<TAgents, TName>, TOutput>
            >;
        } catch (error) {
            await persistFailedRun({
                storage: context.config.storage,
                runBase,
                error,
            });
            await tolerateUnsupportedStorageTable(() => streams.close(runId, "closed"));

            context.activeRuntimes.delete(runId);
            throw error;
        }
    }

    function streamResolved<
        TName extends TAgents[number]["name"],
        TState = AgentState,
        TOutput extends AgentOutput | undefined = undefined,
    >(
        agent: AgentByName<TAgents, TName>,
        input: AppRunInput<
            AgentContextOf<AgentByName<TAgents, TName>>,
            TState,
            ProviderOptionsForAgent<AgentByName<TAgents, TName>>,
            TOutput
        >,
    ): Promise<
        StreamResult<TState, StructuredOutputForAgent<AgentByName<TAgents, TName>, TOutput>>
    > {
        return stream(agent.name, input, agent);
    }

    return { stream, streamResolved };
};
