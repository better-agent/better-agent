import type {
    GenerativeModelCallOptions,
    GenerativeModelOutputItem,
    GenerativeModelResponse,
    ModalitiesParam,
} from "@better-agent/core/providers";
import { BetterAgentError } from "@better-agent/shared/errors";
import type { Result } from "@better-agent/shared/neverthrow";
import { err, ok } from "@better-agent/shared/neverthrow";
import { extractPassthroughOptions } from "../../utils/object-utils";
import type { OpenAICapsFor, OpenAIOptionsFor } from "../types";
import type {
    OpenAICreateEmbeddingRequest,
    OpenAICreateEmbeddingResponse,
    OpenAIEmbeddingModels,
} from "./schemas";

/**
 * Keys explicitly handled by the OpenAI embedding mapper.
 */
const OPENAI_EMBEDDING_KNOWN_KEYS: ReadonlySet<string> = new Set([
    // Framework-managed
    "input",
    "tools",
    "toolChoice",
    "modalities",
    "structured_output",
    // Explicitly mapped
    "encoding_format",
    "dimensions",
    "user",
]);

export function mapToOpenAIEmbeddingRequest<
    M extends OpenAIEmbeddingModels,
    TModalities extends ModalitiesParam<OpenAICapsFor<M>> = undefined,
>(args: {
    modelId: M;
    options: GenerativeModelCallOptions<OpenAICapsFor<M>, OpenAIOptionsFor<M>, TModalities>;
}): Result<OpenAICreateEmbeddingRequest, BetterAgentError> {
    try {
        const o = args.options;

        const input =
            typeof o.input === "string"
                ? o.input
                : Array.isArray(o.input) &&
                    o.input.length === 1 &&
                    o.input[0]?.type === "message" &&
                    typeof o.input[0].content === "string"
                  ? o.input[0].content
                  : undefined;

        if (typeof input !== "string" || !input) {
            return err(
                BetterAgentError.fromCode(
                    "VALIDATION_FAILED",
                    "Embedding generation requires a text input",
                    { context: { provider: "openai", model: args.modelId } },
                ).at({
                    at: "openai.embedding.map.inputMissing",
                }),
            );
        }

        return ok({
            ...extractPassthroughOptions(o as Record<string, unknown>, OPENAI_EMBEDDING_KNOWN_KEYS),
            model: args.modelId,
            input,
            encoding_format: o.encoding_format,
            dimensions: o.dimensions,
            user: o.user,
        });
    } catch (e) {
        return err(
            BetterAgentError.wrap({
                err: e,
                message: "Failed to map OpenAI Embedding request",
                opts: { code: "INTERNAL", context: { provider: "openai", model: args.modelId } },
            }).at({
                at: "openai.embedding.mapToRequest",
            }),
        );
    }
}

export function mapFromOpenAIEmbeddingResponse(
    raw: OpenAICreateEmbeddingResponse,
): GenerativeModelResponse {
    const output: GenerativeModelOutputItem[] = raw.data.map((item) => ({
        type: "message",
        role: "assistant",
        content: [
            {
                type: "embedding",
                embedding: item.embedding,
            },
        ],
    }));

    return {
        output,
        finishReason: "stop",
        usage: {
            inputTokens: raw.usage?.prompt_tokens,
            totalTokens: raw.usage?.total_tokens,
        },
        response: {
            body: raw,
        },
    };
}
