export type FinishReason = "stop" | "length" | "tool-calls" | "content-filter" | "other";

export interface TokenUsage {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
    reasoningTokens?: number;
    cachedInputTokens?: number;
}

export interface RuntimeFinishedResult {
    finishReason?: FinishReason;
    usage?: TokenUsage;
    stepCount?: number;
}
