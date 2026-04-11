import { describe, expect, test } from "bun:test";
import { TOOL_JSON_SCHEMA } from "@better-agent/core";
import type { RunContext } from "@better-agent/core";
import { type Event, Events } from "@better-agent/core/events";
import { ok } from "@better-agent/shared/neverthrow";
import { createOpenAI } from "../../src/openai";
import type { createOpenAIClient } from "../../src/openai/client/create-client";
import { createOpenAIGenerativeModel } from "../../src/openai/models";
import {
    mapFromOpenAIResponsesResponse,
    mapFromOpenAIResponsesStreamEvent,
    mapToOpenAIResponsesRequest,
} from "../../src/openai/responses/mappers";
import type {
    OpenAICreateResponse,
    OpenAIResponseStreamEvent,
} from "../../src/openai/responses/schemas";
import { OPENAI_TEXT_FIXTURE, WEATHER_TOOL } from "../fixtures/openai.text";

describe("openai-text request mapping", () => {
    test("maps multimodal input with general options and reasoning", () => {
        const mapped = mapToOpenAIResponsesRequest({
            modelId: "gpt-5.4",
            options: {
                input: [
                    {
                        type: "message",
                        role: "user",
                        content: [
                            { type: "text", text: OPENAI_TEXT_FIXTURE.prompts.multimodal },
                            {
                                type: "image",
                                source: {
                                    kind: "url",
                                    url: OPENAI_TEXT_FIXTURE.imageUrl,
                                },
                            },
                        ],
                    },
                ],
                modalities: ["text"],
                max_output_tokens: 64,
                temperature: 0.2,
                top_p: 1,
                metadata: { suite: "openai-text" },
                reasoningEffort: "low",
                reasoningSummary: "auto",
                textVerbosity: "high",
                logprobs: 3,
                maxToolCalls: 2,
            },
        });
        if (mapped.isErr()) throw mapped.error;

        expect(mapped.value.model).toBe("gpt-5.4");
        expect(mapped.value.max_output_tokens).toBe(64);
        expect(mapped.value.temperature).toBe(0.2);
        expect(mapped.value.top_p).toBe(1);
        expect((mapped.value.metadata as Record<string, unknown>)?.suite).toBe("openai-text");
        expect((mapped.value.reasoning as Record<string, unknown>)?.effort).toBe("low");
        expect((mapped.value.reasoning as Record<string, unknown>)?.summary).toBe("auto");
        expect((mapped.value.text as Record<string, unknown>)?.verbosity).toBe("high");
        expect(mapped.value.top_logprobs).toBe(3);
        expect(mapped.value.max_tool_calls).toBe(2);
    });

    test("maps text response options even when modalities are omitted", () => {
        const mapped = mapToOpenAIResponsesRequest({
            modelId: "gpt-5.4",
            options: {
                input: "hello",
                max_output_tokens: 64,
                temperature: 0.2,
                top_p: 1,
            },
        });
        if (mapped.isErr()) throw mapped.error;

        expect(mapped.value.max_output_tokens).toBe(64);
        expect(mapped.value.temperature).toBe(0.2);
        expect(mapped.value.top_p).toBe(1);
    });

    test("maps provider-managed file inputs", () => {
        const mapped = mapToOpenAIResponsesRequest({
            modelId: "gpt-5.1",
            options: {
                input: [
                    {
                        type: "message",
                        role: "user",
                        content: [
                            { type: "text", text: "Summarize this PDF" },
                            {
                                type: "file",
                                source: {
                                    kind: "provider-file",
                                    ref: {
                                        provider: "openai",
                                        id: "file_123",
                                    },
                                    mimeType: "application/pdf",
                                    filename: "report.pdf",
                                },
                            },
                        ],
                    },
                ],
            },
        });
        if (mapped.isErr()) throw mapped.error;

        const input = mapped.value.input as Array<Record<string, unknown>>;
        const content = input[0]?.content as Array<Record<string, unknown>>;
        expect(content[1]?.type).toBe("input_file");
        expect(content[1]?.file_id).toBe("file_123");
        expect(content[1]?.filename).toBe("report.pdf");
    });

    test("omits assistant image and file parts from replay input instead of throwing", () => {
        const mapped = mapToOpenAIResponsesRequest({
            modelId: "gpt-5.1",
            options: {
                input: [
                    {
                        type: "message",
                        role: "assistant",
                        content: [
                            { type: "text", text: "Here is the generated image." },
                            {
                                type: "image",
                                source: {
                                    kind: "url",
                                    url: OPENAI_TEXT_FIXTURE.imageUrl,
                                },
                            },
                            {
                                type: "file",
                                source: {
                                    kind: "url",
                                    url: "https://example.com/report.pdf",
                                    mimeType: "application/pdf",
                                    filename: "report.pdf",
                                },
                            },
                        ],
                    },
                    {
                        type: "message",
                        role: "user",
                        content: "What changed?",
                    },
                ],
            },
        });
        if (mapped.isErr()) throw mapped.error;

        const input = mapped.value.input as Array<Record<string, unknown>>;
        expect(input[0]).toEqual({
            role: "assistant",
            content: [{ type: "output_text", text: "Here is the generated image." }],
        });
        expect(input[1]).toEqual({
            role: "user",
            content: [{ type: "input_text", text: "What changed?" }],
        });
    });

    test("maps url and base64 file inputs", () => {
        const wrongProvider = mapToOpenAIResponsesRequest({
            modelId: "gpt-5.4",
            options: {
                input: [
                    {
                        type: "message",
                        role: "user",
                        content: [
                            {
                                type: "file",
                                source: {
                                    kind: "provider-file",
                                    ref: {
                                        provider: "xai",
                                        id: "file_123",
                                    },
                                },
                            },
                        ],
                    },
                ],
            },
        });
        expect(wrongProvider.isErr()).toBe(true);
        if (wrongProvider.isOk()) throw new Error("Expected provider mismatch to fail");
        expect(wrongProvider.error.message.toLowerCase()).toContain("provider=openai");

        const urlSource = mapToOpenAIResponsesRequest({
            modelId: "gpt-5.4",
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
                                },
                            },
                        ],
                    },
                ],
            },
        });
        if (urlSource.isErr()) throw urlSource.error;
        const urlContent = (urlSource.value.input as Array<Record<string, unknown>>)[0]?.content as
            | Array<Record<string, unknown>>
            | undefined;
        expect(urlContent?.[0]?.type).toBe("input_file");
        expect(urlContent?.[0]?.file_url).toBe("https://example.com/report.pdf");

        const base64Source = mapToOpenAIResponsesRequest({
            modelId: "gpt-5.4",
            options: {
                input: [
                    {
                        type: "message",
                        role: "user",
                        content: [
                            {
                                type: "file",
                                source: {
                                    kind: "base64",
                                    data: "JVBERi0xLjQ=",
                                    mimeType: "application/pdf",
                                    filename: "report.pdf",
                                },
                            },
                        ],
                    },
                ],
            },
        });
        if (base64Source.isErr()) throw base64Source.error;
        const base64Content = (base64Source.value.input as Array<Record<string, unknown>>)[0]
            ?.content as Array<Record<string, unknown>> | undefined;
        expect(base64Content?.[0]?.type).toBe("input_file");
        expect(String(base64Content?.[0]?.file_data ?? "")).toContain(
            "data:application/pdf;base64,",
        );
    });

    test("maps function tools and tool choice variants", () => {
        const toolCase = mapToOpenAIResponsesRequest({
            modelId: OPENAI_TEXT_FIXTURE.modelIds.mini,
            options: {
                input: OPENAI_TEXT_FIXTURE.prompts.useTool,
                tools: [WEATHER_TOOL] as never,
                toolChoice: { type: "tool", name: "get_weather" },
            },
        });
        if (toolCase.isErr()) throw toolCase.error;
        const toolChoice = toolCase.value.tool_choice as Record<string, unknown> | undefined;
        expect(toolChoice?.type).toBe("function");
        expect(toolChoice?.name).toBe("get_weather");

        const noneCase = mapToOpenAIResponsesRequest({
            modelId: OPENAI_TEXT_FIXTURE.modelIds.mini,
            options: {
                input: OPENAI_TEXT_FIXTURE.prompts.noTool,
                tools: [WEATHER_TOOL] as never,
                toolChoice: { type: "none" },
            },
        });
        if (noneCase.isErr()) throw noneCase.error;
        expect(noneCase.value.tool_choice).toBe("none");
    });

    test("maps provider-native tools declared in tools[]", () => {
        const openai = createOpenAI({});
        const mapped = mapToOpenAIResponsesRequest({
            modelId: OPENAI_TEXT_FIXTURE.modelIds.latest,
            options: {
                input: OPENAI_TEXT_FIXTURE.prompts.hello,
                tools: [
                    openai.tools.webSearch({ search_context_size: "low" }),
                    openai.tools.webSearchPreview({ search_context_size: "medium" }),
                    openai.tools.toolSearch({
                        execution: "client",
                        description: "Search loaded tools",
                    }),
                    openai.tools.shell(),
                ],
            },
        });
        if (mapped.isErr()) throw mapped.error;

        const tools = mapped.value.tools as Array<Record<string, unknown>> | undefined;
        expect(tools?.some((tool) => tool.type === "web_search")).toBe(true);
        expect(tools?.some((tool) => tool.type === "web_search_preview")).toBe(true);
        expect(tools?.some((tool) => tool.type === "tool_search")).toBe(true);
        expect(tools?.some((tool) => tool.type === "shell")).toBe(true);
        expect(tools?.some((tool) => tool.type === "function")).toBe(false);
    });

    test("maps coexistence of function tools and provider-native tools", () => {
        const openai = createOpenAI({});
        const mapped = mapToOpenAIResponsesRequest({
            modelId: OPENAI_TEXT_FIXTURE.modelIds.latest,
            options: {
                input: OPENAI_TEXT_FIXTURE.prompts.coexistence,
                tools: [
                    WEATHER_TOOL,
                    openai.tools.webSearch({ search_context_size: "low" }),
                ] as never,
                toolChoice: { type: "tool", name: "get_weather" },
            },
        });
        if (mapped.isErr()) throw mapped.error;

        const tools = mapped.value.tools as Array<Record<string, unknown>> | undefined;
        expect(tools?.some((tool) => tool.type === "function" && tool.name === "get_weather")).toBe(
            true,
        );
        expect(tools?.some((tool) => tool.type === "web_search")).toBe(true);
        const toolChoice = mapped.value.tool_choice as Record<string, unknown> | undefined;
        expect(toolChoice?.type).toBe("function");
        expect(toolChoice?.name).toBe("get_weather");
    });

    test("maps structured output and reports validation errors", () => {
        const structured = mapToOpenAIResponsesRequest({
            modelId: OPENAI_TEXT_FIXTURE.modelIds.mini,
            options: {
                input: OPENAI_TEXT_FIXTURE.prompts.returnJson,
                structured_output: {
                    name: "standard_schema",
                    schema: OPENAI_TEXT_FIXTURE.standardSchema["~standard"].jsonSchema.input(),
                },
            },
        });
        if (structured.isErr()) throw structured.error;
        const format = (structured.value.text as Record<string, unknown>)?.format as
            | Record<string, unknown>
            | undefined;
        expect(format?.type).toBe("json_schema");
        expect(format?.name).toBe("standard_schema");
    });

    test("request validation errors are deterministic", () => {
        const badToolChoice = mapToOpenAIResponsesRequest({
            modelId: OPENAI_TEXT_FIXTURE.modelIds.mini,
            options: {
                input: OPENAI_TEXT_FIXTURE.prompts.hello,
                tools: [WEATHER_TOOL] as never,
                toolChoice: { type: "tool", name: OPENAI_TEXT_FIXTURE.unknownToolName },
            },
        });
        expect(badToolChoice.isErr()).toBe(true);
        if (badToolChoice.isOk()) throw new Error("Expected unknown tool choice to fail");
        expect(badToolChoice.error.message.toLowerCase()).toContain("requested tool not found");

        const badToolSchema = mapToOpenAIResponsesRequest({
            modelId: OPENAI_TEXT_FIXTURE.modelIds.mini,
            options: {
                input: OPENAI_TEXT_FIXTURE.prompts.hello,
                tools: [
                    {
                        ...WEATHER_TOOL,
                        schema: { type: "string" },
                        [TOOL_JSON_SCHEMA]: { type: "string" },
                    },
                ] as never,
            },
        });
        expect(badToolSchema.isErr()).toBe(true);
        if (badToolSchema.isOk()) throw new Error("Expected non-object tool schema to fail");
        expect(badToolSchema.error.message.toLowerCase()).toContain(
            "tool parameters schema must be an object",
        );

        const badStructuredSchema = mapToOpenAIResponsesRequest({
            modelId: OPENAI_TEXT_FIXTURE.modelIds.mini,
            options: {
                input: OPENAI_TEXT_FIXTURE.prompts.hello,
                structured_output: {
                    name: "bad_schema",
                    strict: true,
                    schema: { type: "string" } as never,
                },
            },
        });
        expect(badStructuredSchema.isErr()).toBe(true);
        if (badStructuredSchema.isOk()) {
            throw new Error("Expected non-object structured schema to fail");
        }
        expect(badStructuredSchema.error.message.toLowerCase()).toContain(
            "structured output schema must be an object",
        );
    });
});

describe("openai-text response mapping", () => {
    test("maps assistant message, function call, and native tool call output", () => {
        const mapped = mapFromOpenAIResponsesResponse({
            output: [
                {
                    type: "message",
                    role: "assistant",
                    content: [{ type: "output_text", text: "hello world" }],
                },
                {
                    type: "function_call",
                    id: OPENAI_TEXT_FIXTURE.ids.functionCall,
                    call_id: "call_1",
                    name: "get_weather",
                    arguments: '{"location":"SF"}',
                },
                {
                    id: OPENAI_TEXT_FIXTURE.ids.nativeCall,
                    type: "web_search_call",
                    status: "completed",
                    action: {
                        type: "search",
                        query: "hello",
                        queries: ["hello"],
                    },
                },
                {
                    id: "so_1",
                    type: "shell_call_output",
                    call_id: "sc_1",
                    output: [{ type: "logs", logs: "ok" }],
                },
                {
                    id: "tso_1",
                    type: "tool_search_output",
                    call_id: "tsc_1",
                    status: "completed",
                    tools: [{ type: "function", name: "get_weather" }],
                },
                {
                    id: "ig_1",
                    type: "image_generation_call",
                    status: "completed",
                    result: "Zm9v",
                },
            ],
            usage: {
                input_tokens: 1,
                output_tokens: 2,
            },
        } as unknown as OpenAICreateResponse);

        const messages = mapped.output.filter((item) => item.type === "message");
        expect(messages.length).toBe(2);
        const textMessage = messages[0];
        expect(textMessage?.type).toBe("message");
        if (
            !textMessage ||
            textMessage.type !== "message" ||
            typeof textMessage.content === "string"
        ) {
            throw new Error("Expected mapped assistant text message");
        }
        expect(textMessage.content[0]?.type).toBe("text");

        const imageMessage = messages[1];
        expect(imageMessage?.type).toBe("message");
        if (
            !imageMessage ||
            imageMessage.type !== "message" ||
            typeof imageMessage.content === "string"
        ) {
            throw new Error("Expected mapped assistant image message");
        }
        expect(imageMessage.content[0]).toEqual({
            type: "image",
            source: {
                kind: "base64",
                data: "Zm9v",
                mimeType: "image/png",
            },
        });

        const toolCalls = mapped.output.filter((item) => item.type === "tool-call");
        const providerToolResults = mapped.output.filter(
            (item) => item.type === "provider-tool-result",
        );
        expect(toolCalls.length).toBe(1);
        expect(providerToolResults.length).toBe(4);
        expect(toolCalls[0]?.name).toBe("get_weather");
        expect(providerToolResults[0]?.name).toBe("web_search");
        expect(providerToolResults[1]?.name).toBe("shell");
        expect(providerToolResults[2]?.name).toBe("tool_search");
        expect(providerToolResults[3]?.name).toBe("image_generation");
    });

    test("maps finish reasons for key response states", () => {
        const lengthReason = mapFromOpenAIResponsesResponse({
            output: [],
            incomplete_details: { reason: "max_output_tokens" },
        } as unknown as OpenAICreateResponse);
        expect(lengthReason.finishReason).toBe("length");

        const contentFilterReason = mapFromOpenAIResponsesResponse({
            output: [],
            incomplete_details: { reason: "content_filter" },
        } as unknown as OpenAICreateResponse);
        expect(contentFilterReason.finishReason).toBe("content-filter");

        const otherReason = mapFromOpenAIResponsesResponse({
            output: [],
            incomplete_details: { reason: "other" },
        } as unknown as OpenAICreateResponse);
        expect(otherReason.finishReason).toBe("other");

        const stopReason = mapFromOpenAIResponsesResponse({
            output: [],
        } as unknown as OpenAICreateResponse);
        expect(stopReason.finishReason).toBe("stop");
    });
});

describe("openai-text stream mapping", () => {
    test("maps text stream lifecycle events", () => {
        const start = mapFromOpenAIResponsesStreamEvent(
            {
                type: "response.output_item.added",
                item: {
                    type: "message",
                },
            } as OpenAIResponseStreamEvent,
            OPENAI_TEXT_FIXTURE.ids.message1,
        );
        if (start.isErr()) throw start.error;
        expect(start.value?.kind).toBe("event");
        if (start.value?.kind === "event") {
            expect(start.value.event.type).toBe(Events.TEXT_MESSAGE_START);
        }

        const delta = mapFromOpenAIResponsesStreamEvent(
            {
                type: "response.output_text.delta",
                delta: "hel",
            } as OpenAIResponseStreamEvent,
            OPENAI_TEXT_FIXTURE.ids.message1,
        );
        if (delta.isErr()) throw delta.error;
        expect(delta.value?.kind).toBe("event");
        if (delta.value?.kind === "event") {
            expect(delta.value.event.type).toBe(Events.TEXT_MESSAGE_CONTENT);
        }

        const done = mapFromOpenAIResponsesStreamEvent(
            {
                type: "response.output_text.done",
                text: "hello",
            } as OpenAIResponseStreamEvent,
            OPENAI_TEXT_FIXTURE.ids.message1,
        );
        if (done.isErr()) throw done.error;
        expect(done.value?.kind).toBe("event");
        if (done.value?.kind === "event") {
            expect(done.value.event.type).toBe(Events.TEXT_MESSAGE_END);
        }
    });

    test("maps function and native tool stream lifecycle events", () => {
        const functionStart = mapFromOpenAIResponsesStreamEvent(
            {
                type: "response.output_item.added",
                item: {
                    type: "function_call",
                    id: OPENAI_TEXT_FIXTURE.ids.functionCall,
                    call_id: "call_stream_1",
                    name: "get_weather",
                },
            } as OpenAIResponseStreamEvent,
            OPENAI_TEXT_FIXTURE.ids.message1,
        );
        if (functionStart.isErr()) throw functionStart.error;
        expect(functionStart.value?.kind).toBe("event");
        if (functionStart.value?.kind === "event") {
            expect(functionStart.value.event.type).toBe(Events.TOOL_CALL_START);
            if (functionStart.value.event.type !== Events.TOOL_CALL_START) {
                throw new Error("Expected TOOL_CALL_START");
            }
            expect(functionStart.value.event.toolCallId).toBe("call_stream_1");
        }

        const functionArgs = mapFromOpenAIResponsesStreamEvent(
            {
                type: "response.function_call_arguments.delta",
                item_id: OPENAI_TEXT_FIXTURE.ids.functionCall,
                call_id: "call_stream_1",
                delta: '{"location":"SF"}',
            } as OpenAIResponseStreamEvent,
            OPENAI_TEXT_FIXTURE.ids.message1,
        );
        if (functionArgs.isErr()) throw functionArgs.error;
        expect(functionArgs.value?.kind).toBe("event");
        if (functionArgs.value?.kind === "event") {
            expect(functionArgs.value.event.type).toBe(Events.TOOL_CALL_ARGS);
            if (functionArgs.value.event.type !== Events.TOOL_CALL_ARGS) {
                throw new Error("Expected TOOL_CALL_ARGS");
            }
            expect(functionArgs.value.event.toolCallId).toBe("call_stream_1");
        }

        const functionEnd = mapFromOpenAIResponsesStreamEvent(
            {
                type: "response.function_call_arguments.done",
                item_id: OPENAI_TEXT_FIXTURE.ids.functionCall,
                call_id: "call_stream_1",
            } as OpenAIResponseStreamEvent,
            OPENAI_TEXT_FIXTURE.ids.message1,
        );
        if (functionEnd.isErr()) throw functionEnd.error;
        expect(functionEnd.value?.kind).toBe("event");
        if (functionEnd.value?.kind === "event") {
            expect(functionEnd.value.event.type).toBe(Events.TOOL_CALL_END);
            if (functionEnd.value.event.type !== Events.TOOL_CALL_END) {
                throw new Error("Expected TOOL_CALL_END");
            }
            expect(functionEnd.value.event.toolCallId).toBe("call_stream_1");
        }

        const customArgs = mapFromOpenAIResponsesStreamEvent(
            {
                type: "response.custom_tool_call_input.delta",
                item_id: "ct_1",
                delta: "echo hello",
            } as OpenAIResponseStreamEvent,
            OPENAI_TEXT_FIXTURE.ids.message1,
        );
        if (customArgs.isErr()) throw customArgs.error;
        expect(customArgs.value?.kind).toBe("event");
        if (customArgs.value?.kind === "event") {
            expect(customArgs.value.event.type).toBe(Events.TOOL_CALL_ARGS);
        }

        const customEnd = mapFromOpenAIResponsesStreamEvent(
            {
                type: "response.custom_tool_call_input.done",
                item_id: "ct_1",
            } as OpenAIResponseStreamEvent,
            OPENAI_TEXT_FIXTURE.ids.message1,
        );
        if (customEnd.isErr()) throw customEnd.error;
        expect(customEnd.value?.kind).toBe("event");
        if (customEnd.value?.kind === "event") {
            expect(customEnd.value.event.type).toBe(Events.TOOL_CALL_END);
        }

        const nativeStart = mapFromOpenAIResponsesStreamEvent(
            {
                type: "response.output_item.added",
                item: {
                    id: OPENAI_TEXT_FIXTURE.ids.nativeCall,
                    type: "web_search_call",
                    status: "in_progress",
                },
            } as OpenAIResponseStreamEvent,
            OPENAI_TEXT_FIXTURE.ids.message1,
        );
        if (nativeStart.isErr()) throw nativeStart.error;
        expect(nativeStart.value?.kind).toBe("event");
        if (nativeStart.value?.kind === "event") {
            expect(nativeStart.value.event.type).toBe(Events.TOOL_CALL_START);
        }

        const toolSearchResult = mapFromOpenAIResponsesStreamEvent(
            {
                type: "response.output_item.done",
                item: {
                    id: "tso_1",
                    type: "tool_search_output",
                    call_id: "tsc_1",
                    status: "completed",
                    tools: [{ type: "function", name: "get_weather" }],
                },
            } as OpenAIResponseStreamEvent,
            OPENAI_TEXT_FIXTURE.ids.message1,
        );
        if (toolSearchResult.isErr()) throw toolSearchResult.error;
        expect(toolSearchResult.value?.kind).toBe("event");
        if (toolSearchResult.value?.kind === "event") {
            expect(toolSearchResult.value.event.type).toBe(Events.TOOL_CALL_RESULT);
            if (toolSearchResult.value.event.type !== Events.TOOL_CALL_RESULT) {
                throw new Error("Expected TOOL_CALL_RESULT");
            }
            expect(toolSearchResult.value.event.toolCallName).toBe("tool_search");
        }

        const nativeResult = mapFromOpenAIResponsesStreamEvent(
            {
                type: "response.output_item.done",
                item: {
                    id: OPENAI_TEXT_FIXTURE.ids.nativeCall,
                    type: "web_search_call",
                    status: "completed",
                },
            } as OpenAIResponseStreamEvent,
            OPENAI_TEXT_FIXTURE.ids.message1,
        );
        if (nativeResult.isErr()) throw nativeResult.error;
        expect(nativeResult.value?.kind).toBe("event");
        if (nativeResult.value?.kind === "event") {
            expect(nativeResult.value.event.type).toBe(Events.TOOL_CALL_RESULT);
        }

        const nativeOutputResult = mapFromOpenAIResponsesStreamEvent(
            {
                type: "response.output_item.done",
                item: {
                    id: "so_1",
                    type: "shell_call_output",
                    call_id: "sc_1",
                    output: [{ type: "logs", logs: "ok" }],
                },
            } as OpenAIResponseStreamEvent,
            OPENAI_TEXT_FIXTURE.ids.message1,
        );
        if (nativeOutputResult.isErr()) throw nativeOutputResult.error;
        expect(nativeOutputResult.value?.kind).toBe("event");
        if (nativeOutputResult.value?.kind === "event") {
            expect(nativeOutputResult.value.event.type).toBe(Events.TOOL_CALL_RESULT);
        }
    });

    test("maps native status DATA_PART events and native image partial image event", () => {
        for (const item of OPENAI_TEXT_FIXTURE.statusDataPartCases) {
            const mapped = mapFromOpenAIResponsesStreamEvent(
                {
                    type: item.type,
                    item_id: "tool_1",
                } as OpenAIResponseStreamEvent,
                OPENAI_TEXT_FIXTURE.ids.message1,
            );
            if (mapped.isErr()) throw mapped.error;
            expect(mapped.value?.kind).toBe("event");
            if (mapped.value?.kind === "event") {
                expect(mapped.value.event.type).toBe(Events.DATA_PART);
                const payload = (
                    mapped.value.event as Extract<Event, { type: typeof Events.DATA_PART }>
                ).data as Record<string, unknown>;
                expect(payload.tool).toBe(item.tool);
                expect(payload.status).toBe(item.status);
            }
        }

        const partial = mapFromOpenAIResponsesStreamEvent(
            {
                type: "response.image_generation_call.partial_image",
                item_id: "ig_1",
                partial_image_b64: "Zm9v",
            } as OpenAIResponseStreamEvent,
            OPENAI_TEXT_FIXTURE.ids.message1,
        );
        if (partial.isErr()) throw partial.error;
        expect(partial.value?.kind).toBe("event");
        if (partial.value?.kind === "event") {
            expect(partial.value.event.type).toBe(Events.IMAGE_MESSAGE_CONTENT);
        }
    });

    test("maps reasoning summary/full stream events", () => {
        const summaryStart = mapFromOpenAIResponsesStreamEvent(
            {
                type: "response.reasoning_summary_part.added",
                item_id: "reason_1",
            } as OpenAIResponseStreamEvent,
            OPENAI_TEXT_FIXTURE.ids.message1,
        );
        if (summaryStart.isErr()) throw summaryStart.error;
        expect(summaryStart.value?.kind).toBe("event");
        if (summaryStart.value?.kind === "event") {
            expect(summaryStart.value.event.type).toBe(Events.REASONING_MESSAGE_START);
            if (summaryStart.value.event.type !== Events.REASONING_MESSAGE_START) {
                throw new Error("Expected REASONING_MESSAGE_START");
            }
            expect(summaryStart.value.event.messageId).toBe(OPENAI_TEXT_FIXTURE.ids.message1);
            expect(summaryStart.value.event.visibility).toBe("summary");
        }

        const summaryDelta = mapFromOpenAIResponsesStreamEvent(
            {
                type: "response.reasoning_summary_text.delta",
                item_id: "reason_1",
                delta: "thinking summary",
            } as OpenAIResponseStreamEvent,
            OPENAI_TEXT_FIXTURE.ids.message1,
        );
        if (summaryDelta.isErr()) throw summaryDelta.error;
        expect(summaryDelta.value?.kind).toBe("event");
        if (summaryDelta.value?.kind === "event") {
            expect(summaryDelta.value.event.type).toBe(Events.REASONING_MESSAGE_CONTENT);
            if (summaryDelta.value.event.type !== Events.REASONING_MESSAGE_CONTENT) {
                throw new Error("Expected REASONING_MESSAGE_CONTENT");
            }
            expect(summaryDelta.value.event.messageId).toBe(OPENAI_TEXT_FIXTURE.ids.message1);
            expect(summaryDelta.value.event.visibility).toBe("summary");
            expect(summaryDelta.value.event.delta).toBe("thinking summary");
        }

        const summaryDone = mapFromOpenAIResponsesStreamEvent(
            {
                type: "response.reasoning_summary_text.done",
                item_id: "reason_1",
            } as OpenAIResponseStreamEvent,
            OPENAI_TEXT_FIXTURE.ids.message1,
        );
        if (summaryDone.isErr()) throw summaryDone.error;
        expect(summaryDone.value?.kind).toBe("event");
        if (summaryDone.value?.kind === "event") {
            expect(summaryDone.value.event.type).toBe(Events.REASONING_MESSAGE_END);
            if (summaryDone.value.event.type !== Events.REASONING_MESSAGE_END) {
                throw new Error("Expected REASONING_MESSAGE_END");
            }
            expect(summaryDone.value.event.messageId).toBe(OPENAI_TEXT_FIXTURE.ids.message1);
            expect(summaryDone.value.event.visibility).toBe("summary");
        }

        const fullDelta = mapFromOpenAIResponsesStreamEvent(
            {
                type: "response.reasoning_text.delta",
                item_id: "reason_2",
                delta: "hidden thought",
            } as OpenAIResponseStreamEvent,
            OPENAI_TEXT_FIXTURE.ids.message1,
        );
        if (fullDelta.isErr()) throw fullDelta.error;
        expect(fullDelta.value?.kind).toBe("event");
        if (fullDelta.value?.kind === "event") {
            expect(fullDelta.value.event.type).toBe(Events.REASONING_MESSAGE_CONTENT);
            if (fullDelta.value.event.type !== Events.REASONING_MESSAGE_CONTENT) {
                throw new Error("Expected REASONING_MESSAGE_CONTENT");
            }
            expect(fullDelta.value.event.messageId).toBe(OPENAI_TEXT_FIXTURE.ids.message1);
            expect(fullDelta.value.event.visibility).toBe("full");
            expect(fullDelta.value.event.delta).toBe("hidden thought");
        }

        const fullDone = mapFromOpenAIResponsesStreamEvent(
            {
                type: "response.reasoning_text.done",
                item_id: "reason_2",
            } as OpenAIResponseStreamEvent,
            OPENAI_TEXT_FIXTURE.ids.message1,
        );
        if (fullDone.isErr()) throw fullDone.error;
        expect(fullDone.value?.kind).toBe("event");
        if (fullDone.value?.kind === "event") {
            expect(fullDone.value.event.type).toBe(Events.REASONING_MESSAGE_END);
            if (fullDone.value.event.type !== Events.REASONING_MESSAGE_END) {
                throw new Error("Expected REASONING_MESSAGE_END");
            }
            expect(fullDone.value.event.messageId).toBe(OPENAI_TEXT_FIXTURE.ids.message1);
            expect(fullDone.value.event.visibility).toBe("full");
        }
    });

    test("maps stream error event to upstream error", () => {
        const mapped = mapFromOpenAIResponsesStreamEvent(
            {
                type: "error",
                message: "OpenAI streaming error",
                error: { message: "fail" },
                sequence_number: 1,
            } as OpenAIResponseStreamEvent,
            OPENAI_TEXT_FIXTURE.ids.message1,
        );
        expect(mapped.isErr()).toBe(true);
        if (mapped.isOk()) throw new Error("Expected stream error mapping to fail");
        expect(mapped.error.code).toBe("UPSTREAM_FAILED");
        expect(mapped.error.context?.upstreamCode).toBe("STREAM_ERROR");
    });

    test("maps context length stream error to a clearer message", () => {
        const mapped = mapFromOpenAIResponsesStreamEvent(
            {
                type: "error",
                error: {
                    type: "invalid_request_error",
                    code: "context_length_exceeded",
                    message:
                        "Your input exceeds the context window of this model. Please adjust your input and try again.",
                    param: "input",
                },
                sequence_number: 1,
            } as OpenAIResponseStreamEvent,
            OPENAI_TEXT_FIXTURE.ids.message1,
        );
        expect(mapped.isErr()).toBe(true);
        if (mapped.isOk()) throw new Error("Expected stream error mapping to fail");
        expect(mapped.error.code).toBe("CONTEXT_LENGTH_EXCEEDED");
        expect(mapped.error.message).toContain("context window");
        expect(mapped.error.context?.upstreamCode).toBe("context_length_exceeded");
    });

    test("backfills native result/end from response.completed without duplicates", async () => {
        const fakeClient = {
            responses: {
                stream: async () =>
                    ok(
                        (async function* () {
                            yield ok({
                                type: "response.output_item.added",
                                item: {
                                    id: OPENAI_TEXT_FIXTURE.ids.nativeCall,
                                    type: "web_search_call",
                                    status: "in_progress",
                                },
                            } as OpenAIResponseStreamEvent);
                            yield ok({
                                type: "response.completed",
                                response: {
                                    output: [
                                        {
                                            id: OPENAI_TEXT_FIXTURE.ids.nativeCall,
                                            type: "web_search_call",
                                            status: "completed",
                                        },
                                    ],
                                    usage: {
                                        input_tokens: 1,
                                        output_tokens: 1,
                                    },
                                },
                            } as OpenAIResponseStreamEvent);
                        })(),
                    ),
            },
        } as unknown as ReturnType<typeof createOpenAIClient>;

        const model = createOpenAIGenerativeModel("gpt-5.1", fakeClient, "responses");
        if (!model.doGenerateStream) {
            throw new Error("Expected responses model to implement doGenerateStream");
        }

        const runContext: RunContext & { capturedEvents: Event[] } = {
            runId: "run_1",
            agentName: "test-agent",
            providerId: "openai",
            modelId: "gpt-5.1",
            generateMessageId: () => OPENAI_TEXT_FIXTURE.ids.message1,
            signal: new AbortController().signal,
            capturedEvents: [],
        };

        const streamResult = await model.doGenerateStream({ input: "hello" }, runContext);
        if (streamResult.isErr()) throw streamResult.error;
        for await (const event of streamResult.value.events) {
            if (event.isErr()) throw event.error;
            runContext.capturedEvents.push(event.value);
        }
        const final = await streamResult.value.final;

        const toolResults = runContext.capturedEvents.filter(
            (event) => event.type === Events.TOOL_CALL_RESULT,
        );
        const toolEnds = runContext.capturedEvents.filter(
            (event) => event.type === Events.TOOL_CALL_END,
        );
        expect(toolResults.length).toBe(1);
        expect(toolEnds.length).toBe(1);
        expect(final.output.filter((item) => item.type === "provider-tool-result").length).toBe(1);
    });

    test("does not duplicate native result/end when output_item.done already exists", async () => {
        const fakeClient = {
            responses: {
                stream: async () =>
                    ok(
                        (async function* () {
                            yield ok({
                                type: "response.output_item.added",
                                item: {
                                    id: OPENAI_TEXT_FIXTURE.ids.nativeCall,
                                    type: "web_search_call",
                                    status: "in_progress",
                                },
                            } as OpenAIResponseStreamEvent);
                            yield ok({
                                type: "response.output_item.done",
                                item: {
                                    id: OPENAI_TEXT_FIXTURE.ids.nativeCall,
                                    type: "web_search_call",
                                    status: "completed",
                                },
                            } as OpenAIResponseStreamEvent);
                            yield ok({
                                type: "response.completed",
                                response: {
                                    output: [
                                        {
                                            id: OPENAI_TEXT_FIXTURE.ids.nativeCall,
                                            type: "web_search_call",
                                            status: "completed",
                                        },
                                    ],
                                    usage: {
                                        input_tokens: 1,
                                        output_tokens: 1,
                                    },
                                },
                            } as OpenAIResponseStreamEvent);
                        })(),
                    ),
            },
        } as unknown as ReturnType<typeof createOpenAIClient>;

        const model = createOpenAIGenerativeModel("gpt-5.1", fakeClient, "responses");
        if (!model.doGenerateStream) {
            throw new Error("Expected responses model to implement doGenerateStream");
        }

        const runContext: RunContext & { capturedEvents: Event[] } = {
            runId: "run_2",
            agentName: "test-agent",
            providerId: "openai",
            modelId: "gpt-5.1",
            generateMessageId: () => OPENAI_TEXT_FIXTURE.ids.message2,
            signal: new AbortController().signal,
            capturedEvents: [],
        };

        const streamResult = await model.doGenerateStream({ input: "hello" }, runContext);
        if (streamResult.isErr()) throw streamResult.error;
        for await (const event of streamResult.value.events) {
            if (event.isErr()) throw event.error;
            runContext.capturedEvents.push(event.value);
        }
        await streamResult.value.final;

        const toolResults = runContext.capturedEvents.filter(
            (event) => event.type === Events.TOOL_CALL_RESULT,
        );
        const toolEnds = runContext.capturedEvents.filter(
            (event) => event.type === Events.TOOL_CALL_END,
        );
        expect(toolResults.length).toBe(1);
        expect(toolEnds.length).toBe(1);
    });

    test("enriches function call stream events with server tool metadata", async () => {
        const fakeClient = {
            responses: {
                stream: async () =>
                    ok(
                        (async function* () {
                            yield ok({
                                type: "response.output_item.added",
                                item: {
                                    type: "function_call",
                                    id: OPENAI_TEXT_FIXTURE.ids.functionCall,
                                    call_id: "call_stream_server_1",
                                    name: "get_weather",
                                },
                            } as OpenAIResponseStreamEvent);
                            yield ok({
                                type: "response.function_call_arguments.delta",
                                item_id: OPENAI_TEXT_FIXTURE.ids.functionCall,
                                call_id: "call_stream_server_1",
                                delta: '{"location":"SF"}',
                            } as OpenAIResponseStreamEvent);
                            yield ok({
                                type: "response.function_call_arguments.done",
                                item_id: OPENAI_TEXT_FIXTURE.ids.functionCall,
                                call_id: "call_stream_server_1",
                            } as OpenAIResponseStreamEvent);
                            yield ok({
                                type: "response.completed",
                                response: {
                                    output: [],
                                    usage: {
                                        input_tokens: 1,
                                        output_tokens: 1,
                                    },
                                },
                            } as OpenAIResponseStreamEvent);
                        })(),
                    ),
            },
        } as unknown as ReturnType<typeof createOpenAIClient>;

        const model = createOpenAIGenerativeModel("gpt-5.1", fakeClient, "responses");
        if (!model.doGenerateStream) {
            throw new Error("Expected responses model to implement doGenerateStream");
        }

        const events: Event[] = [];
        const runContext: RunContext = {
            runId: "run_function_stream_1",
            agentName: "test-agent",
            providerId: "openai",
            modelId: "gpt-5.1",
            generateMessageId: () => OPENAI_TEXT_FIXTURE.ids.message1,
            signal: new AbortController().signal,
        };

        const streamResult = await model.doGenerateStream(
            { input: "hello", tools: [WEATHER_TOOL] },
            runContext,
        );
        if (streamResult.isErr()) throw streamResult.error;
        for await (const event of streamResult.value.events) {
            if (event.isErr()) throw event.error;
            events.push(event.value);
        }
        await streamResult.value.final;

        const toolEvents = events.filter(
            (event) =>
                event.type === Events.TOOL_CALL_START ||
                event.type === Events.TOOL_CALL_ARGS ||
                event.type === Events.TOOL_CALL_END,
        );

        expect(toolEvents).toHaveLength(3);
        for (const event of toolEvents) {
            expect(event.runId).toBe("run_function_stream_1");
            expect(event.agentName).toBe("test-agent");
            expect(event.toolTarget).toBe("server");
            expect(event.toolCallName).toBe("get_weather");
        }
    });

    test("synthesizes reasoning start when delta arrives before start", async () => {
        const fakeClient = {
            responses: {
                stream: async () =>
                    ok(
                        (async function* () {
                            yield ok({
                                type: "response.reasoning_text.delta",
                                item_id: "reason_3",
                                delta: "step 1",
                            } as OpenAIResponseStreamEvent);
                            yield ok({
                                type: "response.reasoning_text.done",
                                item_id: "reason_3",
                            } as OpenAIResponseStreamEvent);
                            yield ok({
                                type: "response.completed",
                                response: {
                                    output: [],
                                    usage: {
                                        input_tokens: 1,
                                        output_tokens: 1,
                                    },
                                },
                            } as OpenAIResponseStreamEvent);
                        })(),
                    ),
            },
        } as unknown as ReturnType<typeof createOpenAIClient>;

        const model = createOpenAIGenerativeModel("gpt-5.1", fakeClient, "responses");
        if (!model.doGenerateStream) {
            throw new Error("Expected responses model to implement doGenerateStream");
        }

        const events: Event[] = [];
        const runContext: RunContext = {
            runId: "run_reasoning_1",
            agentName: "test-agent",
            providerId: "openai",
            modelId: "gpt-5.1",
            generateMessageId: () => OPENAI_TEXT_FIXTURE.ids.message1,
            signal: new AbortController().signal,
        };

        const streamResult = await model.doGenerateStream({ input: "hello" }, runContext);
        if (streamResult.isErr()) throw streamResult.error;
        for await (const event of streamResult.value.events) {
            if (event.isErr()) throw event.error;
            events.push(event.value);
        }
        await streamResult.value.final;

        const reasoningTypes = events
            .filter((event) => event.type.startsWith("REASONING_MESSAGE_"))
            .map((event) => event.type);
        expect(reasoningTypes).toEqual([
            Events.REASONING_MESSAGE_START,
            Events.REASONING_MESSAGE_CONTENT,
            Events.REASONING_MESSAGE_END,
        ]);
    });
});
