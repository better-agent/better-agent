import { BetterAgentError } from "@better-agent/shared/errors";
import { logger } from "@better-agent/shared/logger";
import type { AnyAgentDefinition } from "../agent";
import { type Event, Events } from "../events";
import type { ConversationRuntimeStateStore, ConversationStore, StreamStore } from "../persistence";
import type { PluginRuntime } from "../plugins";
import type { ConversationItem, OutputSchemaDefinition } from "../providers";
import { type AsyncEventQueue, createAsyncEventQueue } from "./event-queue";
import { executeRun } from "./execution";
import {
    createStreamPersistenceEmitter,
    generateId,
    loadConversationMessages,
    saveConversationMessages,
    toEventEmitter,
    validateAgentContext,
    validateStoredConversationItems,
} from "./helpers";
import { createPendingToolRuntime } from "./pending-tools";
import { createAgentRegistry, resolveAgentFromRegistry } from "./registry";
import type {
    BetterAgentRuntime,
    ContextBoundAgent,
    ResumeConversationOptions,
    RunAdvancedOptions,
    RunOptions,
    RunResult,
    StreamResult,
    SubmitToolApprovalParams,
    SubmitToolResultParams,
} from "./types";

/** Creates a runtime for registered agents. */
export function createRuntime<const TAgents extends readonly AnyAgentDefinition[]>(options: {
    agents: TAgents;
    pluginRuntime?: PluginRuntime | null;
    stream?: StreamStore;
    conversations?: ConversationStore;
    runtimeState?: ConversationRuntimeStateStore;
    streamLifecycle?: "request_bound" | "detached";
    advanced?: RunAdvancedOptions;
}): BetterAgentRuntime<TAgents> {
    const agents = createAgentRegistry(options.agents);
    const pluginRuntime = options.pluginRuntime ?? null;
    const pendingToolRuntime = createPendingToolRuntime();
    const streamLifecycle = options.streamLifecycle ?? "request_bound";
    const activeRuns = new Map<string, AbortController>();

    const resolveConversationReplay = (
        agent: AnyAgentDefinition,
        runReplay: RunOptions<unknown>["conversationReplay"],
    ): RunOptions<unknown>["conversationReplay"] => {
        const agentReplay = agent.conversationReplay;
        if (!agentReplay && !runReplay) {
            return undefined;
        }

        const merged = {
            ...(agentReplay ?? {}),
            ...(runReplay ?? {}),
        };

        if (
            runReplay &&
            Object.prototype.hasOwnProperty.call(runReplay, "prepareInput") &&
            runReplay.prepareInput === null
        ) {
            merged.prepareInput = undefined;
        }

        return merged;
    };

    const warnIgnoredConversationReplay = (params: {
        agent: AnyAgentDefinition;
        conversationReplay: RunOptions<unknown>["conversationReplay"];
    }) => {
        if (!params.conversationReplay) {
            return;
        }

        const replayMode =
            params.agent.model.caps.replayMode ??
            (params.agent.model.caps.inputShape === "prompt"
                ? "single_turn_persistent"
                : "multi_turn");

        if (replayMode === "multi_turn") {
            return;
        }

        logger.warn(
            `conversationReplay was provided for agent '${params.agent.name}', but model replayMode is '${replayMode}', so stored history replay customization was skipped.`,
        );
    };

    const buildPersistence = <TContext>(
        persistence?: RunOptions<TContext>["persistence"],
        defaults?: {
            stream?: StreamStore;
            conversations?: ConversationStore;
            runtimeState?: ConversationRuntimeStateStore;
        },
    ) => {
        const resolved = {
            stream: persistence?.stream ?? defaults?.stream,
            conversations: persistence?.conversations ?? defaults?.conversations,
            runtimeState: persistence?.runtimeState ?? defaults?.runtimeState,
        };

        return resolved.stream || resolved.conversations || resolved.runtimeState
            ? resolved
            : undefined;
    };

    const createPluginEventContext = (params: {
        runId: string;
        agentName: string;
        conversationId?: string;
        abortController: AbortController;
    }) => ({
        runId: params.runId,
        agentName: params.agentName,
        conversationId: params.conversationId,
        control: {
            abortRun: async () => {
                params.abortController.abort();
            },
        },
    });

    const createLiveEmitter = (params: {
        runId: string;
        agentName: string;
        conversationId?: string;
        abortController: AbortController;
        persistenceEmit?: (event: Event) => Promise<void>;
        queuePush?: (event: Event) => Promise<void>;
        onEvent?: RunOptions<unknown>["onEvent"];
    }) => {
        const userEmit = toEventEmitter(params.onEvent);

        return async (event: Event) => {
            const pluginEventContext = createPluginEventContext({
                runId: params.runId,
                agentName: params.agentName,
                abortController: params.abortController,
                conversationId: params.conversationId,
            });

            const transformed =
                pluginRuntime?.hasEventMiddleware === true
                    ? await pluginRuntime.dispatchEvent(event, pluginEventContext)
                    : event;

            if (!transformed) {
                return;
            }

            if (params.persistenceEmit) {
                await params.persistenceEmit(transformed);
            }

            if (pluginRuntime?.hasOnEvent) {
                await pluginRuntime.dispatchOnEvent(transformed, pluginEventContext);
            }

            if (params.queuePush) {
                await params.queuePush(transformed);
            }

            await userEmit(transformed);
        };
    };

    const wrapRuntimeError = (params: {
        error: unknown;
        message: string;
        traceAt: string;
        isAbort?: boolean;
    }) =>
        BetterAgentError.wrap({
            err: params.error,
            message: params.message,
            opts: {
                code: params.isAbort
                    ? "ABORTED"
                    : params.error instanceof BetterAgentError
                      ? params.error.code
                      : "INTERNAL",
                trace: [{ at: params.traceAt }],
            },
        });

    const emitSafely = async (emit: (event: Event) => Promise<void>, event: Event) => {
        try {
            await emit(event);
        } catch (error) {
            logger.error("Failed to emit runtime event.", error);
        }
    };

    const closeStreamSafely = async (streamStore: StreamStore | undefined, runId: string) => {
        if (!streamStore) {
            return;
        }

        try {
            await streamStore.close(runId);
        } catch (error) {
            logger.error(`Failed to close stream '${runId}'.`, error);
        }
    };

    const createRuntimeExecutionContext = (params: {
        resolvedAgent: AnyAgentDefinition;
        conversationId?: string;
        onEvent?: RunOptions<unknown>["onEvent"];
        externalSignal?: AbortSignal;
        streamStore?: StreamStore;
        queue?: AsyncEventQueue<Event>;
        queueSignal?: AbortSignal;
        detachFromExternalAbort?: boolean;
    }) => {
        const runId = generateId("run");
        const abortController = new AbortController();
        activeRuns.set(runId, abortController);
        const signalController = new AbortController();
        const abortFromSignal = (signal: AbortSignal) => {
            if (!signalController.signal.aborted) {
                signalController.abort(signal.reason);
            }
        };
        const onInternalAbort = () => abortFromSignal(abortController.signal);
        const onExternalAbort = () => {
            if (params.externalSignal) {
                abortFromSignal(params.externalSignal);
            }
        };
        const signal = signalController.signal;
        const persistenceEmit = params.streamStore
            ? createStreamPersistenceEmitter({
                  stream: params.streamStore,
                  streamId: runId,
              })
            : undefined;
        const emit = createLiveEmitter({
            runId,
            agentName: params.resolvedAgent.name,
            abortController,
            conversationId: params.conversationId,
            persistenceEmit,
            queuePush: params.queue
                ? async (event) => {
                      if (!params.queueSignal?.aborted) {
                          params.queue?.push(event);
                      }
                  }
                : undefined,
            onEvent: params.onEvent,
        });

        abortController.signal.addEventListener("abort", onInternalAbort, { once: true });
        if (params.externalSignal && !params.detachFromExternalAbort) {
            if (params.externalSignal.aborted) {
                abortFromSignal(params.externalSignal);
            } else {
                params.externalSignal.addEventListener("abort", onExternalAbort, { once: true });
            }
        }

        if (params.queue && params.queueSignal) {
            const closeQueueOnAbort = () => params.queue?.close();
            if (params.queueSignal.aborted) {
                closeQueueOnAbort();
            } else {
                params.queueSignal.addEventListener("abort", closeQueueOnAbort, { once: true });
            }
        }

        return {
            runId,
            signal,
            emit,
            cleanupSignal() {
                abortController.signal.removeEventListener("abort", onInternalAbort);
                params.externalSignal?.removeEventListener("abort", onExternalAbort);
            },
        };
    };

    const completeRunSuccess = async <TResult>(params: {
        runId: string;
        resolvedAgent: AnyAgentDefinition;
        conversationId?: string;
        emit: (event: Event) => Promise<void>;
        result: RunResult & { items: ConversationItem[] };
        saveConversationParams?: Omit<Parameters<typeof saveConversationMessages>[0], "result">;
        streamStore?: StreamStore;
        runtimeState?: ConversationRuntimeStateStore;
        queue?: AsyncEventQueue<Event>;
        success: (result: RunResult) => TResult;
    }) => {
        const itemsToSave =
            pluginRuntime?.hasOnBeforeSave === true
                ? await pluginRuntime.applyBeforeSave({
                      runId: params.runId,
                      agentName: params.resolvedAgent.name,
                      items: params.result.items,
                      conversationId: params.conversationId,
                  })
                : params.result.items;

        if (params.saveConversationParams) {
            await saveConversationMessages({
                ...params.saveConversationParams,
                result: { ...params.result, items: itemsToSave },
            });
        }

        const publicResult = {
            response: params.result.response,
            structured: params.result.structured,
        };
        await params.emit({
            type: Events.RUN_FINISHED,
            runId: params.runId,
            agentName: params.resolvedAgent.name,
            result: publicResult,
            timestamp: Date.now(),
            conversationId: params.conversationId,
        });

        activeRuns.delete(params.runId);
        if (params.runtimeState && params.conversationId !== undefined) {
            await params.runtimeState.clear({
                conversationId: params.conversationId,
                agentName: params.resolvedAgent.name,
            });
        }
        await closeStreamSafely(params.streamStore, params.runId);
        params.queue?.close();
        pendingToolRuntime.clearRun(params.runId, "Run finished");
        return params.success(publicResult);
    };

    const handleRunFailure = async (params: {
        error: unknown;
        signal: AbortSignal;
        traceAt: string;
        emit: (event: Event) => Promise<void>;
        runId: string;
        resolvedAgent: AnyAgentDefinition;
        conversationId?: string;
        streamStore?: StreamStore;
        runtimeState?: ConversationRuntimeStateStore;
        queue?: AsyncEventQueue<Event>;
    }): Promise<never> => {
        const isAbort =
            params.signal.aborted ||
            (params.error instanceof BetterAgentError && params.error.code === "ABORTED");

        const wrapped = wrapRuntimeError({
            error: params.error,
            message: "Run failed",
            traceAt: params.traceAt,
            isAbort,
        });

        if (isAbort) {
            await emitSafely(params.emit, {
                type: Events.RUN_ABORTED,
                runId: params.runId,
                agentName: params.resolvedAgent.name,
                timestamp: Date.now(),
                conversationId: params.conversationId,
            });
        } else {
            await emitSafely(params.emit, {
                type: Events.RUN_ERROR,
                runId: params.runId,
                agentName: params.resolvedAgent.name,
                error: wrapped,
                timestamp: Date.now(),
                conversationId: params.conversationId,
            });
        }

        activeRuns.delete(params.runId);
        if (params.runtimeState && params.conversationId !== undefined) {
            await params.runtimeState.clear({
                conversationId: params.conversationId,
                agentName: params.resolvedAgent.name,
            });
        }
        await closeStreamSafely(params.streamStore, params.runId);
        params.queue?.fail(wrapped);
        pendingToolRuntime.clearRun(params.runId, wrapped.message);
        throw wrapped;
    };

    return {
        streamLifecycle,
        run: (async <TContext, TOutput extends OutputSchemaDefinition | undefined = undefined>(
            agent: TAgents[number]["name"],
            runOptions: RunOptions<TContext, TOutput>,
        ): Promise<RunResult> => {
            const resolvedAgent = resolveAgentFromRegistry(
                agents,
                agent,
                "core.run.createRuntime.run",
            ) as ContextBoundAgent<TContext>;
            if (
                runOptions.conversationId !== undefined &&
                runOptions.conversationId.trim().length === 0
            ) {
                throw BetterAgentError.fromCode(
                    "VALIDATION_FAILED",
                    "conversationId must be a non-empty string.",
                    {
                        context: { conversationId: runOptions.conversationId },
                        trace: [{ at: "core.run.createRuntime.run.validateConversationId" }],
                    },
                );
            }

            const execution = createRuntimeExecutionContext({
                resolvedAgent,
                conversationId: runOptions.conversationId,
                onEvent: runOptions.onEvent,
                externalSignal: runOptions.signal,
            });

            const resolvedPersistence = buildPersistence(runOptions.persistence, {
                stream: options.stream,
                conversations: options.conversations,
                runtimeState: options.runtimeState,
            });

            try {
                const effectiveConversationReplay = resolveConversationReplay(
                    resolvedAgent,
                    runOptions.conversationReplay,
                );
                warnIgnoredConversationReplay({
                    agent: resolvedAgent,
                    conversationReplay: effectiveConversationReplay,
                });
                const validatedContext = await validateAgentContext(
                    resolvedAgent,
                    runOptions.context,
                );
                const runPersistence = runOptions.persistence;
                const resolvedConversations =
                    runPersistence?.conversations ?? options.conversations;
                const conversationInput = await loadConversationMessages({
                    input: runOptions.input,
                    caps: resolvedAgent.model.caps,
                    agentName: resolvedAgent.name,
                    replaceHistory: runOptions.replaceHistory,
                    conversationReplay: effectiveConversationReplay,
                    conversations: resolvedConversations,
                    conversationId: runOptions.conversationId,
                });

                await execution.emit({
                    type: Events.RUN_STARTED,
                    runId: execution.runId,
                    agentName: resolvedAgent.name,
                    runInput: {
                        input: runOptions.input,
                        context: validatedContext,
                    },
                    timestamp: Date.now(),
                    conversationId: runOptions.conversationId,
                });

                if (execution.signal.aborted) {
                    throw BetterAgentError.fromCode("ABORTED", "Run aborted before it started", {
                        context: { runId: execution.runId, agentName: resolvedAgent.name },
                        trace: [{ at: "core.run.createRuntime.run.abortedBeforeStart" }],
                    });
                }

                const result = await executeRun({
                    agent: resolvedAgent,
                    options: {
                        ...runOptions,
                        input: conversationInput.input,
                        initialItems: conversationInput.items,
                        replayStartIndex: conversationInput.replayStartIndex,
                        conversationReplayActive: conversationInput.conversationReplayActive,
                        conversationReplay: effectiveConversationReplay,
                        context: validatedContext,
                        runId: execution.runId,
                        signal: execution.signal,
                        emit: execution.emit,
                        generateMessageId: () => generateId("message"),
                        mode: "run",
                        advancedDefaults: options.advanced,
                        persistence: resolvedPersistence,
                        pendingToolRuntime,
                        pluginRuntime,
                    },
                });

                return await completeRunSuccess({
                    runId: execution.runId,
                    resolvedAgent,
                    emit: execution.emit,
                    result,
                    saveConversationParams: {
                        agentName: resolvedAgent.name,
                        loaded: conversationInput.loaded,
                        conversations: resolvedConversations,
                        conversationId: runOptions.conversationId,
                    },
                    runtimeState: resolvedPersistence?.runtimeState,
                    conversationId: runOptions.conversationId,
                    success: (publicResult) => publicResult,
                });
            } catch (error) {
                return await handleRunFailure({
                    error,
                    signal: execution.signal,
                    traceAt: "core.run.createRuntime.run",
                    emit: execution.emit,
                    runId: execution.runId,
                    resolvedAgent,
                    conversationId: runOptions.conversationId,
                    runtimeState: resolvedPersistence?.runtimeState,
                });
            } finally {
                execution.cleanupSignal();
            }
        }) as unknown as BetterAgentRuntime<TAgents>["run"],

        stream: (<TContext, TOutput extends OutputSchemaDefinition | undefined = undefined>(
            agent: TAgents[number]["name"],
            runOptions: RunOptions<TContext, TOutput>,
        ): StreamResult => {
            const resolvedAgent = resolveAgentFromRegistry(
                agents,
                agent,
                "core.run.createRuntime.stream",
            ) as ContextBoundAgent<TContext>;
            if (
                runOptions.conversationId !== undefined &&
                runOptions.conversationId.trim().length === 0
            ) {
                throw BetterAgentError.fromCode(
                    "VALIDATION_FAILED",
                    "conversationId must be a non-empty string.",
                    {
                        context: { conversationId: runOptions.conversationId },
                        trace: [{ at: "core.run.createRuntime.stream.validateConversationId" }],
                    },
                );
            }

            const queue = createAsyncEventQueue<Event>();
            const runPersistence = runOptions.persistence;
            const streamStore = runPersistence?.stream ?? options.stream;
            const execution = createRuntimeExecutionContext({
                resolvedAgent,
                conversationId: runOptions.conversationId,
                onEvent: runOptions.onEvent,
                externalSignal: runOptions.signal,
                detachFromExternalAbort: streamLifecycle === "detached",
                queueSignal: streamLifecycle === "detached" ? runOptions.signal : undefined,
                streamStore,
                queue,
            });

            const resolvedPersistence = buildPersistence(runPersistence, {
                stream: streamStore,
                conversations: options.conversations,
                runtimeState: options.runtimeState,
            });

            const result = (async (): Promise<RunResult> => {
                try {
                    const effectiveConversationReplay = resolveConversationReplay(
                        resolvedAgent,
                        runOptions.conversationReplay,
                    );
                    warnIgnoredConversationReplay({
                        agent: resolvedAgent,
                        conversationReplay: effectiveConversationReplay,
                    });
                    const validatedContext = await validateAgentContext(
                        resolvedAgent,
                        runOptions.context,
                    );
                    const resolvedConversations =
                        runPersistence?.conversations ?? options.conversations;
                    const conversationInput = await loadConversationMessages({
                        input: runOptions.input,
                        caps: resolvedAgent.model.caps,
                        agentName: resolvedAgent.name,
                        replaceHistory: runOptions.replaceHistory,
                        conversationReplay: effectiveConversationReplay,
                        conversations: resolvedConversations,
                        conversationId: runOptions.conversationId,
                    });

                    if (streamStore) {
                        await streamStore.open(execution.runId, { runId: execution.runId });
                    }

                    if (
                        resolvedPersistence?.runtimeState &&
                        runOptions.conversationId !== undefined
                    ) {
                        await resolvedPersistence.runtimeState.set({
                            conversationId: runOptions.conversationId,
                            agentName: resolvedAgent.name,
                            status: "running",
                            updatedAt: Date.now(),
                            activeRunId: execution.runId,
                            activeStreamId: streamStore ? execution.runId : undefined,
                        });
                    }

                    await execution.emit({
                        type: Events.RUN_STARTED,
                        runId: execution.runId,
                        agentName: resolvedAgent.name,
                        runInput: {
                            input: runOptions.input,
                            context: validatedContext,
                        },
                        timestamp: Date.now(),
                        conversationId: runOptions.conversationId,
                    });

                    if (execution.signal.aborted) {
                        throw BetterAgentError.fromCode(
                            "ABORTED",
                            "Run aborted before it started",
                            {
                                context: { runId: execution.runId, agentName: resolvedAgent.name },
                                trace: [{ at: "core.run.createRuntime.stream.abortedBeforeStart" }],
                            },
                        );
                    }

                    const runResult = await executeRun({
                        agent: resolvedAgent,
                        options: {
                            ...runOptions,
                            input: conversationInput.input,
                            initialItems: conversationInput.items,
                            replayStartIndex: conversationInput.replayStartIndex,
                            conversationReplayActive: conversationInput.conversationReplayActive,
                            conversationReplay: effectiveConversationReplay,
                            context: validatedContext,
                            runId: execution.runId,
                            signal: execution.signal,
                            emit: execution.emit,
                            generateMessageId: () => generateId("message"),
                            mode: "stream",
                            advancedDefaults: options.advanced,
                            persistence: resolvedPersistence,
                            pendingToolRuntime,
                            pluginRuntime,
                        },
                    });

                    return await completeRunSuccess({
                        runId: execution.runId,
                        resolvedAgent,
                        emit: execution.emit,
                        result: runResult,
                        streamStore,
                        queue,
                        saveConversationParams: {
                            agentName: resolvedAgent.name,
                            loaded: conversationInput.loaded,
                            conversations: resolvedConversations,
                            conversationId: runOptions.conversationId,
                        },
                        runtimeState: resolvedPersistence?.runtimeState,
                        conversationId: runOptions.conversationId,
                        success: (publicResult) => publicResult,
                    });
                } catch (error) {
                    return await handleRunFailure({
                        error,
                        signal: execution.signal,
                        traceAt: "core.run.createRuntime.stream",
                        emit: execution.emit,
                        runId: execution.runId,
                        resolvedAgent,
                        conversationId: runOptions.conversationId,
                        streamStore,
                        runtimeState: resolvedPersistence?.runtimeState,
                        queue,
                    });
                } finally {
                    execution.cleanupSignal();
                }
            })();

            void result.catch(() => {});

            return {
                runId: execution.runId,
                events: queue.iterate(),
                result,
            };
        }) as unknown as BetterAgentRuntime<TAgents>["stream"],

        loadConversation: async <TName extends TAgents[number]["name"]>(
            agent: TName,
            conversationId: string,
        ) => {
            if (conversationId.trim().length === 0) {
                throw BetterAgentError.fromCode(
                    "VALIDATION_FAILED",
                    "conversationId must be a non-empty string.",
                    {
                        context: { conversationId },
                        trace: [
                            {
                                at: "core.run.createRuntime.loadConversation.validateConversationId",
                            },
                        ],
                    },
                );
            }
            const resolvedAgent = resolveAgentFromRegistry(
                agents,
                agent,
                "core.run.createRuntime.loadConversation",
            );
            const conversations = options.conversations;
            if (!conversations) {
                return null;
            }

            const loaded = await conversations.load({
                conversationId,
                agentName: resolvedAgent.name,
            });
            if (!loaded) {
                return null;
            }

            validateStoredConversationItems(loaded.items, conversationId);
            return { items: loaded.items };
        },
        resumeStream: async (params) => {
            if (params.streamId.trim().length === 0) {
                throw BetterAgentError.fromCode(
                    "VALIDATION_FAILED",
                    "streamId must be a non-empty string.",
                    {
                        context: { streamId: params.streamId },
                        trace: [{ at: "core.run.createRuntime.resumeStream.validateStreamId" }],
                    },
                );
            }
            if (!options.stream) {
                return null;
            }

            return options.stream.resume(params.streamId, params.afterSeq);
        },

        resumeConversation: async <TName extends TAgents[number]["name"]>(
            agent: TName,
            params: ResumeConversationOptions,
        ) => {
            if (params.conversationId.trim().length === 0) {
                throw BetterAgentError.fromCode(
                    "VALIDATION_FAILED",
                    "conversationId must be a non-empty string.",
                    {
                        context: { conversationId: params.conversationId },
                        trace: [
                            {
                                at: "core.run.createRuntime.resumeConversation.validateConversationId",
                            },
                        ],
                    },
                );
            }

            const resolvedAgent = resolveAgentFromRegistry(
                agents,
                agent,
                "core.run.createRuntime.resumeConversation",
            );
            const state = !options.runtimeState
                ? null
                : await options.runtimeState.get({
                      conversationId: params.conversationId,
                      agentName: resolvedAgent.name,
                  });

            if (!state || state.status !== "running" || !state.activeStreamId || !options.stream) {
                return null;
            }

            // biome-ignore lint/style/noNonNullAssertion: activeStreamId is checked above via runtime state existence
            return options.stream.resume(state.activeStreamId!, params.afterSeq);
        },

        abortRun: async (runId: string): Promise<boolean> => {
            const controller = activeRuns.get(runId);
            if (!controller) {
                return false;
            }

            controller.abort();
            return true;
        },

        submitToolResult: async (params: SubmitToolResultParams): Promise<boolean> =>
            pendingToolRuntime.submitToolResult(params),

        submitToolApproval: async (params: SubmitToolApprovalParams): Promise<boolean> =>
            pendingToolRuntime.submitToolApproval(params),
    };
}
