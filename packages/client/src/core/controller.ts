import type { AgentEvent, RuntimeInterrupt } from "@better-agent/core";
import { EventType, RuntimeInterruptReason } from "@better-agent/core";
import { createRuntimeStateControl } from "@better-agent/core/runtime";
import type { AgentStreamResume, UIMessage } from "../types";
import type {
    AgentControllerFinish,
    AgentControllerLifecycleHooks,
    AgentControllerOptions,
    AgentControllerSnapshot,
    AgentControllerStatus,
    AgentMessageInput,
    BetterAgentClientAgentHandle,
    BetterAgentClientAgentMemoryHandle,
    PendingClientTool,
    PendingToolApproval,
    SendOptions,
} from "../types";
import { fromAgentMessages, toAgentMessages } from "../ui/convert";
import { createUserUIMessage } from "../ui/messages";
import { applyUIEvent, createUIReducerState } from "../ui/reducer";
import { ensureBrowserTeardownTracking, isBrowserPageTearingDown } from "./browser-lifecycle";
import { BetterAgentClientError, toBetterAgentClientError } from "./errors";
import type { AgentNameOf } from "./inference";

type ClientToolInterrupt = RuntimeInterrupt & {
    reason: typeof RuntimeInterruptReason.ClientToolPending;
    toolCallId: string;
};

type ApprovalInterrupt = RuntimeInterrupt & {
    reason: typeof RuntimeInterruptReason.ToolApprovalPending;
    toolCallId: string;
};

type ResumeEntry = {
    interruptId: string;
    status: "resolved" | "cancelled";
    payload?: unknown;
};

export class AgentController<TApp, TName extends AgentNameOf<TApp>> {
    private messages: UIMessage[];
    private stateControl: ReturnType<typeof createRuntimeStateControl<unknown>>;
    private status: AgentControllerStatus = "ready";
    private error: BetterAgentClientError | undefined;
    private runId: string | undefined;
    private threadId: string | undefined;
    private pendingClientTools: PendingClientTool[] = [];
    private pendingToolApprovals: PendingToolApproval[] = [];
    private stateRevision = 0;
    private snapshot: AgentControllerSnapshot;
    private listeners = new Set<() => void>();
    private activeAbortController: AbortController | undefined;
    private finishMessageStartIndex = 0;
    private stopRequested = false;
    private stopWaitTimer: ReturnType<typeof setTimeout> | undefined;
    private abortRequestedRunId: string | undefined;
    private started = false;

    constructor(
        private readonly agent: BetterAgentClientAgentHandle<TApp, TName>,
        private readonly options: AgentControllerOptions<TApp, TName>,
    ) {
        ensureBrowserTeardownTracking();
        this.messages = options.initialMessages ?? [];
        this.stateControl = createRuntimeStateControl(options.initialState);
        this.threadId = options.threadId;
        this.runId = options.initialInterruptState?.runId;
        this.pendingClientTools = [...(options.initialInterruptState?.pendingClientTools ?? [])];
        this.pendingToolApprovals = [
            ...(options.initialInterruptState?.pendingToolApprovals ?? []),
        ];
        this.status =
            options.initialInterruptState?.status ??
            (this.pendingClientTools.length > 0 || this.pendingToolApprovals.length > 0
                ? "interrupted"
                : "ready");

        for (const approval of this.pendingToolApprovals) {
            this.updateToolCallPart(approval.toolCallId, {
                state: "approval-requested",
                approval: {
                    interruptId: approval.interruptId,
                    needsApproval: true,
                    ...(approval.metadata ? { metadata: approval.metadata } : {}),
                },
            });
        }

        this.snapshot = this.createSnapshot();
    }

    start(): void {
        if (this.started) {
            return;
        }
        this.started = true;

        const shouldAutoHydrateThread =
            this.threadId && this.options.initialMessages === undefined && "memory" in this.agent;

        if (this.options.resume) {
            void (async () => {
                try {
                    if (shouldAutoHydrateThread) {
                        await this.loadMessages(this.threadId, {
                            beforeRunId: this.options.resume?.runId,
                        });
                    }
                    await this.resume(this.options.resume);
                } catch {}
            })();
        } else if (this.pendingClientTools.length > 0 && !this.hasUndecidedApprovals()) {
            void this.runPendingInterruptsWithLifecycle();
        } else if (shouldAutoHydrateThread && this.threadId) {
            void this.loadThread(this.threadId).catch(() => {});
        }
    }

    getSnapshot(): AgentControllerSnapshot {
        return this.snapshot;
    }

    private createSnapshot(): AgentControllerSnapshot {
        return {
            messages: this.messages,
            state: this.stateControl.get(),
            status: this.status,
            error: this.error,
            runId: this.runId,
            threadId: this.threadId,
            isRunning: this.status === "submitted" || this.status === "streaming",
            pendingClientTools: this.pendingClientTools,
            pendingToolApprovals: this.getPendingToolApprovalsSnapshot(),
        };
    }

    private getPendingToolApprovalsSnapshot(): PendingToolApproval[] {
        return this.pendingToolApprovals.filter((approval) => approval.approved === undefined);
    }

    private isClientToolInterrupt(
        interrupt: RuntimeInterrupt | undefined,
    ): interrupt is ClientToolInterrupt {
        return Boolean(
            interrupt?.reason === RuntimeInterruptReason.ClientToolPending && interrupt.toolCallId,
        );
    }

    private isApprovalInterrupt(
        interrupt: RuntimeInterrupt | undefined,
    ): interrupt is ApprovalInterrupt {
        return Boolean(
            interrupt?.reason === RuntimeInterruptReason.ToolApprovalPending &&
                interrupt.toolCallId,
        );
    }

    private getToolCallPart(toolCallId: string) {
        for (const message of this.messages) {
            const part = message.parts.find(
                (
                    candidate,
                ): candidate is Extract<UIMessage["parts"][number], { type: "tool-call" }> =>
                    candidate.type === "tool-call" && candidate.toolCallId === toolCallId,
            );

            if (part) {
                return part;
            }
        }

        return undefined;
    }

    private combineAbortSignals(primary: AbortSignal, secondary?: AbortSignal | null): AbortSignal {
        if (!secondary) {
            return primary;
        }

        return AbortSignal.any([primary, secondary]);
    }

    private hasUndecidedApprovals(): boolean {
        return this.pendingToolApprovals.some((approval) => approval.approved === undefined);
    }

    subscribe(listener: () => void): () => void {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    }

    setMessages(messages: UIMessage[]): void {
        this.messages = messages;
        this.notify();
    }

    async loadMessages(
        threadId = this.threadId,
        options?: { beforeRunId?: string },
    ): Promise<void> {
        if (!threadId) {
            throw new BetterAgentClientError("Cannot load messages without a threadId.");
        }
        const memory =
            "memory" in this.agent
                ? (this.agent as BetterAgentClientAgentMemoryHandle).memory
                : undefined;
        if (!memory) {
            throw new BetterAgentClientError("Agent memory is not available.");
        }

        try {
            const messages = await memory.messages.list(threadId, options);
            this.threadId = threadId;
            this.messages = fromAgentMessages(
                messages.map((message) => {
                    const {
                        threadId: _threadId,
                        runId: _runId,
                        createdAt: _createdAt,
                        ...rest
                    } = message;
                    return rest;
                }),
            );

            for (const approval of this.pendingToolApprovals) {
                this.updateToolCallPart(approval.toolCallId, {
                    state: "approval-requested",
                    approval: {
                        interruptId: approval.interruptId,
                        needsApproval: true,
                        ...(approval.metadata ? { metadata: approval.metadata } : {}),
                    },
                });
            }

            this.error = undefined;
            this.notify();
        } catch (error) {
            this.error = toBetterAgentClientError(error);
            this.status = "error";
            this.notify();
            throw this.error;
        }
    }

    private async loadThread(threadId: string): Promise<void> {
        const memory =
            "memory" in this.agent
                ? (this.agent as BetterAgentClientAgentMemoryHandle).memory
                : undefined;
        if (!memory) {
            throw new BetterAgentClientError("Agent memory is not available.");
        }

        const runtime = await memory.threads.runtime(threadId);
        if (runtime.resumable) {
            await this.loadMessages(threadId, { beforeRunId: runtime.resumable.runId });
            await this.resume(runtime.resumable);
            return;
        }

        await this.loadMessages(threadId);

        if (runtime.interrupted) {
            this.hydrateInterrupts(runtime.interrupted.runId, runtime.interrupted.interrupts);
            if (this.pendingClientTools.length > 0 && !this.hasUndecidedApprovals()) {
                await this.runPendingInterruptsWithLifecycle();
            }
        }
    }

    private hydrateInterrupts(runId: string, interrupts: RuntimeInterrupt[]): void {
        const approvalInterrupts = interrupts.filter((interrupt): interrupt is ApprovalInterrupt =>
            this.isApprovalInterrupt(interrupt),
        );
        const clientToolInterrupts = interrupts.filter(
            (interrupt): interrupt is ClientToolInterrupt => this.isClientToolInterrupt(interrupt),
        );

        const approvals: PendingToolApproval[] = [];
        for (const interrupt of approvalInterrupts) {
            const pending = this.createPendingApproval(runId, interrupt);
            if ("isError" in pending) {
                return;
            }
            approvals.push(pending);
            this.updateToolCallPart(interrupt.toolCallId, {
                state: "approval-requested",
                approval: {
                    interruptId: interrupt.id,
                    needsApproval: true,
                    ...(interrupt.metadata ? { metadata: interrupt.metadata } : {}),
                },
            });
        }

        const clientTools: PendingClientTool[] = [];
        for (const interrupt of clientToolInterrupts) {
            const pending = this.createPendingClientTool(runId, interrupt);
            if ("isError" in pending) {
                return;
            }
            clientTools.push(pending);
        }

        this.runId = runId;
        this.pendingToolApprovals = approvals;
        this.pendingClientTools = clientTools;
        this.status = "interrupted";
        this.error = undefined;
        this.notify();
    }

    async selectThread(threadId: string): Promise<void> {
        this.stop();
        await this.loadThread(threadId);
    }

    clearThread(): void {
        this.stop();
        this.messages = [];
        this.threadId = undefined;
        this.runId = undefined;
        this.error = undefined;
        this.pendingClientTools = [];
        this.pendingToolApprovals = [];
        this.status = "ready";
        this.notify();
    }

    private clearStopWaitTimer(): void {
        if (this.stopWaitTimer) {
            clearTimeout(this.stopWaitTimer);
            this.stopWaitTimer = undefined;
        }
    }

    private resetStopRequest(): void {
        this.stopRequested = false;
        this.abortRequestedRunId = undefined;
        this.clearStopWaitTimer();
    }

    private abortServerRun(runId: string): void {
        if (this.abortRequestedRunId === runId) {
            return;
        }

        this.abortRequestedRunId = runId;
        void this.agent.runs.abort(runId).catch((error: unknown) => {
            console.error("[better-agent] abortRun failed", error);
        });
    }

    private abortActiveRequest(): void {
        this.activeAbortController?.abort();
        this.activeAbortController = undefined;
    }

    stop(): void {
        this.stopRequested = true;
        const runId = this.runId;
        if (runId) {
            this.clearStopWaitTimer();
            this.abortServerRun(runId);
            this.abortActiveRequest();
        } else if (this.activeAbortController && !this.stopWaitTimer) {
            const activeAbortController = this.activeAbortController;
            this.stopWaitTimer = setTimeout(() => {
                if (this.stopRequested && this.activeAbortController === activeAbortController) {
                    this.abortActiveRequest();
                }
                this.clearStopWaitTimer();
            }, 2000);
        }

        if (this.status !== "ready") {
            this.status = "ready";
            this.notify();
        }
    }

    private safeLifecycle(name: string, fn: () => void | Promise<void>): void {
        try {
            const result = fn();
            if (
                result !== undefined &&
                typeof result === "object" &&
                "then" in result &&
                typeof (result as Promise<void>).then === "function"
            ) {
                void (result as Promise<void>).catch((err: unknown) => {
                    console.error(`[better-agent] ${name} callback failed`, err);
                });
            }
        } catch (err) {
            console.error(`[better-agent] ${name} callback failed`, err);
        }
    }

    private emitEvent(hooks: AgentControllerLifecycleHooks, event: AgentEvent): void {
        const onEvent = hooks.onEvent;
        if (!onEvent) {
            return;
        }
        this.safeLifecycle("onEvent", () => onEvent(event));
    }

    private invokeLifecycleFinish(
        hooks: AgentControllerLifecycleHooks,
        finish: AgentControllerFinish,
    ): void {
        this.safeLifecycle("onFinish", () => hooks.onFinish?.(finish));
        const error = finish.error;
        if (finish.isError && error) {
            const onError = hooks.onError;
            if (onError) {
                this.safeLifecycle("onError", () => onError(error));
            }
        }
    }

    private createFinish(
        finish: Pick<
            AgentControllerFinish,
            "isAbort" | "isDisconnect" | "isError" | "isInterrupted"
        > &
            Pick<AgentControllerFinish, "error" | "interruptReason"> & {
                pendingClientTools?: PendingClientTool[];
                pendingToolApprovals?: PendingToolApproval[];
            },
    ): AgentControllerFinish {
        const messages = [...this.messages];
        const generatedMessages = messages.slice(this.finishMessageStartIndex);
        const message = generatedMessages[generatedMessages.length - 1];
        return {
            ...(message ? { message } : {}),
            generatedMessages,
            messages,
            runId: this.runId,
            threadId: this.threadId,
            pendingClientTools: finish.pendingClientTools ?? [...this.pendingClientTools],
            pendingToolApprovals:
                finish.pendingToolApprovals ?? this.getPendingToolApprovalsSnapshot(),
            ...finish,
        };
    }

    async sendMessage(
        input: AgentMessageInput,
        sendOptions?: SendOptions<TApp, TName>,
    ): Promise<void> {
        const hooks = {
            onEvent: this.options.onEvent,
            onFinish: this.options.onFinish,
            onError: this.options.onError,
        };
        let terminal: AgentControllerFinish | undefined;

        this.stop();
        this.resetStopRequest();
        this.error = undefined;
        this.pendingClientTools = [];
        this.pendingToolApprovals = [];
        this.status = "submitted";
        const inputMessages = typeof input === "string" ? [createUserUIMessage(input)] : input;
        this.messages = [...this.messages, ...inputMessages];
        this.finishMessageStartIndex = this.messages.length;
        this.notify();

        const abortController = new AbortController();
        this.activeAbortController = abortController;

        const streamSignal = this.combineAbortSignals(
            abortController.signal,
            sendOptions?.signal ?? null,
        );

        const context = sendOptions?.context ?? this.options.context;

        try {
            const stream = this.agent.stream(
                {
                    messages: toAgentMessages(this.threadId ? inputMessages : this.messages).map(
                        ({ id: _id, ...message }) => message,
                    ),
                    ...(context !== undefined ? { context } : {}),
                    ...(this.stateControl.get() !== undefined
                        ? { state: this.stateControl.get() }
                        : {}),
                    ...(this.threadId !== undefined ? { threadId: this.threadId } : {}),
                },
                { signal: streamSignal },
            );

            terminal = await this.consumeStream(stream, hooks, streamSignal);
        } catch (error) {
            if (streamSignal.aborted || isBrowserPageTearingDown()) {
                this.status = "ready";
                this.notify();
                terminal = this.createFinish({
                    isAbort: true,
                    isDisconnect: false,
                    isError: false,
                    isInterrupted: false,
                });
            } else {
                this.error = toBetterAgentClientError(error);
                this.status = "error";
                this.notify();
                terminal = this.createFinish({
                    isAbort: false,
                    isDisconnect: false,
                    isError: true,
                    isInterrupted: false,
                    error: this.error,
                });
            }
        } finally {
            if (this.activeAbortController === abortController) {
                this.activeAbortController = undefined;
            }
            if (terminal !== undefined) {
                this.invokeLifecycleFinish(hooks, terminal);
            }
        }
    }

    async approveToolCall(interruptId: string, metadata?: Record<string, unknown>): Promise<void> {
        await this.resolveApprovalDecision(interruptId, true, metadata);
    }

    async rejectToolCall(
        interruptId: string,
        metadata?: Record<string, unknown> | string,
    ): Promise<void> {
        await this.resolveApprovalDecision(interruptId, false, metadata);
    }

    async resume(resume?: AgentStreamResume): Promise<void> {
        const nextResume = resume ?? (this.runId ? { runId: this.runId } : undefined);
        if (!nextResume) {
            throw new BetterAgentClientError("Cannot resume without a runId.");
        }

        const hooks = {
            onEvent: this.options.onEvent,
            onFinish: this.options.onFinish,
            onError: this.options.onError,
        };

        const abortController = new AbortController();
        this.resetStopRequest();
        this.activeAbortController?.abort();
        this.activeAbortController = abortController;
        this.runId = nextResume.runId;
        this.status = "streaming";
        this.finishMessageStartIndex = this.messages.length;
        this.notify();

        let terminal: AgentControllerFinish | undefined;

        try {
            const stream = this.agent.runs.resumeStream(
                {
                    runId: nextResume.runId,
                    afterSequence: nextResume.afterSequence,
                },
                { signal: abortController.signal },
            );

            terminal = await this.consumeStream(stream, hooks, abortController.signal);
        } catch (error) {
            if (abortController.signal.aborted || isBrowserPageTearingDown()) {
                this.status = "ready";
                this.notify();
                terminal = this.createFinish({
                    isAbort: true,
                    isDisconnect: false,
                    isError: false,
                    isInterrupted: false,
                });
            } else {
                this.error = toBetterAgentClientError(error);
                this.status = "error";
                this.notify();
                terminal = this.createFinish({
                    isAbort: false,
                    isDisconnect: false,
                    isError: true,
                    isInterrupted: false,
                    error: this.error,
                });
            }
        } finally {
            if (this.activeAbortController === abortController) {
                this.activeAbortController = undefined;
            }
            if (terminal !== undefined) {
                this.invokeLifecycleFinish(hooks, terminal);
            }
        }
    }

    private async consumeStream(
        stream: AsyncIterable<AgentEvent>,
        hooks: AgentControllerLifecycleHooks,
        signal: AbortSignal,
        beforeSuccessFinish?: () => void,
    ): Promise<AgentControllerFinish> {
        for await (const event of stream) {
            if (signal.aborted) {
                break;
            }

            const terminal = await this.processStreamEvent(event, hooks, signal);
            if (terminal) {
                return terminal;
            }
        }

        if (signal.aborted) {
            return this.createFinish({
                isAbort: true,
                isDisconnect: false,
                isError: false,
                isInterrupted: false,
            });
        }

        beforeSuccessFinish?.();
        this.status = "ready";
        this.notify();
        return this.createFinish({
            isAbort: false,
            isDisconnect: false,
            isError: false,
            isInterrupted: false,
        });
    }

    private async processStreamEvent(
        event: AgentEvent,
        hooks: AgentControllerLifecycleHooks,
        signal: AbortSignal,
    ): Promise<AgentControllerFinish | undefined> {
        if (event.type === EventType.RUN_ERROR) {
            const message =
                "message" in event && typeof event.message === "string"
                    ? event.message
                    : "Run failed.";
            const code = "code" in event && typeof event.code === "string" ? event.code : undefined;
            this.error = new BetterAgentClientError(message, {
                code,
                details: event,
            });
            this.status = "error";
            this.notify();
            this.emitEvent(hooks, event);
            return this.createFinish({
                isAbort: false,
                isDisconnect: false,
                isError: true,
                isInterrupted: false,
                error: this.error,
            });
        }

        if (event.type === EventType.RUN_FINISHED && event.outcome === "interrupt") {
            this.applyEvent(event);
            this.notify();
            this.emitEvent(hooks, event);

            const interrupts = event.interrupts ?? [];
            const runId = event.runId ?? this.runId;

            if (!runId && interrupts.length > 0) {
                this.error = new BetterAgentClientError("Interrupt missing runId.");
                this.status = "error";
                this.notify();
                return this.createFinish({
                    isAbort: false,
                    isDisconnect: false,
                    isError: true,
                    isInterrupted: false,
                    error: this.error,
                });
            }

            if (runId && interrupts.length > 0) {
                this.runId = runId;
                return await this.resolveInterrupts({
                    runId,
                    interrupts,
                    hooks,
                    signal,
                });
            }

            this.status = "interrupted";
            this.notify();
            return this.createFinish({
                isAbort: false,
                isDisconnect: false,
                isError: false,
                isInterrupted: true,
                interruptReason: "other",
            });
        }

        this.applyEvent(event);
        if (this.stopRequested) {
            return this.createFinish({
                isAbort: true,
                isDisconnect: false,
                isError: false,
                isInterrupted: false,
            });
        }

        this.status = "streaming";
        this.notify();
        this.emitEvent(hooks, event);
        return undefined;
    }

    private createPendingClientTool(
        runId: string,
        interrupt: ClientToolInterrupt,
    ): PendingClientTool | AgentControllerFinish {
        const toolCall = this.getToolCallPart(interrupt.toolCallId);
        if (!toolCall) {
            this.error = new BetterAgentClientError(
                `Client tool call not found for toolCallId: ${interrupt.toolCallId}`,
            );
            this.status = "error";
            this.notify();
            return this.createFinish({
                isAbort: false,
                isDisconnect: false,
                isError: true,
                isInterrupted: false,
                error: this.error,
            });
        }

        return {
            interruptId: interrupt.id,
            runId,
            toolCallId: interrupt.toolCallId,
            toolName: toolCall.toolName,
            input: toolCall.input,
            ...(interrupt.expiresAt !== undefined ? { expiresAt: interrupt.expiresAt } : {}),
        };
    }

    private createPendingApproval(
        runId: string,
        interrupt: ApprovalInterrupt,
    ): PendingToolApproval | AgentControllerFinish {
        const toolCall = this.getToolCallPart(interrupt.toolCallId);

        if (!toolCall) {
            this.error = new BetterAgentClientError(
                `Approval tool call not found for toolCallId: ${interrupt.toolCallId}`,
            );
            this.status = "error";
            this.notify();
            return this.createFinish({
                isAbort: false,
                isDisconnect: false,
                isError: true,
                isInterrupted: false,
                error: this.error,
            });
        }

        return {
            interruptId: interrupt.id,
            runId,
            toolCallId: interrupt.toolCallId,
            toolName: toolCall.toolName,
            input: toolCall.input,
            metadata: interrupt.metadata,
            ...(interrupt.expiresAt !== undefined ? { expiresAt: interrupt.expiresAt } : {}),
        };
    }

    private async createClientToolResumeEntry(
        pending: PendingClientTool,
    ): Promise<ResumeEntry | undefined> {
        const handler = this.getToolHandler(pending.toolName);
        if (!handler) {
            return undefined;
        }

        try {
            const payload = await handler(pending.input);
            const resumePayload =
                payload === undefined
                    ? { status: "success" as const, result: {} }
                    : { status: "success" as const, result: payload };

            this.upsertToolResultPart(pending.toolCallId, {
                state: "output-available",
                result:
                    typeof resumePayload.result === "string"
                        ? resumePayload.result
                        : JSON.stringify(resumePayload.result),
            });
            this.notify();

            return {
                interruptId: pending.interruptId,
                status: "resolved",
                payload: resumePayload,
            };
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            const resumePayload = {
                status: "error" as const,
                error: message,
            };

            this.upsertToolResultPart(pending.toolCallId, {
                state: "output-error",
                error: message,
            });
            this.notify();

            return {
                interruptId: pending.interruptId,
                status: "resolved",
                payload: resumePayload,
            };
        }
    }

    private async resolveInterrupts(params: {
        runId: string;
        interrupts: RuntimeInterrupt[];
        hooks: AgentControllerLifecycleHooks;
        signal: AbortSignal;
    }): Promise<AgentControllerFinish> {
        const { hooks, runId, signal } = params;
        const approvalInterrupts = params.interrupts.filter(
            (interrupt): interrupt is ApprovalInterrupt => this.isApprovalInterrupt(interrupt),
        );
        const clientToolInterrupts = params.interrupts.filter(
            (interrupt): interrupt is ClientToolInterrupt => this.isClientToolInterrupt(interrupt),
        );

        if (approvalInterrupts.length > 0) {
            const approvals: PendingToolApproval[] = [];
            for (const interrupt of approvalInterrupts) {
                const pending = this.createPendingApproval(runId, interrupt);
                if ("isError" in pending) {
                    return pending;
                }
                approvals.push(pending);
                this.updateToolCallPart(interrupt.toolCallId, {
                    state: "approval-requested",
                    approval: {
                        interruptId: interrupt.id,
                        needsApproval: true,
                        ...(interrupt.metadata ? { metadata: interrupt.metadata } : {}),
                    },
                });
            }

            const clientTools: PendingClientTool[] = [];
            for (const interrupt of clientToolInterrupts) {
                const pending = this.createPendingClientTool(runId, interrupt);
                if ("isError" in pending) {
                    return pending;
                }
                clientTools.push(pending);
            }

            this.pendingToolApprovals = approvals;
            this.pendingClientTools = clientTools;
            this.status = "interrupted";
            this.notify();
            return this.createFinish({
                isAbort: false,
                isDisconnect: false,
                isError: false,
                isInterrupted: true,
                interruptReason: "tool_approval_pending",
            });
        }

        if (clientToolInterrupts.length > 0) {
            const clientTools: PendingClientTool[] = [];
            for (const interrupt of clientToolInterrupts) {
                const pending = this.createPendingClientTool(runId, interrupt);
                if ("isError" in pending) {
                    return pending;
                }
                clientTools.push(pending);
            }

            this.pendingClientTools = clientTools;
            this.pendingToolApprovals = [];
            return this.resolvePendingInterruptBatch(hooks, signal);
        }

        this.pendingClientTools = [];
        this.pendingToolApprovals = [];
        this.status = "interrupted";
        this.notify();
        return this.createFinish({
            isAbort: false,
            isDisconnect: false,
            isError: false,
            isInterrupted: true,
            interruptReason: "other",
        });
    }

    private async streamWithResume(
        resume: ResumeEntry[],
        hooks: AgentControllerLifecycleHooks,
        signal: AbortSignal,
    ): Promise<AgentControllerFinish> {
        const stream = this.agent.stream(
            {
                resume,
                ...(this.stateControl.get() !== undefined
                    ? { state: this.stateControl.get() }
                    : {}),
                ...(this.threadId !== undefined ? { threadId: this.threadId } : {}),
            },
            { signal },
        );

        return this.consumeStream(stream, hooks, signal, () => {
            this.pendingClientTools = [];
            this.pendingToolApprovals = [];
        });
    }

    private async runPendingInterruptsWithLifecycle(): Promise<void> {
        const hooks = {
            onEvent: this.options.onEvent,
            onFinish: this.options.onFinish,
            onError: this.options.onError,
        };
        const abortController = new AbortController();
        this.resetStopRequest();
        this.activeAbortController?.abort();
        this.activeAbortController = abortController;
        this.error = undefined;
        this.finishMessageStartIndex = this.messages.length;
        this.status = "streaming";
        this.notify();

        let terminal: AgentControllerFinish | undefined;

        try {
            terminal = await this.resolvePendingInterruptBatch(hooks, abortController.signal);
        } catch (e) {
            if (abortController.signal.aborted) {
                terminal = this.createFinish({
                    isAbort: true,
                    isDisconnect: false,
                    isError: false,
                    isInterrupted: false,
                });
            } else {
                this.error = toBetterAgentClientError(e);
                this.status = "error";
                this.notify();
                terminal = this.createFinish({
                    isAbort: false,
                    isDisconnect: false,
                    isError: true,
                    isInterrupted: false,
                    error: this.error,
                });
            }
        } finally {
            if (this.activeAbortController === abortController) {
                this.activeAbortController = undefined;
            }

            if (terminal !== undefined) {
                this.invokeLifecycleFinish(hooks, terminal);
            }
        }
    }

    private async resolvePendingInterruptBatch(
        hooks: AgentControllerLifecycleHooks,
        signal: AbortSignal,
    ): Promise<AgentControllerFinish> {
        if (this.hasUndecidedApprovals()) {
            this.status = "interrupted";
            this.notify();
            return this.createFinish({
                isAbort: false,
                isDisconnect: false,
                isError: false,
                isInterrupted: true,
                interruptReason: "tool_approval_pending",
            });
        }

        const runId =
            this.runId ?? this.pendingToolApprovals[0]?.runId ?? this.pendingClientTools[0]?.runId;

        if (!runId) {
            this.error = new BetterAgentClientError("Pending interrupt missing runId.");
            this.status = "error";
            this.notify();
            return this.createFinish({
                isAbort: false,
                isDisconnect: false,
                isError: true,
                isInterrupted: false,
                error: this.error,
            });
        }

        const resume: ResumeEntry[] = this.pendingToolApprovals.map((approval) => ({
            interruptId: approval.interruptId,
            status: "resolved",
            payload: {
                approved: approval.approved,
                ...(approval.responseMetadata ? { metadata: approval.responseMetadata } : {}),
            },
        }));

        if (this.pendingClientTools.some((pending) => !this.getToolHandler(pending.toolName))) {
            this.status = "interrupted";
            this.notify();
            return this.createFinish({
                isAbort: false,
                isDisconnect: false,
                isError: false,
                isInterrupted: true,
                interruptReason: "client_tool_pending",
            });
        }

        for (const pending of this.pendingClientTools) {
            const entry = await this.createClientToolResumeEntry(pending);
            if (entry) {
                resume.push(entry);
            }
        }

        if (resume.length === 0) {
            this.status = "interrupted";
            this.notify();
            return this.createFinish({
                isAbort: false,
                isDisconnect: false,
                isError: false,
                isInterrupted: true,
                interruptReason: "other",
            });
        }

        this.runId = runId;
        return this.streamWithResume(resume, hooks, signal);
    }

    private getToolHandler(
        toolName: string,
    ): ((input: unknown) => unknown | Promise<unknown>) | undefined {
        const handlers = this.options.toolHandlers as
            | Record<string, ((input: unknown) => unknown | Promise<unknown>) | undefined>
            | undefined;
        return handlers?.[toolName];
    }

    private updateToolCallPart(
        toolCallId: string,
        update: Partial<Extract<UIMessage["parts"][number], { type: "tool-call" }>>,
    ): void {
        this.messages = this.messages.map((message) => ({
            ...message,
            parts: message.parts.map((part) =>
                part.type === "tool-call" && part.toolCallId === toolCallId
                    ? { ...part, ...update }
                    : part,
            ),
        }));
    }

    private upsertToolResultPart(
        toolCallId: string,
        update: Partial<Extract<UIMessage["parts"][number], { type: "tool-result" }>>,
    ): void {
        this.messages = this.messages.map((message) => {
            const existingResultIndex = message.parts.findIndex(
                (part) => part.type === "tool-result" && part.toolCallId === toolCallId,
            );
            const existingToolCallIndex = message.parts.findIndex(
                (part) => part.type === "tool-call" && part.toolCallId === toolCallId,
            );

            if (existingResultIndex === -1 && existingToolCallIndex === -1) {
                return message;
            }

            if (existingResultIndex !== -1) {
                return {
                    ...message,
                    parts: message.parts.map((part, index) =>
                        index === existingResultIndex && part.type === "tool-result"
                            ? { ...part, ...update }
                            : part,
                    ),
                };
            }

            const parts = [...message.parts];
            const insertIndex = existingToolCallIndex + 1;
            parts.splice(insertIndex, 0, {
                type: "tool-result",
                toolCallId,
                state: "output-available",
                ...update,
            });

            return {
                ...message,
                parts,
            };
        });
    }

    private async resolveApprovalDecision(
        interruptId: string,
        approved: boolean,
        metadata?: Record<string, unknown> | string,
    ): Promise<void> {
        const approvalIndex = this.pendingToolApprovals.findIndex(
            (approval) => approval.interruptId === interruptId,
        );
        if (approvalIndex === -1) {
            throw new BetterAgentClientError(
                `Pending approval not found for interruptId: ${interruptId}`,
            );
        }

        const approval = this.pendingToolApprovals[approvalIndex];
        if (!approval) {
            return;
        }

        const normalizedMetadata = typeof metadata === "string" ? { note: metadata } : metadata;

        this.error = undefined;
        this.pendingToolApprovals = this.pendingToolApprovals.map((pending, index) =>
            index === approvalIndex
                ? {
                      ...pending,
                      approved,
                      responseMetadata: normalizedMetadata,
                  }
                : pending,
        );
        this.updateToolCallPart(approval.toolCallId, {
            state: "approval-responded",
            approval: {
                interruptId: approval.interruptId,
                needsApproval: true,
                approved,
                ...(normalizedMetadata ? { metadata: normalizedMetadata } : {}),
            },
        });
        this.notify();

        if (this.hasUndecidedApprovals()) {
            this.status = "interrupted";
            this.notify();
            return;
        }

        await this.runPendingInterruptsWithLifecycle();
    }

    private applyEvent(event: AgentEvent): void {
        const rid = "runId" in event && typeof event.runId === "string" ? event.runId : undefined;
        const tid =
            "threadId" in event && typeof event.threadId === "string" && event.threadId.length > 0
                ? event.threadId
                : undefined;
        if (rid) {
            this.runId = rid;
            if (this.stopRequested) {
                this.clearStopWaitTimer();
                this.abortServerRun(rid);
                this.abortActiveRequest();
                return;
            }
        }

        if (tid) {
            this.threadId = tid;
        }

        if (this.stopRequested) {
            return;
        }

        this.stateControl.apply(event);
        if (event.type === EventType.STATE_SNAPSHOT || event.type === EventType.STATE_DELTA) {
            this.stateRevision += 1;
        }

        this.messages = applyUIEvent(createUIReducerState(this.messages), event).messages;
    }

    private notify(): void {
        this.snapshot = this.createSnapshot();
        for (const listener of this.listeners) {
            listener();
        }
    }
}

export function createAgentController<TApp, TName extends AgentNameOf<TApp>>(
    agent: BetterAgentClientAgentHandle<TApp, TName>,
    options: AgentControllerOptions<TApp, TName>,
): AgentController<TApp, TName> {
    return new AgentController<TApp, TName>(agent, options);
}
