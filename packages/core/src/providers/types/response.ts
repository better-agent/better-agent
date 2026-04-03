import type { Capabilities } from "./capabilities";
import type { GenerativeModelOutputItem } from "./output";

/**
 * Token usage statistics for a model call.
 */
export interface GenerativeModelUsage {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
    reasoningTokens?: number;
    cachedInputTokens?: number;
}

/**
 * Finish reason reported by a model.
 */
export type GenerativeModelFinishReason =
    /** Model completed normally. */
    | "stop"
    /** Model stopped because token/output limits were reached. */
    | "length"
    /** Model output was blocked or truncated by safety/content filters. */
    | "content-filter"
    /** Model stopped to request one or more tool calls. */
    | "tool-calls"
    /** Generation was interrupted by an explicit abort action. */
    | "abort"
    /** Any provider-specific reason that does not map to a normalized value. */
    | "other";

/**
 * Model response payload.
 */
export interface GenerativeModelResponse<TModelCaps extends Capabilities = Capabilities> {
    output: Array<GenerativeModelOutputItem<TModelCaps>>;
    finishReason: GenerativeModelFinishReason;
    usage: GenerativeModelUsage;
    request?: {
        body: unknown;
    };
    response?: {
        body: unknown;
    };
}
