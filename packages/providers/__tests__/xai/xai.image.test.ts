import { describe, expect, test } from "bun:test";
import { createXAI } from "../../src/xai";
import { mapFromXAIImagesResponse, mapToXAIImagesRequest } from "../../src/xai/images";

describe("xai-image mapper", () => {
    test("creates image models", () => {
        const xai = createXAI({});
        const model = xai.image("grok-imagine-image");
        expect(model.providerId).toBe("xai");
        expect(model.modelId).toBe("grok-imagine-image");
    });

    test("request maps image options", () => {
        const mapped = mapToXAIImagesRequest({
            modelId: "grok-imagine-image",
            options: {
                input: "Generate a sunset over Addis Ababa.",
                n: 2,
                quality: "high",
                response_format: "b64_json",
                user: "test-user",
            },
        });
        if (mapped.isErr()) throw mapped.error;

        expect(mapped.value.mode).toBe("generate");
        expect(mapped.value.body.model).toBe("grok-imagine-image");
        expect(mapped.value.body.prompt).toBe("Generate a sunset over Addis Ababa.");
        expect(mapped.value.body.n).toBe(2);
        expect(mapped.value.body.quality).toBe("high");
        expect(mapped.value.body.response_format).toBe("b64_json");
        expect(mapped.value.body.user).toBe("test-user");
    });

    test("request rejects invalid prompt and stream", () => {
        const badPrompt = mapToXAIImagesRequest({
            modelId: "grok-imagine-image",
            options: {
                input: [{ type: "tool-call", name: "bad", callId: "1" }],
            } as never,
        });
        expect(badPrompt.isErr()).toBe(true);

        const badStream = mapToXAIImagesRequest({
            modelId: "grok-imagine-image",
            options: {
                input: "Generate a logo",
                stream: true,
            } as never,
        });
        expect(badStream.isErr()).toBe(true);
    });

    test("request maps text plus image input to edit mode", () => {
        const mapped = mapToXAIImagesRequest({
            modelId: "grok-imagine-image",
            options: {
                input: [
                    {
                        type: "message",
                        content: [
                            { type: "text", text: "Remove the background" },
                            {
                                type: "image",
                                source: {
                                    kind: "base64",
                                    data: "AQID",
                                    mimeType: "image/png",
                                },
                            },
                        ],
                    },
                ],
                resolution: "1024x1024",
            } as never,
        });
        if (mapped.isErr()) throw mapped.error;

        expect(mapped.value.mode).toBe("edit");
        if (mapped.value.mode !== "edit") throw new Error("Expected edit mode");
        expect(mapped.value.body.prompt).toBe("Remove the background");
        expect(mapped.value.body.image?.image_url).toBe("data:image/png;base64,AQID");
        expect(mapped.value.body.resolution).toBe("1024x1024");
    });

    test("response maps url and base64 outputs", () => {
        const urlMapped = mapFromXAIImagesResponse({
            data: [
                {
                    url: "https://example.com/image.png",
                    mime_type: "image/png",
                    revised_prompt: "Revised prompt",
                },
            ],
            usage: { cost_in_usd_ticks: 200000000 },
        } as never);
        const urlMessage = urlMapped.output[0];
        expect(urlMessage?.type).toBe("message");
        expect(urlMapped.usage.totalTokens).toBe(200000000);
        expect(
            (
                urlMapped.response?.body as {
                    normalized?: { images?: Array<{ revised_prompt?: string }> };
                }
            ).normalized?.images?.[0]?.revised_prompt,
        ).toBe("Revised prompt");

        const b64Mapped = mapFromXAIImagesResponse({
            data: [{ b64_json: "AQID", mime_type: "image/jpeg" }],
        } as never);
        const b64Message = b64Mapped.output[0];
        expect(b64Message?.type).toBe("message");
        if (b64Message?.type !== "message" || !Array.isArray(b64Message.content)) {
            throw new Error("Expected image message content");
        }
        const imagePart = b64Message.content.find(
            (part: (typeof b64Message.content)[number]) => part.type === "image",
        );
        if (!imagePart || imagePart.type !== "image") {
            throw new Error("Expected image content part");
        }
        expect(imagePart.source.kind === "base64" ? imagePart.source.mimeType : null).toBe(
            "image/jpeg",
        );
    });
});
