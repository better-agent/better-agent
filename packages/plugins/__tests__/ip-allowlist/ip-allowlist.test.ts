import { describe, expect, test } from "bun:test";
import { ipAllowlist } from "../../src";

describe("ipAllowlist", () => {
    test("allows exact IP matches", async () => {
        const plugin = ipAllowlist({
            allow: ["203.0.113.10"],
        });

        const response = await plugin.guards?.[0]?.({
            agentName: "assistant",
            auth: null,
            input: {},
            request: new Request("https://example.com", {
                headers: { "x-real-ip": "203.0.113.10" },
            }),
        });

        expect(response).toBeNull();
    });

    test("normalizes padded IPv4 octets before matching", async () => {
        const plugin = ipAllowlist({
            allow: ["203.0.113.10"],
        });

        const response = await plugin.guards?.[0]?.({
            agentName: "assistant",
            auth: null,
            input: {},
            request: new Request("https://example.com", {
                headers: { "x-real-ip": "203.000.113.010" },
            }),
        });

        expect(response).toBeNull();
    });

    test("allows CIDR matches", async () => {
        const plugin = ipAllowlist({
            allow: ["203.0.113.0/24"],
            trustProxy: true,
        });

        const response = await plugin.guards?.[0]?.({
            agentName: "assistant",
            auth: null,
            input: {},
            request: new Request("https://example.com", {
                headers: { "x-forwarded-for": "203.0.113.44, 10.0.0.1" },
            }),
        });

        expect(response).toBeNull();
    });

    test("rejects non-allowed IPs", async () => {
        const plugin = ipAllowlist({
            allow: ["203.0.113.0/24"],
        });

        const response = await plugin.guards?.[0]?.({
            agentName: "assistant",
            auth: null,
            input: {},
            request: new Request("https://example.com", {
                headers: { "x-real-ip": "198.51.100.7" },
            }),
        });

        expect(response?.status).toBe(403);
    });

    test("supports ipv6 exact matches", async () => {
        const plugin = ipAllowlist({
            allow: ["2001:db8::1"],
        });

        const response = await plugin.guards?.[0]?.({
            agentName: "assistant",
            auth: null,
            input: {},
            request: new Request("https://example.com", {
                headers: { "x-real-ip": "2001:db8::1" },
            }),
        });

        expect(response).toBeNull();
    });

    test("supports ipv6 cidr matches", async () => {
        const plugin = ipAllowlist({
            allow: ["2001:db8::/32"],
            trustProxy: true,
        });

        const response = await plugin.guards?.[0]?.({
            agentName: "assistant",
            auth: null,
            input: {},
            request: new Request("https://example.com", {
                headers: { "x-forwarded-for": "2001:db8::2, 10.0.0.1" },
            }),
        });

        expect(response).toBeNull();
    });

    test("supports custom denied response", async () => {
        const plugin = ipAllowlist({
            allow: ["203.0.113.10"],
            onDenied: ({ ip }) =>
                new Response(JSON.stringify({ error: "nope", ip }), {
                    status: 403,
                    headers: { "content-type": "application/json" },
                }),
        });

        const response = await plugin.guards?.[0]?.({
            agentName: "assistant",
            auth: null,
            input: {},
            request: new Request("https://example.com", {
                headers: { "x-real-ip": "198.51.100.7" },
            }),
        });

        expect(response?.status).toBe(403);
        expect(await response?.json()).toEqual({ error: "nope", ip: "198.51.100.7" });
    });

    test("passes normalized IPs to custom denied responses", async () => {
        const plugin = ipAllowlist({
            allow: ["203.0.113.10"],
            onDenied: ({ ip }) =>
                new Response(JSON.stringify({ error: "nope", ip }), {
                    status: 403,
                    headers: { "content-type": "application/json" },
                }),
        });

        const response = await plugin.guards?.[0]?.({
            agentName: "assistant",
            auth: null,
            input: {},
            request: new Request("https://example.com", {
                headers: { "x-real-ip": "198.051.100.007" },
            }),
        });

        expect(response?.status).toBe(403);
        expect(await response?.json()).toEqual({ error: "nope", ip: "198.51.100.7" });
    });

    test("rejects unresolved ip by default", async () => {
        const plugin = ipAllowlist({
            allow: ["203.0.113.0/24"],
        });

        const response = await plugin.guards?.[0]?.({
            agentName: "assistant",
            auth: null,
            input: {},
            request: new Request("https://example.com"),
        });

        expect(response?.status).toBe(403);
    });

    test("throws on invalid allow entries", () => {
        expect(() =>
            ipAllowlist({
                allow: ["not-an-ip"],
            }),
        ).toThrow();
    });
});
