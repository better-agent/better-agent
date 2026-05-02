import { describe, expect, test } from "bun:test";
import { EventType } from "@better-agent/core";
import type { streamText } from "ai";
import { toBetterAgentStreamResult } from "../src/stream";

type StreamResultInput = ReturnType<typeof streamText>;

async function collect<T>(iterable: AsyncIterable<T>): Promise<T[]> {
    const items: T[] = [];
    for await (const item of iterable) {
        items.push(item);
    }
    return items;
}

async function* parts(items: readonly Record<string, unknown>[]) {
    for (const item of items) {
        yield item;
    }
}

describe("stream", () => {
    test("converts text, reasoning, source, tool, and finish stream parts", async () => {
        const result = {
            fullStream: parts([
                { type: "reasoning-delta", text: "think" },
                { type: "text-delta", text: "hello" },
                {
                    type: "source",
                    sourceType: "url",
                    id: "source-1",
                    url: "https://example.com",
                    title: "Example",
                    providerMetadata: { page: 1 },
                },
                { type: "tool-input-start", id: "call-1", toolName: "search" },
                { type: "tool-input-delta", id: "call-1", delta: '{"query"' },
                { type: "tool-input-delta", id: "call-1", delta: ':"docs"}' },
                { type: "tool-input-end", id: "call-1" },
                { type: "tool-result", toolCallId: "call-1", output: { ok: true } },
                {
                    type: "finish",
                    finishReason: "stop",
                    totalUsage: {
                        inputTokens: 1,
                        outputTokens: 2,
                        totalTokens: 3,
                        outputTokenDetails: {},
                        inputTokenDetails: {},
                    },
                },
            ]),
        } as unknown as StreamResultInput;

        const stream = toBetterAgentStreamResult(result, "message-1");
        const events = await collect(stream.events);

        expect(events.map((event) => event.type)).toEqual([
            EventType.REASONING_START,
            EventType.REASONING_MESSAGE_START,
            EventType.REASONING_MESSAGE_CONTENT,
            EventType.TEXT_MESSAGE_START,
            EventType.TEXT_MESSAGE_CONTENT,
            EventType.CUSTOM,
            EventType.TOOL_CALL_START,
            EventType.TOOL_CALL_ARGS,
            EventType.TOOL_CALL_ARGS,
            EventType.TOOL_CALL_END,
            EventType.TOOL_CALL_RESULT,
            EventType.TEXT_MESSAGE_END,
            EventType.REASONING_MESSAGE_END,
            EventType.REASONING_END,
        ]);

        expect(stream.final).resolves.toMatchObject({
            messages: [
                {
                    id: "message-1_reasoning",
                    role: "reasoning",
                    content: "think",
                },
                {
                    id: "message-1",
                    role: "assistant",
                    content: "hello",
                    toolCalls: [
                        {
                            id: "call-1",
                            function: {
                                name: "search",
                                arguments: '{"query":"docs"}',
                            },
                        },
                    ],
                    sources: [
                        {
                            id: "source-1",
                            sourceType: "url",
                            url: "https://example.com",
                        },
                    ],
                },
            ],
            finishReason: "stop",
        });
    });

    test("resolves structured output when requested", async () => {
        const result = {
            fullStream: parts([{ type: "finish", finishReason: "stop" }]),
            output: Promise.resolve({ ok: true }),
        } as unknown as StreamResultInput;

        const stream = toBetterAgentStreamResult(result, "message-1", true);
        await collect(stream.events);

        expect(stream.final).resolves.toMatchObject({
            structured: { ok: true },
        });
    });

    test("rejects final and throws wrapped stream errors", async () => {
        const result = {
            fullStream: parts([{ type: "error", error: new Error("stream failed") }]),
        } as unknown as StreamResultInput;

        const stream = toBetterAgentStreamResult(result, "message-1");
        stream.final.catch(() => undefined);

        expect(collect(stream.events)).rejects.toThrow("stream failed");
    });
});
