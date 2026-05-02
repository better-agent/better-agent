import { describe, expect, test } from "bun:test";
import {
    toBetterAgentFinishReason,
    toBetterAgentGenerateResult,
    toBetterAgentUsage,
} from "../src/results";

type GenerateResultInput = Parameters<typeof toBetterAgentGenerateResult>[0];
type UsageInput = Parameters<typeof toBetterAgentUsage>[0];

describe("results", () => {
    test("maps finish reasons", () => {
        expect(toBetterAgentFinishReason("stop")).toBe("stop");
        expect(toBetterAgentFinishReason("length")).toBe("length");
        expect(toBetterAgentFinishReason("content-filter")).toBe("content-filter");
        expect(toBetterAgentFinishReason("tool-calls")).toBe("tool-calls");
        expect(toBetterAgentFinishReason("error")).toBe("other");
        expect(toBetterAgentFinishReason(undefined)).toBe("other");
    });

    test("maps token usage", () => {
        expect(
            toBetterAgentUsage({
                inputTokens: 10,
                outputTokens: 5,
                totalTokens: 15,
                outputTokenDetails: { reasoningTokens: 2 },
                inputTokenDetails: { cacheReadTokens: 3 },
            } as UsageInput),
        ).toEqual({
            inputTokens: 10,
            outputTokens: 5,
            totalTokens: 15,
            reasoningTokens: 2,
            cachedInputTokens: 3,
        });

        expect(toBetterAgentUsage(undefined)).toBeUndefined();
    });

    test("maps generate results to Better Agent messages", () => {
        const result = {
            text: "answer",
            output: { ok: true },
            reasoningText: "thinking",
            finishReason: "tool-calls",
            usage: {
                inputTokens: 1,
                outputTokens: 2,
                totalTokens: 3,
                outputTokenDetails: {},
                inputTokenDetails: {},
            },
            toolCalls: [
                {
                    toolCallId: "call-1",
                    toolName: "search",
                    input: { query: "docs" },
                    providerExecuted: true,
                },
            ],
            toolResults: [
                {
                    toolCallId: "call-1",
                    output: { ok: true },
                    providerExecuted: true,
                },
                {
                    toolCallId: "call-2",
                    output: "ignored",
                },
            ],
            sources: [
                {
                    id: "source-1",
                    sourceType: "url",
                    url: "https://example.com",
                    title: "Example",
                    providerMetadata: { page: 1 },
                },
                {
                    id: "source-2",
                    sourceType: "document",
                },
            ],
            files: [{ base64: "YWJj", mediaType: "text/plain" }],
        } as unknown as GenerateResultInput;

        const mapped = toBetterAgentGenerateResult(result, "message-1") as unknown;

        expect(mapped).toEqual({
            messages: [
                {
                    id: "message-1_reasoning",
                    role: "reasoning",
                    content: "thinking",
                },
                {
                    id: "message-1",
                    role: "assistant",
                    content: [
                        { type: "text", text: '{"ok":true}' },
                        {
                            type: "document",
                            source: {
                                type: "data",
                                value: "YWJj",
                                mimeType: "text/plain",
                            },
                            providerMetadata: undefined,
                        },
                    ],
                    toolCalls: [
                        {
                            id: "call-1",
                            type: "function",
                            function: {
                                name: "search",
                                arguments: '{"query":"docs"}',
                            },
                            providerExecuted: true,
                        },
                    ],
                    sources: [
                        {
                            id: "source-1",
                            sourceType: "url",
                            url: "https://example.com",
                            title: "Example",
                            providerMetadata: { page: 1 },
                        },
                    ],
                },
                {
                    id: "tool_call-1",
                    role: "tool",
                    toolCallId: "call-1",
                    content: '{"ok":true}',
                    status: "success",
                },
            ],
            structured: { ok: true },
            finishReason: "tool-calls",
            usage: {
                inputTokens: 1,
                outputTokens: 2,
                totalTokens: 3,
                reasoningTokens: undefined,
                cachedInputTokens: undefined,
            },
        } as unknown);
    });
});
