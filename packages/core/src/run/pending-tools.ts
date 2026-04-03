import { BetterAgentError } from "@better-agent/shared/errors";
import type { SubmitToolApprovalParams, SubmitToolResultParams } from "./types";

export interface PendingToolRuntime {
    awaitClientToolResult(params: {
        runId: string;
        toolCallId: string;
        toolName: string;
        timeoutMs?: number;
        signal?: AbortSignal;
    }): Promise<unknown>;
    awaitToolApproval(params: {
        runId: string;
        toolCallId: string;
        toolName: string;
        timeoutMs?: number;
        signal?: AbortSignal;
    }): Promise<{
        decision: "approved" | "denied";
        note?: string;
        actorId?: string;
    }>;
    submitToolResult(params: SubmitToolResultParams): Promise<boolean>;
    submitToolApproval(params: SubmitToolApprovalParams): Promise<boolean>;
    clearRun(runId: string, reason: string): void;
}

export const createPendingToolRuntime = (): PendingToolRuntime => {
    type PendingEntry<TValue> = {
        resolve: (value: TValue) => void;
        reject: (error: BetterAgentError) => void;
    };
    const pendingClientToolCalls = new Map<string, Map<string, PendingEntry<unknown>>>();
    const pendingApprovals = new Map<
        string,
        Map<
            string,
            PendingEntry<{
                decision: "approved" | "denied";
                note?: string;
                actorId?: string;
            }>
        >
    >();

    const removePendingEntry = <TValue>(
        entries: Map<string, Map<string, PendingEntry<TValue>>>,
        runId: string,
        toolCallId: string,
    ) => {
        const runPending = entries.get(runId);
        if (!runPending) {
            return;
        }

        runPending.delete(toolCallId);
        if (runPending.size === 0) {
            entries.delete(runId);
        }
    };

    return {
        awaitClientToolResult(params) {
            return new Promise((resolve, reject) => {
                const timeoutMs = params.timeoutMs ?? 30_000;
                const runPending = pendingClientToolCalls.get(params.runId) ?? new Map();
                pendingClientToolCalls.set(params.runId, runPending);

                if (runPending.has(params.toolCallId)) {
                    reject(
                        BetterAgentError.fromCode(
                            "VALIDATION_FAILED",
                            `Client tool '${params.toolName}' call '${params.toolCallId}' is already pending.`,
                            {
                                context: {
                                    runId: params.runId,
                                    toolName: params.toolName,
                                    toolCallId: params.toolCallId,
                                },
                                trace: [{ at: "core.run.pendingTools.awaitClientToolResult" }],
                            },
                        ),
                    );
                    return;
                }

                const onAbort = () => {
                    cleanup();
                    reject(
                        createAbortError(
                            `Run '${params.runId}' was aborted while waiting for client tool result for '${params.toolName}'.`,
                            {
                                runId: params.runId,
                                toolName: params.toolName,
                                toolCallId: params.toolCallId,
                            },
                        ),
                    );
                };
                const cleanup = () => {
                    clearTimeout(timeout);
                    params.signal?.removeEventListener("abort", onAbort);
                    removePendingEntry(pendingClientToolCalls, params.runId, params.toolCallId);
                };
                const timeout = setTimeout(() => {
                    cleanup();
                    reject(
                        BetterAgentError.fromCode(
                            "TIMEOUT",
                            `Timed out waiting for client tool result for '${params.toolName}'.`,
                            {
                                context: {
                                    runId: params.runId,
                                    toolName: params.toolName,
                                    toolCallId: params.toolCallId,
                                },
                                trace: [{ at: "core.run.pendingTools.awaitClientToolResult" }],
                            },
                        ),
                    );
                }, timeoutMs);

                if (params.signal?.aborted) {
                    onAbort();
                    return;
                }

                params.signal?.addEventListener("abort", onAbort, { once: true });
                runPending.set(params.toolCallId, {
                    resolve: (value: unknown) => {
                        cleanup();
                        resolve(value);
                    },
                    reject: (error: BetterAgentError) => {
                        cleanup();
                        reject(error);
                    },
                });
            });
        },

        awaitToolApproval(params) {
            return new Promise((resolve, reject) => {
                const timeoutMs = params.timeoutMs ?? 30_000;
                const runPending = pendingApprovals.get(params.runId) ?? new Map();
                pendingApprovals.set(params.runId, runPending);

                if (runPending.has(params.toolCallId)) {
                    reject(
                        BetterAgentError.fromCode(
                            "VALIDATION_FAILED",
                            `Tool '${params.toolName}' call '${params.toolCallId}' is already pending approval.`,
                            {
                                context: {
                                    runId: params.runId,
                                    toolName: params.toolName,
                                    toolCallId: params.toolCallId,
                                },
                                trace: [{ at: "core.run.pendingTools.awaitToolApproval" }],
                            },
                        ),
                    );
                    return;
                }
                const cleanup = () => {
                    clearTimeout(timeout);
                    params.signal?.removeEventListener("abort", onAbort);
                    removePendingEntry(pendingApprovals, params.runId, params.toolCallId);
                };

                const onAbort = () => {
                    cleanup();
                    reject(
                        createAbortError(
                            `Run '${params.runId}' was aborted while waiting for approval of '${params.toolName}'.`,
                            {
                                runId: params.runId,
                                toolName: params.toolName,
                                toolCallId: params.toolCallId,
                            },
                        ),
                    );
                };

                const timeout = setTimeout(() => {
                    cleanup();
                    reject(
                        BetterAgentError.fromCode(
                            "TIMEOUT",
                            `Timed out waiting for approval of '${params.toolName}'.`,
                            {
                                context: {
                                    runId: params.runId,
                                    toolName: params.toolName,
                                    toolCallId: params.toolCallId,
                                },
                                trace: [{ at: "core.run.pendingTools.awaitToolApproval" }],
                            },
                        ),
                    );
                }, timeoutMs);

                if (params.signal?.aborted) {
                    onAbort();
                    return;
                }

                params.signal?.addEventListener("abort", onAbort, { once: true });
                runPending.set(params.toolCallId, {
                    resolve: (value: {
                        decision: "approved" | "denied";
                        note?: string;
                        actorId?: string;
                    }) => {
                        cleanup();
                        resolve(value);
                    },
                    reject: (error: BetterAgentError) => {
                        cleanup();
                        reject(error);
                    },
                });
            });
        },

        submitToolResult(params) {
            const runPending = pendingClientToolCalls.get(params.runId);
            if (!runPending) return Promise.resolve(false);

            const pending = runPending.get(params.toolCallId);
            if (!pending) return Promise.resolve(false);

            runPending.delete(params.toolCallId);
            if (runPending.size === 0) {
                pendingClientToolCalls.delete(params.runId);
            }

            if (params.status === "error") {
                pending.reject(
                    BetterAgentError.fromCode("TOOL_EXECUTION_FAILED", params.error, {
                        context: {
                            runId: params.runId,
                            toolCallId: params.toolCallId,
                        },
                        trace: [{ at: "core.run.pendingTools.submitToolResult" }],
                    }),
                );
            } else {
                pending.resolve(params.result);
            }

            return Promise.resolve(true);
        },

        submitToolApproval(params) {
            const runPending = pendingApprovals.get(params.runId);
            if (!runPending) return Promise.resolve(false);

            const pending = runPending.get(params.toolCallId);
            if (!pending) return Promise.resolve(false);

            runPending.delete(params.toolCallId);
            if (runPending.size === 0) {
                pendingApprovals.delete(params.runId);
            }

            const result: {
                decision: "approved" | "denied";
                note?: string;
                actorId?: string;
            } = {
                decision: params.decision,
            };

            if (params.note !== undefined) {
                result.note = params.note;
            }

            if (params.actorId !== undefined) {
                result.actorId = params.actorId;
            }

            pending.resolve(result);

            return Promise.resolve(true);
        },

        clearRun(runId: string, reason: string) {
            const clientToolCalls = pendingClientToolCalls.get(runId);
            if (clientToolCalls) {
                for (const [toolCallId, pending] of clientToolCalls) {
                    pending.reject(
                        createAbortError(`Run '${runId}' was cleared: ${reason}`, {
                            runId,
                            toolCallId,
                        }),
                    );
                }
                pendingClientToolCalls.delete(runId);
            }

            const approvals = pendingApprovals.get(runId);
            if (approvals) {
                for (const [toolCallId, pending] of approvals) {
                    pending.reject(
                        createAbortError(`Run '${runId}' was cleared: ${reason}`, {
                            runId,
                            toolCallId,
                        }),
                    );
                }
                pendingApprovals.delete(runId);
            }
        },
    };
};

const createAbortError = (message: string, context: Record<string, unknown>) =>
    BetterAgentError.fromCode("ABORTED", message, {
        context,
        trace: [{ at: "core.run.pendingTools.clearRun" }],
    });
