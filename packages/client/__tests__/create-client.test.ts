import { describe, expect, test } from "bun:test";
import { createClient } from "../src/create-client";

type MockFetch = NonNullable<Parameters<typeof createClient>[0]["fetch"]>;

describe("createClient", () => {
    test("agent handle sends run requests to the agent route", async () => {
        const requests: Array<{ url: string; method: string; body?: string | null }> = [];
        const client = createClient({
            baseURL: "https://example.com/agents",
            fetch: (async (url, init) => {
                requests.push({
                    url: String(url),
                    method: init?.method ?? "GET",
                    body: typeof init?.body === "string" ? init.body : null,
                });

                return Response.json({ runId: "run_1", outcome: "success", messages: [] });
            }) as MockFetch,
        });

        await client.agent("support").run({
            messages: [{ role: "user", content: "hello" }],
        });

        expect(requests).toEqual([
            {
                url: "https://example.com/agents/support/run",
                method: "POST",
                body: JSON.stringify({
                    messages: [{ role: "user", content: "hello" }],
                }),
            },
        ]);
    });

    test("runs namespace sends abort requests to the runs route", async () => {
        const requests: Array<{ url: string; method: string }> = [];
        const client = createClient({
            baseURL: "https://example.com/agents",
            fetch: (async (url, init) => {
                requests.push({
                    url: String(url),
                    method: init?.method ?? "GET",
                });

                return new Response(null, { status: 204 });
            }) as MockFetch,
        });

        await client.runs.abort("run_1");

        expect(requests).toEqual([
            {
                url: "https://example.com/agents/runs/run_1/abort",
                method: "POST",
            },
        ]);
    });

    test("agent handles are stable by name", () => {
        const client = createClient({
            baseURL: "https://example.com/agents",
            fetch: (async () => Response.json({})) as unknown as MockFetch,
        });

        expect(client.agent("support")).toBe(client.agent("support"));
        expect(client.agent("support")).not.toBe(client.agent("sales"));
    });

    test("agent memory handle sends thread requests to scoped agent routes", async () => {
        const requests: Array<{ url: string; method: string; body?: string | null }> = [];
        const client = createClient({
            baseURL: "https://example.com/agents",
            fetch: (async (url, init) => {
                requests.push({
                    url: String(url),
                    method: init?.method ?? "GET",
                    body: typeof init?.body === "string" ? init.body : null,
                });

                return Response.json({
                    id: "thread_1",
                    agentName: "support",
                    createdAt: 1,
                    updatedAt: 1,
                });
            }) as MockFetch,
        });

        await client.agent("support").memory.threads.create({ title: "Billing" });

        expect(requests).toEqual([
            {
                url: "https://example.com/agents/support/threads",
                method: "POST",
                body: JSON.stringify({ title: "Billing" }),
            },
        ]);
    });

    test("client forwards credentials for cookie auth", async () => {
        const credentials: RequestCredentials[] = [];
        const client = createClient({
            baseURL: "https://example.com/agents",
            credentials: "include",
            fetch: (async (_url, init) => {
                credentials.push(init?.credentials as RequestCredentials);

                return Response.json({ threads: [] });
            }) as MockFetch,
        });

        await client.agent("support").memory.threads.list();

        expect(credentials).toEqual(["include"]);
    });
});
