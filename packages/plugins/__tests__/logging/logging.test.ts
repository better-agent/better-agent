import { describe, expect, test } from "bun:test";
import { loggingPlugin } from "../../src";

describe("loggingPlugin", () => {
    test("logs request metadata by default", async () => {
        const entries: unknown[] = [];
        const plugin = loggingPlugin({
            logger: {
                info: (entry) => entries.push(entry),
            },
        });

        const response = await plugin.guards?.[0]?.({
            mode: "run",
            agentName: "assistant",
            input: { prompt: "hello" },
            request: new Request("https://example.com", {
                method: "POST",
                headers: { authorization: "secret" },
            }),
            plugins: [plugin],
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
        const plugin = loggingPlugin({
            logger: {
                error: (entry) => entries.push(entry),
            },
        });

        await plugin.onAfterToolCall?.({
            runId: "run-1",
            agentName: "assistant",
            toolName: "search",
            toolCallId: "tool-1",
            args: { q: "test" },
            result: { ok: false },
            error: "boom",
            setResult: () => {},
        });

        expect(entries).toHaveLength(1);
        expect(entries[0]).toMatchObject({
            event: "tool.after",
            level: "error",
        });
    });

    test("respects include flags", async () => {
        const entries: unknown[] = [];
        const plugin = loggingPlugin({
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
            args: { q: "x" },
            setArgs: () => {},
        });

        expect(entries).toHaveLength(1);
        expect(entries[0]).toMatchObject({ event: "tool.before" });
    });

    test("supports body redaction and custom formatting", async () => {
        const entries: unknown[] = [];
        const plugin = loggingPlugin({
            redactBody: ({ phase }) => ({ phase, redacted: true }),
            format: (entry) => ({ formatted: true, entry }),
            logger: {
                info: (entry) => entries.push(entry),
            },
        });

        await plugin.guards?.[0]?.({
            mode: "run",
            agentName: "assistant",
            input: { secret: "value" },
            request: new Request("https://example.com", { method: "POST" }),
            plugins: [plugin],
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
        const plugin = loggingPlugin({
            logger: {
                info: () => {
                    throw new Error("logger failed");
                },
            },
        });

        const response = await plugin.guards?.[0]?.({
            mode: "run",
            agentName: "assistant",
            input: {},
            request: new Request("https://example.com"),
            plugins: [plugin],
        });

        expect(response).toBeNull();
    });

    test("logs save metadata using durable items", async () => {
        const entries: unknown[] = [];
        const plugin = loggingPlugin({
            level: "debug",
            include: {
                saves: true,
                requests: false,
                events: false,
                steps: false,
                modelCalls: false,
                toolCalls: false,
            },
            logger: {
                debug: (entry) => entries.push(entry),
            },
        });

        await plugin.onBeforeSave?.({
            runId: "run-1",
            agentName: "assistant",
            conversationId: "conv-1",
            items: [
                { type: "message", role: "user", content: "hello" },
                { type: "message", role: "assistant", content: "hi" },
                { type: "tool-call", callId: "tool-1", name: "search", arguments: "{}" },
            ] as never,
            setItems: () => {},
        });

        expect(entries).toHaveLength(1);
        expect(entries[0]).toMatchObject({
            event: "save.before",
            conversationId: "conv-1",
            data: {
                itemCount: 3,
                messageCount: 2,
            },
        });
    });
});
