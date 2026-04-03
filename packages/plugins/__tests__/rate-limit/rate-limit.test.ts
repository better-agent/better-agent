import { describe, expect, test } from "bun:test";
import { rateLimitPlugin } from "../../src";

describe("rateLimitPlugin", () => {
    test("allows requests up to max and blocks the next request", async () => {
        const rows = new Map<string, { count: number; version: number }>();
        const plugin = rateLimitPlugin({
            windowMs: 60_000,
            max: 2,
            key: ({ agentName, request }) =>
                `${agentName}:${request.headers.get("x-user-id") ?? "anon"}`,
            storage: {
                async read({ bucket }) {
                    return rows.get(bucket.id) ?? null;
                },
                async write({ bucket, prevVersion, next }) {
                    const current = rows.get(bucket.id) ?? null;
                    if (prevVersion === null) {
                        if (current) return false;
                        rows.set(bucket.id, next);
                        return true;
                    }
                    if (!current || current.version !== prevVersion) return false;
                    rows.set(bucket.id, next);
                    return true;
                },
            },
        });

        const guard = plugin.guards?.[0];
        expect(guard).toBeDefined();

        const base = {
            mode: "run" as const,
            agentName: "assistant",
            input: { userId: "u1" },
            request: new Request("https://example.com/agents/assistant/run", {
                method: "POST",
                headers: { "x-user-id": "u1" },
            }),
            plugins: [plugin],
        };

        const first = await guard?.(base);
        const second = await guard?.(base);
        const third = await guard?.(base);

        expect(first).toBeNull();
        expect(second).toBeNull();
        expect(third?.status).toBe(429);
        expect(third?.headers.get("retry-after")).toBeDefined();
    });

    test("retries when storage write returns CAS conflict", async () => {
        const rows = new Map<string, { count: number; version: number }>();
        let writes = 0;
        const plugin = rateLimitPlugin({
            windowMs: 60_000,
            max: 10,
            storage: {
                async read({ bucket }) {
                    return rows.get(bucket.id) ?? null;
                },
                async write({ bucket, prevVersion, next }) {
                    writes += 1;
                    if (writes === 1) return false;
                    const current = rows.get(bucket.id) ?? null;
                    if (prevVersion === null) {
                        if (current) return false;
                        rows.set(bucket.id, next);
                        return true;
                    }
                    if (!current || current.version !== prevVersion) return false;
                    rows.set(bucket.id, next);
                    return true;
                },
            },
        });

        const guard = plugin.guards?.[0];
        const response = await guard?.({
            mode: "run",
            agentName: "assistant",
            input: { value: 1 },
            request: new Request("https://example.com/agents/assistant/run", { method: "POST" }),
            plugins: [plugin],
        });

        expect(response).toBeNull();
        expect(writes).toBe(2);
    });

    test("can deny on storage error through onStoreError", async () => {
        const plugin = rateLimitPlugin({
            windowMs: 60_000,
            max: 10,
            storage: {
                async read() {
                    throw new Error("store down");
                },
                async write() {
                    return true;
                },
            },
            onStoreError: () => "deny",
        });

        const guard = plugin.guards?.[0];
        const response = await guard?.({
            mode: "run",
            agentName: "assistant",
            input: { value: 1 },
            request: new Request("https://example.com/agents/assistant/run", { method: "POST" }),
            plugins: [plugin],
        });

        expect(response?.status).toBe(503);
    });

    test("falls back to the default key when custom key is blank", async () => {
        const plugin = rateLimitPlugin({
            windowMs: 60_000,
            max: 1,
            key: () => "   ",
        });

        const guard = plugin.guards?.[0];
        const base = {
            mode: "run" as const,
            agentName: "assistant",
            input: {},
            request: new Request("https://example.com", { method: "POST" }),
            plugins: [plugin],
        };

        const first = await guard?.(base);
        const second = await guard?.(base);

        expect(first).toBeNull();
        expect(second?.status).toBe(429);
    });

    test("throws on invalid config", () => {
        expect(() =>
            rateLimitPlugin({
                windowMs: 0,
                max: 1,
            }),
        ).toThrow();

        expect(() =>
            rateLimitPlugin({
                windowMs: 1000,
                max: 0,
            }),
        ).toThrow();
    });
});
