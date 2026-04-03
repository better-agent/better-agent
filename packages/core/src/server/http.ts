import { BetterAgentError, type BetterAgentErrorTraceFrame } from "@better-agent/shared/errors";
import { isPlainRecord } from "@better-agent/shared/utils";

/**
 * Validation issue returned in HTTP error payloads.
 */
export interface ValidationIssue {
    message: string;
    path?: string;
}

/**
 * Creates a JSON response.
 */
export const jsonResponse = (body: unknown, init?: ResponseInit): Response =>
    new Response(JSON.stringify(body), {
        ...init,
        headers: {
            "content-type": "application/json",
            ...(init?.headers ?? {}),
        },
    });

/**
 * Creates a `204 No Content` response.
 */
export const noContentResponse = (): Response => new Response(null, { status: 204 });

/**
 * Creates a `404 Not Found` response.
 */
export const notFoundResponse = (message = "Route not found."): Response =>
    jsonErrorResponse({ code: "NOT_FOUND", message, status: 404 });

/**
 * Creates a `405 Method Not Allowed` response.
 */
export const methodNotAllowedResponse = (methods: string[]): Response =>
    jsonErrorResponse(
        {
            code: "METHOD_NOT_ALLOWED",
            message: "Request method is not allowed for this route.",
            status: 405,
        },
        {
            headers: {
                allow: methods.join(", "),
            },
        },
    );

/**
 * Creates one validation issue.
 */
export const toValidationIssue = (message: string, path = "/"): ValidationIssue => ({
    message,
    path,
});

/**
 * Creates a `422 Validation Failed` response.
 */
export const invalidRequest = (issues: ValidationIssue[]): Response =>
    jsonErrorResponse({
        code: "VALIDATION_FAILED",
        message: "Request validation failed.",
        status: 422,
        issues,
    });

/**
 * Creates a JSON error response.
 */
export const jsonErrorResponse = (
    params: {
        code: string;
        message: string;
        status: number;
        retryable?: boolean;
        issues?: ValidationIssue[];
        traceId?: string;
        context?: Record<string, unknown>;
        trace?: BetterAgentErrorTraceFrame[];
    },
    init?: ResponseInit,
): Response =>
    jsonResponse(
        {
            code: params.code,
            message: params.message,
            status: params.status,
            ...(params.retryable !== undefined ? { retryable: params.retryable } : {}),
            ...(params.issues !== undefined ? { issues: params.issues } : {}),
            ...(params.traceId !== undefined ? { traceId: params.traceId } : {}),
            ...(params.context !== undefined ? { context: params.context } : {}),
            ...(params.trace !== undefined ? { trace: params.trace } : {}),
        },
        {
            ...init,
            status: params.status,
            headers: {
                ...(init?.headers ?? {}),
            },
        },
    );

/**
 * Checks whether the request asked for `text/event-stream`.
 */
export const requestsEventStream = (request: Request): boolean =>
    (request.headers.get("accept") ?? "").includes("text/event-stream");

/**
 * Creates an SSE response from an async iterable.
 */
export const toSseResponse = (params: {
    events: AsyncIterable<unknown>;
    streamId?: string;
    runId?: string;
    useEventIds?: boolean;
    signal?: AbortSignal;
    heartbeatMs?: number;
    onDisconnect?: () => void | Promise<void>;
}): Response => {
    const encoder = new TextEncoder();
    let disconnectHandled = false;
    const handleDisconnect = () => {
        if (disconnectHandled) return;
        disconnectHandled = true;
        void params.onDisconnect?.();
    };
    const stream = new ReadableStream({
        async start(controller) {
            const heartbeatMs = params.heartbeatMs ?? 15000;
            const heartbeat = setInterval(() => {
                try {
                    controller.enqueue(encoder.encode(":\n\n"));
                } catch {
                    clearInterval(heartbeat);
                }
            }, heartbeatMs);
            const onAbort = () => {
                clearInterval(heartbeat);
                handleDisconnect();
                try {
                    controller.close();
                } catch {}
            };

            if (params.signal?.aborted) {
                onAbort();
                return;
            }

            params.signal?.addEventListener("abort", onAbort, { once: true });

            try {
                for await (const event of params.events) {
                    if (params.signal?.aborted) {
                        break;
                    }

                    const payload =
                        params.useEventIds &&
                        isPlainRecord(event) &&
                        typeof event.seq === "number" &&
                        Number.isFinite(event.seq)
                            ? `id: ${event.seq}\ndata: ${JSON.stringify(event)}\n\n`
                            : `data: ${JSON.stringify(event)}\n\n`;
                    controller.enqueue(encoder.encode(payload));
                }
            } catch (error) {
                const payload = JSON.stringify({
                    type: "error",
                    message: error instanceof Error ? error.message : "Stream failed",
                });
                controller.enqueue(encoder.encode(`event: error\ndata: ${payload}\n\n`));
            } finally {
                clearInterval(heartbeat);
                params.signal?.removeEventListener("abort", onAbort);
                try {
                    controller.close();
                } catch {}
            }
        },
        cancel() {
            handleDisconnect();
        },
    });

    return new Response(stream, {
        headers: {
            "content-type": "text/event-stream",
            "cache-control": "no-cache",
            ...(params.streamId !== undefined ? { "x-stream-id": params.streamId } : {}),
            ...(params.runId !== undefined ? { "x-run-id": params.runId } : {}),
        },
    });
};

/**
 * Parses `Last-Event-ID` into an `afterSeq` value.
 */
export const parseAfterFromRequest = (request: Request): number | undefined => {
    const lastEventId = request.headers.get("last-event-id");
    if (!lastEventId) {
        return undefined;
    }

    const after = Number(lastEventId);
    return Number.isFinite(after) ? after : undefined;
};

const normalizeValidationIssues = (issues: unknown, fallbackMessage: string): ValidationIssue[] => {
    if (!Array.isArray(issues)) {
        return [toValidationIssue(fallbackMessage)];
    }

    return issues.map((issue) =>
        isPlainRecord(issue) && typeof issue.message === "string"
            ? {
                  message: issue.message,
                  path:
                      typeof issue.path === "string"
                          ? issue.path
                          : typeof issue.instancePath === "string"
                            ? issue.instancePath || "/"
                            : "/",
              }
            : toValidationIssue(fallbackMessage),
    );
};

/**
 * Converts an unknown server error into a public HTTP response.
 */
export const toServerErrorResponse = (error: unknown): Response => {
    const wrapped =
        error instanceof BetterAgentError
            ? error
            : BetterAgentError.wrap({
                  err: error,
                  message: "Server request failed",
                  opts: {
                      code: "INTERNAL",
                      trace: [{ at: "core.server.handle" }],
                  },
              });

    const safeMessage = wrapped.code === "INTERNAL" ? "Server request failed." : wrapped.message;
    const issues =
        wrapped.code === "VALIDATION_FAILED"
            ? normalizeValidationIssues(wrapped.context?.issues, wrapped.message)
            : undefined;
    const safeContext = wrapped.code === "INTERNAL" ? undefined : wrapped.context;
    const safeTrace = wrapped.code === "INTERNAL" ? undefined : wrapped.trace;

    return jsonErrorResponse({
        code: String(wrapped.code ?? "INTERNAL"),
        message: safeMessage,
        status: wrapped.status,
        retryable: wrapped.retryable,
        issues,
        traceId: wrapped.traceId,
        context: safeContext,
        trace: safeTrace,
    });
};
