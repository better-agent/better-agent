import { BetterAgentError } from "@better-agent/shared/errors";
import type { AgentEvent } from "../ag-ui/events";
import {
    type BetterAgentStorage,
    type StreamEventRecord,
    type StreamRecord,
    type StreamStatus,
    isUnsupportedStorageTableError,
    storageTables,
} from "../storage";

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function streamStorageNotConfiguredError(): BetterAgentError {
    return BetterAgentError.fromCode(
        "VALIDATION_FAILED",
        "Stream storage is not configured. resumeStream() requires a StreamStore.",
    );
}

function requireStorage(storage: BetterAgentStorage | undefined): BetterAgentStorage {
    if (!storage) {
        throw streamStorageNotConfiguredError();
    }

    return storage;
}

export function createStreamStore(storage: BetterAgentStorage | undefined) {
    return {
        async open(input: { runId: string }): Promise<void> {
            if (!storage) {
                return;
            }

            const now = Date.now();
            await storage.set<StreamRecord>(storageTables.streams, input.runId, {
                runId: input.runId,
                status: "open",
                createdAt: now,
                updatedAt: now,
            });
        },

        async append(input: { runId: string; event: AgentEvent }): Promise<void> {
            if (!storage) {
                return;
            }

            const stream = await storage.get<StreamRecord>(storageTables.streams, input.runId);
            if (!stream) {
                throw BetterAgentError.fromCode(
                    "NOT_FOUND",
                    `Stream with runId '${input.runId}' not found.`,
                    {
                        context: { runId: input.runId },
                    },
                );
            }

            const latest = await storage.list<StreamEventRecord>(storageTables.streamEvents, {
                where: { runId: input.runId },
                orderBy: { seq: "desc" },
                take: 1,
            });
            const seq = (latest.items[0]?.seq ?? 0) + 1;
            const timestamp =
                typeof input.event.timestamp === "number" ? input.event.timestamp : Date.now();

            await storage.set<StreamEventRecord>(
                storageTables.streamEvents,
                `${input.runId}:${seq}`,
                {
                    id: `${input.runId}:${seq}`,
                    runId: input.runId,
                    seq,
                    timestamp,
                    event: input.event,
                },
            );
        },

        async close(
            runId: string,
            status: Exclude<StreamStatus, "open"> = "closed",
        ): Promise<void> {
            if (!storage) {
                return;
            }

            const stream = await storage.get<StreamRecord>(storageTables.streams, runId);
            if (!stream) {
                return;
            }

            const now = Date.now();
            await storage.set<StreamRecord>(storageTables.streams, runId, {
                ...stream,
                status,
                updatedAt: now,
                closedAt: now,
            });
        },

        resume(input: {
            runId: string;
            afterSequence?: number;
            signal?: AbortSignal;
        }): AsyncIterable<AgentEvent & { seq: number }> {
            return (async function* () {
                try {
                    const requiredStorage = requireStorage(storage);
                    const initialStream = await requiredStorage.get<StreamRecord>(
                        storageTables.streams,
                        input.runId,
                    );
                    if (!initialStream) {
                        throw BetterAgentError.fromCode(
                            "NOT_FOUND",
                            `Stream with runId '${input.runId}' not found.`,
                            {
                                context: {
                                    runId: input.runId,
                                },
                            },
                        );
                    }

                    let nextSequence = input.afterSequence ?? 0;

                    while (true) {
                        if (input.signal?.aborted) {
                            return;
                        }

                        const stream = await requiredStorage.get<StreamRecord>(
                            storageTables.streams,
                            input.runId,
                        );
                        if (!stream) {
                            return;
                        }

                        const streamEvents = await requiredStorage.list<StreamEventRecord>(
                            storageTables.streamEvents,
                            {
                                where: { runId: input.runId },
                                orderBy: { seq: "asc" },
                            },
                        );

                        let yielded = false;
                        for (const record of streamEvents.items) {
                            if (record.seq <= nextSequence) {
                                continue;
                            }

                            yielded = true;
                            nextSequence = record.seq;
                            yield {
                                ...record.event,
                                seq: record.seq,
                            };
                        }

                        if (stream.status !== "open") {
                            return;
                        }

                        if (!yielded) {
                            await wait(25);
                        }
                    }
                } catch (error) {
                    if (isUnsupportedStorageTableError(error)) {
                        throw streamStorageNotConfiguredError();
                    }

                    throw error;
                }
            })();
        },
    };
}
