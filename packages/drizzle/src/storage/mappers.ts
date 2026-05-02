import type {
    MemoryMessage,
    MemoryThread,
    RunRecord,
    StreamEventRecord,
    StreamRecord,
} from "@better-agent/core";
import type { memorySchema, runsSchema, streamsSchema } from "@better-agent/schema";
import type { JsonValue, ScalarRecord } from "@farming-labs/orm";

export type RunRow = ScalarRecord<typeof runsSchema, "run">;
export type MemoryThreadRow = ScalarRecord<typeof memorySchema, "thread">;
export type MemoryMessageRow = ScalarRecord<typeof memorySchema, "message">;
export type StreamRow = ScalarRecord<typeof streamsSchema, "stream">;
export type StreamEventRow = ScalarRecord<typeof streamsSchema, "streamEvent">;

export function fromRunRow(row: RunRow): RunRecord {
    return {
        runId: row.runId,
        agentName: row.agentName,
        ...(row.threadId ? { threadId: row.threadId } : {}),
        ...(row.scope ? { scope: row.scope } : {}),
        status: row.status,
        ...(row.abortRequestedAt ? { abortRequestedAt: row.abortRequestedAt.getTime() } : {}),
        ...(row.finalEvent
            ? { finalEvent: row.finalEvent as unknown as RunRecord["finalEvent"] }
            : {}),
        config: row.config ?? undefined,
        startedAt: row.startedAt.getTime(),
        updatedAt: row.updatedAt.getTime(),
        ...(row.finishedAt ? { finishedAt: row.finishedAt.getTime() } : {}),
    };
}

export function toRunRow(id: string, record: RunRecord): RunRow {
    return {
        runId: record.runId || id,
        agentName: record.agentName,
        threadId: record.threadId ?? null,
        scope: record.scope ?? null,
        status: record.status,
        abortRequestedAt:
            record.abortRequestedAt === undefined ? null : new Date(record.abortRequestedAt),
        finalEvent: (record.finalEvent ?? null) as JsonValue | null,
        config: (record.config ?? null) as JsonValue | null,
        startedAt: new Date(record.startedAt),
        updatedAt: new Date(record.updatedAt),
        finishedAt: record.finishedAt === undefined ? null : new Date(record.finishedAt),
    };
}

export function fromThreadRow(row: MemoryThreadRow): MemoryThread {
    return {
        id: row.id,
        agentName: row.agentName ?? "",
        ...(row.scope ? { scope: row.scope } : {}),
        ...(row.title ? { title: row.title } : {}),
        ...(row.state !== null ? { state: row.state } : {}),
        ...(row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
            ? { metadata: row.metadata as Record<string, unknown> }
            : {}),
        createdAt: row.createdAt.getTime(),
        updatedAt: row.updatedAt.getTime(),
    };
}

export function toThreadRow(id: string, record: MemoryThread): MemoryThreadRow {
    return {
        id: record.id || id,
        agentName: record.agentName,
        scope: record.scope ?? null,
        title: record.title ?? null,
        state: (record.state ?? null) as JsonValue | null,
        metadata: (record.metadata ?? null) as JsonValue | null,
        createdAt: new Date(record.createdAt),
        updatedAt: new Date(record.updatedAt),
    };
}

export function fromMessageRow(row: MemoryMessageRow): MemoryMessage {
    const message = {
        ...(row.message as unknown as Omit<MemoryMessage, "threadId" | "runId" | "createdAt">),
        threadId: row.threadId,
        ...(row.runId ? { runId: row.runId } : {}),
        createdAt: row.createdAt.getTime(),
    };

    return message as MemoryMessage;
}

export function toMessageRow(id: string, record: MemoryMessage): MemoryMessageRow {
    const { threadId, runId, createdAt, ...message } = record;

    return {
        id,
        threadId,
        runId: runId ?? null,
        message: message as JsonValue,
        createdAt: new Date(createdAt),
    };
}

export function fromStreamRow(row: StreamRow): StreamRecord {
    return {
        runId: row.runId,
        status: row.status,
        createdAt: row.createdAt.getTime(),
        updatedAt: row.updatedAt.getTime(),
        ...(row.closedAt ? { closedAt: row.closedAt.getTime() } : {}),
    };
}

export function toStreamRow(id: string, record: StreamRecord): StreamRow {
    return {
        id,
        runId: record.runId,
        status: record.status,
        createdAt: new Date(record.createdAt),
        updatedAt: new Date(record.updatedAt),
        closedAt: record.closedAt === undefined ? null : new Date(record.closedAt),
    };
}

export function fromStreamEventRow(row: StreamEventRow): StreamEventRecord {
    return {
        id: row.id,
        runId: row.runId,
        seq: row.seq,
        timestamp: row.timestamp.getTime(),
        event: row.event as unknown as StreamEventRecord["event"],
    };
}

export function toStreamEventRow(id: string, record: StreamEventRecord): StreamEventRow {
    return {
        id: record.id || id,
        runId: record.runId,
        seq: record.seq,
        timestamp: new Date(record.timestamp),
        event: record.event as unknown as JsonValue,
    };
}
