import { describe, expect, test } from "bun:test";
import { TOOL_JSON_SCHEMA } from "@better-agent/core";
import type { RunContext } from "@better-agent/core";
import type { Event } from "@better-agent/core/events";
import { ok } from "@better-agent/shared/neverthrow";
import {
    mapFromXAIResponsesResponse,
    mapFromXAIResponsesStreamEvent,
    mapToXAIResponsesRequest,
} from "../../src/xai/responses";
import { createXAIResponsesModel } from "../../src/xai/responses/model";
import { OPENAI_TEXT_FIXTURE, WEATHER_TOOL } from "../fixtures/openai.text";

describe("xai-text request mapping", () => {
    test("maps multimodal input with response options", () => {
        const mapped = mapToXAIResponsesRequest({
            modelId: "grok-4",
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
                logprobs: true,
                max_output_tokens: 64,
                temperature: 0.2,
                top_logprobs: 3,
                top_p: 1,
                metadata: { suite: "xai-text" },
            },
        });
        if (mapped.isErr()) throw mapped.error;

        expect(mapped.value.model).toBe("grok-4");
        expect(mapped.value.logprobs).toBe(true);
        expect(mapped.value.max_output_tokens).toBe(64);
        expect(mapped.value.temperature).toBe(0.2);
        expect(mapped.value.top_logprobs).toBe(3);
        expect(mapped.value.top_p).toBe(1);
    });

    test("maps text response options even when modalities are omitted", () => {
        const mapped = mapToXAIResponsesRequest({
            modelId: "grok-4",
            options: {
                input: "hello",
                logprobs: true,
                max_output_tokens: 64,
                temperature: 0.2,
                top_logprobs: 3,
                top_p: 1,
            },
        });
        if (mapped.isErr()) throw mapped.error;

        expect(mapped.value.logprobs).toBe(true);
        expect(mapped.value.max_output_tokens).toBe(64);
        expect(mapped.value.temperature).toBe(0.2);
        expect(mapped.value.top_logprobs).toBe(3);
        expect(mapped.value.top_p).toBe(1);
    });

    test("maps provider-managed file inputs", () => {
        const mapped = mapToXAIResponsesRequest({
            modelId: "grok-4",
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
                                        provider: "xai",
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

    test("rejects unsupported file input source variants", () => {
        const wrongProvider = mapToXAIResponsesRequest({
            modelId: "grok-4",
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
                                        provider: "openai",
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
        expect(wrongProvider.error.message.toLowerCase()).toContain("provider=xai");

        const urlSource = mapToXAIResponsesRequest({
            modelId: "grok-4",
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
        expect(urlSource.isErr()).toBe(true);
        if (urlSource.isOk()) throw new Error("Expected url file source to fail");
        expect(urlSource.error.message.toLowerCase()).toContain("provider-file source");
    });

    test("maps function tools and tool choice variants", () => {
        const toolCase = mapToXAIResponsesRequest({
            modelId: "grok-4",
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
    });

    test("request validation errors are deterministic", () => {
        const badToolChoice = mapToXAIResponsesRequest({
            modelId: "grok-4",
            options: {
                input: OPENAI_TEXT_FIXTURE.prompts.hello,
                tools: [WEATHER_TOOL] as never,
                toolChoice: { type: "tool", name: OPENAI_TEXT_FIXTURE.unknownToolName },
            },
        });
        expect(badToolChoice.isErr()).toBe(true);
        if (badToolChoice.isOk()) throw new Error("Expected unknown tool choice to fail");
        expect(badToolChoice.error.message.toLowerCase()).toContain("requested tool not found");

        const badToolSchema = mapToXAIResponsesRequest({
            modelId: "grok-4",
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
    });
});

describe("xai-text response mapping", () => {
    test("maps assistant message and function call output", () => {
        const mapped = mapFromXAIResponsesResponse({
            id: "resp_1",
            object: "response",
            created_at: Date.now() / 1000,
            model: "grok-4",
            output: [
                {
                    type: "message",
                    role: "assistant",
                    content: [{ type: "output_text", text: "hello world" }],
                },
                {
                    type: "function_call",
                    name: "get_weather",
                    arguments: '{"location":"Addis"}',
                    call_id: "fc_1",
                },
            ],
            parallel_tool_calls: true,
            status: "completed",
            store: true,
            temperature: 1,
            text: {},
            tool_choice: "auto",
            tools: [],
            top_p: 1,
            metadata: null,
            background: false,
            usage: {
                input_tokens: 5,
                output_tokens: 7,
            },
        } as never);

        expect(mapped.output).toHaveLength(2);
        expect(mapped.finishReason).toBe("tool-calls");
    });

    test("ignores undocumented image parts in responses output", () => {
        const mapped = mapFromXAIResponsesResponse({
            id: "resp_1",
            object: "response",
            created_at: Date.now() / 1000,
            model: "grok-4",
            output: [
                {
                    type: "message",
                    role: "assistant",
                    content: [
                        { type: "output_text", text: "hello world" },
                        { type: "image", image_url: "https://example.com/ignored.png" },
                    ],
                },
            ],
            parallel_tool_calls: true,
            status: "completed",
            store: true,
            temperature: 1,
            text: {},
            tool_choice: "auto",
            tools: [],
            top_p: 1,
            metadata: null,
            background: false,
            usage: {
                input_tokens: 5,
                output_tokens: 7,
            },
        } as never);

        expect(mapped.output).toEqual([
            {
                type: "message",
                role: "assistant",
                content: [{ type: "text", text: "hello world" }],
            },
        ]);
    });
});

describe("xai-text generate flow", () => {
    test("non-stream generation maps final response", async () => {
        const fakeClient = {
            responses: {
                create: async () =>
                    ok({
                        id: "resp_1",
                        object: "response",
                        created_at: Date.now() / 1000,
                        model: "grok-4",
                        output: [
                            {
                                type: "message",
                                role: "assistant",
                                content: [{ type: "output_text", text: "hello from xai" }],
                            },
                        ],
                        parallel_tool_calls: true,
                        status: "completed",
                        store: true,
                        temperature: 1,
                        text: {},
                        tool_choice: "auto",
                        tools: [],
                        top_p: 1,
                        metadata: null,
                        background: false,
                        usage: { input_tokens: 2, output_tokens: 3 },
                    }),
            },
        } as never;

        const model = createXAIResponsesModel("grok-4", fakeClient);
        if (!model.doGenerate) throw new Error("Expected doGenerate");

        const result = await model.doGenerate(
            { input: "hello", modalities: ["text"] },
            {
                runId: "run_1",
                agentName: "test-agent",
                providerId: "xai",
                modelId: "grok-4",
                generateMessageId: () => "msg_1",
                signal: new AbortController().signal,
            },
        );
        if (result.isErr()) throw result.error;

        expect(result.value.response.finishReason).toBe("stop");
        expect(result.value.response.output).toHaveLength(1);
    });

    test("stream generation resolves final from streamed response without fallback create call", async () => {
        let createCalls = 0;
        const fakeClient = {
            responses: {
                create: async () => {
                    createCalls += 1;
                    throw new Error("create should not be called during stream finalization");
                },
                stream: async () =>
                    ok(
                        (async function* () {
                            yield ok({
                                type: "response.output_item.added",
                                item: {
                                    id: "msg_1",
                                    type: "message",
                                    role: "assistant",
                                    content: [],
                                },
                            });
                            yield ok({
                                type: "response.output_text.delta",
                                delta: "hello",
                            });
                            yield ok({
                                type: "response.output_text.done",
                            });
                            yield ok({
                                type: "response.completed",
                                response: {
                                    id: "resp_stream_1",
                                    object: "response",
                                    created_at: Date.now() / 1000,
                                    model: "grok-4",
                                    output: [
                                        {
                                            type: "message",
                                            role: "assistant",
                                            content: [{ type: "output_text", text: "hello" }],
                                        },
                                    ],
                                    parallel_tool_calls: true,
                                    status: "completed",
                                    store: true,
                                    temperature: 1,
                                    text: {},
                                    tool_choice: "auto",
                                    tools: [],
                                    top_p: 1,
                                    metadata: null,
                                    background: false,
                                    usage: { input_tokens: 2, output_tokens: 3 },
                                },
                            });
                        })(),
                    ),
            },
        } as never;

        const model = createXAIResponsesModel("grok-4", fakeClient);
        if (!model.doGenerateStream) throw new Error("Expected doGenerateStream");

        const events: Event[] = [];
        const runContext: RunContext = {
            runId: "run_stream_1",
            agentName: "test-agent",
            providerId: "xai",
            modelId: "grok-4",
            generateMessageId: () => "msg_stream_1",
            signal: new AbortController().signal,
        };

        const streamResult = await model.doGenerateStream(
            { input: "hello", modalities: ["text"] },
            runContext,
        );
        if (streamResult.isErr()) throw streamResult.error;

        for await (const event of streamResult.value.events) {
            if (event.isErr()) throw event.error;
            events.push(event.value);
        }

        const final = await streamResult.value.final;

        expect(createCalls).toBe(0);
        expect(final.finishReason).toBe("stop");
        expect(events.map((event) => event.type)).toContain("TEXT_MESSAGE_CONTENT");
    });
});

describe("xai-text stream event mapping", () => {
    test("maps reasoning summary deltas to reasoning events", () => {
        const start = mapFromXAIResponsesStreamEvent(
            { type: "response.reasoning_summary_part.added" },
            "msg_1",
        );
        if (start.isErr()) throw start.error;
        expect(start.value?.kind).toBe("event");
        if (!start.value || start.value.kind !== "event") throw new Error("Expected event");
        expect(start.value.event.type).toBe("REASONING_MESSAGE_START");

        const delta = mapFromXAIResponsesStreamEvent(
            { type: "response.reasoning_summary_text.delta", delta: "thinking" },
            "msg_1",
        );
        if (delta.isErr()) throw delta.error;
        if (!delta.value || delta.value.kind !== "event") throw new Error("Expected event");
        expect(delta.value.event.type).toBe("REASONING_MESSAGE_CONTENT");

        const done = mapFromXAIResponsesStreamEvent(
            { type: "response.reasoning_summary_text.done" },
            "msg_1",
        );
        if (done.isErr()) throw done.error;
        if (!done.value || done.value.kind !== "event") throw new Error("Expected event");
        expect(done.value.event.type).toBe("REASONING_MESSAGE_END");
    });

    test("maps hosted tool progress to data parts", () => {
        const mapped = mapFromXAIResponsesStreamEvent(
            { type: "response.x_search_call.completed", item_id: "tool_1" },
            "msg_1",
        );
        if (mapped.isErr()) throw mapped.error;
        if (!mapped.value || mapped.value.kind !== "event") throw new Error("Expected event");
        expect(mapped.value.event.type).toBe("DATA_PART");
        if (mapped.value.event.type !== "DATA_PART") throw new Error("Expected data part");
        expect((mapped.value.event.data as { tool?: string; status?: string }).tool).toBe(
            "x_search",
        );
        expect((mapped.value.event.data as { tool?: string; status?: string }).status).toBe(
            "completed",
        );
    });
});
