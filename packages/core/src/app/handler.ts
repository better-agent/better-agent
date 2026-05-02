import { BetterAgentError, toProblemDetails } from "@better-agent/shared/errors";
import { isRecord } from "@better-agent/shared/utils";
import { type Endpoint, type HTTPMethod, createEndpoint, createRouter } from "better-call";
import type { AnyDefinedAgent } from "../agent";
import {
    assertAgentAccess,
    resolveAuth,
    resolveDefaultScope,
    throwForbidden,
    throwUnauthorized,
} from "../auth/runtime";
import type { AuthContext } from "../auth/types";
import { type AgentMemory, type MemoryThread, defaultGenerateMemoryId } from "../memory";
import { createPluginRuntime } from "../plugins";
import { type RunRecord, type StreamRecord, storageTables } from "../storage";
import { getInterruptedRunInterrupts, resolveUnsupportedStorageTable } from "./helpers";
import type { BetterAgentApp } from "./types";

export interface CreateBetterAgentHandlerOptions {
    basePath?: string;
}

const wantsEventStream = (request: Request): boolean => {
    return (request.headers.get("accept") ?? "").includes("text/event-stream");
};

const toThreadResponse = (thread: MemoryThread) => ({
    id: thread.id,
    agentName: thread.agentName,
    title: thread.title,
    state: thread.state,
    metadata: thread.metadata,
    createdAt: thread.createdAt,
    updatedAt: thread.updatedAt,
});

const toErrorResponse = (error: unknown): Response => {
    const betterError =
        error instanceof BetterAgentError
            ? error
            : BetterAgentError.wrap({
                  err: error,
                  opts: { code: "INTERNAL" },
              });
    const problem = toProblemDetails(betterError);

    return Response.json(problem, {
        status: problem.status,
        headers: {
            "content-type": "application/problem+json",
        },
    });
};

export function createBetterAgentHandler(
    app: BetterAgentApp,
    options: CreateBetterAgentHandlerOptions = {},
) {
    const pluginRuntime = createPluginRuntime(app.config.plugins);

    const runPluginGuards = async (input: {
        agentName: string;
        body?: unknown;
        request: Request;
        auth: AuthContext | null;
    }): Promise<Response | null> => {
        if (!pluginRuntime.hasGuards) {
            return null;
        }

        return pluginRuntime.dispatchGuard({
            agentName: input.agentName,
            input: isRecord(input.body) ? input.body : {},
            request: input.request,
            auth: input.auth,
        });
    };

    const getAgent = (name: string): AnyDefinedAgent => {
        return app.agent(name).definition;
    };

    const getAgentMemory = (name: string): AgentMemory | undefined => {
        const handle = app.agent(name);
        return "memory" in handle ? (handle.memory as AgentMemory) : undefined;
    };

    const requireMemory = (agent: AnyDefinedAgent): AgentMemory => {
        const memory = getAgentMemory(agent.name);
        if (!memory) {
            throw BetterAgentError.fromCode(
                "NOT_FOUND",
                `Agent '${agent.name}' does not have memory configured.`,
            );
        }

        return memory;
    };

    const resolveMemoryScope = async (input: {
        agentName: string;
        auth: AuthContext | null;
        request: Request;
        memory: AgentMemory;
    }): Promise<string> => {
        if (!app.config.auth) {
            throwForbidden("Remote memory requires app auth to be configured.");
        }

        if (!input.auth) {
            throwUnauthorized();
        }

        const resolver = input.memory.scope;
        const scope = resolver
            ? await resolver({
                  auth: input.auth,
                  request: input.request,
                  agentName: input.agentName,
              })
            : resolveDefaultScope(input.auth);

        if (!scope) {
            throwForbidden("Memory scope could not be resolved for this request.");
        }

        return scope;
    };

    const requireVisibleThread = (input: {
        thread: MemoryThread | undefined;
        threadId: string;
        agentName: string;
        scope: string;
    }): MemoryThread => {
        if (
            !input.thread ||
            input.thread.agentName !== input.agentName ||
            input.thread.scope !== input.scope
        ) {
            throw BetterAgentError.fromCode("NOT_FOUND", `Thread '${input.threadId}' not found.`, {
                context: {
                    threadId: input.threadId,
                    agentName: input.agentName,
                },
            });
        }

        return input.thread;
    };

    const getThreadRequest = async (ctx: { params: { name: string }; request: Request }) => {
        const agent = getAgent(ctx.params.name);
        const memory = requireMemory(agent);
        const auth = await resolveAuth(app.config, ctx.request);
        await assertAgentAccess({
            agent,
            auth,
            request: ctx.request,
            hasAppAuth: Boolean(app.config.auth),
        });
        const scope = await resolveMemoryScope({
            agentName: agent.name,
            auth,
            request: ctx.request,
            memory,
        });

        return { agent, memory, scope };
    };

    const createScopedThread = async (input: {
        agentName: string;
        memory: AgentMemory;
        scope: string;
        title?: string;
        metadata?: Record<string, unknown>;
    }): Promise<MemoryThread> => {
        const now = Date.now();
        const generateId = input.memory.generateId ?? defaultGenerateMemoryId;
        const thread: MemoryThread = {
            id: generateId("thread", {
                agentName: input.agentName,
            }),
            agentName: input.agentName,
            scope: input.scope,
            ...(input.title !== undefined ? { title: input.title } : {}),
            ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
            createdAt: now,
            updatedAt: now,
        };

        await input.memory.threads.set(thread.id, thread);

        return thread;
    };

    const requireRunAccess = async (input: {
        runId: string;
        auth: AuthContext | null;
        request: Request;
    }) => {
        if (!app.config.auth) {
            return;
        }

        if (!input.auth) {
            throwUnauthorized();
        }

        const storage = app.config.storage;
        if (!storage) {
            return;
        }

        const record = await storage.get<RunRecord>(storageTables.runs, input.runId);
        if (!record) {
            throw BetterAgentError.fromCode("NOT_FOUND", `Run '${input.runId}' not found.`, {
                context: { runId: input.runId },
            });
        }

        if (!record.scope) {
            return;
        }

        const agent = getAgent(record.agentName);
        const memory = getAgentMemory(record.agentName);
        const scope = memory
            ? await resolveMemoryScope({
                  agentName: agent.name,
                  auth: input.auth,
                  request: input.request,
                  memory,
              })
            : resolveDefaultScope(input.auth);

        if (record.scope !== scope) {
            throw BetterAgentError.fromCode("NOT_FOUND", `Run '${input.runId}' not found.`, {
                context: { runId: input.runId },
            });
        }
    };

    const run = createEndpoint(
        "/:name/run",
        {
            method: "POST",
            requireRequest: true,
        },
        async (ctx) => {
            try {
                const body = await ctx.body;
                const shouldStream = wantsEventStream(ctx.request);
                const auth = await resolveAuth(app.config, ctx.request);
                const agent = getAgent(ctx.params.name);
                await assertAgentAccess({
                    agent,
                    auth,
                    request: ctx.request,
                    hasAppAuth: Boolean(app.config.auth),
                });
                const guardResponse = await runPluginGuards({
                    agentName: ctx.params.name,
                    body,
                    request: ctx.request,
                    auth,
                });

                if (guardResponse) {
                    return guardResponse;
                }

                const runBody = body;
                const memory = getAgentMemory(ctx.params.name);

                if (isRecord(runBody)) {
                    if ("threadId" in runBody && typeof runBody.threadId !== "string") {
                        throw BetterAgentError.fromCode(
                            "VALIDATION_FAILED",
                            "Run threadId must be a string when provided.",
                        );
                    }

                    if (memory && typeof runBody.threadId === "string") {
                        const scope = await resolveMemoryScope({
                            agentName: agent.name,
                            auth,
                            request: ctx.request,
                            memory,
                        });
                        const thread = await memory.threads.get(runBody.threadId);

                        if (thread) {
                            requireVisibleThread({
                                thread,
                                threadId: runBody.threadId,
                                agentName: agent.name,
                                scope,
                            });
                        } else {
                            await memory.threads.set(runBody.threadId, {
                                id: runBody.threadId,
                                agentName: agent.name,
                                scope,
                                createdAt: Date.now(),
                                updatedAt: Date.now(),
                            });
                        }
                    }
                }

                if (shouldStream) {
                    const abortOnDisconnect =
                        app.config.advanced?.stream?.abortOnDisconnect ?? true;
                    const input = {
                        ...(isRecord(runBody) ? runBody : {}),
                        ...(abortOnDisconnect ? { signal: ctx.request.signal } : {}),
                    };
                    const streamed = await app.agent(ctx.params.name).stream(input);

                    void streamed.final.catch(() => {});

                    return toSseResponse({
                        events: streamed.events,
                        runId: streamed.runId,
                        signal: ctx.request.signal,
                        useEventIds: true,
                        onDisconnect: abortOnDisconnect
                            ? () => app.runs.abort(streamed.runId)
                            : undefined,
                    });
                }

                const input = {
                    ...(isRecord(runBody) ? runBody : {}),
                    signal: ctx.request.signal,
                };
                const result = await app.agent(ctx.params.name).run(input);

                return Response.json(result);
            } catch (error) {
                return toErrorResponse(error);
            }
        },
    );

    const listThreads = createEndpoint(
        "/:name/threads",
        {
            method: "GET",
            requireRequest: true,
        },
        async (ctx) => {
            try {
                const { agent, memory, scope } = await getThreadRequest(ctx);
                const url = new URL(ctx.request.url);
                const limit = Number(url.searchParams.get("limit"));
                const threads = await memory.threads.list({
                    agentName: agent.name,
                    scope,
                    ...(Number.isFinite(limit) && limit > 0 ? { limit } : {}),
                });

                return Response.json({ threads: threads.map(toThreadResponse) });
            } catch (error) {
                return toErrorResponse(error);
            }
        },
    );

    const createThread = createEndpoint(
        "/:name/threads",
        {
            method: "POST",
            requireRequest: true,
        },
        async (ctx) => {
            try {
                const { agent, memory, scope } = await getThreadRequest(ctx);
                const body = await ctx.body;
                const thread = await createScopedThread({
                    agentName: agent.name,
                    memory,
                    scope,
                    ...(isRecord(body) && typeof body.title === "string"
                        ? { title: body.title }
                        : {}),
                    ...(isRecord(body) && isRecord(body.metadata)
                        ? { metadata: body.metadata }
                        : {}),
                });

                return Response.json(toThreadResponse(thread), { status: 201 });
            } catch (error) {
                return toErrorResponse(error);
            }
        },
    );

    const getThread = createEndpoint(
        "/:name/threads/:threadId",
        {
            method: "GET",
            requireRequest: true,
        },
        async (ctx) => {
            try {
                const { agent, memory, scope } = await getThreadRequest(ctx);
                const thread = requireVisibleThread({
                    thread: await memory.threads.get(ctx.params.threadId),
                    threadId: ctx.params.threadId,
                    agentName: agent.name,
                    scope,
                });

                return Response.json(toThreadResponse(thread));
            } catch (error) {
                return toErrorResponse(error);
            }
        },
    );

    const updateThread = createEndpoint(
        "/:name/threads/:threadId",
        {
            method: "PATCH",
            requireRequest: true,
        },
        async (ctx) => {
            try {
                const { agent, memory, scope } = await getThreadRequest(ctx);
                const current = requireVisibleThread({
                    thread: await memory.threads.get(ctx.params.threadId),
                    threadId: ctx.params.threadId,
                    agentName: agent.name,
                    scope,
                });
                const body = await ctx.body;
                const next: MemoryThread = {
                    ...current,
                    ...(isRecord(body) && typeof body.title === "string"
                        ? { title: body.title }
                        : {}),
                    ...(isRecord(body) && isRecord(body.metadata)
                        ? { metadata: body.metadata }
                        : {}),
                    updatedAt: Date.now(),
                };

                await memory.threads.set(ctx.params.threadId, next);

                return Response.json(toThreadResponse(next));
            } catch (error) {
                return toErrorResponse(error);
            }
        },
    );

    const deleteThread = createEndpoint(
        "/:name/threads/:threadId",
        {
            method: "DELETE",
            requireRequest: true,
        },
        async (ctx) => {
            try {
                const { agent, memory, scope } = await getThreadRequest(ctx);
                const thread = await memory.threads.get(ctx.params.threadId);
                if (!thread) {
                    return Response.json({});
                }

                requireVisibleThread({
                    thread,
                    threadId: ctx.params.threadId,
                    agentName: agent.name,
                    scope,
                });

                await memory.threads.delete(ctx.params.threadId);

                return new Response(null, { status: 204 });
            } catch (error) {
                return toErrorResponse(error);
            }
        },
    );

    const listMessages = createEndpoint(
        "/:name/threads/:threadId/messages",
        {
            method: "GET",
            requireRequest: true,
        },
        async (ctx) => {
            try {
                const { agent, memory, scope } = await getThreadRequest(ctx);
                requireVisibleThread({
                    thread: await memory.threads.get(ctx.params.threadId),
                    threadId: ctx.params.threadId,
                    agentName: agent.name,
                    scope,
                });
                const url = new URL(ctx.request.url);
                const limit = Number(url.searchParams.get("limit"));
                const beforeRunId = url.searchParams.get("beforeRunId") ?? undefined;
                const messages = await memory.messages.list({
                    threadId: ctx.params.threadId,
                    ...(Number.isFinite(limit) && limit > 0 ? { limit } : {}),
                    ...(beforeRunId ? { beforeRunId } : {}),
                });

                return Response.json({ messages });
            } catch (error) {
                return toErrorResponse(error);
            }
        },
    );

    const getThreadRuntime = createEndpoint(
        "/:name/threads/:threadId/runtime",
        {
            method: "GET",
            requireRequest: true,
        },
        async (ctx) => {
            try {
                const { agent, memory, scope } = await getThreadRequest(ctx);
                requireVisibleThread({
                    thread: await memory.threads.get(ctx.params.threadId),
                    threadId: ctx.params.threadId,
                    agentName: agent.name,
                    scope,
                });

                const storage = app.config.storage;
                if (!storage) {
                    return Response.json({});
                }

                const latestRunResult = await resolveUnsupportedStorageTable(() =>
                    storage.list<RunRecord>(storageTables.runs, {
                        where: { threadId: ctx.params.threadId },
                        orderBy: { startedAt: "desc" },
                        take: 1,
                    }),
                );
                const latestRun = latestRunResult.supported
                    ? latestRunResult.value.items[0]
                    : undefined;

                if (!latestRun || latestRun.agentName !== agent.name) {
                    return Response.json({});
                }

                if (latestRun.status === "interrupted") {
                    const interrupts = getInterruptedRunInterrupts(latestRun);
                    return Response.json(
                        interrupts.length > 0
                            ? {
                                  interrupted: {
                                      runId: latestRun.runId,
                                      interrupts,
                                  },
                              }
                            : {},
                    );
                }

                if (latestRun.status !== "running") {
                    return Response.json({});
                }

                const streamResult = await resolveUnsupportedStorageTable(() =>
                    storage.get<StreamRecord>(storageTables.streams, latestRun.runId),
                );
                const stream = streamResult.supported ? streamResult.value : undefined;

                return Response.json(
                    stream?.status === "open"
                        ? {
                              resumable: {
                                  runId: latestRun.runId,
                                  afterSequence: 0,
                              },
                          }
                        : {},
                );
            } catch (error) {
                return toErrorResponse(error);
            }
        },
    );

    const abort = createEndpoint(
        "/runs/:runId/abort",
        {
            method: "POST",
            requireRequest: true,
        },
        async (ctx) => {
            try {
                const auth = await resolveAuth(app.config, ctx.request);
                await requireRunAccess({
                    runId: ctx.params.runId,
                    auth,
                    request: ctx.request,
                });

                const guardResponse = await runPluginGuards({
                    agentName: "",
                    request: ctx.request,
                    auth,
                });

                if (guardResponse) {
                    return guardResponse;
                }

                await app.runs.abort(ctx.params.runId);

                return new Response(null, { status: 204 });
            } catch (error) {
                return toErrorResponse(error);
            }
        },
    );

    const resumeStream = createEndpoint(
        "/runs/:runId/stream",
        {
            method: "GET",
            requireRequest: true,
        },
        async (ctx) => {
            try {
                const auth = await resolveAuth(app.config, ctx.request);
                await requireRunAccess({
                    runId: ctx.params.runId,
                    auth,
                    request: ctx.request,
                });

                const guardResponse = await runPluginGuards({
                    agentName: "",
                    request: ctx.request,
                    auth,
                });

                if (guardResponse) {
                    return guardResponse;
                }

                const afterSequence = Number(ctx.request.headers.get("last-event-id"));
                const events = app.runs.resumeStream({
                    runId: ctx.params.runId,
                    afterSequence: Number.isFinite(afterSequence) ? afterSequence : undefined,
                    signal: ctx.request.signal,
                });

                return toSseResponse({
                    events,
                    runId: ctx.params.runId,
                    signal: ctx.request.signal,
                    useEventIds: true,
                });
            } catch (error) {
                return toErrorResponse(error);
            }
        },
    );

    const routes: Record<string, Endpoint> = {
        run: run,
        listThreads: listThreads,
        createThread: createThread,
        getThread: getThread,
        updateThread: updateThread,
        deleteThread: deleteThread,
        getThreadRuntime: getThreadRuntime,
        listMessages: listMessages,
        abort: abort,
        resumeStream: resumeStream,
    };
    const builtInRouteKeys = new Set([
        "POST /:name/run",
        "GET /:name/threads",
        "POST /:name/threads",
        "GET /:name/threads/:threadId",
        "PATCH /:name/threads/:threadId",
        "DELETE /:name/threads/:threadId",
        "GET /:name/threads/:threadId/runtime",
        "GET /:name/threads/:threadId/messages",
        "POST /runs/:runId/abort",
        "GET /runs/:runId/stream",
    ]);

    for (const [index, endpoint] of pluginRuntime.endpoints.entries()) {
        const routeKey = `${endpoint.method} ${endpoint.path}`;
        if (builtInRouteKeys.has(routeKey)) {
            throw BetterAgentError.fromCode(
                "VALIDATION_FAILED",
                `Plugin endpoint '${routeKey}' conflicts with an existing server route.`,
                {
                    context: {
                        pluginId: endpoint.pluginId,
                        method: endpoint.method,
                        path: endpoint.path,
                    },
                    trace: [{ at: "core.app.createBetterAgentHandler.pluginEndpointConflict" }],
                },
            );
        }

        routes[`plugin_${index}`] = createEndpoint(
            endpoint.path,
            {
                method: endpoint.method as HTTPMethod,
                requireRequest: true,
            },
            async (ctx) => {
                try {
                    const url = new URL(ctx.request.url);
                    const auth = await resolveAuth(app.config, ctx.request);
                    return await endpoint.handler({
                        request: ctx.request,
                        params: (ctx.params ?? {}) as Record<string, string>,
                        query: url.searchParams,
                        auth,
                    });
                } catch (error) {
                    return toErrorResponse(error);
                }
            },
        );
    }

    const router = createRouter(routes, {
        basePath: options.basePath ?? app.config.basePath,
    });

    return router.handler;
}

function toSseResponse(params: {
    events: AsyncIterable<unknown>;
    runId?: string;
    signal?: AbortSignal;
    heartbeatMs?: number;
    useEventIds?: boolean;
    onDisconnect?: () => void | Promise<void>;
}): Response {
    const encoder = new TextEncoder();
    let disconnected = false;

    const handleDisconnect = () => {
        if (disconnected) {
            return;
        }

        disconnected = true;
        void params.onDisconnect?.();
    };

    const encodeEvent = (event: unknown): Uint8Array => {
        const id =
            params.useEventIds &&
            event &&
            typeof event === "object" &&
            "seq" in event &&
            typeof event.seq === "number" &&
            Number.isFinite(event.seq)
                ? `id: ${event.seq}\n`
                : "";

        return encoder.encode(`${id}data: ${JSON.stringify(event)}\n\n`);
    };

    const encodeError = (error: unknown): Uint8Array => {
        const betterError =
            error instanceof BetterAgentError
                ? error
                : BetterAgentError.wrap({
                      err: error,
                      opts: { code: "INTERNAL" },
                  });
        const problem = toProblemDetails(betterError);

        return encoder.encode(`event: error\ndata: ${JSON.stringify(problem)}\n\n`);
    };

    const stream = new ReadableStream({
        async start(controller) {
            const heartbeatMs = params.heartbeatMs ?? 15000;
            const heartbeat =
                heartbeatMs > 0
                    ? setInterval(() => {
                          try {
                              controller.enqueue(encoder.encode(":\n\n"));
                          } catch {
                              clearInterval(heartbeat);
                          }
                      }, heartbeatMs)
                    : undefined;

            const clearHeartbeat = () => {
                if (heartbeat) {
                    clearInterval(heartbeat);
                }
            };

            const close = () => {
                try {
                    controller.close();
                } catch {}
            };

            const onAbort = () => {
                clearHeartbeat();
                handleDisconnect();
                close();
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

                    controller.enqueue(encodeEvent(event));
                }
            } catch (error) {
                try {
                    controller.enqueue(encodeError(error));
                } catch {}
            } finally {
                clearHeartbeat();
                params.signal?.removeEventListener("abort", onAbort);
                close();
            }
        },
        cancel() {
            handleDisconnect();
        },
    });

    return new Response(stream, {
        headers: {
            "content-type": "text/event-stream",
            "cache-control": "no-cache, no-transform",
            connection: "keep-alive",
            "x-accel-buffering": "no",
            ...(params.runId !== undefined ? { "x-run-id": params.runId } : {}),
        },
    });
}
