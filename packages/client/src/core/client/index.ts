import type {
    BetterAgentClient,
    ClientConfig,
    ReplayInput,
    RequestOptions,
    StreamRequestOptions,
    ToolCallContext,
} from "../../types/client";
import type {
    AgentNameFromApp,
    ModalitiesForAgent,
    NormalizeClientApp,
    RunInputForAgent,
} from "../../types/client-type-helpers";
import { parseSse } from "../sse";
import { throwRequestError } from "./errors";
import { mergeHeaders, prepareRequest } from "./request";
import { createToolSubmissionHandlers } from "./tool-submission";

/**
 * Creates a Better Agent client.
 *
 * @param config Client configuration.
 * @returns A typed client.
 *
 * @example
 * ```ts
 * import { createClient } from "@better-agent/client";
 *
 * const client = createClient({
 *   baseURL: "http://localhost:3000/api",
 *   secret: "dev_secret",
 * });
 *
 * const result = await client.run("helloAgent", {
 *   input: "Write one short sentence about TypeScript.",
 * });
 * ```
 *
 * @example
 * ```ts
 * import type ba from "./better-agent/server";
 * import { createClient } from "@better-agent/client";
 *
 * const client = createClient<typeof ba>({
 *   baseURL: "http://localhost:3000/api",
 *   secret: "dev_secret",
 *   toolHandlers: {
 *     getClientTime: () => ({ now: new Date().toISOString() }),
 *   },
 * });
 *
 * for await (const event of client.stream("helloAgent", {
 *   input: "Use tools if needed.",
 * })) {
 *   console.log(event.type);
 * }
 * ```
 */
export const createClient = <TApp = unknown>(
    config: ClientConfig<TApp>,
): BetterAgentClient<NormalizeClientApp<TApp>> => {
    type TClientApp = NormalizeClientApp<TApp>;

    const baseURL = config.baseURL.replace(/\/$/, "");
    const doFetch = config.fetch ?? fetch;
    const advanced = config.advanced;
    const authHeaders = config.secret ? { authorization: `Bearer ${config.secret}` } : undefined;

    const toolSubmissionMaxAttempts = Math.max(
        1,
        Math.floor(advanced?.toolSubmissionMaxAttempts ?? 3),
    );
    const toolSubmissionRetryDelayMs = Math.max(0, advanced?.toolSubmissionRetryDelayMs ?? 150);

    const { submitToolResult, submitToolApproval } = createToolSubmissionHandlers({
        advanced,
        baseURL,
        defaultHeaders: config.headers,
        doFetch,
        secret: config.secret,
        toolSubmissionMaxAttempts,
        toolSubmissionRetryDelayMs,
    });

    const client = {
        async run<
            TAgentName extends AgentNameFromApp<TClientApp>,
            const TModalities extends
                | ModalitiesForAgent<TClientApp, TAgentName>
                | undefined = undefined,
        >(
            agent: TAgentName,
            input: RunInputForAgent<TClientApp, TAgentName, TModalities>,
            options?: RequestOptions<TClientApp>,
        ) {
            const request = { agent, ...input };
            const prepared = await prepareRequest(advanced, {
                operation: "run",
                url: `${baseURL}/${encodeURIComponent(String(agent))}/run`,
                method: "POST",
                headers: mergeHeaders(
                    authHeaders,
                    { "content-type": "application/json" },
                    config.headers,
                    options?.headers,
                ),
                body: JSON.stringify(request),
            });

            const res = await doFetch(prepared.url, {
                method: prepared.method,
                headers: prepared.headers,
                ...(prepared.body !== undefined ? { body: prepared.body } : {}),
                signal: options?.signal ?? null,
            });
            options?.onResponse?.(res);
            if (!res.ok) {
                await throwRequestError({
                    response: res,
                    operation: "run",
                    at: "client.core.run",
                    context: { agentName: agent },
                });
            }

            return await res.json();
        },

        stream<
            TAgentName extends AgentNameFromApp<TClientApp>,
            const TModalities extends
                | ModalitiesForAgent<TClientApp, TAgentName>
                | undefined = undefined,
        >(
            agent: TAgentName,
            input: RunInputForAgent<TClientApp, TAgentName, TModalities>,
            options?: StreamRequestOptions<TClientApp>,
        ) {
            const request = { agent, ...input };

            return (async function* () {
                const pendingToolCalls = new Map<string, PendingToolCall>();
                const toolCallController = new AbortController();
                // Local tool handlers should stop when the stream ends or the caller aborts.
                const abortToolCalls = () => {
                    if (!toolCallController.signal.aborted) toolCallController.abort();
                };

                const externalSignal = options?.signal;
                // Forward the caller's abort signal into the client-tool execution context.
                const onExternalAbort = () => abortToolCalls();
                if (externalSignal) {
                    if (externalSignal.aborted) {
                        abortToolCalls();
                    } else {
                        externalSignal.addEventListener("abort", onExternalAbort, {
                            once: true,
                        });
                    }
                }

                const processClientToolCall = async (
                    toolCallKey: string,
                    runId: string,
                    toolCallId: string,
                ) => {
                    const pending = pendingToolCalls.get(toolCallKey);
                    // Execute each client tool once, and only after args are complete and approval allows it.
                    if (
                        !pending ||
                        pending.submitted ||
                        !pending.ended ||
                        (pending.approvalState !== "waiting" &&
                            pending.approvalState !== "approved")
                    ) {
                        return;
                    }

                    pending.submitted = true;

                    let parsedArgs: unknown = {};
                    try {
                        parsedArgs = pending.argsJson ? JSON.parse(pending.argsJson) : {};
                    } catch {
                        await submitToolResult({
                            agent: String(agent),
                            runId,
                            toolCallId,
                            error: `Invalid client tool arguments for '${pending.toolName}'.`,
                        });
                        return;
                    }

                    const context: ToolCallContext<TClientApp> = {
                        agent,
                        runId,
                        toolCallId,
                        // Client tool handlers get a signal that is tied to the stream lifecycle.
                        signal: toolCallController.signal,
                    };

                    const handler = resolveToolHandler(
                        pending.toolName,
                        options,
                        config.toolHandlers,
                    );
                    if (!handler) {
                        await submitToolResult({
                            agent: String(agent),
                            runId,
                            toolCallId,
                            error: `Missing client tool handler for '${pending.toolName}'.`,
                        });
                        return;
                    }

                    try {
                        const result = await Promise.resolve(
                            handler({
                                toolName: pending.toolName,
                                input: parsedArgs,
                                context,
                            }),
                        );
                        await submitToolResult({
                            agent: String(agent),
                            runId,
                            toolCallId,
                            result,
                        });
                    } catch (error) {
                        await submitToolResult({
                            agent: String(agent),
                            runId,
                            toolCallId,
                            error:
                                error instanceof Error
                                    ? error.message
                                    : "Client tool handler failed.",
                        });
                    }
                };

                try {
                    const prepared = await prepareRequest(advanced, {
                        operation: "stream",
                        url: `${baseURL}/${encodeURIComponent(String(agent))}/run`,
                        method: "POST",
                        headers: mergeHeaders(
                            authHeaders,
                            {
                                "content-type": "application/json",
                                accept: "text/event-stream",
                            },
                            config.headers,
                            options?.headers,
                        ),
                        body: JSON.stringify({ ...request, stream: true }),
                    });

                    const res = await doFetch(prepared.url, {
                        method: prepared.method,
                        headers: prepared.headers,
                        body: prepared.body,
                        signal: options?.signal ?? null,
                    });
                    options?.onResponse?.(res);
                    if (!res.ok) {
                        await throwRequestError({
                            response: res,
                            operation: "stream",
                            at: "client.core.stream",
                            context: { agentName: agent },
                        });
                    }

                    if (!res.body) return;

                    for await (const ev of parseSse(res.body)) {
                        if (ev.type === "TOOL_CALL_START") {
                            if (ev.toolTarget !== "client") {
                                yield ev;
                                continue;
                            }
                            if (typeof ev.runId === "string") {
                                pendingToolCalls.set(getToolCallKey(ev.runId, ev.toolCallId), {
                                    toolName: ev.toolCallName,
                                    argsJson: "",
                                    ended: false,
                                    submitted: false,
                                    approvalState: "waiting",
                                });
                            }
                        } else if (ev.type === "TOOL_CALL_ARGS") {
                            if (typeof ev.runId !== "string") {
                                yield ev;
                                continue;
                            }
                            const pending = pendingToolCalls.get(
                                getToolCallKey(ev.runId, ev.toolCallId),
                            );
                            if (pending) pending.argsJson += ev.delta;
                        } else if (ev.type === "TOOL_CALL_END" && typeof ev.runId === "string") {
                            const toolCallKey = getToolCallKey(ev.runId, ev.toolCallId);
                            const pending = pendingToolCalls.get(toolCallKey);
                            if (pending) {
                                pending.ended = true;
                                await processClientToolCall(toolCallKey, ev.runId, ev.toolCallId);
                            }
                        } else if (
                            (ev.type === "TOOL_APPROVAL_REQUIRED" ||
                                ev.type === "TOOL_APPROVAL_UPDATED") &&
                            ev.toolTarget === "client" &&
                            typeof ev.runId === "string"
                        ) {
                            const toolCallKey = getToolCallKey(ev.runId, ev.toolCallId);
                            const pending = pendingToolCalls.get(toolCallKey);
                            if (pending) {
                                pending.approvalState =
                                    ev.state === "approved"
                                        ? "approved"
                                        : ev.state === "requested"
                                          ? "requested"
                                          : ev.state === "denied"
                                            ? "denied"
                                            : "expired";

                                if (
                                    pending.approvalState === "denied" ||
                                    pending.approvalState === "expired"
                                ) {
                                    pending.submitted = true;
                                    pendingToolCalls.delete(toolCallKey);
                                } else if (pending.approvalState === "approved") {
                                    await processClientToolCall(
                                        toolCallKey,
                                        ev.runId,
                                        ev.toolCallId,
                                    );
                                }
                            }
                        }

                        if (
                            ev.type === "RUN_ABORTED" ||
                            ev.type === "RUN_ERROR" ||
                            ev.type === "RUN_FINISHED"
                        ) {
                            // Once the run ends, any local tool work should stop and completed entries can be dropped.
                            for (const [toolCallKey, pending] of pendingToolCalls) {
                                if (pending.submitted) pendingToolCalls.delete(toolCallKey);
                            }
                            abortToolCalls();
                        }

                        yield ev;
                    }
                } finally {
                    abortToolCalls();
                    if (externalSignal) {
                        externalSignal.removeEventListener("abort", onExternalAbort);
                    }
                    pendingToolCalls.clear();
                }
            })();
        },

        resumeStream<TAgentName extends AgentNameFromApp<TClientApp>>(
            agent: TAgentName,
            input: ReplayInput,
            options?: RequestOptions<TClientApp>,
        ) {
            return (async function* () {
                const searchParams = new URLSearchParams();
                searchParams.set("streamId", input.streamId);

                const headers = mergeHeaders(
                    authHeaders,
                    { accept: "text/event-stream" },
                    config.headers,
                    options?.headers,
                );

                if (typeof input.afterSeq === "number") {
                    headers.set("last-event-id", String(input.afterSeq));
                }

                const prepared = await prepareRequest(advanced, {
                    operation: "resume-stream",
                    url: `${baseURL}/${encodeURIComponent(String(agent))}/stream-events/resume?${searchParams.toString()}`,
                    method: "GET",
                    headers,
                });

                const res = await doFetch(prepared.url, {
                    method: prepared.method,
                    headers: prepared.headers,
                    ...(prepared.body !== undefined ? { body: prepared.body } : {}),
                    signal: options?.signal ?? null,
                });
                options?.onResponse?.(res);
                if (res.status === 204) return;
                if (!res.ok) {
                    await throwRequestError({
                        response: res,
                        operation: "resume-stream",
                        at: "client.core.resumeStream",
                        context: { agentName: agent },
                    });
                }
                if (!res.body) return;

                for await (const ev of parseSse(res.body)) {
                    yield ev;
                }
            })();
        },

        resumeConversation<TAgentName extends AgentNameFromApp<TClientApp>>(
            agent: TAgentName,
            input: { conversationId: string; afterSeq?: number },
            options?: RequestOptions<TClientApp>,
        ) {
            return (async function* () {
                const headers = mergeHeaders(
                    authHeaders,
                    { accept: "text/event-stream" },
                    config.headers,
                    options?.headers,
                );

                if (typeof input.afterSeq === "number") {
                    headers.set("last-event-id", String(input.afterSeq));
                }

                const prepared = await prepareRequest(advanced, {
                    operation: "resume-conversation",
                    url: `${baseURL}/${encodeURIComponent(String(agent))}/conversations/${encodeURIComponent(input.conversationId)}/resume`,
                    method: "GET",
                    headers,
                });

                const res = await doFetch(prepared.url, {
                    method: prepared.method,
                    headers: prepared.headers,
                    ...(prepared.body !== undefined ? { body: prepared.body } : {}),
                    signal: options?.signal ?? null,
                });
                options?.onResponse?.(res);
                if (res.status === 204) return;
                if (!res.ok) {
                    await throwRequestError({
                        response: res,
                        operation: "resume-conversation",
                        at: "client.core.resumeConversation",
                        context: { agentName: agent, conversationId: input.conversationId },
                    });
                }
                if (!res.body) return;

                for await (const ev of parseSse(res.body)) {
                    yield ev;
                }
            })();
        },

        async loadConversation(
            agent: AgentNameFromApp<TClientApp>,
            conversationId: string,
            options?: RequestOptions<TClientApp>,
        ) {
            const prepared = await prepareRequest(advanced, {
                operation: "load-conversation",
                url: `${baseURL}/${encodeURIComponent(String(agent))}/conversations/${encodeURIComponent(conversationId)}`,
                method: "GET",
                headers: mergeHeaders(authHeaders, config.headers, options?.headers),
            });

            const res = await doFetch(prepared.url, {
                method: prepared.method,
                headers: prepared.headers,
                ...(prepared.body !== undefined ? { body: prepared.body } : {}),
                signal: options?.signal ?? null,
            });
            options?.onResponse?.(res);
            if (res.status === 204) {
                return null;
            }
            if (!res.ok) {
                await throwRequestError({
                    response: res,
                    operation: "load-conversation",
                    at: "client.core.loadConversation",
                    context: { agentName: agent, conversationId },
                });
            }

            return await res.json();
        },

        async abortRun(
            req: Parameters<BetterAgentClient<TClientApp>["abortRun"]>[0],
            options?: Parameters<BetterAgentClient<TClientApp>["abortRun"]>[1],
        ) {
            const prepared = await prepareRequest(advanced, {
                operation: "abort-run",
                url: `${baseURL}/${encodeURIComponent(String(req.agent))}/runs/${encodeURIComponent(req.runId)}/abort`,
                method: "POST",
                headers: mergeHeaders(authHeaders, config.headers, options?.headers),
            });

            const res = await doFetch(prepared.url, {
                method: prepared.method,
                headers: prepared.headers,
                ...(prepared.body !== undefined ? { body: prepared.body } : {}),
                signal: options?.signal ?? null,
            });
            options?.onResponse?.(res);
            if (res.status === 204) {
                return;
            }
            if (!res.ok) {
                await throwRequestError({
                    response: res,
                    operation: "abort-run",
                    at: "client.core.abortRun",
                    context: { agentName: req.agent, runId: req.runId },
                });
            }
        },

        async submitToolResult(
            req: Parameters<BetterAgentClient<TClientApp>["submitToolResult"]>[0],
        ) {
            await submitToolResult({
                ...req,
                agent: String(req.agent),
            });
        },

        async submitToolApproval(
            req: Parameters<BetterAgentClient<TClientApp>["submitToolApproval"]>[0],
        ) {
            await submitToolApproval({
                ...req,
                agent: String(req.agent),
            });
        },
    };

    return client as BetterAgentClient<TClientApp>;
};

type PendingToolCall = {
    toolName: string;
    argsJson: string;
    ended: boolean;
    submitted: boolean;
    approvalState: "waiting" | "requested" | "approved" | "denied" | "expired";
};

const getToolCallKey = (runId: string, toolCallId: string) => `${runId}:${toolCallId}`;

// Resolve client tool handlers in request-first order, then normalize map handlers
// to the same `{ toolName, input, context }` shape used by `onToolCall`.
const resolveToolHandler = <TClientApp>(
    toolName: string,
    options: StreamRequestOptions<TClientApp> | undefined,
    staticToolHandlers: ClientConfig<TClientApp>["toolHandlers"] | undefined,
) => {
    const requestHandler = options?.onToolCall;
    const requestToolHandlers = options?.toolHandlers as
        | Record<
              string,
              (input: unknown, context: ToolCallContext<TClientApp>) => unknown | Promise<unknown>
          >
        | undefined;
    const requestToolHandler = requestToolHandlers?.[toolName];
    const staticHandlers = staticToolHandlers as
        | Record<
              string,
              (input: unknown, context: ToolCallContext<TClientApp>) => unknown | Promise<unknown>
          >
        | undefined;
    const staticHandler = staticHandlers?.[toolName];

    return (
        requestHandler ??
        (requestToolHandler
            ? (params: {
                  toolName: string;
                  input: unknown;
                  context: ToolCallContext<TClientApp>;
              }) => requestToolHandler(params.input, params.context)
            : undefined) ??
        (staticHandler
            ? (params: {
                  toolName: string;
                  input: unknown;
                  context: ToolCallContext<TClientApp>;
              }) => staticHandler(params.input, params.context)
            : undefined)
    );
};
