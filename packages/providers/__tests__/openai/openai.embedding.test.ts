import { describe, expect, test } from "bun:test";
import {
    mapFromOpenAIEmbeddingResponse,
    mapToOpenAIEmbeddingRequest,
} from "../../src/openai/embeddings/mappers";
import { EMBEDDING_FIXTURE } from "../fixtures/openai.embedding";

describe("openai-embedding mapper", () => {
    test("request maps embedding options", () => {
        const mapped = mapToOpenAIEmbeddingRequest({
            modelId: "text-embedding-3-small",
            options: EMBEDDING_FIXTURE.requestOptions,
        });
        if (mapped.isErr()) throw mapped.error;

        expect(mapped.value.model).toBe("text-embedding-3-small");
        expect(mapped.value.input).toBe("Embed me.");
        expect(mapped.value.encoding_format).toBe("float");
        expect(mapped.value.dimensions).toBe(64);
        expect(mapped.value.user).toBe("test-user-1");
    });

    test("request rejects non-text input", () => {
        const mapped = mapToOpenAIEmbeddingRequest({
            modelId: "text-embedding-3-small",
            options: {
                input: [
                    {
                        type: "message",
                        role: "user",
                        content: [{ type: "text", text: "not supported for embedding mapper" }],
                    },
                ],
            } as never,
        });
        expect(mapped.isErr()).toBe(true);
        if (mapped.isOk()) throw new Error("Expected non-text embedding input to fail");
        expect(mapped.error.message.toLowerCase()).toContain("requires a text input");
    });

    test("request accepts a single prompt-style message with string content", () => {
        const mapped = mapToOpenAIEmbeddingRequest({
            modelId: "text-embedding-3-small",
            options: {
                input: [{ type: "message", content: "Embed me." }],
            } as never,
        });
        if (mapped.isErr()) throw mapped.error;

        expect(mapped.value.input).toBe("Embed me.");
    });

    test("response maps vectors and usage", () => {
        const mapped = mapFromOpenAIEmbeddingResponse(EMBEDDING_FIXTURE.response);
        const message = mapped.output[0];
        expect(message?.type).toBe("message");
        if (!message || message.type !== "message" || typeof message.content === "string") {
            throw new Error("Expected mapped embedding output message");
        }
        const embeddingPart = message.content[0];
        expect(embeddingPart?.type).toBe("embedding");
        if (!embeddingPart || embeddingPart.type !== "embedding") {
            throw new Error("Expected mapped embedding part");
        }
        expect(embeddingPart.embedding.length).toBe(3);
        expect(embeddingPart.embedding[0]).toBe(0.12);
        expect(mapped.usage.inputTokens).toBe(3);
        expect(mapped.usage.totalTokens).toBe(3);
    });
});
