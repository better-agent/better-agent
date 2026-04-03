import { describe, expect, test } from "bun:test";
import { TOOL_JSON_SCHEMA } from "@better-agent/core";
import {
    createAnthropicStreamState,
    mapFromAnthropicMessagesResponse,
    mapFromAnthropicStreamEvent,
    mapToAnthropicMessagesRequest,
} from "../../src/anthropic/responses";

describe("anthropic request mapping", () => {
    test("replays completed tool calls as assistant tool_use followed by tool_result", () => {
        const mapped = mapToAnthropicMessagesRequest({
            modelId: "claude-sonnet-4-6",
            options: {
                input: [
                    { type: "message", role: "user", content: "weather?" },
                    {
                        type: "tool-call",
                        callId: "call_1",
                        name: "lookup",
                        arguments: '{"city":"Addis"}',
                        result: { city: "Addis", temperature: 26 },
                    },
                ],
            },
        });
        if (mapped.isErr()) throw mapped.error;

        expect(mapped.value.request.messages).toEqual([
            {
                role: "user",
                content: [{ type: "text", text: "weather?" }],
            },
            {
                role: "assistant",
                content: [
                    {
                        type: "tool_use",
                        id: "call_1",
                        name: "lookup",
                        input: { city: "Addis" },
                    },
                ],
            },
            {
                role: "user",
                content: [
                    {
                        type: "tool_result",
                        tool_use_id: "call_1",
                        content: '{"city":"Addis","temperature":26}',
                    },
                ],
            },
        ]);
    });

    test("auto structured output falls back to the json tool on unsupported models", () => {
        const mapped = mapToAnthropicMessagesRequest({
            modelId: "claude-sonnet-4-20250514",
            options: {
                input: "Return weather as JSON.",
                structured_output: {
                    name: "weather",
                    schema: {
                        type: "object",
                        properties: {
                            city: { type: "string" },
                        },
                        required: ["city"],
                        additionalProperties: false,
                    },
                },
            },
        });
        if (mapped.isErr()) throw mapped.error;

        expect(mapped.value.request.output_config?.format).toBeUndefined();
        expect(
            mapped.value.request.tools?.find(
                (tool) => "name" in tool && tool.name === "json" && "input_schema" in tool,
            ),
        ).toBeDefined();
        expect(mapped.value.request.tool_choice).toEqual({
            type: "tool",
            name: "json",
            disable_parallel_tool_use: true,
        });
    });

    test("auto structured output uses native output_config on supported models", () => {
        const mapped = mapToAnthropicMessagesRequest({
            modelId: "claude-sonnet-4-6",
            options: {
                input: "Return weather as JSON.",
                structured_output: {
                    name: "weather",
                    schema: {
                        type: "object",
                        properties: {
                            city: { type: "string" },
                        },
                        required: ["city"],
                        additionalProperties: false,
                    },
                },
            },
        });
        if (mapped.isErr()) throw mapped.error;

        expect(mapped.value.request.output_config?.format).toEqual({
            type: "json_schema",
            schema: {
                type: "object",
                properties: {
                    city: { type: "string" },
                },
                required: ["city"],
                additionalProperties: false,
            },
        });
        expect(
            mapped.value.request.tools?.some((tool) => "name" in tool && tool.name === "json") ??
                false,
        ).toBe(false);
    });

    test("only forwards strict for custom tools on models that support it", () => {
        const lookupTool = {
            name: "lookup",
            kind: "server",
            description: "Look up weather.",
            schema: {
                type: "object",
                properties: {
                    city: { type: "string" },
                },
                required: ["city"],
                additionalProperties: false,
            },
            strict: true,
            [TOOL_JSON_SCHEMA]: {
                type: "object",
                properties: {
                    city: { type: "string" },
                },
                required: ["city"],
                additionalProperties: false,
            },
        } as const;

        const supported = mapToAnthropicMessagesRequest({
            modelId: "claude-sonnet-4-6",
            options: {
                input: "Use the lookup tool.",
                tools: [lookupTool as never],
            },
        });
        if (supported.isErr()) throw supported.error;

        expect(supported.value.request.tools?.[0]).toMatchObject({
            name: "lookup",
            strict: true,
        });
        expect(supported.value.betas).toContain("structured-outputs-2025-11-13");

        const unsupported = mapToAnthropicMessagesRequest({
            modelId: "claude-sonnet-4-20250514",
            options: {
                input: "Use the lookup tool.",
                tools: [lookupTool as never],
            },
        });
        if (unsupported.isErr()) throw unsupported.error;

        expect(unsupported.value.request.tools?.[0]).toMatchObject({
            name: "lookup",
        });
        expect(
            unsupported.value.request.tools?.[0] != null &&
                "strict" in unsupported.value.request.tools[0],
        ).toBe(false);
        expect(unsupported.value.betas).not.toContain("structured-outputs-2025-11-13");
    });

    test("maps citation-enabled document inputs", () => {
        const mapped = mapToAnthropicMessagesRequest({
            modelId: "claude-sonnet-4-6",
            options: {
                input: [
                    {
                        type: "message",
                        role: "user",
                        content: [
                            {
                                type: "file",
                                source: {
                                    kind: "url",
                                    url: "https://example.com/report.pdf",
                                    mimeType: "application/pdf",
                                    filename: "report.pdf",
                                },
                                providerMetadata: {
                                    anthropic: {
                                        context: "Use the report as the source of truth.",
                                        citations: { enabled: true },
                                    },
                                },
                            },
                        ],
                    },
                ],
            },
        });
        if (mapped.isErr()) throw mapped.error;

        const document = mapped.value.request.messages[0]?.content[0];
        expect(document).toMatchObject({
            type: "document",
            title: "report.pdf",
            context: "Use the report as the source of truth.",
            citations: { enabled: true },
        });
    });

    test("prefers Anthropic file title metadata over filename", () => {
        const mapped = mapToAnthropicMessagesRequest({
            modelId: "claude-sonnet-4-6",
            options: {
                input: [
                    {
                        type: "message",
                        role: "user",
                        content: [
                            {
                                type: "file",
                                source: {
                                    kind: "url",
                                    url: "https://example.com/report.pdf",
                                    mimeType: "application/pdf",
                                    filename: "report.pdf",
                                },
                                providerMetadata: {
                                    anthropic: {
                                        title: "Quarterly Report",
                                    },
                                },
                            },
                        ],
                    },
                ],
            },
        });
        if (mapped.isErr()) throw mapped.error;

        const document = mapped.value.request.messages[0]?.content[0];
        expect(document).toMatchObject({
            type: "document",
            title: "Quarterly Report",
        });
    });

    test("maps Anthropic cache control on direct image inputs", () => {
        const mapped = mapToAnthropicMessagesRequest({
            modelId: "claude-sonnet-4-6",
            options: {
                input: [
                    {
                        type: "message",
                        role: "user",
                        content: [
                            {
                                type: "image",
                                source: {
                                    kind: "url",
                                    url: "https://example.com/image.png",
                                },
                                providerMetadata: {
                                    anthropic: {
                                        cacheControl: { type: "ephemeral", ttl: "5m" },
                                    },
                                },
                            },
                        ],
                    },
                ],
            },
        });
        if (mapped.isErr()) throw mapped.error;

        const image = mapped.value.request.messages[0]?.content[0];
        expect(image).toMatchObject({
            type: "image",
            cache_control: { type: "ephemeral", ttl: "5m" },
        });
    });

    test("adds fine-grained tool streaming beta only for streaming calls when enabled", () => {
        const streaming = mapToAnthropicMessagesRequest({
            modelId: "claude-sonnet-4-6",
            options: {
                input: "Use a tool if needed.",
            },
            stream: true,
        });
        if (streaming.isErr()) throw streaming.error;
        expect(streaming.value.betas).toContain("fine-grained-tool-streaming-2025-05-14");

        const disabled = mapToAnthropicMessagesRequest({
            modelId: "claude-sonnet-4-6",
            options: {
                input: "Use a tool if needed.",
                toolStreaming: false,
            },
            stream: true,
        });
        if (disabled.isErr()) throw disabled.error;
        expect(disabled.value.betas).not.toContain("fine-grained-tool-streaming-2025-05-14");

        const nonStreaming = mapToAnthropicMessagesRequest({
            modelId: "claude-sonnet-4-6",
            options: {
                input: "Use a tool if needed.",
            },
            stream: false,
        });
        if (nonStreaming.isErr()) throw nonStreaming.error;
        expect(nonStreaming.value.betas).not.toContain("fine-grained-tool-streaming-2025-05-14");
    });
});

describe("anthropic response mapping", () => {
    test("surfaces text citations in non-stream responses", () => {
        const response = mapFromAnthropicMessagesResponse({
            response: {
                id: "msg_1",
                type: "message",
                role: "assistant",
                model: "claude-sonnet-4-6",
                content: [
                    {
                        type: "text",
                        text: "The answer is in the report.",
                        citations: [{ start: 0, end: 6, document_id: "doc_1" }],
                    },
                ],
                stop_reason: "end_turn",
                stop_sequence: null,
                usage: {},
            },
        });

        expect(response.output[0]).toEqual({
            type: "message",
            role: "assistant",
            content: [
                {
                    type: "text",
                    text: "The answer is in the report.",
                    providerMetadata: {
                        anthropic: {
                            citations: [{ start: 0, end: 6, document_id: "doc_1" }],
                        },
                    },
                },
            ],
        });
    });

    test("accumulates text citations in streaming responses", () => {
        const state = createAnthropicStreamState("msg_stream");

        const events = [
            {
                type: "message_start",
                message: {
                    id: "msg_upstream",
                    type: "message",
                    role: "assistant",
                    model: "claude-sonnet-4-6",
                    content: [],
                    stop_reason: null,
                    stop_sequence: null,
                    usage: {},
                },
            },
            {
                type: "content_block_start",
                index: 0,
                content_block: {
                    type: "text",
                    text: "",
                },
            },
            {
                type: "content_block_delta",
                index: 0,
                delta: {
                    type: "text_delta",
                    text: "Grounded answer",
                },
            },
            {
                type: "content_block_delta",
                index: 0,
                delta: {
                    type: "citations_delta",
                    citation: { start: 0, end: 8, document_id: "doc_1" },
                },
            },
            {
                type: "content_block_stop",
                index: 0,
            },
            {
                type: "message_delta",
                delta: {
                    stop_reason: "end_turn",
                    stop_sequence: null,
                },
                usage: {},
            },
            {
                type: "message_stop",
            },
        ] satisfies Parameters<typeof mapFromAnthropicStreamEvent>[0][];

        let finalResponse: ReturnType<typeof mapFromAnthropicMessagesResponse> | undefined;

        for (const event of events) {
            const mapped = mapFromAnthropicStreamEvent(event, state);
            if (mapped.isErr()) throw mapped.error;
            if (mapped.value?.kind === "final") {
                finalResponse = mapped.value.response;
            }
        }

        expect(finalResponse?.output[0]).toEqual({
            type: "message",
            role: "assistant",
            content: [
                {
                    type: "text",
                    text: "Grounded answer",
                    providerMetadata: {
                        anthropic: {
                            citations: [{ start: 0, end: 8, document_id: "doc_1" }],
                        },
                    },
                },
            ],
        });
    });
});
