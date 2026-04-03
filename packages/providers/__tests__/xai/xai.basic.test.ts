import { describe, expect, test } from "bun:test";
import { createXAI } from "../../src/xai";

describe("xai provider model metadata", () => {
    test("creates xAI models by output modality", () => {
        const xai = createXAI({});
        const textModel = xai.model("grok-4");
        const imageModel = xai.model("grok-imagine-image");
        expect(textModel.providerId).toBe("xai");
        expect(textModel.modelId).toBe("grok-4");
        expect("text" in textModel.caps.outputModalities).toBe(true);
        expect(imageModel.providerId).toBe("xai");
        expect(imageModel.modelId).toBe("grok-imagine-image");
        expect(imageModel.caps.outputModalities.image).toBeTruthy();
    });
});
