import type { Event } from "../events";
import type { ConversationItem } from "../providers";

/**
 * Stores stream events so they can be resumed later.
 */
export interface StreamStore {
    /** Start a new stream. */
    open(streamId: string, meta: { runId: string }): Promise<void>;
    /** Save one event into the stream. */
    append(streamId: string, event: StreamEvent): Promise<void>;
    /** Mark the stream as finished. */
    close(streamId: string): Promise<void>;
    /**
     * Resume a stream after a given event number.
     *
     * Yields historical events after `afterSeq`, then continues live if the
     * stream is still active. If the stream is already closed, iteration ends
     * once the stored events are exhausted.
     */
    resume(streamId: string, afterSeq?: number): AsyncIterable<StreamEvent>;
}

/**
 * Options for the built-in in-memory stream store.
 */
export interface InMemoryStreamStoreOptions {
    advanced?: {
        /** Poll interval used while waiting for new events during resume. */
        resumePollMs?: number;
    };
}

/**
 * One saved event with a stream sequence number.
 */
export type StreamEvent = Event & {
    /** Event number inside this stream. */
    seq: number;
};

/**
 * Loads and saves durable conversation history.
 */
export interface ConversationStore<TCursor = ConversationCursor> {
    /** Load saved items for one conversation. */
    load(params: LoadConversationParams): Promise<LoadedConversation<TCursor> | null>;
    /** Save updated items back to the conversation store. */
    save(params: SaveConversationParams<TCursor>): Promise<SaveConversationResult<TCursor>>;
}

/**
 * Opaque cursor used for optimistic concurrency in conversation stores.
 */
export type ConversationCursor = string | number;

/**
 * Saved conversation items plus an optional cursor.
 */
export interface LoadedConversation<TCursor = ConversationCursor> {
    /** Saved conversation items. */
    items: ConversationItem[];
    /** Cursor used for optimistic concurrency. */
    cursor?: TCursor;
}

/**
 * Data needed to load a saved conversation.
 */
export interface LoadConversationParams {
    /** Conversation to load. */
    conversationId: string;
    /** Agent that owns this conversation history. */
    agentName: string;
}

/**
 * Data needed to save a conversation safely.
 */
export interface SaveConversationParams<TCursor = ConversationCursor> {
    /** Conversation to update. */
    conversationId: string;
    /** Agent that owns this conversation history. */
    agentName: string;
    /** Full durable item list to save. */
    items: ConversationItem[];
    /** Expected current cursor. Save should fail if it changed. */
    expectedCursor?: TCursor;
}

/**
 * Result returned after a successful save.
 */
export interface SaveConversationResult<TCursor = ConversationCursor> {
    /** New cursor after the save. */
    cursor: TCursor;
}

/**
 * Runtime status for a conversation-scoped run.
 */
export type ConversationRunStatus = "running" | "finished" | "failed" | "aborted";

/**
 * App-owned runtime state used to look up the active stream for a conversation.
 */
export interface ConversationRuntimeState {
    /** Conversation this state belongs to. */
    conversationId: string;
    /** Agent that owns this conversation. */
    agentName: string;
    /** Currently active run id, when one exists. */
    activeRunId?: string;
    /** Currently active stream id, when one exists. */
    activeStreamId?: string;
    /** Last known runtime status for the conversation. */
    status: ConversationRunStatus;
    /** Millisecond timestamp of the latest state update. */
    updatedAt: number;
}

/**
 * Optional store for active run or active stream lookup by conversation.
 */
export interface ConversationRuntimeStateStore {
    /** Load the latest runtime state for a conversation. */
    get(params: LoadConversationParams): Promise<ConversationRuntimeState | null>;
    /** Save the latest runtime state for a conversation. */
    set(state: ConversationRuntimeState): Promise<void>;
    /** Clear any active runtime state for a conversation. */
    clear(params: LoadConversationParams): Promise<void>;
}
