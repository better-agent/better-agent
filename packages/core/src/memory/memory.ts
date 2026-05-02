import { BetterAgentError } from "@better-agent/shared/errors";
import type { AgentMessage } from "../ag-ui/messages";
import { type BetterAgentStorage, storageTables } from "../storage";
import type {
    AgentMemory,
    CreateMemoryOptions,
    MemoryIdContext,
    MemoryIdGenerator,
    MemoryIdKind,
    MemoryMessage,
    MemoryThread,
} from "./types";

const explicitStorageMemory = new WeakSet<AgentMemory>();

export function defaultGenerateMemoryId(kind: MemoryIdKind, context?: MemoryIdContext): string {
    if (
        kind === "messageRecord" &&
        context?.threadId &&
        context.createdAt !== undefined &&
        context.messageId
    ) {
        return `${context.threadId}:${context.createdAt}:${context.messageId}`;
    }

    return `${kind}_${crypto.randomUUID()}`;
}

function createMemoryStore(input: {
    storage: NonNullable<CreateMemoryOptions["storage"]>;
    generateId: MemoryIdGenerator;
}): Pick<AgentMemory, "threads" | "messages"> {
    const createMessageId = (
        context: Required<Pick<MemoryIdContext, "threadId" | "createdAt">> &
            Pick<MemoryIdContext, "runId" | "messageId" | "index">,
    ) => input.generateId("messageRecord", context);
    const storage = input.storage;

    return {
        threads: {
            get(threadId) {
                return storage.get<MemoryThread>(storageTables.memoryThreads, threadId);
            },
            async list(input = {}) {
                const where: Record<string, string> = {};
                if (input.agentName !== undefined) {
                    where.agentName = input.agentName;
                }
                if (input.scope !== undefined) {
                    where.scope = input.scope;
                }

                const result = await storage.list<MemoryThread>(storageTables.memoryThreads, {
                    ...(Object.keys(where).length > 0 ? { where } : {}),
                    orderBy: { updatedAt: "desc" },
                });

                return input.limit === undefined
                    ? result.items
                    : result.items.slice(0, input.limit);
            },
            async set(threadId, thread) {
                if (thread.id !== threadId) {
                    throw BetterAgentError.fromCode(
                        "VALIDATION_FAILED",
                        `Thread id '${thread.id}' does not match target '${threadId}'.`,
                        {
                            context: {
                                threadId,
                                providedThreadId: thread.id,
                            },
                        },
                    );
                }

                await storage.set(storageTables.memoryThreads, threadId, thread);
            },
            async delete(threadId) {
                const messages = await storage.list<MemoryMessage>(storageTables.memoryMessages, {
                    where: { threadId },
                });

                await Promise.all(
                    messages.items.map((message) =>
                        storage.delete(
                            storageTables.memoryMessages,
                            createMessageId({
                                threadId: message.threadId,
                                createdAt: message.createdAt,
                                messageId: message.id,
                            }),
                        ),
                    ),
                );
                await storage.delete(storageTables.memoryThreads, threadId);
            },
        },
        messages: {
            async list(input) {
                const result = await storage.list<MemoryMessage>(storageTables.memoryMessages, {
                    where: { threadId: input.threadId },
                    orderBy: { createdAt: "asc" },
                });

                const beforeRunIndex =
                    input.beforeRunId === undefined
                        ? -1
                        : result.items.findIndex((message) => message.runId === input.beforeRunId);
                const messages =
                    beforeRunIndex === -1 ? result.items : result.items.slice(0, beforeRunIndex);

                return input.limit === undefined ? messages : messages.slice(-input.limit);
            },
            async append(input) {
                if (input.messages.length === 0) {
                    return;
                }

                const now = Date.now();

                await Promise.all(
                    input.messages.map((message, index) => {
                        const createdAt = now + index;
                        const memoryMessage: MemoryMessage = {
                            ...message,
                            threadId: input.threadId,
                            runId: input.runId,
                            createdAt,
                        };

                        return storage.set(
                            storageTables.memoryMessages,
                            createMessageId({
                                threadId: input.threadId,
                                runId: input.runId,
                                createdAt,
                                messageId: message.id,
                                index,
                            }),
                            memoryMessage,
                        );
                    }),
                );
            },
        },
    };
}

function validateLastMessages(lastMessages: number | undefined): number | undefined {
    if (lastMessages === undefined) {
        return undefined;
    }

    if (!Number.isInteger(lastMessages) || lastMessages < 1) {
        throw BetterAgentError.fromCode(
            "VALIDATION_FAILED",
            "Memory lastMessages must be a positive integer.",
            {
                context: {
                    lastMessages,
                },
            },
        );
    }

    return lastMessages;
}

function createBoundMemory(input: {
    storage?: BetterAgentStorage;
    lastMessages?: number;
    generateId?: MemoryIdGenerator;
    scope?: CreateMemoryOptions["scope"];
    unboundMessage: string;
}): AgentMemory {
    const generateId = input.generateId ?? defaultGenerateMemoryId;
    const getStorage = () => {
        const storage = input.storage;
        if (!storage) {
            throw BetterAgentError.fromCode("VALIDATION_FAILED", input.unboundMessage);
        }

        return createMemoryStore({ storage, generateId });
    };

    return {
        generateId,
        threads: {
            get(threadId: string) {
                return getStorage().threads.get(threadId);
            },
            list(input?: { agentName?: string; scope?: string; limit?: number }) {
                return getStorage().threads.list(input);
            },
            set(threadId: string, thread: MemoryThread) {
                return getStorage().threads.set(threadId, thread);
            },
            delete(threadId: string) {
                return getStorage().threads.delete(threadId);
            },
        },
        messages: {
            list(input: { threadId: string; limit?: number; beforeRunId?: string }) {
                return getStorage().messages.list(input);
            },
            append(input: { threadId: string; runId?: string; messages: AgentMessage[] }) {
                return getStorage().messages.append(input);
            },
        },
        ...(input.lastMessages !== undefined ? { lastMessages: input.lastMessages } : {}),
        ...(input.scope !== undefined ? { scope: input.scope } : {}),
        async fork(threadId, fromThreadId, transformMessages) {
            const storage = getStorage();
            const sourceThread = await storage.threads.get(fromThreadId);
            if (!sourceThread) {
                throw BetterAgentError.fromCode(
                    "NOT_FOUND",
                    `Thread '${fromThreadId}' not found.`,
                    {
                        context: {
                            threadId: fromThreadId,
                        },
                    },
                );
            }

            const now = Date.now();
            const nextThread: MemoryThread = {
                ...sourceThread,
                id: threadId,
                createdAt: now,
                updatedAt: now,
            };

            await storage.threads.set(threadId, nextThread);

            const sourceMessages = await storage.messages.list({ threadId: fromThreadId });
            const baseMessages = sourceMessages.map(
                ({ threadId: _threadId, runId: _runId, createdAt: _createdAt, ...message }) =>
                    message,
            );
            const nextMessages = transformMessages ? transformMessages(baseMessages) : baseMessages;

            if (nextMessages.length > 0) {
                await storage.messages.append({
                    threadId,
                    messages: nextMessages,
                });
            }

            return nextThread;
        },
    };
}

export function createMemory(options: CreateMemoryOptions = {}): AgentMemory {
    const lastMessages = validateLastMessages(options.lastMessages);
    const memory = createBoundMemory({
        storage: options.storage,
        lastMessages,
        generateId: options.generateId,
        scope: options.scope,
        unboundMessage:
            "Memory is not bound to storage. Use app.agent(name).memory or pass storage to createMemory({ storage }).",
    });

    if (options.storage !== undefined) {
        explicitStorageMemory.add(memory);
    }

    return memory;
}

export function bindMemoryStorage(memory: AgentMemory, storage?: BetterAgentStorage): AgentMemory {
    if (explicitStorageMemory.has(memory)) {
        return memory;
    }

    return createBoundMemory({
        storage,
        lastMessages: memory.lastMessages,
        generateId: memory.generateId,
        scope: memory.scope,
        unboundMessage:
            "Memory is not bound to storage. Configure app storage or pass storage to createMemory({ storage }).",
    });
}
