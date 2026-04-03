import { describe, expect, test } from "bun:test";
import { ipAllowlistPlugin } from "../../src";

describe("ipAllowlistPlugin", () => {
    test("allows exact IP matches", async () => {
        const plugin = ipAllowlistPlugin({
            allow: ["203.0.113.10"],
        });

        const response = await plugin.guards?.[0]?.({
            mode: "run",
            agentName: "assistant",
            input: {},
            request: new Request("https://example.com", {
                headers: { "x-real-ip": "203.0.113.10" },
            }),
            plugins: [plugin],
        });

        expect(response).toBeNull();
    });

    test("allows CIDR matches", async () => {
        const plugin = ipAllowlistPlugin({
            allow: ["203.0.113.0/24"],
            trustProxy: true,
        });

        const response = await plugin.guards?.[0]?.({
            mode: "run",
            agentName: "assistant",
            input: {},
            request: new Request("https://example.com", {
                headers: { "x-forwarded-for": "203.0.113.44, 10.0.0.1" },
            }),
            plugins: [plugin],
        });

        expect(response).toBeNull();
    });

    test("rejects non-allowed IPs", async () => {
        const plugin = ipAllowlistPlugin({
            allow: ["203.0.113.0/24"],
        });

        const response = await plugin.guards?.[0]?.({
            mode: "run",
            agentName: "assistant",
            input: {},
            request: new Request("https://example.com", {
                headers: { "x-real-ip": "198.51.100.7" },
            }),
            plugins: [plugin],
        });

        expect(response?.status).toBe(403);
    });

    test("supports ipv6 exact matches", async () => {
        const plugin = ipAllowlistPlugin({
            allow: ["2001:db8::1"],
        });

        const response = await plugin.guards?.[0]?.({
            mode: "run",
            agentName: "assistant",
            input: {},
            request: new Request("https://example.com", {
                headers: { "x-real-ip": "2001:db8::1" },
            }),
            plugins: [plugin],
        });

        expect(response).toBeNull();
    });

    test("supports ipv6 cidr matches", async () => {
        const plugin = ipAllowlistPlugin({
            allow: ["2001:db8::/32"],
            trustProxy: true,
        });

        const response = await plugin.guards?.[0]?.({
            mode: "run",
            agentName: "assistant",
            input: {},
            request: new Request("https://example.com", {
                headers: { "x-forwarded-for": "2001:db8::2, 10.0.0.1" },
            }),
            plugins: [plugin],
        });

        expect(response).toBeNull();
    });

    test("supports custom denied response", async () => {
        const plugin = ipAllowlistPlugin({
            allow: ["203.0.113.10"],
            onDenied: ({ ip }) =>
                new Response(JSON.stringify({ error: "nope", ip }), {
                    status: 403,
                    headers: { "content-type": "application/json" },
                }),
        });

        const response = await plugin.guards?.[0]?.({
            mode: "run",
            agentName: "assistant",
            input: {},
            request: new Request("https://example.com", {
                headers: { "x-real-ip": "198.51.100.7" },
            }),
            plugins: [plugin],
        });

        expect(response?.status).toBe(403);
        expect(await response?.json()).toEqual({ error: "nope", ip: "198.51.100.7" });
    });

    test("rejects unresolved ip by default", async () => {
        const plugin = ipAllowlistPlugin({
            allow: ["203.0.113.0/24"],
        });

        const response = await plugin.guards?.[0]?.({
            mode: "run",
            agentName: "assistant",
            input: {},
            request: new Request("https://example.com"),
            plugins: [plugin],
        });

        expect(response?.status).toBe(403);
    });

    test("throws on invalid allow entries", () => {
        expect(() =>
            ipAllowlistPlugin({
                allow: ["not-an-ip"],
            }),
        ).toThrow();
    });
});
