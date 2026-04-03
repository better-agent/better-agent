import type {
    GenerativeModelInputItem,
    GenerativeModelResponse,
} from "@better-agent/core/providers";
import type { BetterAgentClient, ClientEvent } from "../types/client";
import type {
    AgentNameFromApp,
    DefaultStructuredOutputForAgent,
} from "../types/client-type-helpers";
import type {
    AgentChatControllerOptions,
    AgentChatSnapshot,
    AgentStatus,
    ApproveToolCallParams,
    ControllerRunInput,
    InternalSubmitOptions,
    OnFinishParams,
    PreparedRequestInput,
    RetryResult,
    SendMessageOptions,
    SendResult,
    SetMessagesInput,
    StreamConsumptionResult,
    StreamTerminalState,
    SubmissionContext,
    UIMessageInput,
} from "../types/controller";
import type { ResumeOption } from "../types/controller";
import type { PendingToolApproval, UIMessage } from "../types/ui";
import { ensureBrowserTeardownTracking, isBrowserPageTearingDown } from "./browser-lifecycle";
import type { AgentClientError } from "./error";
import { StreamDisconnectError, getEventErrorMessage, toAgentClientError } from "./error";
import { type MessageState, applyEvent, createMessageState } from "./reducer";
import { getMessagesFromResponse } from "./response";
import {
    fromConversationItems,
    fromModelMessages,
    makeLocalMessageId,
    mergeModelOptions,
    normalizeOptimisticUserMessageConfig,
    toModelMessages,
} from "./utils";

/**
 * Framework-agnostic controller for one agent conversation.
 */
export class AgentChatController<
    TApp = unknown,
    TAgentName extends AgentNameFromApp<TApp> = AgentNameFromApp<TApp>,
> {
    // Private state.
    private readonly id: string;
    private state: MessageState;
    private status: AgentStatus = "ready";
    private error: AgentClientError | undefined = undefined;
    private lastStreamId: string | undefined;
    private lastRunId: string | undefined;
    private lastResponse: GenerativeModelResponse | undefined;
    private lastStructured: DefaultStructuredOutputForAgent<TApp, TAgentName> | undefined;
    private lastAppliedSeq = -1;
    private lastAppliedSeqByStream: Map<string, number> = new Map();
    private initialMessages: UIMessage[];
    private listeners: Set<() => void> = new Set();
    private destroyed = false;
    private initialized = false;
    private warnedHistoryCombo = false;
    private options: AgentChatControllerOptions<TApp, TAgentName>;
    private activeAbortController: AbortController | null = null;

    // Constructor.
    constructor(
        private client: BetterAgentClient<TApp>,
        options: AgentChatControllerOptions<TApp, TAgentName>,
    ) {
        this.options = options;
        this.id = options.id ?? makeLocalMessageId();
        const normalized = this.normalizeMessages(options.initialMessages ?? []);
        this.state = createMessageState(normalized);
        this.initialMessages = normalized;
        this.lastStreamId = this.getConfiguredInitialStreamId(options);
    }

    // Public state.

    /** Returns the current messages. */
    getMessages(): UIMessage[] {
        return this.state.messages;
    }

    /** Returns the current status. */
    getStatus(): AgentStatus {
        return this.status;
    }

    /** Returns the latest client error. */
    getError(): AgentClientError | undefined {
        return this.error;
    }

    /** Returns the latest stream id. */
    getStreamId(): string | undefined {
        return this.lastStreamId;
    }

    /** Returns the latest run id. */
    getRunId(): string | undefined {
        return this.lastRunId;
    }

    /** True while a request is active. */
    get isLoading(): boolean {
        return (
            this.status === "hydrating" ||
            this.status === "submitted" ||
            this.status === "streaming"
        );
    }

    /** True while stream events are being consumed. */
    get isStreaming(): boolean {
        return this.status === "streaming";
    }

    /** Returns pending tool approvals. */
    getPendingToolApprovals(): PendingToolApproval[] {
        const seen = new Set<string>();
        const pending: PendingToolApproval[] = [];

        for (const message of this.state.messages) {
            for (const part of message.parts) {
                if (
                    part.type === "tool-call" &&
                    part.state === "approval-requested" &&
                    !seen.has(part.callId)
                ) {
                    pending.push({
                        toolCallId: part.callId,
                        toolName: part.name,
                        args: part.args,
                        toolTarget: part.toolTarget,
                        input: part.approval?.input,
                        meta: part.approval?.meta,
                        note: part.approval?.note,
                        actorId: part.approval?.actorId,
                    });
                    seen.add(part.callId);
                }
            }
        }
        return pending;
    }

    /** Returns an immutable snapshot. */
    getSnapshot(): AgentChatSnapshot {
        return {
            id: this.id,
            conversationId: this.options.conversationId,
            messages: this.state.messages,
            status: this.status,
            error: this.error,
            streamId: this.lastStreamId,
            runId: this.lastRunId,
            isLoading: this.isLoading,
            isStreaming: this.isStreaming,
            pendingToolApprovals: this.getPendingToolApprovals(),
        };
    }

    // Public lifecycle.

    /** Stops the active run or stream. */
    stop(): void {
        if (this.destroyed) return;
        this.cancelActiveWork();
        this.setStatus("ready");
    }

    /** Replaces the transport client. */
    updateClient(client: BetterAgentClient<TApp>): void {
        this.client = client;
    }

    /**
     * Subscribes to state updates.
     */
    subscribe(listener: () => void): () => void {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    }

    /** Calls each subscribed listener after controller state changes. */
    private notify(): void {
        if (this.destroyed) return;
        for (const listener of this.listeners) {
            listener();
        }
    }

    /** Stores run and stream ids from response headers. */
    private updateResponseIds(response: Response): void {
        const runId = response.headers.get("x-run-id");
        if (runId && runId !== this.lastRunId) {
            this.lastRunId = runId;
        }

        const streamId = response.headers.get("x-stream-id");
        if (streamId && streamId !== this.lastStreamId) {
            this.lastStreamId = streamId;
        }
    }

    // Public requests.

    /** Starts hydration or resume behavior. */
    init(): void {
        if (this.initialized) return;
        this.initialized = true;
        ensureBrowserTeardownTracking();

        if (this.options.hydrateFromServer && this.options.conversationId) {
            void this.hydrateFromServer();
            return;
        }

        this.initResume();
    }

    /** Starts resume behavior, even with messages when allowed. */
    private initResume(options?: { allowWithMessages?: boolean }): void {
        const resume = this.options.resume;
        if (!resume) return;

        const hasMessages = this.state.messages.length > 0;
        const explicitStreamId =
            typeof resume === "object" && resume !== null && typeof resume.streamId === "string"
                ? resume.streamId
                : undefined;
        const explicitAfterSeq =
            typeof resume === "object" && resume !== null ? resume.afterSeq : undefined;
        // Prefer an explicit cursor, otherwise reuse the stream cursor.
        const streamAfterSeq =
            explicitAfterSeq ??
            (explicitStreamId ? this.lastAppliedSeqByStream.get(explicitStreamId) : undefined);

        // Skip implicit resume when messages already exist.
        if (
            hasMessages &&
            explicitStreamId === undefined &&
            explicitAfterSeq === undefined &&
            !options?.allowWithMessages
        ) {
            return;
        }

        if (explicitStreamId) {
            void this.resumeStream({
                streamId: explicitStreamId,
                ...(streamAfterSeq !== undefined ? { afterSeq: streamAfterSeq } : {}),
            });
            return;
        }

        if (!this.options.conversationId) {
            console.warn(
                "[better-agent] `resume` requires `conversationId` unless an explicit `streamId` is provided.",
            );
            return;
        }

        // Use the caller cursor when present, otherwise let the server decide.
        if (explicitAfterSeq !== undefined) {
            void this.resumeConversation({ afterSeq: explicitAfterSeq });
            return;
        }

        void this.resumeConversation();
    }

    /** Hydrates from server history before resuming. */
    private async hydrateFromServer(): Promise<void> {
        const conversationId = this.options.conversationId;
        if (!conversationId) {
            this.initResume();
            return;
        }

        const loadConversation = this.client.loadConversation;
        if (typeof loadConversation !== "function") {
            // Skip hydration when loading is unavailable.
            this.initResume();
            return;
        }

        const { signal, controller } = this.startOperation();
        this.setStatus("hydrating");
        let hydrationCompleted = false;
        this.setError(undefined);

        try {
            const result = await loadConversation.call(
                this.client,
                this.options.agent,
                conversationId,
                { signal },
            );
            this.throwIfAborted(signal);

            if (result) {
                // Replace local state with the server snapshot.
                const uiMessages = fromConversationItems(result.items);
                this.initialMessages = uiMessages;
                this.state = createMessageState(uiMessages);
                this.notify();
            }

            this.setStatus("ready");
            hydrationCompleted = true;
        } catch (e) {
            if (this.isAbortError(e, signal)) {
                return;
            }

            const err = this.toError(e, "Hydration failed");
            this.options.onError?.(err);
            this.setStatus("ready");
            hydrationCompleted = true;
        } finally {
            this.finishOperation(controller);
            if (hydrationCompleted) {
                // Allow resume after hydration.
                this.initResume({ allowWithMessages: true });
            }
        }
    }

    /** Sends one message. */
    async sendMessage(
        input: ControllerRunInput,
        options?: SendMessageOptions,
    ): Promise<SendResult> {
        return this.submitWithInternalOptions(
            input,
            options?.signal ? { signal: options.signal } : undefined,
        );
    }

    /** Retries a user message by local id. */
    async retryMessage(localId: string): Promise<RetryResult> {
        const message = this.getMessageByLocalId(localId);
        if (!message) {
            throw new Error(`Message '${localId}' was not found.`);
        }
        if (message.role !== "user") {
            throw new Error("Only user messages can be retried.");
        }

        const idx = this.state.byLocalId.get(localId);
        if (idx === undefined) {
            throw new Error(`Message '${localId}' was not found.`);
        }

        const retryMessages = this.state.messages
            .slice(0, idx + 1)
            .map((candidate) =>
                candidate.localId === localId
                    ? (this.createPendingUserMessage(candidate) ?? candidate)
                    : candidate,
            );

        return this.submitWithInternalOptions(
            {
                input: toModelMessages(retryMessages),
                sendClientHistory: true,
            },
            {
                replaceLocalId: localId,
                replaceMessage: this.createPendingUserMessage(message),
                serializedHistoryInput: true,
            },
        );
    }

    /** Resumes an existing stream. */
    async resumeStream(options: { streamId: string; afterSeq?: number }): Promise<void> {
        const { streamId } = options;
        const { signal, controller } = this.startOperation();
        this.setStatus("submitted");
        this.setError(undefined);

        try {
            const events = this.client.resumeStream(
                this.options.agent,
                {
                    streamId,
                    afterSeq: options.afterSeq ?? this.lastAppliedSeqByStream.get(streamId) ?? -1,
                },
                {
                    signal,
                    onResponse: (response) => {
                        this.updateResponseIds(response);
                    },
                },
            );

            const result = await this.consumeStreamUntilTerminal(events, {
                signal,
                replay: true,
                disconnectMessage: "Resume stream disconnected.",
            });
            if (!result.receivedEvent) {
                this.setStatus("ready");
                return;
            }
            if (!result.terminalState) {
                throw this.toStreamDisconnectError(
                    undefined,
                    "Stream ended before terminal run event.",
                );
            }
            if (result.terminalState === "error") {
                throw result.terminalError ?? new Error("Resume failed.");
            }

            this.setStatus("ready");
            if (result.receivedEvent && result.terminalState) {
                this.emitFinish({ streamId, isAbort: result.terminalState === "aborted" });
            }
        } catch (e) {
            if (
                this.destroyed ||
                this.isAbortError(e, signal) ||
                (this.isStreamDisconnectError(e) && this.isPageTeardownLike())
            ) {
                this.setStatus("ready");
                return;
            }

            const err = toAgentClientError(e, "Resume failed.");
            this.setError(err);
            this.setStatus("error");
            if (this.isStreamDisconnectError(e)) {
                this.options.onDisconnect?.({
                    error: err,
                    runId: this.lastRunId,
                    streamId,
                });
            }
            this.options.onError?.(err);
        } finally {
            this.finishOperation(controller);
        }
    }

    /** Resumes the active stream for the current conversation. */
    async resumeConversation(options?: { afterSeq?: number }): Promise<void> {
        const conversationId = this.options.conversationId;
        if (!conversationId) {
            console.warn("[better-agent] `resumeConversation()` requires `conversationId`.");
            return;
        }

        const { signal, controller } = this.startOperation();
        this.setStatus("submitted");
        this.setError(undefined);

        try {
            const events = this.client.resumeConversation(
                this.options.agent,
                {
                    conversationId,
                    ...(options?.afterSeq !== undefined ? { afterSeq: options.afterSeq } : {}),
                },
                {
                    signal,
                    onResponse: (response) => {
                        this.updateResponseIds(response);
                    },
                },
            );

            const result = await this.consumeStreamUntilTerminal(events, {
                signal,
                replay: true,
                disconnectMessage: "Resume stream disconnected.",
            });
            if (!result.receivedEvent) {
                this.setStatus("ready");
                return;
            }
            if (!result.terminalState) {
                throw this.toStreamDisconnectError(
                    undefined,
                    "Stream ended before terminal run event.",
                );
            }
            if (result.terminalState === "error") {
                throw result.terminalError ?? new Error("Resume failed.");
            }

            this.setStatus("ready");
            if (result.receivedEvent && result.terminalState) {
                this.emitFinish({
                    conversationId,
                    isAbort: result.terminalState === "aborted",
                });
            }
        } catch (e) {
            if (
                this.destroyed ||
                this.isAbortError(e, signal) ||
                (this.isStreamDisconnectError(e) && this.isPageTeardownLike())
            ) {
                this.setStatus("ready");
                return;
            }

            const err = toAgentClientError(e, "Resume failed.");
            this.setError(err);
            this.setStatus("error");
            if (this.isStreamDisconnectError(e)) {
                this.options.onDisconnect?.({
                    error: err,
                    runId: this.lastRunId,
                    streamId: this.lastStreamId,
                });
            }
            this.options.onError?.(err);
        } finally {
            this.finishOperation(controller);
        }
    }

    // Public mutations.

    /** Submits a tool approval decision. */
    async approveToolCall(params: ApproveToolCallParams): Promise<void> {
        const runId = params.runId ?? this.lastRunId;
        if (!runId) {
            throw new Error("Cannot submit tool approval response without a runId.");
        }

        await this.client.submitToolApproval({
            agent: this.options.agent,
            runId,
            toolCallId: params.toolCallId,
            decision: params.decision,
            ...(params.note !== undefined ? { note: params.note } : {}),
            ...(params.actorId !== undefined ? { actorId: params.actorId } : {}),
        });
    }

    /** Clears the current error. */
    clearError(): void {
        this.setError(undefined);
        this.setStatus("ready");
    }

    /** Resets local state to the initial snapshot. */
    reset(): void {
        this.cancelActiveWork();
        this.state = createMessageState(this.initialMessages);
        this.lastResponse = undefined;
        this.lastStructured = undefined;
        this.lastRunId = undefined;
        this.lastStreamId = this.getConfiguredInitialStreamId(this.options);
        this.error = undefined;
        this.status = "ready";
        this.lastAppliedSeq = -1;
        this.lastAppliedSeqByStream.clear();
        this.notify();
    }

    /** Replaces local messages. */
    setMessages(value: SetMessagesInput): void {
        const current = this.state.messages;
        const nextRaw = typeof value === "function" ? value(current) : value;
        const next = this.normalizeMessages(nextRaw);
        this.state = createMessageState(next);
        this.notify();
    }

    /** Merges new options into the controller configuration. */
    updateOptions(partial: Partial<AgentChatControllerOptions<TApp, TAgentName>>): void {
        const nextOptions = {
            ...this.options,
            ...partial,
            ...(partial.resume !== undefined &&
            typeof partial.resume === "object" &&
            partial.resume !== null
                ? {
                      resume: {
                          ...(typeof this.options.resume === "object" &&
                          this.options.resume !== null
                              ? this.options.resume
                              : {}),
                          ...partial.resume,
                      },
                  }
                : {}),
            ...(partial.optimisticUserMessage &&
            typeof partial.optimisticUserMessage === "object" &&
            !Array.isArray(partial.optimisticUserMessage)
                ? {
                      optimisticUserMessage: {
                          ...(typeof this.options.optimisticUserMessage === "object" &&
                          this.options.optimisticUserMessage !== null &&
                          !Array.isArray(this.options.optimisticUserMessage)
                              ? this.options.optimisticUserMessage
                              : {}),
                          ...partial.optimisticUserMessage,
                      },
                  }
                : {}),
        };

        const shouldResetSession = this.hasSessionConfigurationChanged(this.options, nextOptions);
        this.options = nextOptions;

        if (shouldResetSession) {
            this.resetForSessionChange();
        }
    }

    /** Destroys the controller. */
    destroy(): void {
        this.cancelActiveWork();
        this.destroyed = true;
        this.listeners.clear();
    }

    // Event handling.

    /** Applies one streamed event to local state. */
    private applyEvent(ev: ClientEvent, options?: { replay?: boolean }): void {
        this.options.onEvent?.(ev);

        // Deduplicates replayed cursors.
        const streamKey =
            typeof ev.streamId === "string" && ev.streamId.length > 0
                ? ev.streamId
                : typeof ev.runId === "string" && ev.runId.length > 0
                  ? ev.runId
                  : undefined;

        if (typeof ev.seq === "number") {
            if (streamKey) {
                const prev = this.lastAppliedSeqByStream.get(streamKey) ?? -1;
                if (ev.seq <= prev) return;
                this.lastAppliedSeqByStream.set(streamKey, ev.seq);
            } else {
                if (ev.seq <= this.lastAppliedSeq) return;
                this.lastAppliedSeq = ev.seq;
            }
        }

        // Tracks run and stream ids.
        if (typeof ev.runId === "string" && ev.runId.length > 0 && ev.runId !== this.lastRunId) {
            this.lastRunId = ev.runId;
        }

        if (ev.type === "RUN_FINISHED") {
            const result = (
                ev as unknown as {
                    result?: {
                        response?: GenerativeModelResponse;
                        structured?: DefaultStructuredOutputForAgent<TApp, TAgentName>;
                    };
                }
            ).result;
            this.lastResponse = result?.response;
            this.lastStructured = result?.structured;
        }

        if (ev.type === "DATA_PART") {
            const payload = {
                data: (ev as unknown as { data: unknown }).data,
                ...((ev as unknown as { id?: string }).id
                    ? { id: (ev as unknown as { id: string }).id }
                    : {}),
            };
            this.options.onData?.(payload);
        }

        if (ev.streamId && ev.streamId !== this.lastStreamId) {
            this.lastStreamId = ev.streamId;
        }

        if (options?.replay && ev.type === "RUN_STARTED") {
            this.reconcileReplayUserMessage(ev.runInput, ev.runId);
        }

        // Applies the event to message state.
        this.state = applyEvent(this.state, ev, {
            synthesizeReplayUserMessage: Boolean(options?.replay),
        });

        this.notify();
    }

    /** Reads streamed events until the stream finishes or a terminal event appears. */
    private async consumeStreamUntilTerminal(
        events: AsyncIterable<ClientEvent>,
        options: { signal: AbortSignal; replay?: boolean; disconnectMessage?: string },
    ): Promise<StreamConsumptionResult> {
        const result: StreamConsumptionResult = {
            receivedEvent: false,
        };

        try {
            for await (const event of events) {
                this.throwIfAborted(options.signal);
                result.receivedEvent = true;

                if (this.status !== "streaming") {
                    this.setStatus("streaming");
                }

                const terminal = this.getTerminalStateFromEvent(event);
                if (terminal) {
                    result.terminalState = terminal.state;
                    result.terminalError = terminal.error;
                }

                this.applyEvent(event, { replay: options.replay });
            }
        } catch (error) {
            if (this.isAbortError(error, options.signal)) {
                throw error;
            }
            throw this.toStreamDisconnectError(error, options.disconnectMessage);
        }

        this.throwIfAborted(options.signal);
        return result;
    }

    /** Reads terminal state from one streamed event. */
    private getTerminalStateFromEvent(
        event: ClientEvent,
    ): { state: StreamTerminalState; error?: AgentClientError } | undefined {
        if (event.type === "RUN_FINISHED") {
            return { state: "finished" };
        }
        if (event.type === "RUN_ABORTED") {
            return { state: "aborted" };
        }
        if (event.type === "RUN_ERROR") {
            return {
                state: "error",
                error: toAgentClientError(
                    (event as unknown as { error: unknown }).error,
                    getEventErrorMessage((event as unknown as { error: unknown }).error),
                ),
            };
        }

        return undefined;
    }

    // Submission flow.

    /** Sends one request through final or stream delivery. */
    private async submitWithInternalOptions(
        runInput: ControllerRunInput,
        internalOptions?: InternalSubmitOptions,
    ): Promise<SendResult> {
        const { signal, controller } = this.startOperation(internalOptions?.signal);
        this.setStatus("submitted");
        this.setError(undefined);
        const context = this.createSubmissionContext(runInput, internalOptions, signal);

        try {
            this.warnIfClientHistoryReplacesConversation(context);
            this.applyLocalSubmissionState(context);

            const requestInput = this.buildRequestInput(context);
            if (context.useFinalDelivery) {
                return await this.runFinalDelivery(context, requestInput);
            }

            return await this.runStreamDelivery(context, requestInput);
        } catch (e) {
            return this.handleSubmissionFailure(e, context);
        } finally {
            this.finishOperation(controller);
        }
    }

    /** Builds the mutable context for one submission. */
    private createSubmissionContext(
        runInput: ControllerRunInput,
        internalOptions: InternalSubmitOptions | undefined,
        signal: AbortSignal,
    ): SubmissionContext {
        return {
            signal,
            conversationId:
                typeof runInput.conversationId === "string"
                    ? runInput.conversationId
                    : this.options.conversationId,
            inputValue: runInput.input,
            sendClientHistory:
                typeof runInput.sendClientHistory === "boolean"
                    ? runInput.sendClientHistory
                    : Boolean(this.options.sendClientHistory),
            optimisticLocalId: internalOptions?.reuseOptimisticLocalId,
            optimisticMessageMarkedSent: false,
            optimisticConfig: normalizeOptimisticUserMessageConfig(
                this.options.optimisticUserMessage,
            ),
            preSubmitState: this.state,
            useFinalDelivery: Boolean(internalOptions?.forceRun) || !this.shouldUseStreamDelivery(),
            runInput,
            internalOptions,
        };
    }

    /** Warns when client history will replace stored server history. */
    private warnIfClientHistoryReplacesConversation(context: SubmissionContext): void {
        if (
            !context.sendClientHistory ||
            !context.conversationId ||
            context.internalOptions?.replaceLocalId ||
            this.warnedHistoryCombo
        ) {
            return;
        }

        this.warnedHistoryCombo = true;
        console.warn(
            "[better-agent] Using sendClientHistory with conversationId. Client history will replace server-stored history on each request. For server-managed history, remove sendClientHistory.",
        );
    }

    /** Applies retry replacement or optimistic user insertion. */
    private applyLocalSubmissionState(context: SubmissionContext): void {
        const replaceLocalId = context.internalOptions?.replaceLocalId;
        if (replaceLocalId) {
            this.replaceRetryMessage(
                replaceLocalId,
                context.internalOptions?.replaceMessage ?? context.inputValue,
            );
            context.optimisticLocalId = replaceLocalId;
            return;
        }

        if (context.optimisticLocalId || !context.optimisticConfig.enabled) {
            return;
        }

        const shouldInsertOptimisticMessage =
            (!context.sendClientHistory &&
                this.canOptimisticallyRenderUserTurn(context.inputValue)) ||
            (context.sendClientHistory &&
                this.canOmitSubmittedInputFromSerializedHistory(context.inputValue));
        if (!shouldInsertOptimisticMessage) {
            return;
        }

        const optimisticMessage = this.createPendingUserMessage(context.inputValue);
        if (!optimisticMessage) {
            return;
        }

        const optimisticLocalId = this.generateMessageId();
        context.optimisticLocalId = optimisticLocalId;
        this.state = createMessageState([
            ...this.state.messages,
            {
                ...optimisticMessage,
                localId: optimisticLocalId,
            },
        ]);
        this.notify();
    }

    /** Builds the request input for the next transport call. */
    private buildRequestInput(context: SubmissionContext): PreparedRequestInput {
        return this.prepareInputForRequest(context.inputValue, this.state.messages, {
            sendClientHistory: context.sendClientHistory,
            optimisticLocalId: context.optimisticLocalId,
            serializedHistoryInput: Boolean(context.internalOptions?.serializedHistoryInput),
        });
    }

    /** Runs one request through final delivery. */
    private async runFinalDelivery(
        context: SubmissionContext,
        requestInput: PreparedRequestInput,
    ): Promise<SendResult> {
        const result = await this.client.run(
            this.options.agent,
            this.createRunPayload(
                context.runInput,
                requestInput.inputToSend,
                requestInput.serializedClientHistory,
            ) as never,
            {
                onResponse: this.options.onResponse,
                signal: context.signal,
            },
        );
        const normalized = this.normalizeFinalRunResult(result);

        this.captureNormalizedRunResult(normalized);
        this.markOptimisticMessageSent(context);
        this.setStatus("ready");
        this.emitFinish({
            isAbort: false,
            conversationId: context.conversationId,
        });

        return {
            runId: normalized.runId,
            streamId: this.lastStreamId,
        };
    }

    /** Runs one request through streamed delivery. */
    private async runStreamDelivery(
        context: SubmissionContext,
        requestInput: PreparedRequestInput,
    ): Promise<SendResult> {
        const requestOptions = this.buildStreamRequestOptions(
            context.optimisticLocalId,
            () => {
                context.optimisticMessageMarkedSent = true;
            },
            context.signal,
        );
        const stream = this.client.stream(
            this.options.agent,
            this.createRunPayload(
                context.runInput,
                requestInput.inputToSend,
                requestInput.serializedClientHistory,
            ) as never,
            requestOptions,
        );
        const result = await this.consumeStreamUntilTerminal(stream, {
            signal: context.signal,
            disconnectMessage: "Stream disconnected.",
        });

        if (!result.terminalState) {
            throw this.toStreamDisconnectError(
                undefined,
                "Stream ended before terminal run event.",
            );
        }
        if (result.terminalState === "error") {
            throw result.terminalError ?? new Error("Run failed.");
        }

        this.setStatus("ready");
        this.emitFinish({
            isAbort: result.terminalState === "aborted",
            conversationId: context.conversationId,
        });
        return { streamId: this.lastStreamId };
    }

    /** Handles aborts, fallback-to-run, and terminal submission errors. */
    private async handleSubmissionFailure(
        error: unknown,
        context: SubmissionContext,
    ): Promise<SendResult> {
        if (
            this.destroyed ||
            this.isAbortError(error, context.signal) ||
            (this.isStreamDisconnectError(error) && this.isPageTeardownLike())
        ) {
            if (this.state !== context.preSubmitState && !context.optimisticMessageMarkedSent) {
                this.state = context.preSubmitState;
                this.notify();
            }
            if (!this.destroyed) {
                this.setStatus("ready");
            }
            return { streamId: this.lastStreamId };
        }

        let err = toAgentClientError(error, "Run failed.");
        if (!context.internalOptions?.forceRun && this.shouldFallbackToRun(err)) {
            try {
                return await this.submitWithInternalOptions(context.runInput, {
                    ...context.internalOptions,
                    forceRun: true,
                    reuseOptimisticLocalId: context.optimisticLocalId,
                });
            } catch (fallbackError) {
                err = toAgentClientError(fallbackError, "Run failed.");
            }
        }

        this.applyOptimisticFailure(context, err);
        this.setError(err);
        this.setStatus("error");
        if (this.isStreamDisconnectError(error)) {
            this.options.onDisconnect?.({
                error: err,
                ...(this.lastRunId ? { runId: this.lastRunId } : {}),
                ...(this.lastStreamId ? { streamId: this.lastStreamId } : {}),
            });
        }
        this.options.onError?.(err);
        return this.lastStreamId ? { streamId: this.lastStreamId } : {};
    }

    /** Marks the optimistic user message as sent after a successful request. */
    private markOptimisticMessageSent(context: SubmissionContext): void {
        if (!context.optimisticLocalId || context.optimisticMessageMarkedSent) {
            return;
        }

        this.updateMessageByLocalId(context.optimisticLocalId, (msg) => {
            const { error: _error, ...rest } = msg;
            return { ...rest, status: "sent" };
        });
        context.optimisticMessageMarkedSent = true;
    }

    /** Applies optimistic-message failure handling. */
    private applyOptimisticFailure(context: SubmissionContext, err: AgentClientError): void {
        if (!context.optimisticLocalId) {
            return;
        }

        if (context.optimisticConfig.onError === "remove") {
            this.removeMessageByLocalId(context.optimisticLocalId);
            return;
        }

        const failed = this.updateMessageByLocalId(context.optimisticLocalId, (msg) => ({
            ...msg,
            status: "failed",
            error: err.message,
        }));
        if (failed) {
            this.options.onOptimisticUserMessageError?.({
                message: failed,
                error: err,
            });
        }
    }

    /** Stores the latest run result from final delivery. */
    private captureNormalizedRunResult(result: {
        runId?: string;
        response?: GenerativeModelResponse;
        structured?: unknown;
    }): void {
        if (result.runId) {
            this.lastRunId = result.runId;
        }
        if (result.response) {
            this.lastResponse = result.response;
            this.appendResponseMessages(result.response);
        }
        this.lastStructured = result.structured as
            | DefaultStructuredOutputForAgent<TApp, TAgentName>
            | undefined;
    }

    // Operation state.
    private setStatus(status: AgentStatus): void {
        if (this.status === status) return;
        this.status = status;
        this.notify();
    }

    /** Stores the latest controller error without notifying listeners. */
    private setError(error: AgentClientError | undefined): void {
        this.error = error;
    }

    /** Normalizes unknown failures into an `Error` with a fallback message. */
    private toError(error: unknown, fallback: string): Error {
        return error instanceof Error ? error : new Error(fallback);
    }

    /** Starts one controller operation. */
    private startOperation(externalSignal?: AbortSignal): {
        signal: AbortSignal;
        controller: AbortController;
    } {
        this.throwIfDestroyed();
        this.cancelActiveWork();
        const controller = new AbortController();
        this.activeAbortController = controller;
        return {
            controller,
            signal: this.mergeSignals(controller.signal, externalSignal),
        };
    }

    /** Clears the tracked active operation if it matches the provided controller. */
    private finishOperation(controller: AbortController): void {
        if (this.activeAbortController === controller) {
            this.activeAbortController = null;
        }
    }

    /** Aborts and forgets any in-flight controller operation. */
    private cancelActiveWork(): void {
        this.activeAbortController?.abort();
        this.activeAbortController = null;
    }

    /** Merges the controller abort signal with an optional external signal. */
    private mergeSignals(primary: AbortSignal, externalSignal?: AbortSignal): AbortSignal {
        if (!externalSignal) {
            return primary;
        }

        const controller = new AbortController();
        const abortFrom = (source: AbortSignal) => {
            if (!controller.signal.aborted) {
                controller.abort(source.reason);
            }
        };

        if (primary.aborted) {
            abortFrom(primary);
        } else {
            primary.addEventListener("abort", () => abortFrom(primary), { once: true });
        }

        if (externalSignal.aborted) {
            abortFrom(externalSignal);
        } else {
            externalSignal.addEventListener("abort", () => abortFrom(externalSignal), {
                once: true,
            });
        }

        return controller.signal;
    }

    /** Throws an abort-shaped error when the given signal has already aborted. */
    private throwIfAborted(signal: AbortSignal): void {
        if (signal.aborted) {
            throw this.toAbortError(signal.reason);
        }
    }

    /** Rejects work after the controller has been destroyed. */
    private throwIfDestroyed(): void {
        if (this.destroyed) {
            throw new Error("AgentChatController has been destroyed.");
        }
    }

    /** Returns `true` when a failure should be treated as an abort. */
    private isAbortError(error: unknown, signal?: AbortSignal): boolean {
        return (
            (signal?.aborted ?? false) ||
            (error instanceof DOMException && error.name === "AbortError") ||
            (error instanceof Error && error.name === "AbortError")
        );
    }

    /** Returns true when a failure came from stream disconnection. */
    private isStreamDisconnectError(error: unknown): error is StreamDisconnectError {
        return error instanceof StreamDisconnectError;
    }

    /** Returns true when the page is being torn down during navigation or refresh. */
    private isPageTeardownLike(): boolean {
        return (
            isBrowserPageTearingDown() ||
            (typeof document !== "undefined" && document.visibilityState === "hidden")
        );
    }

    /** Converts an abort reason into a standard `AbortError` instance. */
    private toAbortError(reason?: unknown): Error {
        if (reason instanceof Error) {
            return reason;
        }

        try {
            return new DOMException(
                typeof reason === "string" ? reason : "The operation was aborted.",
                "AbortError",
            );
        } catch {
            const error = new Error(
                typeof reason === "string" ? reason : "The operation was aborted.",
            );
            error.name = "AbortError";
            return error;
        }
    }

    /** Wraps one failure as a stream disconnect. */
    private toStreamDisconnectError(
        error: unknown,
        fallback = "Stream disconnected.",
    ): StreamDisconnectError {
        const base = this.toError(error, fallback);
        return new StreamDisconnectError(base.message, error);
    }

    // Message state.

    /** Binds an already-visible current user turn to the replay run identity. */
    private reconcileReplayUserMessage(runInput: Record<string, unknown>, runId: string): void {
        const latestMessage = this.state.messages.at(-1);
        if (!latestMessage || latestMessage.role !== "user") {
            return;
        }

        const replayMessage = this.toReplayUserMessage(runInput, runId);
        if (!replayMessage || this.state.byLocalId.has(replayMessage.localId)) {
            return;
        }

        if (!this.isSameUserTurn(latestMessage, replayMessage)) {
            return;
        }

        const nextMessages = this.state.messages.slice();
        nextMessages[nextMessages.length - 1] = {
            ...latestMessage,
            localId: replayMessage.localId,
            ...(replayMessage.id !== undefined ? { id: replayMessage.id } : {}),
            status: "sent",
        };
        this.state = createMessageState(nextMessages);
    }

    /** Reconstructs the replayed current user turn from one RUN_STARTED event. */
    private toReplayUserMessage(
        runInput: Record<string, unknown>,
        runId: string,
    ): UIMessage | undefined {
        const input = runInput.input;

        if (typeof input === "string") {
            return {
                localId: `user_run:${runId}`,
                id: `user_run:${runId}`,
                role: "user",
                parts: [{ type: "text", text: input, state: "complete" }],
                status: "sent",
            };
        }

        const replayInput = Array.isArray(input)
            ? input
            : this.isSingleReplayMessageInput(input)
              ? [input]
              : undefined;
        if (!replayInput) {
            return undefined;
        }

        let index = 0;
        const replayMessages = fromModelMessages(replayInput as GenerativeModelInputItem[], {
            generateId: () => `user_run:${runId}:${(index++).toString(36)}`,
        });
        const latestUserMessage = [...replayMessages]
            .reverse()
            .find((message) => message.role === "user");

        return latestUserMessage ? { ...latestUserMessage, status: "sent" } : undefined;
    }

    /** Detects one structured replay message item. */
    private isSingleReplayMessageInput(input: unknown): input is {
        type: "message";
        role?: string;
        content: string | unknown[];
    } {
        return (
            typeof input === "object" &&
            input !== null &&
            (input as { type?: unknown }).type === "message" &&
            (typeof (input as { content?: unknown }).content === "string" ||
                Array.isArray((input as { content?: unknown }).content))
        );
    }

    /** Matches one already-visible user turn to its replayed equivalent. */
    private isSameUserTurn(current: UIMessage, replayed: UIMessage): boolean {
        return JSON.stringify(current.parts) === JSON.stringify(replayed.parts);
    }

    /** Generates a local message id using the configured factory when present. */
    private generateMessageId(message?: Partial<UIMessageInput>): string {
        return this.options.generateMessageId?.(message) ?? makeLocalMessageId();
    }

    /** Ensures every incoming UI message has a stable local id. */
    private normalizeMessages(list: UIMessageInput[]): UIMessage[] {
        return list.map((message) => ({
            ...message,
            localId: message.localId ?? this.generateMessageId(message),
        }));
    }

    /** Detects option changes that require resetting conversation session state. */
    private hasSessionConfigurationChanged(
        prev: AgentChatControllerOptions<TApp, TAgentName>,
        next: AgentChatControllerOptions<TApp, TAgentName>,
    ): boolean {
        return (
            prev.agent !== next.agent ||
            prev.conversationId !== next.conversationId ||
            prev.hydrateFromServer !== next.hydrateFromServer ||
            Boolean(prev.resume) !== Boolean(next.resume) ||
            (typeof prev.resume === "object" ? prev.resume.streamId : undefined) !==
                (typeof next.resume === "object" ? next.resume.streamId : undefined) ||
            (typeof prev.resume === "object" ? prev.resume.afterSeq : undefined) !==
                (typeof next.resume === "object" ? next.resume.afterSeq : undefined)
        );
    }

    /** Resets controller state after a session-defining option changes. */
    private resetForSessionChange(): void {
        this.cancelActiveWork();
        const normalized = this.normalizeMessages(this.options.initialMessages ?? []);
        this.state = createMessageState(normalized);
        this.initialMessages = normalized;
        this.lastResponse = undefined;
        this.lastStructured = undefined;
        this.lastRunId = undefined;
        this.lastStreamId = this.getConfiguredInitialStreamId(this.options);
        this.error = undefined;
        this.status = "ready";
        this.lastAppliedSeq = -1;
        this.lastAppliedSeqByStream.clear();
        this.warnedHistoryCombo = false;
        this.initialized = false;
        this.notify();
        this.init();
    }

    /** Reads the initial resume stream id from controller options. */
    private getConfiguredInitialStreamId(options: { resume?: ResumeOption }): string | undefined {
        return typeof options.resume === "object" && options.resume !== null
            ? options.resume.streamId
            : undefined;
    }

    /** Returns one message by local id from the current message state. */
    private getMessageByLocalId(localId: string): UIMessage | undefined {
        const idx = this.state.byLocalId.get(localId);
        return idx === undefined ? undefined : this.state.messages[idx];
    }

    /** Updates one message by local id and notifies listeners when found. */
    private updateMessageByLocalId(
        localId: string,
        updater: (msg: UIMessage) => UIMessage,
    ): UIMessage | undefined {
        const idx = this.state.byLocalId.get(localId);
        if (idx === undefined) return undefined;
        const current = this.state.messages[idx];
        if (!current) return undefined;
        const next = this.state.messages.slice();
        next[idx] = updater(current);
        this.state = createMessageState(next);
        this.notify();
        return next[idx];
    }

    /** Removes one local message from state and notifies listeners. */
    private removeMessageByLocalId(localId: string): void {
        const idx = this.state.byLocalId.get(localId);
        if (idx === undefined) return;
        const next = this.state.messages.filter((msg) => msg.localId !== localId);
        this.state = createMessageState(next);
        this.notify();
    }

    // Request building.

    /** Resolves the effective delivery mode for the next submission. */
    private shouldUseStreamDelivery(): boolean {
        if (this.options.delivery === "stream") return true;
        if (this.options.delivery === "final") return false;
        return true; // `auto` defaults to streaming.
    }

    /** Detects stream capability errors that should retry through `run()`. */
    private shouldFallbackToRun(error: AgentClientError): boolean {
        if (this.options.delivery !== "auto") return false;
        const message = error.message.toLowerCase();
        return (
            message.includes("does not support streaming generation") ||
            message.includes("streaming generation is not supported") ||
            message.includes("streaming is not supported")
        );
    }

    /** Appends model response messages to local state after final delivery. */
    private appendResponseMessages(response: GenerativeModelResponse): void {
        const responseMessages = getMessagesFromResponse(response).map((msg, i) => ({
            ...msg,
            localId: this.generateMessageId(msg),
            ...(msg.id ? {} : { id: `response_${i.toString(36)}` }),
        }));

        if (responseMessages.length === 0) return;
        const nextMessages = [...this.state.messages, ...responseMessages];
        this.state = createMessageState(nextMessages);
        this.notify();
    }

    /** Normalizes supported final-run response shapes into one controller shape. */
    private normalizeFinalRunResult(payload: unknown): {
        runId?: string;
        response?: GenerativeModelResponse;
        structured?: unknown;
    } {
        if (typeof payload !== "object" || payload === null) return {};

        const record = payload as Record<string, unknown>;
        const next: { runId?: string; response?: GenerativeModelResponse; structured?: unknown } =
            {};

        if (typeof record.runId === "string") next.runId = record.runId;

        const nestedResponse =
            typeof record.result === "object" &&
            record.result !== null &&
            typeof (record.result as { response?: unknown }).response === "object" &&
            (record.result as { response?: unknown }).response !== null
                ? ((record.result as { response: GenerativeModelResponse })
                      .response as GenerativeModelResponse)
                : undefined;

        const maybeResponse =
            nestedResponse ??
            (typeof record.response === "object" && record.response !== null
                ? (record.response as GenerativeModelResponse)
                : "output" in record && Array.isArray(record.output)
                  ? (record as unknown as GenerativeModelResponse)
                  : undefined);

        if (maybeResponse) next.response = maybeResponse;
        if ("structured" in record) next.structured = record.structured;
        return next;
    }

    /** Builds the input payload, optionally serializing client history into it. */
    private prepareInputForRequest(
        inputValue: unknown,
        baseMessages: UIMessage[],
        options: {
            sendClientHistory: boolean;
            optimisticLocalId?: string;
            serializedHistoryInput: boolean;
        },
    ): {
        inputToSend: unknown;
        serializedClientHistory: boolean;
    } {
        if (!options.sendClientHistory) {
            return { inputToSend: inputValue, serializedClientHistory: false };
        }

        if (options.serializedHistoryInput) {
            return {
                inputToSend: inputValue,
                serializedClientHistory: true,
            };
        }

        const preparedMessages = this.options.prepareMessages?.({
            messages: baseMessages,
            input: inputValue,
        });
        if (preparedMessages) {
            return {
                inputToSend: preparedMessages,
                serializedClientHistory: true,
            };
        }

        const serializedMessages = toModelMessages(baseMessages);
        const inputItems = this.normalizeInputItems(inputValue);

        if (typeof inputValue === "string") {
            return {
                inputToSend: options.optimisticLocalId
                    ? serializedMessages
                    : [
                          ...serializedMessages,
                          { type: "message", role: "user", content: inputValue },
                      ],
                serializedClientHistory: true,
            };
        }

        if (inputItems) {
            return {
                inputToSend:
                    options.optimisticLocalId &&
                    this.canOmitSubmittedInputFromSerializedHistory(inputValue)
                        ? serializedMessages
                        : [...serializedMessages, ...inputItems],
                serializedClientHistory: true,
            };
        }

        return {
            inputToSend: inputValue,
            serializedClientHistory: false,
        };
    }

    /** Builds the run payload for one request. */
    private createRunPayload(
        runInput: ControllerRunInput,
        inputToSend: unknown,
        serializedClientHistory: boolean,
    ): Record<string, unknown> {
        const conversationId =
            typeof runInput.conversationId === "string"
                ? runInput.conversationId
                : this.options.conversationId;
        const modelOptions = mergeModelOptions(
            this.options.modelOptions as Record<string, unknown> | undefined,
            runInput.modelOptions as Record<string, unknown> | undefined,
        );
        const { modelOptions: _modelOptions, ...restRunInput } = runInput;

        return {
            ...restRunInput,
            input: inputToSend,
            modelOptions: Object.keys(modelOptions).length > 0 ? modelOptions : undefined,
            conversationId,
            context:
                runInput.context !== undefined || this.options.context !== undefined
                    ? (runInput.context ?? this.options.context)
                    : undefined,
            replaceHistory: serializedClientHistory && Boolean(conversationId) ? true : undefined,
        };
    }

    // Input normalization.

    /** Builds stream request hooks for ids, callbacks, and optimistic updates. */
    private buildStreamRequestOptions(
        optimisticLocalId: string | undefined,
        onMarkedSent: () => void,
        signal?: AbortSignal,
    ): Record<string, unknown> | undefined {
        const hasCallbacks =
            this.options.onResponse || this.options.onToolCall || this.options.toolHandlers;
        if (!hasCallbacks && !optimisticLocalId && !signal) return undefined;

        return {
            signal,
            onResponse: (response: Response) => {
                this.updateResponseIds(response);
                this.options.onResponse?.(response);
                if (response.ok && optimisticLocalId) {
                    this.updateMessageByLocalId(optimisticLocalId, (msg) => {
                        const { error: _error, ...rest } = msg;
                        return { ...rest, status: "sent" };
                    });
                    onMarkedSent();
                }
            },
            onToolCall: this.options.onToolCall,
            toolHandlers: this.options.toolHandlers,
        };
    }

    /** Replaces one user message slot with a pending retry version. */
    private replaceRetryMessage(replaceLocalId: string, inputValue: unknown): void {
        const current = this.state.messages;
        const idx = this.state.byLocalId.get(replaceLocalId);
        const nextMessage = this.createPendingUserMessage(inputValue) ?? {
            localId: replaceLocalId,
            role: "user",
            parts: [{ type: "text", text: String(inputValue ?? "") }],
            status: "pending",
        };

        let nextMessages = current;
        if (idx === undefined) {
            nextMessages = [...current, nextMessage];
        } else {
            const copy = current.slice(0, idx);
            copy.push(nextMessage);
            nextMessages = copy;
        }

        if (nextMessages !== current) {
            this.state = createMessageState(nextMessages);
            this.notify();
        }
    }

    /** Derives a pending user message from retry input when possible. */
    private createPendingUserMessage(inputValue: unknown): UIMessage | undefined {
        if (typeof inputValue === "string") {
            return {
                localId: this.generateMessageId(),
                role: "user",
                parts: [{ type: "text", text: inputValue }],
                status: "pending",
            };
        }

        if (typeof inputValue === "object" && inputValue !== null && "localId" in inputValue) {
            const message = inputValue as UIMessage;
            if (message.role === "user" && Array.isArray(message.parts)) {
                const { error: _error, ...rest } = message;
                return {
                    ...rest,
                    status: "pending",
                };
            }
        }

        const items = this.normalizeInputItems(inputValue);
        if (!items) {
            return undefined;
        }

        const messages = fromModelMessages(items);
        const latestUser = [...messages].reverse().find((message) => message.role === "user");
        if (!latestUser) {
            return undefined;
        }

        const { error: _error, ...rest } = latestUser;
        return {
            ...rest,
            status: "pending",
        };
    }

    /** Normalizes supported input shapes into input items when possible. */
    private normalizeInputItems(inputValue: unknown): GenerativeModelInputItem[] | undefined {
        if (Array.isArray(inputValue)) {
            return inputValue as GenerativeModelInputItem[];
        }

        if (
            typeof inputValue === "object" &&
            inputValue !== null &&
            typeof (inputValue as { type?: unknown }).type === "string"
        ) {
            return [inputValue as GenerativeModelInputItem];
        }

        return undefined;
    }

    /** Returns true when input is safely representable as one optimistic user turn. */
    private canOptimisticallyRenderUserTurn(inputValue: unknown): boolean {
        if (typeof inputValue === "string") {
            return true;
        }

        if (typeof inputValue === "object" && inputValue !== null && "localId" in inputValue) {
            const message = inputValue as UIMessage;
            return message.role === "user" && Array.isArray(message.parts);
        }

        const items = this.normalizeInputItems(inputValue);
        if (!items || items.length !== 1) {
            return false;
        }

        const [item] = items;
        return item?.type === "message" && (item.role === undefined || item.role === "user");
    }

    /** Returns true when serialized history can reuse the optimistic user turn. */
    private canOmitSubmittedInputFromSerializedHistory(inputValue: unknown): boolean {
        if (typeof inputValue === "string") {
            return true;
        }

        if (typeof inputValue === "object" && inputValue !== null && "localId" in inputValue) {
            const message = inputValue as UIMessage;
            return message.role === "user" && Array.isArray(message.parts);
        }

        const items = this.normalizeInputItems(inputValue);
        if (!items || items.length !== 1) {
            return false;
        }

        const [item] = items;
        return item?.type === "message" && item.role === "user";
    }

    // Callback emission.

    /** Calls `onFinish` with the latest completion data. */
    private emitFinish(overrides: {
        streamId?: string;
        conversationId?: string;
        isAbort: boolean;
    }): void {
        const response = this.lastResponse;
        const params = {
            messages: this.state.messages,
            isAbort: overrides.isAbort,
        } as OnFinishParams<TApp, TAgentName>;

        if (this.lastRunId) {
            params.runId = this.lastRunId;
        }

        const streamIdToUse = overrides.streamId ?? this.lastStreamId;
        if (streamIdToUse) {
            params.streamId = streamIdToUse;
        }

        const conversationId = overrides.conversationId ?? this.options.conversationId;
        if (conversationId) {
            params.conversationId = conversationId;
        }

        if (response) {
            params.response = response;
            params.finishReason = response.finishReason;
            params.usage = response.usage;
        }

        if (this.lastStructured !== undefined) {
            (params as OnFinishParams<TApp, TAgentName> & { structured: unknown }).structured =
                this.lastStructured;
        }

        this.options.onFinish?.(params);
    }
}

/**
 * Creates an `AgentChatController`.
 */
export function createAgentChatController<
    TApp,
    TAgentName extends AgentNameFromApp<TApp> = AgentNameFromApp<TApp>,
>(
    client: BetterAgentClient<TApp>,
    options: AgentChatControllerOptions<TApp, TAgentName>,
): AgentChatController<TApp, TAgentName> {
    return new AgentChatController<TApp, TAgentName>(client, options);
}
