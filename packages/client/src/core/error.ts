/** One frame from a serialized Better Agent error trace. */
export interface AgentClientErrorTraceFrame {
    /** Trace step name. */
    at: string;
    /** Optional trace metadata. */
    data?: Record<string, unknown>;
}

/** Client-normalized Better Agent error shape. */
export interface AgentClientError extends Error {
    /** Stable error code. */
    code?: string;
    /** HTTP status when available. */
    status?: number;
    /** Whether the request may succeed on retry. */
    retryable?: boolean;
    /** Short human title. */
    title?: string;
    /** Detailed error message. */
    detail?: string;
    /** Validation or structured issues. */
    issues?: unknown[];
    /** Server trace id. */
    traceId?: string;
    /** Extra error context. */
    context?: Record<string, unknown>;
    /** Structured trace frames. */
    trace?: AgentClientErrorTraceFrame[];
    /** Original thrown value. */
    raw?: unknown;
}

/** Internal error used to mark broken stream transport. */
export class StreamDisconnectError extends Error {
    cause?: unknown;

    constructor(message: string, cause?: unknown) {
        super(message);
        this.name = "StreamDisconnectError";
        this.cause = cause;
    }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null;

const stripSurfacePrefix = (message: string): string =>
    message.replace(/^(run failed|stream failed):\s*/i, "");

const extractMessage = (error: unknown): string | undefined => {
    if (error instanceof Error && typeof error.message === "string" && error.message.trim()) {
        return stripSurfacePrefix(error.message);
    }
    if (!isRecord(error)) return undefined;

    const message =
        (typeof error.message === "string" && error.message) ||
        (typeof error.detail === "string" && error.detail) ||
        (typeof error.title === "string" && error.title);

    return typeof message === "string" && message.trim().length > 0
        ? stripSurfacePrefix(message)
        : undefined;
};

/** Normalizes unknown failures into `AgentClientError`. */
export const toAgentClientError = (
    error: unknown,
    fallbackMessage = "Run failed.",
): AgentClientError => {
    if (error instanceof Error) {
        const enriched = error as AgentClientError;
        enriched.message = stripSurfacePrefix(enriched.message);
        if (typeof enriched.detail === "string" && enriched.detail.length > 0) {
            enriched.detail = stripSurfacePrefix(enriched.detail);
        }
        if (enriched.raw === undefined) enriched.raw = error;
        return enriched;
    }

    const message = extractMessage(error) ?? fallbackMessage;
    const next = new Error(message) as AgentClientError;
    next.raw = error;

    if (!isRecord(error)) return next;

    if (typeof error.code === "string") next.code = error.code;
    if (typeof error.status === "number") next.status = error.status;
    if (typeof error.retryable === "boolean") next.retryable = error.retryable;
    if (typeof error.title === "string") next.title = error.title;
    if (typeof error.detail === "string") next.detail = stripSurfacePrefix(error.detail);
    if (typeof error.traceId === "string") next.traceId = error.traceId;
    if (Array.isArray(error.issues)) next.issues = error.issues;
    if (isRecord(error.context)) next.context = error.context;
    if (Array.isArray(error.trace)) next.trace = error.trace as AgentClientErrorTraceFrame[];

    return next;
};

/**
 * Resolves a user-facing message from an event error payload.
 */
export const getEventErrorMessage = (error: unknown): string => toAgentClientError(error).message;
