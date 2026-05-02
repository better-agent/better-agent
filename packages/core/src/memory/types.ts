import type { AgentMessage } from "../ag-ui/messages";
import type { AuthContext } from "../auth/types";
import type { BetterAgentStorage } from "../storage";

export interface MemoryThread {
    id: string;
    agentName: string;
    scope?: string;
    title?: string;
    state?: unknown;
    metadata?: Record<string, unknown>;
    createdAt: number;
    updatedAt: number;
}

export type MemoryMessage = AgentMessage & {
    threadId: string;
    runId?: string;
    createdAt: number;
};

export type MemoryIdKind = "thread" | "messageRecord";

export interface MemoryIdContext {
    agentName?: string;
    threadId?: string;
    runId?: string;
    messageId?: string;
    createdAt?: number;
    index?: number;
}

export type MemoryIdGenerator = (kind: MemoryIdKind, context?: MemoryIdContext) => string;

interface MemoryAccess {
    threads: {
        get(threadId: string): Promise<MemoryThread | undefined> | MemoryThread | undefined;
        list(input?: {
            agentName?: string;
            scope?: string;
            limit?: number;
        }): Promise<MemoryThread[]>;
        set(threadId: string, thread: MemoryThread): Promise<void>;
        delete(threadId: string): Promise<void>;
    };
    messages: {
        list(input: {
            threadId: string;
            limit?: number;
            beforeRunId?: string;
        }): Promise<MemoryMessage[]>;
        append(input: {
            threadId: string;
            runId?: string;
            messages: AgentMessage[];
        }): Promise<void> | void;
    };
}

export interface CreateMemoryOptions {
    storage?: BetterAgentStorage;
    lastMessages?: number;
    generateId?: MemoryIdGenerator;
    scope?: (ctx: {
        auth: AuthContext | null;
        request: Request;
        agentName: string;
    }) => string | null | Promise<string | null>;
}

export interface AgentMemory extends MemoryAccess {
    lastMessages?: number;
    generateId?: MemoryIdGenerator;
    scope?: CreateMemoryOptions["scope"];
    fork(
        threadId: string,
        fromThreadId: string,
        transformMessages?: (messages: AgentMessage[]) => AgentMessage[],
    ): Promise<MemoryThread> | MemoryThread;
}
