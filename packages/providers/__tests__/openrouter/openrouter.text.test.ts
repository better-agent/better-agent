import { describe, expect, test } from "bun:test";
import { TOOL_JSON_SCHEMA } from "@better-agent/core";
import { createOpenRouter } from "../../src/openrouter";
import {
    createOpenRouterStreamState,
    mapFromOpenRouterChatCompletion,
    mapFromOpenRouterChatCompletionChunk,
    mapToOpenRouterChatCompletionsRequest,
} from "../../src/openrouter/responses";

describe("openrouter text request mapping", () => {
    test("maps multimodal input, structured output, and tool choice", () => {
        const weatherTool = {
            name: "lookup_weather",
            description: "Lookup weather",
            kind: "server",
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

        const mapped = mapToOpenRouterChatCompletionsRequest({
            modelId: "openai/gpt-4.1-mini",
            options: {
                input: [
                    {
                        type: "message",
                        role: "user",
                        content: [
                            { type: "text", text: "Describe this image as JSON" },
                            {
                                type: "image",
                                source: {
                                    kind: "url",
                                    url: "https://example.com/cat.png",
                                },
                            },
                        ],
                    },
                ],
                tools: [weatherTool as never],
                toolChoice: { type: "tool", name: "lookup_weather" },
                structured_output: {
                    name: "vision_result",
                    schema: {
                        type: "object",
                        properties: {
                            description: { type: "string" },
                        },
                        required: ["description"],
                        additionalProperties: false,
                    },
                },
                temperature: 0.2,
                max_tokens: 128,
                modalities: ["text"],
            },
        });
        if (mapped.isErr()) throw mapped.error;

        expect(mapped.value.messages).toEqual([
            {
                role: "user",
                content: [
                    { type: "text", text: "Describe this image as JSON" },
                    { type: "image_url", image_url: { url: "https://example.com/cat.png" } },
                ],
            },
        ]);
        expect(mapped.value.tools?.[0]).toMatchObject({
            type: "function",
            function: { name: "lookup_weather", strict: true },
        });
        expect(mapped.value.tool_choice).toEqual({
            type: "function",
            function: { name: "lookup_weather" },
        });
        expect(mapped.value.response_format).toEqual({
            type: "json_schema",
            json_schema: {
                name: "vision_result",
                schema: {
                    type: "object",
                    properties: { description: { type: "string" } },
                    required: ["description"],
                    additionalProperties: false,
                },
            },
        });
        expect(mapped.value.temperature).toBe(0.2);
        expect(mapped.value.max_tokens).toBe(128);
    });

    test("maps OpenRouter hosted web search tool using server tool parameters", () => {
        const openrouter = createOpenRouter({});
        const mapped = mapToOpenRouterChatCompletionsRequest({
            modelId: "openai/gpt-5.4-mini",
            options: {
                input: "What were the major AI announcements this week?",
                tools: [
                    openrouter.tools.webSearch({
                        engine: "exa",
                        max_results: 5,
                        max_total_results: 20,
                        search_context_size: "medium",
                        allowed_domains: ["openai.com"],
                        excluded_domains: ["reddit.com"],
                        user_location: {
                            type: "approximate",
                            city: "San Francisco",
                            region: "California",
                            country: "US",
                            timezone: "America/Los_Angeles",
                        },
                    }),
                ],
            },
        });
        if (mapped.isErr()) throw mapped.error;

        expect(mapped.value.tools).toEqual([
            {
                type: "openrouter:web_search",
                parameters: {
                    engine: "exa",
                    max_results: 5,
                    max_total_results: 20,
                    search_context_size: "medium",
                    allowed_domains: ["openai.com"],
                    excluded_domains: ["reddit.com"],
                    user_location: {
                        type: "approximate",
                        city: "San Francisco",
                        region: "California",
                        country: "US",
                        timezone: "America/Los_Angeles",
                    },
                },
            },
        ]);
    });

    test("maps OpenRouter hosted datetime tool using server tool parameters", () => {
        const openrouter = createOpenRouter({});
        const mapped = mapToOpenRouterChatCompletionsRequest({
            modelId: "openai/gpt-5.4-mini",
            options: {
                input: "What time is it in Tokyo right now?",
                tools: [
                    openrouter.tools.datetime({
                        timezone: "Asia/Tokyo",
                    }),
                ],
            },
        });
        if (mapped.isErr()) throw mapped.error;

        expect(mapped.value.tools).toEqual([
            {
                type: "openrouter:datetime",
                parameters: {
                    timezone: "Asia/Tokyo",
                },
            },
        ]);
    });

    test("maps response text, images, and tool calls", () => {
        const mapped = mapFromOpenRouterChatCompletion({
            id: "chatcmpl_1",
            choices: [
                {
                    index: 0,
                    finish_reason: "tool_calls",
                    message: {
                        role: "assistant",
                        content: "Here is the result.",
                        images: ["https://example.com/result.png"],
                        tool_calls: [
                            {
                                id: "call_1",
                                function: {
                                    name: "lookup_weather",
                                    arguments: '{"city":"SF"}',
                                },
                            },
                        ],
                    },
                },
            ],
            usage: {
                prompt_tokens: 10,
                completion_tokens: 5,
                total_tokens: 15,
            },
        });

        expect(mapped.finishReason).toBe("tool-calls");
        expect(mapped.output).toEqual([
            {
                type: "message",
                role: "assistant",
                content: [
                    { type: "text", text: "Here is the result." },
                    {
                        type: "image",
                        source: {
                            kind: "url",
                            url: "https://example.com/result.png",
                        },
                    },
                ],
            },
            {
                type: "tool-call",
                callId: "call_1",
                name: "lookup_weather",
                arguments: '{"city":"SF"}',
            },
        ]);
        expect(mapped.usage?.totalTokens).toBe(15);
    });

    test("maps audio input and audio output options", () => {
        const mapped = mapToOpenRouterChatCompletionsRequest({
            modelId: "openai/gpt-4o-audio-preview",
            options: {
                input: [
                    {
                        type: "message",
                        role: "user",
                        content: [
                            { type: "text", text: "Please transcribe this clip." },
                            {
                                type: "audio",
                                source: {
                                    kind: "base64",
                                    data: "QUJDRA==",
                                    mimeType: "audio/wav",
                                },
                            },
                        ],
                    },
                ],
                modalities: ["text", "audio"],
                audio: {
                    voice: "alloy",
                    format: "wav",
                },
            },
        });
        if (mapped.isErr()) throw mapped.error;

        expect(mapped.value.messages).toEqual([
            {
                role: "user",
                content: [
                    { type: "text", text: "Please transcribe this clip." },
                    {
                        type: "input_audio",
                        inputAudio: {
                            data: "QUJDRA==",
                            format: "wav",
                        },
                    },
                ],
            },
        ]);
        expect(mapped.value.modalities).toEqual(["text", "audio"]);
        expect(mapped.value.audio).toEqual({
            voice: "alloy",
            format: "wav",
        });
    });

    test("maps streamed audio and transcript deltas into final response", () => {
        const state = createOpenRouterStreamState();
        state.audioFormat = "wav";

        const audioDelta = mapFromOpenRouterChatCompletionChunk(
            {
                choices: [
                    {
                        delta: {
                            audio: {
                                data: "QUJD",
                            },
                        },
                    },
                ],
            },
            state,
        );
        if (audioDelta.isErr()) throw audioDelta.error;
        expect(audioDelta.value).toEqual({
            kind: "audio-delta",
            data: "QUJD",
        });

        const transcriptDelta = mapFromOpenRouterChatCompletionChunk(
            {
                choices: [
                    {
                        delta: {
                            audio: {
                                transcript: "Hello",
                            },
                        },
                    },
                ],
            },
            state,
        );
        if (transcriptDelta.isErr()) throw transcriptDelta.error;
        expect(transcriptDelta.value).toEqual({
            kind: "transcript-delta",
            delta: "Hello",
        });

        const finalChunk = mapFromOpenRouterChatCompletionChunk(
            {
                choices: [
                    {
                        finish_reason: "stop",
                    },
                ],
            },
            state,
        );
        if (finalChunk.isErr()) throw finalChunk.error;
        expect(finalChunk.value).toEqual({
            kind: "final",
            response: {
                output: [
                    {
                        type: "message",
                        role: "assistant",
                        content: [
                            {
                                type: "audio",
                                source: {
                                    kind: "base64",
                                    data: "QUJD",
                                    mimeType: "audio/wav",
                                },
                            },
                            {
                                type: "transcript",
                                text: "Hello",
                            },
                        ],
                    },
                ],
                finishReason: "stop",
                usage: {},
                response: {
                    body: {
                        choices: [
                            {
                                finish_reason: "stop",
                            },
                        ],
                    },
                },
            },
        });
    });
});
