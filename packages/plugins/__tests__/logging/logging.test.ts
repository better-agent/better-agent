import { describe, expect, test } from "bun:test";
import { logging } from "../../src";

describe("logging", () => {
    test("logs request metadata by default", async () => {
        const entries: unknown[] = [];
        const plugin = logging({
            logger: {
                info: (entry) => entries.push(entry),
            },
        });

        const response = await plugin.guards?.[0]?.({
            agentName: "assistant",
            auth: null,
            input: { prompt: "hello" },
            request: new Request("https://example.com", {
                method: "POST",
                headers: { authorization: "secret" },
            }),
        });

        expect(response).toBeNull();
        expect(entries).toHaveLength(1);
        expect(entries[0]).toMatchObject({
            event: "request.received",
            agentName: "assistant",
        });
        expect(entries[0]).toMatchObject({
            data: {
                headers: {
                    authorization: "[REDACTED]",
                },
            },
        });
    });

    test("logs tool errors through onAfterToolCall", async () => {
        const entries: unknown[] = [];
        const plugin = logging({
            logger: {
                error: (entry) => entries.push(entry),
            },
        });

        await plugin.onAfterToolCall?.({
            runId: "run-1",
            agentName: "assistant",
            toolName: "search",
            toolCallId: "tool-1",
            input: { q: "test" },
            status: "error",
            result: { ok: false },
            error: "boom",
            setStatus: () => {},
            setResult: () => {},
            setError: () => {},
        });

        expect(entries).toHaveLength(1);
        expect(entries[0]).toMatchObject({
            event: "tool.after",
            level: "error",
        });
    });

    test("respects include flags", async () => {
        const entries: unknown[] = [];
        const plugin = logging({
            include: {
                requests: false,
                toolCalls: true,
            },
            logger: {
                info: (entry) => entries.push(entry),
            },
        });

        expect(plugin.guards).toBeUndefined();

        await plugin.onBeforeToolCall?.({
            runId: "run-1",
            agentName: "assistant",
            toolName: "search",
            toolCallId: "tool-1",
            input: { q: "x" },
            setInput: () => {},
        });

        expect(entries).toHaveLength(1);
        expect(entries[0]).toMatchObject({ event: "tool.before" });
    });

    test("supports body redaction and custom formatting", async () => {
        const entries: unknown[] = [];
        const plugin = logging({
            redactBody: ({ phase }) => ({ phase, redacted: true }),
            format: (entry) => ({ formatted: true, entry }),
            logger: {
                info: (entry) => entries.push(entry),
            },
        });

        await plugin.guards?.[0]?.({
            agentName: "assistant",
            auth: null,
            input: { secret: "value" },
            request: new Request("https://example.com", { method: "POST" }),
        });

        expect(entries).toHaveLength(1);
        expect(entries[0]).toMatchObject({
            formatted: true,
            entry: {
                event: "request.received",
                data: {
                    input: {
                        phase: "request",
                        redacted: true,
                    },
                },
            },
        });
    });

    test("swallows logger failures", async () => {
        const plugin = logging({
            logger: {
                info: () => {
                    throw new Error("logger failed");
                },
            },
        });

        const response = await plugin.guards?.[0]?.({
            agentName: "assistant",
            auth: null,
            input: {},
            request: new Request("https://example.com"),
        });

        expect(response).toBeNull();
    });

    test("applies custom header redaction", async () => {
        const entries: unknown[] = [];
        const plugin = logging({
            redactHeaders: ["x-session-token"],
            logger: {
                info: (entry) => entries.push(entry),
            },
        });

        await plugin.guards?.[0]?.({
            agentName: "assistant",
            auth: null,
            input: {},
            request: new Request("https://example.com", {
                headers: { "x-session-token": "session-1" },
            }),
        });

        expect(entries[0]).toMatchObject({
            data: {
                headers: {
                    "x-session-token": "[REDACTED]",
                },
            },
        });
    });

    test("swallows formatter and redactor failures", async () => {
        const entries: unknown[] = [];
        const plugin = logging({
            redactBody: () => {
                throw new Error("redactor failed");
            },
            format: () => {
                throw new Error("formatter failed");
            },
            logger: {
                info: (entry) => entries.push(entry),
            },
        });

        const response = await plugin.guards?.[0]?.({
            agentName: "assistant",
            auth: null,
            input: { prompt: "hello" },
            request: new Request("https://example.com"),
        });

        expect(response).toBeNull();
        expect(entries).toHaveLength(1);
        expect(entries[0]).toMatchObject({
            event: "request.received",
            data: {
                input: { prompt: "hello" },
            },
        });
    });
});
