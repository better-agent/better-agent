import { Events } from "@better-agent/core/events";
import type { Event } from "@better-agent/core/events";
import type {
    GenerativeModelCallOptions,
    GenerativeModelImageSource,
    GenerativeModelResponse,
    GenerativeModelUsage,
} from "@better-agent/core/providers";
import { BetterAgentError } from "@better-agent/shared/errors";
import type { Result } from "@better-agent/shared/neverthrow";
import { err, ok } from "@better-agent/shared/neverthrow";
import { omitNullish } from "../../utils/object-utils";
import type {
    OpenRouterChatCompletionChunk,
    OpenRouterChatCompletionResponse,
    OpenRouterChatCompletionsRequestSchema,
} from "../responses/schemas";
import type { OpenRouterImageCaps, OpenRouterImageEndpointOptions } from "./types";

const toImageUrl = (source: GenerativeModelImageSource): string =>
    source.kind === "url" ? source.url : `data:${source.mimeType};base64,${source.data}`;

const extractImageUrl = (image: unknown): string | undefined => {
    if (typeof image === "string") {
        return image;
    }

    if (!image || typeof image !== "object") {
        return undefined;
    }

    const candidate = image as {
        image_url?: string | { url?: string };
        url?: string;
    };

    if (typeof candidate.image_url === "string") {
        return candidate.image_url;
    }

    if (candidate.image_url && typeof candidate.image_url === "object") {
        return candidate.image_url.url;
    }

    return candidate.url;
};

const mapOpenRouterUsage = (usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
}): GenerativeModelUsage =>
    omitNullish({
        inputTokens: usage?.prompt_tokens,
        outputTokens: usage?.completion_tokens,
        totalTokens: usage?.total_tokens,
    });

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
    const images = (firstChoice?.message.images ?? [])
        .map(extractImageUrl)
        .filter((url): url is string => typeof url === "string" && url.length > 0);

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
        usage: mapOpenRouterUsage(raw.usage ?? undefined),
        response: {
            body: raw,
        },
    };
}

export function mapFromOpenRouterImageChatCompletionChunk(
    raw: OpenRouterChatCompletionChunk,
    messageId: string,
): Result<
    | {
          kind: "event";
          event: Event;
      }
    | {
          kind: "final";
          response: GenerativeModelResponse;
      }
    | null,
    BetterAgentError
> {
    try {
        const firstChoice = raw.choices[0];
        const deltaImages = (firstChoice?.delta?.images ?? [])
            .map(extractImageUrl)
            .filter((url): url is string => typeof url === "string" && url.length > 0);
        const firstDeltaImage = deltaImages[0];

        if (firstDeltaImage) {
            return ok({
                kind: "event",
                event: {
                    type: Events.IMAGE_MESSAGE_CONTENT,
                    messageId,
                    delta: {
                        kind: "url",
                        url: firstDeltaImage,
                    },
                    timestamp: Date.now(),
                },
            });
        }

        const finishReason = firstChoice?.finish_reason;
        if (!finishReason) {
            return ok(null);
        }

        const response = mapFromOpenRouterImageChatCompletion({
            choices: [
                {
                    index: firstChoice?.index,
                    finish_reason: finishReason,
                    message: {
                        role: "assistant",
                        content: "",
                        images: firstChoice?.delta?.images ?? [],
                    },
                },
            ],
        });

        return ok({
            kind: "final",
            response: {
                ...response,
                response: {
                    body: raw,
                },
            },
        });
    } catch (e) {
        return err(
            BetterAgentError.wrap({
                err: e,
                message: "Failed to map OpenRouter image stream chunk",
                opts: { code: "INTERNAL", context: { provider: "openrouter" } },
            }).at({ at: "openrouter.images.mapFromChunk" }),
        );
    }
}
