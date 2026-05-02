import type { MemoryMessage, RunResult } from "@better-agent/core";
import type { AgentNameOf } from "./core/inference";
import { joinURL, requestJson, requestSse } from "./core/request";
import type {
    BetterAgentClient,
    BetterAgentClientAgentMemoryHandle,
    BetterAgentClientConfig,
    ClientMemoryThread,
    ClientThreadRuntime,
} from "./types";

export function createClient<TApp = unknown>(
    config: BetterAgentClientConfig,
): BetterAgentClient<TApp> {
    const baseURL = config.baseURL.replace(/\/$/, "");
    const withLimit = (url: string, limit?: number) => {
        if (typeof limit !== "number") {
            return url;
        }

        const separator = url.includes("?") ? "&" : "?";
        return `${url}${separator}limit=${encodeURIComponent(String(limit))}`;
    };
    const withParam = (url: string, key: string, value?: string) => {
        if (value === undefined) {
            return url;
        }

        const separator = url.includes("?") ? "&" : "?";
        return `${url}${separator}${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
    };

    const runs = {
        async abort(runId, options) {
            await requestJson(
                config,
                {
                    url: joinURL(baseURL, `/runs/${encodeURIComponent(runId)}/abort`),
                    method: "POST",
                },
                options,
            );
        },
        resumeStream(input, options) {
            return (async function* () {
                const headers = new Headers(options?.headers);
                if (typeof input.afterSequence === "number") {
                    headers.set("last-event-id", String(input.afterSequence));
                }

                const events = await requestSse(
                    config,
                    {
                        url: joinURL(baseURL, `/runs/${encodeURIComponent(input.runId)}/stream`),
                        method: "GET",
                    },
                    {
                        ...options,
                        headers,
                    },
                );

                for await (const event of events) {
                    yield event;
                }
            })();
        },
    } satisfies BetterAgentClient<TApp>["runs"];

    const agentHandles = new Map<
        string,
        BetterAgentClientAgentMemoryHandle<TApp, AgentNameOf<TApp>>
    >();

    const client = {
        agent(agentName) {
            const agentKey = String(agentName);
            const cached = agentHandles.get(agentKey);
            if (cached) {
                return cached as ReturnType<BetterAgentClient<TApp>["agent"]>;
            }

            const encodedAgentName = encodeURIComponent(agentKey);
            const runURL = joinURL(baseURL, `/${encodedAgentName}/run`);

            const handle: BetterAgentClientAgentMemoryHandle<TApp, AgentNameOf<TApp>> = {
                runs,
                run(input, options) {
                    return requestJson<RunResult>(
                        config,
                        {
                            url: runURL,
                            method: "POST",
                            body: input,
                        },
                        options,
                    );
                },
                stream(input, options) {
                    return (async function* () {
                        const events = await requestSse(
                            config,
                            {
                                url: runURL,
                                method: "POST",
                                body: input,
                            },
                            options,
                        );

                        for await (const event of events) {
                            yield event;
                        }
                    })();
                },
                memory: {
                    threads: {
                        async list(input, options) {
                            const result = await requestJson<{ threads: ClientMemoryThread[] }>(
                                config,
                                {
                                    url: withLimit(
                                        joinURL(baseURL, `/${encodedAgentName}/threads`),
                                        input?.limit,
                                    ),
                                    method: "GET",
                                },
                                options,
                            );

                            return result.threads;
                        },
                        create(input, options) {
                            return requestJson<ClientMemoryThread>(
                                config,
                                {
                                    url: joinURL(baseURL, `/${encodedAgentName}/threads`),
                                    method: "POST",
                                    body: input ?? {},
                                },
                                options,
                            );
                        },
                        get(threadId, options) {
                            return requestJson<ClientMemoryThread>(
                                config,
                                {
                                    url: joinURL(
                                        baseURL,
                                        `/${encodedAgentName}/threads/${encodeURIComponent(threadId)}`,
                                    ),
                                    method: "GET",
                                },
                                options,
                            );
                        },
                        update(threadId, input, options) {
                            return requestJson<ClientMemoryThread>(
                                config,
                                {
                                    url: joinURL(
                                        baseURL,
                                        `/${encodedAgentName}/threads/${encodeURIComponent(threadId)}`,
                                    ),
                                    method: "PATCH",
                                    body: input,
                                },
                                options,
                            );
                        },
                        async delete(threadId, options) {
                            await requestJson(
                                config,
                                {
                                    url: joinURL(
                                        baseURL,
                                        `/${encodedAgentName}/threads/${encodeURIComponent(threadId)}`,
                                    ),
                                    method: "DELETE",
                                },
                                options,
                            );
                        },
                        runtime(threadId, options) {
                            return requestJson<ClientThreadRuntime>(
                                config,
                                {
                                    url: joinURL(
                                        baseURL,
                                        `/${encodedAgentName}/threads/${encodeURIComponent(threadId)}/runtime`,
                                    ),
                                    method: "GET",
                                },
                                options,
                            );
                        },
                    },
                    messages: {
                        async list(threadId, input, options) {
                            const url = withParam(
                                withLimit(
                                    joinURL(
                                        baseURL,
                                        `/${encodedAgentName}/threads/${encodeURIComponent(threadId)}/messages`,
                                    ),
                                    input?.limit,
                                ),
                                "beforeRunId",
                                input?.beforeRunId,
                            );
                            const result = await requestJson<{ messages: MemoryMessage[] }>(
                                config,
                                {
                                    url,
                                    method: "GET",
                                },
                                options,
                            );

                            return result.messages;
                        },
                    },
                },
            };

            agentHandles.set(agentKey, handle);
            return handle as ReturnType<BetterAgentClient<TApp>["agent"]>;
        },
        runs,
    } as BetterAgentClient<TApp>;

    return client;
}
