import { BetterAgentError } from "@better-agent/shared/errors";
import type { PrepareRequestContext } from "../../types/client";

type ParsedErrorBody = {
    error?: unknown;
    code?: unknown;
    message?: unknown;
    detail?: unknown;
    title?: unknown;
    status?: unknown;
    retryable?: unknown;
    traceId?: unknown;
    context?: unknown;
    issues?: unknown;
    trace?: unknown;
};

const tryParseJson = (bodyText: string): ParsedErrorBody | null => {
    try {
        return JSON.parse(bodyText) as ParsedErrorBody;
    } catch {
        return null;
    }
};

const parseErrorBody = (bodyText: string) => {
    let errorCodeFromBody: string | undefined;
    let errorMessageFromBody: string | undefined;
    let errorTitleFromBody: string | undefined;
    let errorStatusFromBody: number | undefined;
    let retryableFromBody: boolean | undefined;
    let traceIdFromBody: string | undefined;
    let issuesFromBody: unknown[] | undefined;
    let contextFromBody: Record<string, unknown> | undefined;
    let traceFromBody: Array<{ at: string; data?: Record<string, unknown> }> | undefined;

    if (bodyText.length > 0) {
        const parsed = tryParseJson(bodyText);
        if (parsed) {
            if (typeof parsed.code === "string") errorCodeFromBody = parsed.code;
            else if (typeof parsed.error === "string") errorCodeFromBody = parsed.error;
            if (typeof parsed.message === "string") errorMessageFromBody = parsed.message;
            else if (typeof parsed.detail === "string") errorMessageFromBody = parsed.detail;
            if (typeof parsed.title === "string") errorTitleFromBody = parsed.title;
            if (typeof parsed.status === "number") errorStatusFromBody = parsed.status;
            if (typeof parsed.retryable === "boolean") retryableFromBody = parsed.retryable;
            if (typeof parsed.traceId === "string") traceIdFromBody = parsed.traceId;
            if (Array.isArray(parsed.issues)) issuesFromBody = parsed.issues;
            if (typeof parsed.context === "object" && parsed.context !== null) {
                contextFromBody = parsed.context as Record<string, unknown>;
            }
            if (Array.isArray(parsed.trace)) {
                traceFromBody = parsed.trace as Array<{
                    at: string;
                    data?: Record<string, unknown>;
                }>;
            }
        }
    }

    return {
        errorCodeFromBody,
        errorMessageFromBody,
        errorTitleFromBody,
        errorStatusFromBody,
        retryableFromBody,
        traceIdFromBody,
        issuesFromBody,
        contextFromBody,
        traceFromBody,
    };
};

const getContentType = (response: Response): string =>
    response.headers.get("content-type")?.toLowerCase() ?? "";

const isHtmlResponse = (response: Response): boolean =>
    getContentType(response).includes("text/html");

const truncateForContext = (value: string, maxLength = 300): string =>
    value.length <= maxLength ? value : `${value.slice(0, maxLength)}...`;

export const throwRequestError = async (params: {
    response: Response;
    operation: PrepareRequestContext["operation"];
    at: string;
    context: Record<string, unknown>;
}) => {
    const bodyText = (await params.response.text().catch(() => "")).trim();
    const {
        errorCodeFromBody,
        errorMessageFromBody,
        errorTitleFromBody,
        errorStatusFromBody,
        retryableFromBody,
        traceIdFromBody,
        issuesFromBody,
        contextFromBody,
        traceFromBody,
    } = parseErrorBody(bodyText);

    const fallbackDetail = isHtmlResponse(params.response)
        ? "Server returned an HTML error page. This usually means a framework or dev-server failure before the API handler ran."
        : params.response.statusText || "Unknown error";

    const detail =
        errorMessageFromBody ??
        (bodyText.length > 0 && !isHtmlResponse(params.response) ? bodyText : undefined) ??
        fallbackDetail;

    const error = Object.assign(
        BetterAgentError.fromCode(
            errorCodeFromBody ??
                (params.response.status >= 500 || params.response.status === 429
                    ? "UPSTREAM_FAILED"
                    : "BAD_REQUEST"),
            detail,
            {
                title: errorTitleFromBody,
                status: errorStatusFromBody ?? params.response.status,
                retryable: retryableFromBody,
                traceId: traceIdFromBody,
                context: {
                    ...params.context,
                    operation: params.operation,
                    status: params.response.status,
                    ...(contextFromBody ?? {}),
                    error: errorCodeFromBody,
                    issues: issuesFromBody,
                    ...(isHtmlResponse(params.response) && bodyText.length > 0
                        ? {
                              responseContentType: getContentType(params.response),
                              responseBodySnippet: truncateForContext(bodyText),
                          }
                        : {}),
                },
                trace: [...(traceFromBody ?? []), { at: params.at }],
            },
        ),
        issuesFromBody ? { issues: issuesFromBody } : {},
    );

    throw error;
};
