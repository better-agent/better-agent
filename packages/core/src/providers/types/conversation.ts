import type { Capabilities } from "./capabilities";
import type {
    AudioContentBase,
    EmbeddingContentBase,
    FileContentBase,
    ImageContentBase,
    ReasoningContentBase,
    TextContentBase,
    TranscriptContentBase,
    VideoContentBase,
} from "./content";
import type { GenerativeModelMessageRole } from "./input";
import type {
    GenerativeModelProviderToolResult,
    GenerativeModelToolCallRequest,
    GenerativeModelToolCallResult,
} from "./tool-calls";

/**
 * Durable conversation message part.
 *
 * Unlike provider input/output parts, this is intentionally not capability-gated.
 * It represents canonical stored state across turns.
 */
export type ConversationMessagePart =
    | TextContentBase
    | ImageContentBase
    | FileContentBase
    | VideoContentBase
    | AudioContentBase
    | EmbeddingContentBase
    | TranscriptContentBase
    | ReasoningContentBase;

/**
 * Durable conversation message content.
 */
export type ConversationMessageContent = string | ConversationMessagePart[];

/**
 * Canonical stored message in a conversation timeline.
 */
export interface ConversationMessage {
    type: "message";
    role: GenerativeModelMessageRole<Capabilities>;
    content: ConversationMessageContent;
    providerMetadata?: Record<string, unknown>;
}

/**
 * Canonical durable conversation item.
 */
export type ConversationItem =
    | ConversationMessage
    | GenerativeModelToolCallRequest
    | GenerativeModelToolCallResult
    | GenerativeModelProviderToolResult;
