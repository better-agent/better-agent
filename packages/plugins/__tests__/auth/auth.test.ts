import { describe, expect, test } from "bun:test";
import { authPlugin } from "../../src";

describe("authPlugin", () => {
    test("allows a valid API key", async () => {
        const plugin = authPlugin({
            apiKeys: ["secret-1"],
        });

        const response = await plugin.guards?.[0]?.({
            mode: "run",
            agentName: "assistant",
            input: {},
            request: new Request("https://example.com", {
                headers: { "x-api-key": "secret-1" },
            }),
            plugins: [plugin],
        });

        expect(response).toBeNull();
    });

    test("rejects an invalid API key", async () => {
        const plugin = authPlugin({
            apiKeys: ["secret-1"],
        });

        const response = await plugin.guards?.[0]?.({
            mode: "run",
            agentName: "assistant",
            input: {},
            request: new Request("https://example.com"),
            plugins: [plugin],
        });

        expect(response?.status).toBe(401);
    });

    test("supports custom validation", async () => {
        const plugin = authPlugin({
            validate: ({ key, agentName }) => key === `${agentName}-key`,
            getKey: ({ request }) => request.headers.get("authorization"),
        });

        const response = await plugin.guards?.[0]?.({
            mode: "run",
            agentName: "assistant",
            input: {},
            request: new Request("https://example.com", {
                headers: { authorization: "assistant-key" },
            }),
            plugins: [plugin],
        });

        expect(response).toBeNull();
    });

    test("supports custom unauthorized response", async () => {
        const plugin = authPlugin({
            apiKeys: ["secret-1"],
            onUnauthorized: ({ key }) =>
                new Response(JSON.stringify({ error: "bad_key", key }), {
                    status: 401,
                    headers: { "content-type": "application/json" },
                }),
        });

        const response = await plugin.guards?.[0]?.({
            mode: "run",
            agentName: "assistant",
            input: {},
            request: new Request("https://example.com"),
            plugins: [plugin],
        });

        expect(response?.status).toBe(401);
        expect(await response?.json()).toEqual({ error: "bad_key", key: null });
    });

    test("supports custom header names", async () => {
        const plugin = authPlugin({
            header: "authorization",
            apiKeys: ["Bearer secret-1"],
        });

        const response = await plugin.guards?.[0]?.({
            mode: "run",
            agentName: "assistant",
            input: {},
            request: new Request("https://example.com", {
                headers: { authorization: "Bearer secret-1" },
            }),
            plugins: [plugin],
        });

        expect(response).toBeNull();
    });

    test("throws when misconfigured", () => {
        expect(() => authPlugin({})).toThrow();
    });
});
