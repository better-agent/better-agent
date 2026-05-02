import { describe, expect, test } from "bun:test";
import { rateLimit } from "../../src";
import { createBucket } from "../../src/rate-limit/bucket";
import { createMemoryStore } from "../../src/rate-limit/memory-store";

describe("rateLimit", () => {
    test("allows requests up to max and blocks the next request", async () => {
        const rows = new Map<string, { count: number; version: number }>();
        const plugin = rateLimit({
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
            agentName: "assistant",
            auth: null,
            input: { userId: "u1" },
            request: new Request("https://example.com/agents/assistant/run", {
                method: "POST",
                headers: { "x-user-id": "u1" },
            }),
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
        const plugin = rateLimit({
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
            agentName: "assistant",
            auth: null,
            input: { value: 1 },
            request: new Request("https://example.com/agents/assistant/run", { method: "POST" }),
        });

        expect(response).toBeNull();
        expect(writes).toBe(2);
    });

    test("can deny on storage error through onStoreError", async () => {
        const plugin = rateLimit({
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
            agentName: "assistant",
            auth: null,
            input: { value: 1 },
            request: new Request("https://example.com/agents/assistant/run", { method: "POST" }),
        });

        expect(response?.status).toBe(503);
    });

    test("falls back to the default key when custom key is blank", async () => {
        const plugin = rateLimit({
            windowMs: 60_000,
            max: 1,
            key: () => "   ",
        });

        const guard = plugin.guards?.[0];
        const base = {
            agentName: "assistant",
            auth: null,
            input: {},
            request: new Request("https://example.com", { method: "POST" }),
        };

        const first = await guard?.(base);
        const second = await guard?.(base);

        expect(first).toBeNull();
        expect(second?.status).toBe(429);
    });

    test("passes auth context to key and store callbacks", async () => {
        const seenSubjects: Array<string | null> = [];
        const plugin = rateLimit({
            windowMs: 60_000,
            max: 1,
            key: ({ auth }) => auth?.subject ?? "anonymous",
            storage: {
                async read({ request }) {
                    seenSubjects.push(request.auth?.subject ?? null);
                    return null;
                },
                async write({ request }) {
                    seenSubjects.push(request.auth?.subject ?? null);
                    return true;
                },
            },
        });

        const response = await plugin.guards?.[0]?.({
            agentName: "assistant",
            auth: { subject: "user_1" },
            input: {},
            request: new Request("https://example.com", { method: "POST" }),
        });

        expect(response).toBeNull();
        expect(seenSubjects).toEqual(["user_1", "user_1"]);
    });

    test("default memory store prunes expired buckets", async () => {
        const store = createMemoryStore();
        const oldBucket = createBucket({
            key: "assistant:user_1",
            now: new Date(0),
            windowMs: 1_000,
        });
        const currentBucket = createBucket({
            key: "assistant:user_1",
            now: new Date(2_000),
            windowMs: 1_000,
        });
        const request = {
            agentName: "assistant",
            auth: null,
            request: new Request("https://example.com"),
        };

        await store.write({
            bucket: oldBucket,
            request,
            prevVersion: null,
            next: { count: 1, version: 1 },
        });

        expect(await store.read({ bucket: oldBucket, request })).toMatchObject({ count: 1 });

        await store.read({ bucket: currentBucket, request });

        expect(await store.read({ bucket: oldBucket, request })).toBeNull();
    });

    test("throws on invalid config", () => {
        expect(() =>
            rateLimit({
                windowMs: 0,
                max: 1,
            }),
        ).toThrow();

        expect(() =>
            rateLimit({
                windowMs: 1000,
                max: 0,
            }),
        ).toThrow();
    });
});
