import type {
    GenerativeModelCallOptions,
    GenerativeModelImageSource,
    GenerativeModelResponse,
} from "@better-agent/core/providers";
import { BetterAgentError } from "@better-agent/shared/errors";
import type { Result } from "@better-agent/shared/neverthrow";
import { err, ok } from "@better-agent/shared/neverthrow";
import { omitNullish } from "../../utils/object-utils";
import type { OpenRouterChatCompletionResponse, OpenRouterChatCompletionsRequestSchema } from "../responses/schemas";
import type { OpenRouterImageCaps, OpenRouterImageEndpointOptions } from "./types";

const toImageUrl = (source: GenerativeModelImageSource): string =>
    source.kind === "url" ? source.url : `data:${source.mimeType};base64,${source.data}`;

const parsePromptInput = (
    input: GenerativeModelCallOptions<OpenRouterImageCaps, OpenRouterImageEndpointOptions>["input"],
) => {
    if (typeof input === "string") return { prompt: input, images: [] as GenerativeModelImageSource[] };

    const first = Array.isArray(input) ? input[0] : input;
    if (!first || typeof first !== "object" || !("type" in first) || first.type !== "message") {
        throw BetterAgentError.fromCode(
            "VALIDATION_FAILED",
            "OpenRouter image generation requires a prompt string or a single message input",
            { context: { provider: "openrouter" } },
        ).at({ at: "openrouter.images.map.inputShape" });
    }

    if (typeof first.content === "string") {
        return { prompt: first.content, images: [] as GenerativeModelImageSource[] };
    }

    const promptParts: string[] = [];
    const images: GenerativeModelImageSource[] = [];
    for (const part of first.content) {
        if (part.type === "text") {
            promptParts.push(part.text);
            continue;
        }
        if (part.type === "image") {
            images.push(part.source);
            continue;
        }
        throw BetterAgentError.fromCode(
            "VALIDATION_FAILED",
            "OpenRouter image generation only supports text and image input parts",
            { context: { provider: "openrouter", partType: part.type } },
        ).at({ at: "openrouter.images.map.partType" });
    }

    return { prompt: promptParts.join("\n"), images };
};

export function mapToOpenRouterImageChatCompletionsRequest(args: {
    modelId: string;
    options: GenerativeModelCallOptions<OpenRouterImageCaps, OpenRouterImageEndpointOptions>;
}): Result<OpenRouterChatCompletionsRequestSchema, BetterAgentError> {
    try {
        const parsed = parsePromptInput(args.options.input);
        if (!parsed.prompt || parsed.prompt.trim().length === 0) {
            return err(
                BetterAgentError.fromCode(
                    "VALIDATION_FAILED",
                    "OpenRouter image generation requires a text prompt",
                    { context: { provider: "openrouter", model: args.modelId } },
                ).at({ at: "openrouter.images.map.prompt" }),
            );
        }

        return ok({
            model: args.modelId,
            messages: [
                {
                    role: "user",
                    content: [
                        { type: "text", text: parsed.prompt },
                        ...parsed.images.map((image) => ({
                            type: "image_url" as const,
                            image_url: {
                                url: toImageUrl(image),
                            },
                        })),
                    ],
                },
            ],
            modalities: ["image"],
            max_tokens: args.options.max_tokens,
            temperature: args.options.temperature,
            top_p: args.options.top_p,
            frequency_penalty: args.options.frequency_penalty,
            presence_penalty: args.options.presence_penalty,
            seed: args.options.seed,
            user: args.options.user,
            route: args.options.route,
            provider: args.options.provider,
            plugins: args.options.plugins,
        });
    } catch (e) {
        return err(
            BetterAgentError.wrap({
                err: e,
                message: "Failed to map OpenRouter image request",
                opts: { code: "INTERNAL", context: { provider: "openrouter", model: args.modelId } },
            }).at({ at: "openrouter.images.mapToRequest" }),
        );
    }
}

export function mapFromOpenRouterImageChatCompletion(
    raw: OpenRouterChatCompletionResponse,
): GenerativeModelResponse {
    const firstChoice = raw.choices[0];
    const images = firstChoice?.message.images ?? [];

    return {
        output: images.map((url) => ({
            type: "message" as const,
            role: "assistant" as const,
            content: [
                {
                    type: "image" as const,
                    source: {
                        kind: "url" as const,
                        url,
                    },
                },
            ],
        })),
        finishReason: "stop",
        usage: omitNullish({
            inputTokens: raw.usage?.prompt_tokens,
            outputTokens: raw.usage?.completion_tokens,
            totalTokens: raw.usage?.total_tokens,
        }),
        response: {
            body: raw,
        },
    };
}
