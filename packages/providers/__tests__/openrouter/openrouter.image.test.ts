import { Events } from "@better-agent/core/events";
import { describe, expect, test } from "bun:test";
import {
    mapFromOpenRouterImageChatCompletion,
    mapFromOpenRouterImageChatCompletionChunk,
    mapToOpenRouterImageChatCompletionsRequest,
} from "../../src/openrouter/images";

describe("openrouter image request mapping", () => {
    test("maps prompt and reference image into chat completions image request", () => {
        const mapped = mapToOpenRouterImageChatCompletionsRequest({
            modelId: "google/gemini-2.5-flash-image-preview",
            options: {
                input: [
                    {
                        type: "message",
                        content: [
                            { type: "text", text: "Turn this into a watercolor poster" },
                            {
                                type: "image",
                                source: {
                                    kind: "url",
                                    url: "https://example.com/source.png",
                                },
                            },
                        ],
                    },
                ],
                temperature: 0.4,
            },
        });
        if (mapped.isErr()) throw mapped.error;

        expect(mapped.value.modalities).toEqual(["image"]);
        expect(mapped.value.messages).toEqual([
            {
                role: "user",
                content: [
                    { type: "text", text: "Turn this into a watercolor poster" },
                    {
                        type: "image_url",
                        image_url: { url: "https://example.com/source.png" },
                    },
                ],
            },
        ]);
        expect(mapped.value.temperature).toBe(0.4);
    });

    test("maps generated image urls into assistant image output", () => {
        const mapped = mapFromOpenRouterImageChatCompletion({
            id: "chatcmpl_1",
            choices: [
                {
                    index: 0,
                    finish_reason: "stop",
                    message: {
                        role: "assistant",
                        content: "",
                        images: ["https://example.com/generated.png"],
                    },
                },
            ],
        });

        expect(mapped.output).toEqual([
            {
                type: "message",
                role: "assistant",
                content: [
                    {
                        type: "image",
                        source: {
                            kind: "url",
                            url: "https://example.com/generated.png",
                        },
                    },
                ],
            },
        ]);
    });

    test("maps streamed image delta into image message content event", () => {
        const mapped = mapFromOpenRouterImageChatCompletionChunk(
            {
                id: "chatcmpl_1",
                choices: [
                    {
                        index: 0,
                        finish_reason: null,
                        delta: {
                            images: [
                                {
                                    type: "image_url",
                                    image_url: {
                                        url: "data:image/png;base64,abc123",
                                    },
                                },
                            ],
                        },
                    },
                ],
            },
            "msg_1",
        );
        if (mapped.isErr()) throw mapped.error;

        expect(mapped.value).toEqual({
            kind: "event",
            event: {
                type: Events.IMAGE_MESSAGE_CONTENT,
                messageId: "msg_1",
                delta: {
                    kind: "url",
                    url: "data:image/png;base64,abc123",
                },
                timestamp: expect.any(Number),
            },
        });
    });
});
