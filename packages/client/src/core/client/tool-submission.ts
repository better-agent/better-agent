import type { ClientConfig } from "../../types/client";
import { throwRequestError } from "./errors";
import { mergeHeaders, prepareRequest } from "./request";

type ToolSubmissionDeps = {
    advanced: ClientConfig["advanced"] | undefined;
    baseURL: string;
    defaultHeaders?: Headers | Record<string, string>;
    doFetch: typeof fetch;
    secret?: string;
    toolSubmissionMaxAttempts: number;
    toolSubmissionRetryDelayMs: number;
};

type SubmitToolResultParams = {
    agent: string;
    runId: string;
    toolCallId: string;
    result?: unknown;
    error?: string;
};

type SubmitToolApprovalParams = {
    agent: string;
    runId: string;
    toolCallId: string;
    decision: "approved" | "denied";
    note?: string;
    actorId?: string;
};

const sleep = async (ms: number) => {
    await new Promise((resolve) => setTimeout(resolve, ms));
};

export const createToolSubmissionHandlers = (deps: ToolSubmissionDeps) => {
    const doFetch = deps.doFetch;
    const authHeaders = deps.secret ? { authorization: `Bearer ${deps.secret}` } : undefined;

    const submitToolResult = async (params: SubmitToolResultParams) => {
        const payload = JSON.stringify({
            runId: params.runId,
            toolCallId: params.toolCallId,
            ...(params.error !== undefined
                ? { status: "error", error: params.error }
                : { status: "success", result: params.result }),
        });

        for (let attempt = 1; attempt <= deps.toolSubmissionMaxAttempts; attempt++) {
            try {
                const prepared = await prepareRequest(deps.advanced, {
                    operation: "tool-result",
                    url: `${deps.baseURL}/${encodeURIComponent(params.agent)}/run/tool-result`,
                    method: "POST",
                    headers: mergeHeaders(
                        authHeaders,
                        { "content-type": "application/json" },
                        deps.defaultHeaders,
                    ),
                    body: payload,
                });

                const res = await doFetch(prepared.url, {
                    method: prepared.method,
                    headers: prepared.headers,
                    body: prepared.body,
                });

                if (res.ok) return;

                const isRetryable = res.status >= 500 || res.status === 429;

                if (!isRetryable || attempt === deps.toolSubmissionMaxAttempts) {
                    await throwRequestError({
                        response: res,
                        operation: "tool-result",
                        at: "client.core.submitToolResult",
                        context: {
                            agentName: params.agent,
                            runId: params.runId,
                            toolCallId: params.toolCallId,
                        },
                    });
                }

                await sleep(deps.toolSubmissionRetryDelayMs * attempt);
            } catch (error) {
                const wrapped =
                    error instanceof Error
                        ? error
                        : new Error("Tool result submission failed.", { cause: error });
                if (attempt === deps.toolSubmissionMaxAttempts) throw wrapped;
                await sleep(deps.toolSubmissionRetryDelayMs * attempt);
            }
        }
    };

    const submitToolApproval = async (params: SubmitToolApprovalParams) => {
        const payload = JSON.stringify({
            runId: params.runId,
            toolCallId: params.toolCallId,
            decision: params.decision,
            ...(params.note !== undefined ? { note: params.note } : {}),
            ...(params.actorId !== undefined ? { actorId: params.actorId } : {}),
        });

        for (let attempt = 1; attempt <= deps.toolSubmissionMaxAttempts; attempt++) {
            try {
                const prepared = await prepareRequest(deps.advanced, {
                    operation: "tool-approval",
                    url: `${deps.baseURL}/${encodeURIComponent(params.agent)}/run/tool-approval`,
                    method: "POST",
                    headers: mergeHeaders(
                        authHeaders,
                        { "content-type": "application/json" },
                        deps.defaultHeaders,
                    ),
                    body: payload,
                });

                const res = await doFetch(prepared.url, {
                    method: prepared.method,
                    headers: prepared.headers,
                    body: prepared.body,
                });

                if (res.ok) return;

                const isRetryable = res.status >= 500 || res.status === 429;
                if (!isRetryable || attempt === deps.toolSubmissionMaxAttempts) {
                    await throwRequestError({
                        response: res,
                        operation: "tool-approval",
                        at: "client.core.submitToolApproval",
                        context: {
                            agentName: params.agent,
                            runId: params.runId,
                            toolCallId: params.toolCallId,
                            decision: params.decision,
                        },
                    });
                }

                await sleep(deps.toolSubmissionRetryDelayMs * attempt);
            } catch (error) {
                const wrapped =
                    error instanceof Error
                        ? error
                        : new Error("Tool approval submission failed.", { cause: error });
                if (attempt === deps.toolSubmissionMaxAttempts) throw wrapped;
                await sleep(deps.toolSubmissionRetryDelayMs * attempt);
            }
        }
    };

    return {
        submitToolApproval,
        submitToolResult,
    };
};
