export type BetterAgentIdKind = "run" | "message" | "toolResult";

export type BetterAgentMessageIdRole =
    | "system"
    | "developer"
    | "user"
    | "assistant"
    | "reasoning"
    | "tool"
    | "activity";

export interface BetterAgentIdContext {
    agentName?: string;
    runId?: string;
    threadId?: string;
    role?: BetterAgentMessageIdRole;
    parentMessageId?: string;
    toolCallId?: string;
    toolName?: string;
}

export type BetterAgentIdGenerator = (
    kind: BetterAgentIdKind,
    context?: BetterAgentIdContext,
) => string;

export function defaultGenerateId(kind: BetterAgentIdKind, context?: BetterAgentIdContext): string {
    if (kind === "toolResult" && context?.toolCallId) {
        return `tool_${context.toolCallId}`;
    }

    return `${kind}_${crypto.randomUUID()}`;
}

export function ensureAbortSignal(signal?: AbortSignal): AbortSignal {
    if (signal) {
        return signal;
    }

    return new AbortController().signal;
}

export function mergeAbortSignals(...signals: Array<AbortSignal | undefined>): AbortSignal {
    const definedSignals = signals.filter((signal): signal is AbortSignal => Boolean(signal));

    if (definedSignals.length === 0) {
        return new AbortController().signal;
    }

    if (definedSignals.length === 1) {
        const [signal] = definedSignals;
        if (signal) {
            return signal;
        }
    }

    return AbortSignal.any(definedSignals);
}
