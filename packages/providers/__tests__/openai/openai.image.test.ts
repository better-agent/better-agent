import { describe, expect, test } from "bun:test";
import { Events } from "@better-agent/core/events";
import {
    mapFromOpenAIImagesResponse,
    mapFromOpenAIImagesStreamEvent,
    mapToOpenAIImagesRequest,
} from "../../src/openai/images/mappers";
import { IMAGE_FIXTURE } from "../fixtures/openai.image";

describe("openai-image mapper", () => {
    test("request maps image options", () => {
        const mapped = mapToOpenAIImagesRequest({
            modelId: "gpt-image-1",
            options: IMAGE_FIXTURE.requestOptions,
        });
        if (mapped.isErr()) throw mapped.error;

        expect(mapped.value.mode).toBe("generate");
        expect(mapped.value.body.model).toBe("gpt-image-1");
        expect(mapped.value.body.prompt).toBe(IMAGE_FIXTURE.prompt);
        expect(mapped.value.body.quality).toBe("low");
        expect(mapped.value.body.output_format).toBe("webp");
        expect(mapped.value.body.output_compression).toBe(80);
        expect(mapped.value.body.stream).toBe(true);
        expect(mapped.value.body.partial_images).toBe(2);
        expect(mapped.value.body.size).toBe("1536x1024");
        expect(mapped.value.body.moderation).toBe("low");
        expect(mapped.value.body.background).toBe("transparent");
        expect(mapped.value.body.user).toBe("test-user");
    });

    test("request rejects invalid prompt and input shape", () => {
        const nonTextPrompt = mapToOpenAIImagesRequest({
            modelId: "gpt-image-1",
            options: {
                input: [{ type: "tool-call", name: "bad", callId: "1" }],
            } as never,
        });
        expect(nonTextPrompt.isErr()).toBe(true);
        if (nonTextPrompt.isOk()) throw new Error("Expected non-text prompt to fail");
        expect(nonTextPrompt.error.message.toLowerCase()).toContain("single message input");

        const multipleInputs = mapToOpenAIImagesRequest({
            modelId: "gpt-image-1",
            options: {
                input: ["one", "two"],
            } as never,
        });
        expect(multipleInputs.isErr()).toBe(true);
        if (multipleInputs.isOk()) throw new Error("Expected multiple input items to fail");
        expect(multipleInputs.error.message.toLowerCase()).toContain("single input item");
    });

    test("request maps text plus image input to edit mode", () => {
        const mapped = mapToOpenAIImagesRequest({
            modelId: "gpt-image-1",
            options: {
                input: [
                    {
                        type: "message",
                        content: [
                            { type: "text", text: "Remove the background" },
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
                input_fidelity: "high",
            } as never,
        });
        if (mapped.isErr()) throw mapped.error;

        expect(mapped.value.mode).toBe("edit");
        if (mapped.value.mode !== "edit") throw new Error("Expected edit mode");
        expect(mapped.value.body.prompt).toBe("Remove the background");
        expect(mapped.value.body.images).toHaveLength(1);
        expect(mapped.value.body.images[0]?.image_url).toBe("https://example.com/source.png");
        expect(mapped.value.body.input_fidelity).toBe("high");
    });

    test("request rejects stream for non-gpt-image-1 models", () => {
        const mapped = mapToOpenAIImagesRequest({
            modelId: "dall-e-3",
            options: {
                input: "Generate a logo.",
                stream: true,
            },
        });
        expect(mapped.isErr()).toBe(true);
        if (mapped.isOk()) throw new Error("Expected unsupported stream model to fail");
        expect(mapped.error.message.toLowerCase()).toContain("only supported for gpt-image-1");
    });

    test("response maps url and base64 outputs", () => {
        const urlMapped = mapFromOpenAIImagesResponse(IMAGE_FIXTURE.urlResponse);
        const urlMessage = urlMapped.output[0];
        expect(urlMessage?.type).toBe("message");
        if (
            !urlMessage ||
            urlMessage.type !== "message" ||
            typeof urlMessage.content === "string"
        ) {
            throw new Error("Expected mapped URL image output message");
        }
        const urlImagePart = urlMessage.content[0];
        expect(urlImagePart?.type).toBe("image");
        if (!urlImagePart || urlImagePart.type !== "image" || urlImagePart.source.kind !== "url") {
            throw new Error("Expected mapped URL image part");
        }
        expect(urlImagePart.source.url).toBe("https://example.com/image.png");

        const b64Mapped = mapFromOpenAIImagesResponse(IMAGE_FIXTURE.base64Response);
        const b64Message = b64Mapped.output[0];
        expect(b64Message?.type).toBe("message");
        if (
            !b64Message ||
            b64Message.type !== "message" ||
            typeof b64Message.content === "string"
        ) {
            throw new Error("Expected mapped base64 image output message");
        }
        const b64ImagePart = b64Message.content[0];
        expect(b64ImagePart?.type).toBe("image");
        if (
            !b64ImagePart ||
            b64ImagePart.type !== "image" ||
            b64ImagePart.source.kind !== "base64"
        ) {
            throw new Error("Expected mapped base64 image part");
        }
        expect(b64ImagePart.source.data).toBe("AQID");
        expect(b64ImagePart.source.mimeType).toBe("image/webp");
    });

    test("stream partial event maps to image content event", () => {
        const mapped = mapFromOpenAIImagesStreamEvent(
            {
                type: "image_generation.partial_image",
                b64_json: "AQID",
                created_at: 1,
            },
            IMAGE_FIXTURE.streamMessageId,
        );
        if (mapped.isErr()) throw mapped.error;
        expect(mapped.value?.kind).toBe("event");
        if (!mapped.value || mapped.value.kind !== "event") {
            throw new Error("Expected partial image event mapping");
        }
        expect(mapped.value.event.type).toBe(Events.IMAGE_MESSAGE_CONTENT);
    });

    test("stream completed event maps final image and usage", () => {
        const mapped = mapFromOpenAIImagesStreamEvent(
            {
                type: "image_generation.completed",
                b64_json: "AQID",
                created_at: 1,
                output_format: "jpeg",
                usage: {
                    input_tokens: 2,
                    output_tokens: 3,
                    total_tokens: 5,
                },
            },
            IMAGE_FIXTURE.streamMessageId,
        );
        if (mapped.isErr()) throw mapped.error;

        expect(mapped.value?.kind).toBe("final");
        if (!mapped.value || mapped.value.kind !== "final") {
            throw new Error("Expected completed image final mapping");
        }

        const finalMessage = mapped.value.response.output[0];
        expect(finalMessage?.type).toBe("message");
        if (
            !finalMessage ||
            finalMessage.type !== "message" ||
            typeof finalMessage.content === "string"
        ) {
            throw new Error("Expected mapped final image output message");
        }
        const finalImagePart = finalMessage.content[0];
        expect(finalImagePart?.type).toBe("image");
        if (
            !finalImagePart ||
            finalImagePart.type !== "image" ||
            finalImagePart.source.kind !== "base64"
        ) {
            throw new Error("Expected mapped final base64 image part");
        }
        expect(finalImagePart.source.data).toBe("AQID");
        expect(finalImagePart.source.mimeType).toBe("image/jpeg");
        expect(mapped.value.response.usage.inputTokens).toBe(2);
        expect(mapped.value.response.usage.outputTokens).toBe(3);
        expect(mapped.value.response.usage.totalTokens).toBe(5);
    });
});
