import { describe, expect, test } from "bun:test";
import { createOpenRouter } from "../../src/openrouter";
import { mapToOpenRouterChatCompletionsRequest } from "../../src/openrouter/responses";

describe("openrouter audio provider", () => {
    test("audio() narrows caps to text and audio semantics", () => {
        const openrouter = createOpenRouter({});
        const model = openrouter.audio("openai/gpt-4o-audio-preview");

        expect(model.providerId).toBe("openrouter");
        expect(model.modelId).toBe("openai/gpt-4o-audio-preview");
        expect(model.caps.inputModalities).toEqual({
            text: true,
            audio: true,
        });
        expect(model.caps.outputModalities).toEqual({
            text: {
                options: {},
            },
            audio: true,
        });
        expect(model.caps.supportsInstruction).toBe(true);
    });

    test("audio model request supports audio input and audio output options", () => {
        const openrouter = createOpenRouter({});
        const model = openrouter.audio("openai/gpt-4o-audio-preview");

        const mapped = mapToOpenRouterChatCompletionsRequest({
            modelId: model.modelId,
            options: {
                input: [
                    {
                        type: "message",
                        role: "user",
                        content: [
                            { type: "text", text: "Summarize this audio clip." },
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
                    { type: "text", text: "Summarize this audio clip." },
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
});
