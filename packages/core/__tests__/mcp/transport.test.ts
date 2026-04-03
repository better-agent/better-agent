import { afterEach, describe, expect, test } from "bun:test";
import type { JSONRPCMessage } from "../../src/mcp/tool/json-rpc-message";
import { createMCPClient } from "../../src/mcp/tool/mcp-client";
import { HttpMCPTransport } from "../../src/mcp/tool/mcp-http-transport";

const originalFetch = globalThis.fetch;
const originalSetTimeout = globalThis.setTimeout;

const sseResponse = (chunks: string[], init?: ResponseInit) =>
    new Response(
        new ReadableStream<Uint8Array>({
            start(controller) {
                const encoder = new TextEncoder();
                for (const chunk of chunks) {
                    controller.enqueue(encoder.encode(chunk));
                }
                controller.close();
            },
        }),
        {
            ...init,
            headers: {
                "content-type": "text/event-stream",
                ...(init?.headers ?? {}),
            },
        },
    );

const waitFor = async (predicate: () => boolean, timeoutMs = 1000) => {
    const startedAt = Date.now();
    while (!predicate()) {
        if (Date.now() - startedAt > timeoutMs) {
            throw new Error("Timed out waiting for condition.");
        }
        await new Promise((resolve) => originalSetTimeout(resolve, 5));
    }
};

afterEach(() => {
    globalThis.fetch = originalFetch;
    globalThis.setTimeout = originalSetTimeout;
});

describe("MCP transport", () => {
    test("HttpMCPTransport reads inbound SSE messages and tracks session id", async () => {
        const received: JSONRPCMessage[] = [];
        globalThis.fetch = (async (_input: URL | RequestInfo, init?: RequestInit) => {
            if (init?.method === "GET") {
                return sseResponse(
                    [
                        "event: message\n",
                        "id: event-1\n",
                        'data: {"jsonrpc":"2.0","id":1,"result":{"ok":true}}\n\n',
                    ],
                    {
                        headers: {
                            "mcp-session-id": "session_1",
                        },
                    },
                );
            }

            return new Response(null, { status: 204 });
        }) as unknown as typeof fetch;

        const transport = new HttpMCPTransport({
            url: "https://example.com/mcp",
            headers: undefined,
            sessionId: undefined,
        });

        transport.onmessage = (message) => {
            received.push(message);
        };

        await transport.start();
        await waitFor(() => received.length === 1);

        expect(received).toEqual([
            {
                jsonrpc: "2.0",
                id: 1,
                result: { ok: true },
            },
        ]);

        await transport.close();
    });

    test("HttpMCPTransport reconnects with last-event-id after inbound SSE closes", async () => {
        const fetchCalls: Array<{ method: string; lastEventId: string | null }> = [];
        const reconnectDelays: number[] = [];
        let getCount = 0;

        globalThis.setTimeout = ((callback: TimerHandler, delay?: number) => {
            reconnectDelays.push(Number(delay ?? 0));
            if (typeof callback === "function") {
                void callback();
            }
            return 0 as unknown as Timer;
        }) as unknown as typeof globalThis.setTimeout;

        globalThis.fetch = (async (_input: URL | RequestInfo, init?: RequestInit) => {
            const headers = new Headers(init?.headers);
            fetchCalls.push({
                method: String(init?.method ?? "GET"),
                lastEventId: headers.get("last-event-id"),
            });

            if (init?.method === "GET") {
                getCount += 1;
                if (getCount === 1) {
                    return sseResponse([
                        "event: message\n",
                        "id: event-9\n",
                        'data: {"jsonrpc":"2.0","id":1,"result":{"ok":true}}\n\n',
                    ]);
                }

                return new Response(null, { status: 405 });
            }

            return new Response(null, { status: 204 });
        }) as unknown as typeof fetch;

        const transport = new HttpMCPTransport({
            url: "https://example.com/mcp",
            headers: undefined,
            advanced: {
                reconnectInitialDelayMs: 7,
            },
            sessionId: undefined,
        });

        await transport.start();
        await waitFor(() => fetchCalls.length >= 2);

        expect(fetchCalls[0]).toEqual({ method: "GET", lastEventId: null });
        expect(fetchCalls[1]).toEqual({ method: "GET", lastEventId: "event-9" });
        expect(reconnectDelays).toContain(7);

        await transport.close();
    });

    test("createMCPClient preserves session id across initialize and later requests", async () => {
        const requests: Array<{ method: string; sessionId: string | null; body?: string }> = [];

        globalThis.fetch = (async (_input: URL | RequestInfo, init?: RequestInit) => {
            const headers = new Headers(init?.headers);
            const method = String(init?.method ?? "GET");
            const body = typeof init?.body === "string" ? init.body : undefined;
            requests.push({
                method,
                sessionId: headers.get("mcp-session-id"),
                ...(body !== undefined ? { body } : {}),
            });

            if (method === "GET") {
                return new Response(null, { status: 405 });
            }

            if (body?.includes('"method":"initialize"')) {
                return new Response(
                    JSON.stringify({
                        jsonrpc: "2.0",
                        id: 0,
                        result: {
                            protocolVersion: "2025-06-18",
                            capabilities: { tools: {} },
                            serverInfo: { name: "test-server", version: "1.0.0" },
                        },
                    }),
                    {
                        status: 200,
                        headers: {
                            "content-type": "application/json",
                            "mcp-session-id": "session_abc",
                        },
                    },
                );
            }

            if (body?.includes('"method":"notifications/initialized"')) {
                return new Response(null, { status: 202 });
            }

            if (body?.includes('"method":"tools/list"')) {
                return new Response(
                    JSON.stringify({
                        jsonrpc: "2.0",
                        id: 1,
                        result: { tools: [] },
                    }),
                    {
                        status: 200,
                        headers: {
                            "content-type": "application/json",
                        },
                    },
                );
            }

            if (method === "DELETE") {
                return new Response(null, { status: 204 });
            }

            return new Response(null, { status: 500 });
        }) as unknown as typeof fetch;

        const client = await createMCPClient({
            transport: { type: "http", url: "https://example.com/mcp" },
        });

        await client.listTools();
        await client.close();

        expect(requests[0]?.method).toBe("GET");
        expect(requests[1]?.body?.includes('"method":"initialize"')).toBe(true);
        const sessionPosts = requests.filter(
            (request) => request.method === "POST" && request.sessionId === "session_abc",
        );
        expect(sessionPosts.length).toBeGreaterThanOrEqual(2);
        expect(
            sessionPosts.some((request) => request.body?.includes('"method":"tools/list"')),
        ).toBe(true);
    });
});
