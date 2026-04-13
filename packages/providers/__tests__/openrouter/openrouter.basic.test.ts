import { describe, expect, test } from "bun:test";
import { createOpenRouter } from "../../src/openrouter";

describe("openrouter provider model metadata", () => {
    test("creates OpenRouter text, audio, and image models", () => {
        const openrouter = createOpenRouter({});
        const textModel = openrouter.model("openai/gpt-4.1-mini");
        const audioModel = openrouter.audio("openai/gpt-4o-audio-preview");
        const imageModel = openrouter.image("google/gemini-2.5-flash-image-preview");

        expect(textModel.providerId).toBe("openrouter");
        expect(textModel.modelId).toBe("openai/gpt-4.1-mini");
        expect("text" in textModel.caps.outputModalities).toBe(true);
        expect("image" in textModel.caps.outputModalities).toBe(true);

        expect(audioModel.providerId).toBe("openrouter");
        expect(audioModel.modelId).toBe("openai/gpt-4o-audio-preview");
        expect(audioModel.caps.inputModalities.audio).toBe(true);
        expect("audio" in audioModel.caps.outputModalities).toBe(true);

        expect(imageModel.providerId).toBe("openrouter");
        expect(imageModel.modelId).toBe("google/gemini-2.5-flash-image-preview");
        expect(imageModel.caps.outputModalities.image).toBeTruthy();
    });
});
