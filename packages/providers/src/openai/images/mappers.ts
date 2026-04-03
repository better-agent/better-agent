import { Events } from "@better-agent/core/events";
import type { Event } from "@better-agent/core/events";
import type {
    GenerativeModelCallOptions,
    GenerativeModelImageSource,
    GenerativeModelOutputItem,
    GenerativeModelResponse,
    GenerativeModelUsage,
    ModalitiesParam,
} from "@better-agent/core/providers";
import { BetterAgentError } from "@better-agent/shared/errors";
import type { Result } from "@better-agent/shared/neverthrow";
import { err, ok } from "@better-agent/shared/neverthrow";
import { extractPassthroughOptions, omitNullish } from "../../utils/object-utils";
import type { OpenAIImageStreamEvent } from "../shared/schemas";
import type { OpenAICapsFor, OpenAIOptionsFor } from "../types";
import type {
    OpenAICreateImage,
    OpenAICreateImageSchema,
    OpenAIEditImageSchema,
    OpenAIImageModels,
} from "./schemas";

/**
 * Keys explicitly handled by the OpenAI images mapper.
 */
const OPENAI_IMAGE_KNOWN_KEYS: ReadonlySet<string> = new Set([
    // Framework-managed
    "input",
    "tools",
    "toolChoice",
    "modalities",
    "structured_output",
    // Explicitly mapped
    "n",
    "quality",
    "response_format",
    "output_format",
    "output_compression",
    "stream",
    "partial_images",
    "size",
    "moderation",
    "background",
    "style",
    "input_fidelity",
    "user",
]);

const mapOpenAIUsage = (usage?: {
    input_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
}): GenerativeModelUsage =>
    omitNullish({
        inputTokens: usage?.input_tokens,
        outputTokens: usage?.output_tokens,
        totalTokens: usage?.total_tokens,
    });

type OpenAIImagesRequestPayload =
    | { mode: "generate"; body: OpenAICreateImageSchema }
    | { mode: "edit"; body: OpenAIEditImageSchema };

const toImageDataUrl = (source: GenerativeModelImageSource): string =>
    source.kind === "url" ? source.url : `data:${source.mimeType};base64,${source.data}`;

const parseOpenAIImagePromptInput = <
    M extends OpenAIImageModels,
    TModalities extends ModalitiesParam<OpenAICapsFor<M>> = undefined,
>(args: {
    modelId: M;
    options: GenerativeModelCallOptions<OpenAICapsFor<M>, OpenAIOptionsFor<M>, TModalities>;
}) => {
    const input = args.options.input;

    if (Array.isArray(input) && input.length > 1) {
        throw BetterAgentError.fromCode(
            "VALIDATION_FAILED",
            "Image generation supports a single input item",
            { context: { provider: "openai", model: args.modelId } },
        ).at({
            at: "openai.images.map.inputLimit",
        });
    }

    const first = Array.isArray(input) ? input[0] : input;
    if (typeof first === "string")
        return { prompt: first, images: [] as GenerativeModelImageSource[] };

    if (!first || typeof first !== "object" || !("type" in first) || first.type !== "message") {
        throw BetterAgentError.fromCode(
            "VALIDATION_FAILED",
            "Image generation requires a prompt string or a single message input",
            { context: { provider: "openai", model: args.modelId } },
        ).at({
            at: "openai.images.map.inputShape",
        });
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
            "Image generation only supports text and image input parts",
            { context: { provider: "openai", model: args.modelId, partType: part.type } },
        ).at({
            at: "openai.images.map.partType",
        });
    }

    return { prompt: promptParts.join("\n"), images };
};

export function mapFromOpenAIImagesStreamEvent(
    event: OpenAIImageStreamEvent,
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
    if (event.type === "image_generation.partial_image") {
        return ok({
            kind: "event",
            event: {
                type: Events.IMAGE_MESSAGE_CONTENT,
                messageId,
                delta: {
                    kind: "base64",
                    data: event.b64_json,
                    mimeType: `image/${event.output_format ?? "png"}`,
                },
                timestamp: Date.now(),
            },
        });
    }

    if (event.type === "image_generation.completed") {
        const response: GenerativeModelResponse = {
            output: [
                {
                    type: "message",
                    role: "assistant",
                    content: [
                        {
                            type: "image",
                            source: {
                                kind: "base64",
                                data: event.b64_json,
                                mimeType: `image/${event.output_format ?? "png"}`,
                            },
                        },
                    ],
                },
            ],
            finishReason: "stop",
            usage: mapOpenAIUsage(event.usage),
            response: {
                body: event,
            },
        };

        return ok({
            kind: "final",
            response,
        });
    }

    return ok(null);
}

export function mapToOpenAIImagesRequest<
    M extends OpenAIImageModels,
    TModalities extends ModalitiesParam<OpenAICapsFor<M>> = undefined,
>(args: {
    modelId: M;
    options: GenerativeModelCallOptions<OpenAICapsFor<M>, OpenAIOptionsFor<M>, TModalities>;
}): Result<OpenAIImagesRequestPayload, BetterAgentError> {
    try {
        const o = args.options;

        if (o.stream && args.modelId !== "gpt-image-1") {
            return err(
                BetterAgentError.fromCode(
                    "VALIDATION_FAILED",
                    "Image streaming is only supported for gpt-image-1",
                    { context: { provider: "openai", model: args.modelId } },
                ).at({
                    at: "openai.images.map.streamUnsupported",
                }),
            );
        }

        const parsed = parseOpenAIImagePromptInput(args);
        const prompt = parsed.prompt;

        if (typeof prompt !== "string" || !prompt) {
            return err(
                BetterAgentError.fromCode(
                    "VALIDATION_FAILED",
                    "Image generation requires a text prompt",
                    { context: { provider: "openai", model: args.modelId } },
                ).at({
                    at: "openai.images.map.promptMissing",
                }),
            );
        }

        if (parsed.images.length === 0) {
            return ok({
                mode: "generate",
                body: {
                    ...extractPassthroughOptions(
                        o as Record<string, unknown>,
                        OPENAI_IMAGE_KNOWN_KEYS,
                    ),
                    model: args.modelId,
                    prompt,
                    n: o.n,
                    quality: o.quality,
                    response_format: o.response_format,
                    output_format: o.output_format,
                    output_compression: o.output_compression,
                    stream: o.stream,
                    partial_images: o.partial_images,
                    size: o.size,
                    moderation: o.moderation,
                    background: o.background,
                    style: o.style,
                    user: o.user,
                },
            });
        }

        if (args.modelId === "dall-e-3") {
            return err(
                BetterAgentError.fromCode(
                    "VALIDATION_FAILED",
                    "OpenAI image edits are not supported for dall-e-3",
                    { context: { provider: "openai", model: args.modelId } },
                ).at({
                    at: "openai.images.map.editUnsupported",
                }),
            );
        }

        return ok({
            mode: "edit",
            body: {
                ...extractPassthroughOptions(o as Record<string, unknown>, OPENAI_IMAGE_KNOWN_KEYS),
                model: args.modelId,
                prompt,
                images: parsed.images.map((image) => ({
                    image_url: toImageDataUrl(image),
                })),
                n: o.n,
                quality: o.quality,
                response_format: o.response_format,
                output_format: o.output_format,
                output_compression: o.output_compression,
                stream: o.stream,
                partial_images: o.partial_images,
                size: o.size,
                moderation: o.moderation,
                background: o.background,
                user: o.user,
                input_fidelity: o.input_fidelity,
            },
        });
    } catch (e) {
        return err(
            BetterAgentError.wrap({
                err: e,
                message: "Failed to map OpenAI Images request",
                opts: { code: "INTERNAL", context: { provider: "openai", model: args.modelId } },
            }).at({
                at: "openai.images.mapToRequest",
            }),
        );
    }
}

export function mapFromOpenAIImagesResponse(raw: OpenAICreateImage): GenerativeModelResponse {
    const data = raw.data ?? [];
    const mimeType: `image/${"png" | "webp" | "jpeg"}` = `image/${raw.output_format ?? "png"}`;

    const images: GenerativeModelImageSource[] = data.flatMap((d): GenerativeModelImageSource[] =>
        d.url
            ? [
                  {
                      kind: "url",
                      url: d.url,
                  },
              ]
            : d.b64_json
              ? [
                    {
                        kind: "base64",
                        data: d.b64_json,
                        mimeType,
                    },
                ]
              : [],
    );

    const output: GenerativeModelOutputItem[] = [];
    if (images.length) {
        output.push({
            type: "message",
            role: "assistant",
            content: images.map((source) => ({
                type: "image",
                source,
            })),
        });
    }

    return {
        output,
        finishReason: "stop",
        usage: raw.usage
            ? {
                  inputTokens: raw.usage.input_tokens,
                  outputTokens: raw.usage.output_tokens,
                  totalTokens: raw.usage.total_tokens,
              }
            : {},
        response: {
            body: raw,
        },
    };
}
