import type { AgentEvent } from "../ag-ui/events";

export type StoreValue = string | number | boolean | null;

export interface StoreListQuery {
    where?: Record<string, StoreValue>;
    orderBy?: Record<string, "asc" | "desc">;
    take?: number;
}

export interface StoreListResult<T = unknown> {
    items: T[];
}

export interface BetterAgentStorage {
    get<T = unknown>(table: string, id: string): T | undefined | Promise<T | undefined>;
    set<T = unknown>(table: string, id: string, value: T): void | Promise<void>;
    delete(table: string, id: string): void | Promise<void>;
    list<T = unknown>(
        table: string,
        query?: StoreListQuery,
    ): StoreListResult<T> | Promise<StoreListResult<T>>;
}

export const storageTables = {
    runs: "runs",
    streams: "streams",
    streamEvents: "streamEvents",
    memoryThreads: "memoryThreads",
    memoryMessages: "memoryMessages",
} as const;

export type StorageTable = (typeof storageTables)[keyof typeof storageTables];

export const storageDomains = {
    runs: [storageTables.runs],
    streams: [storageTables.streams, storageTables.streamEvents],
    memory: [storageTables.memoryThreads, storageTables.memoryMessages],
} as const satisfies Record<string, readonly StorageTable[]>;

export type StorageDomain = keyof typeof storageDomains;
export type StorageScope = StorageDomain | StorageTable;

export type RunStatus = "running" | "completed" | "failed" | "interrupted" | "aborted";

export interface RunRecord {
    runId: string;
    agentName: string;
    threadId?: string;
    scope?: string;
    status: RunStatus;
    abortRequestedAt?: number;
    finalEvent?: {
        type: "RUN_FINISHED" | "RUN_ERROR";
        [key: string]: unknown;
    };
    config: unknown;
    startedAt: number;
    updatedAt: number;
    finishedAt?: number;
}

export type StreamStatus = "open" | "closed";

export interface StreamRecord {
    runId: string;
    status: StreamStatus;
    createdAt: number;
    updatedAt: number;
    closedAt?: number;
}

export interface StreamEventRecord {
    id: string;
    runId: string;
    seq: number;
    timestamp: number;
    event: AgentEvent;
}
