import { afterEach, describe, expect, test } from "bun:test";
import { createOpenRouterClient } from "../../src/openrouter/client";

const originalFetch = globalThis.fetch;

afterEach(() => {
    globalThis.fetch = originalFetch;
});

describe("openrouter client", () => {
    test("chat create sends requests to /chat/completions with auth and attribution headers", async () => {
        const requests: Array<{ method: string; path: string; body: unknown }> = [];
        let refererHeader: string | undefined;
        let titleHeader: string | undefined;

        const mockFetchImpl = async (input: RequestInfo | URL, init?: RequestInit) => {
            const request = input instanceof Request ? input : new Request(input, init);
            requests.push({
                method: request.method,
                path: new URL(request.url).pathname,
                body: JSON.parse(await request.text()),
            });
            refererHeader = request.headers.get("HTTP-Referer") ?? undefined;
            titleHeader = request.headers.get("X-Title") ?? undefined;

            return Response.json({
                id: "chatcmpl_1",
                choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant", content: "hi" } }],
            });
        };

        globalThis.fetch = Object.assign(mockFetchImpl, {
            preconnect() {
                return undefined;
            },
        }) as typeof fetch;

        const client = createOpenRouterClient({
            apiKey: "or-key",
            siteURL: "https://example.com",
            appName: "better-agent",
        });
        const result = await client.chat.create({
            model: "openai/gpt-4.1-mini",
            messages: [{ role: "user", content: "hello" }],
        });

        expect(result.isOk()).toBe(true);
        expect(refererHeader).toBe("https://example.com");
        expect(titleHeader).toBe("better-agent");
        expect(requests).toEqual([
            {
                method: "POST",
                path: "/api/v1/chat/completions",
                body: {
                    model: "openai/gpt-4.1-mini",
                    messages: [{ role: "user", content: "hello" }],
                },
            },
        ]);
    });
});
