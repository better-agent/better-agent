import { BetterAgentError } from "@better-agent/shared/errors";
import type { ConversationItem } from "../providers";
import type {
    ConversationRuntimeState,
    ConversationRuntimeStateStore,
    ConversationStore,
    InMemoryStreamStoreOptions,
    StreamEvent,
    StreamStore,
} from "./types";

// Internal state for one in-memory stream.
interface MemoryStreamState {
    meta: { runId: string };
    events: StreamEvent[];
    active: boolean;
}

/**
 * Creates an in-memory stream store.
 */
export function createMemoryStreamStore(options?: InMemoryStreamStoreOptions): StreamStore {
    const streams = new Map<string, MemoryStreamState>();

    const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

    const resumePollMs = options?.advanced?.resumePollMs ?? 25;
    if (!Number.isFinite(resumePollMs) || resumePollMs <= 0) {
        throw BetterAgentError.fromCode(
            "VALIDATION_FAILED",
            "advanced.resumePollMs must be a positive number.",
            {
                context: { resumePollMs },
                trace: [{ at: "core.persistence.createMemoryStreamStore" }],
            },
        );
    }

    return {
        async open(streamId: string, meta: { runId: string }): Promise<void> {
            streams.set(streamId, {
                meta,
                events: [],
                active: true,
            });
        },

        async append(streamId: string, event: StreamEvent): Promise<void> {
            const stream = streams.get(streamId);
            if (!stream) throw new Error(`Stream ${streamId} not found`);
            stream.events.push(event);
        },

        async close(streamId: string): Promise<void> {
            const stream = streams.get(streamId);
            if (stream) stream.active = false;
        },

        async *resume(streamId: string, afterSeq = -1): AsyncIterable<StreamEvent> {
            let nextSeq = afterSeq;

            while (true) {
                const stream = streams.get(streamId);
                if (!stream) {
                    return;
                }

                let yielded = false;
                for (const event of stream.events) {
                    if (event.seq <= nextSeq) continue;
                    yielded = true;
                    nextSeq = event.seq;
                    yield event;
                }

                if (!stream.active) {
                    return;
                }

                if (!yielded) {
                    await wait(resumePollMs);
                }
            }
        },
    };
}

/**
 * Creates an in-memory conversation runtime-state store.
 */
export function createMemoryConversationRuntimeStateStore(): ConversationRuntimeStateStore {
    const states = new Map<string, ConversationRuntimeState>();
    const getKey = (conversationId: string, agentName: string) => `${agentName}:${conversationId}`;

    return {
        async get({ conversationId, agentName }) {
            return states.get(getKey(conversationId, agentName)) ?? null;
        },
        async set(state) {
            states.set(getKey(state.conversationId, state.agentName), { ...state });
        },
        async clear({ conversationId, agentName }) {
            states.delete(getKey(conversationId, agentName));
        },
    };
}

/**
 * Creates an in-memory conversation store with optimistic concurrency cursors.
 *
 * Useful for local development, tests, and simple single-process deployments.
 * Data is not persisted across process restarts.
 */
export function createMemoryConversationStore(): ConversationStore<number> {
    const conversations = new Map<string, { items: ConversationItem[]; version: number }>();
    const getConversationKey = (conversationId: string, agentName: string) =>
        `${agentName}:${conversationId}`;

    return {
        async load({ conversationId, agentName }) {
            const entry = conversations.get(getConversationKey(conversationId, agentName));
            return entry ? { items: [...entry.items], cursor: entry.version } : null;
        },
        async save({ conversationId, agentName, items, expectedCursor }) {
            const key = getConversationKey(conversationId, agentName);
            const entry = conversations.get(key);
            if (entry && expectedCursor !== undefined && entry.version !== expectedCursor) {
                throw BetterAgentError.fromCode(
                    "CONFLICT",
                    "Conversation was updated in another session.",
                    {
                        context: { conversationId, agentName },
                        trace: [{ at: "core.persistence.createMemoryConversationStore.save" }],
                    },
                );
            }

            const version = (entry?.version ?? 0) + 1;
            conversations.set(key, {
                items: [...items],
                version,
            });
            return { cursor: version };
        },
    };
}
