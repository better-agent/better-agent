import type {
    GenerativeModelCallOptions,
    GenerativeModelImageSource,
    GenerativeModelResponse,
} from "@better-agent/core/providers";
import { BetterAgentError } from "@better-agent/shared/errors";
import type { Result } from "@better-agent/shared/neverthrow";
import { err, ok } from "@better-agent/shared/neverthrow";
import { extractPassthroughOptions, omitNullish } from "../../utils/object-utils";

import type { XAICreateImageResponse, XAICreateImageSchema, XAIEditImageSchema } from "./schemas";
import type { XAIImageCaps, XAIImageEndpointOptions, XAIImageModelId } from "./types";

/**
 * Keys explicitly handled by the xAI images mapper.
 * Everything else on the options object is passed through to the API body.
 */
const XAI_IMAGE_KNOWN_KEYS: ReadonlySet<string> = new Set([
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
    "size",
    "style",
    "aspect_ratio",
    "resolution",
    "user",
]);

type XAIImagesRequestPayload =
    | { mode: "generate"; body: XAICreateImageSchema }
    | { mode: "edit"; body: XAIEditImageSchema };

const toImageDataUrl = (source: GenerativeModelImageSource): string =>
    source.kind === "url" ? source.url : `data:${source.mimeType};base64,${source.data}`;

const parseXAIImagePromptInput = (args: {
    modelId: XAIImageModelId;
    options: GenerativeModelCallOptions<XAIImageCaps, XAIImageEndpointOptions>;
}) => {
    const input = args.options.input;
    if (Array.isArray(input) && input.length > 1) {
        throw BetterAgentError.fromCode(
            "VALIDATION_FAILED",
            "Image generation supports a single input item",
            { context: { provider: "xai", model: args.modelId } },
        ).at({ at: "xai.images.map.inputLimit" });
    }
    const first = Array.isArray(input) ? input[0] : input;
    if (typeof first === "string")
        return { prompt: first, images: [] as GenerativeModelImageSource[] };
    if (!first || typeof first !== "object" || !("type" in first) || first.type !== "message") {
        throw BetterAgentError.fromCode(
            "VALIDATION_FAILED",
            "xAI image generation requires a prompt string or a single message input.",
            { context: { provider: "xai", model: args.modelId } },
        ).at({ at: "xai.images.map.inputShape" });
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
            "xAI image generation only supports text and image input parts.",
            { context: { provider: "xai", model: args.modelId } },
        ).at({ at: "xai.images.map.partType" });
    }
    return { prompt: promptParts.join("\n"), images };
};

export function mapToXAIImagesRequest<M extends XAIImageModelId>(args: {
    modelId: M;
    options: GenerativeModelCallOptions<XAIImageCaps, XAIImageEndpointOptions>;
}): Result<XAIImagesRequestPayload, BetterAgentError> {
    try {
        const o = args.options;
        if ("stream" in (o as Record<string, unknown>) && (o as Record<string, unknown>).stream) {
            return err(
                BetterAgentError.fromCode(
                    "VALIDATION_FAILED",
                    "Image streaming is not supported by the xAI provider.",
                    { context: { provider: "xai", model: args.modelId } },
                ).at({ at: "xai.images.map.streamUnsupported" }),
            );
        }
        const parsed = parseXAIImagePromptInput(args);
        const prompt = parsed.prompt;
        if (!prompt || prompt.trim().length === 0) {
            return err(
                BetterAgentError.fromCode(
                    "VALIDATION_FAILED",
                    "xAI image generation requires a text prompt.",
                    { context: { provider: "xai", model: args.modelId } },
                ).at({ at: "xai.images.map.prompt" }),
            );
        }

        const imageOptions = o as {
            n?: XAICreateImageSchema["n"];
            quality?: XAICreateImageSchema["quality"];
            response_format?: XAICreateImageSchema["response_format"];
            size?: XAICreateImageSchema["size"];
            style?: XAICreateImageSchema["style"];
            aspect_ratio?: XAIEditImageSchema["aspect_ratio"];
            resolution?: XAIEditImageSchema["resolution"];
            user?: XAICreateImageSchema["user"];
        };

        if (parsed.images.length === 0) {
            const request: XAICreateImageSchema = {
                ...extractPassthroughOptions(
                    imageOptions as Record<string, unknown>,
                    XAI_IMAGE_KNOWN_KEYS,
                ),
                model: args.modelId as XAICreateImageSchema["model"],
                prompt,
                ...omitNullish({
                    n: imageOptions.n,
                    quality: imageOptions.quality,
                    response_format: imageOptions.response_format,
                    size: imageOptions.size,
                    style: imageOptions.style,
                    user: imageOptions.user,
                }),
            };
            return ok({ mode: "generate", body: request });
        }

        const firstImage = parsed.images[0];
        if (!firstImage) {
            throw BetterAgentError.fromCode(
                "VALIDATION_FAILED",
                "xAI image generation requires at least one image when editing",
                { context: { provider: "xai", model: args.modelId } },
            ).at({ at: "xai.images.map.firstImageMissing" });
        }
        const editRequest: XAIEditImageSchema = {
            ...extractPassthroughOptions(
                imageOptions as Record<string, unknown>,
                XAI_IMAGE_KNOWN_KEYS,
            ),
            model: args.modelId as XAIEditImageSchema["model"],
            prompt,
            ...(parsed.images.length === 1
                ? {
                      image: {
                          type: "image_url",
                          image_url: toImageDataUrl(firstImage),
                      },
                  }
                : {
                      images: parsed.images.map((image) => ({
                          type: "image_url" as const,
                          image_url: toImageDataUrl(image),
                      })),
                  }),
            ...omitNullish({
                n: imageOptions.n,
                quality: imageOptions.quality,
                response_format: imageOptions.response_format,
                size: imageOptions.size,
                style: imageOptions.style,
                aspect_ratio: imageOptions.aspect_ratio,
                resolution: imageOptions.resolution,
                user: imageOptions.user,
            }),
        };
        return ok({ mode: "edit", body: editRequest });
    } catch (e) {
        return err(
            BetterAgentError.wrap({
                err: e,
                message: "Failed to map xAI image request",
                opts: { code: "INTERNAL", context: { provider: "xai", model: args.modelId } },
            }).at({ at: "xai.images.mapToRequest" }),
        );
    }
}

export function mapFromXAIImagesResponse(raw: XAICreateImageResponse): GenerativeModelResponse {
    const output = (raw.data ?? []).map(outputMapper).filter(isDefined);
    const usage =
        typeof raw.usage?.cost_in_usd_ticks === "number"
            ? { totalTokens: raw.usage.cost_in_usd_ticks }
            : {};
    const images = (raw.data ?? []).map((item) => ({
        ...omitNullish({
            url: typeof item.url === "string" ? item.url : undefined,
            b64_json: typeof item.b64_json === "string" ? item.b64_json : undefined,
            mime_type: typeof item.mime_type === "string" ? item.mime_type : undefined,
            revised_prompt:
                typeof item.revised_prompt === "string" ? item.revised_prompt : undefined,
        }),
    }));
    return {
        output,
        finishReason: "stop",
        usage,
        response: { body: { ...raw, normalized: { images, usage: raw.usage } } },
    };
}

function outputMapper(item: unknown) {
    if (!item || typeof item !== "object") return null;
    const image = item as {
        url?: unknown;
        b64_json?: unknown;
        mime_type?: unknown;
        revised_prompt?: unknown;
    };
    const url = typeof image.url === "string" ? image.url : null;
    const b64 = typeof image.b64_json === "string" ? image.b64_json : null;
    const mimeType = typeof image.mime_type === "string" ? image.mime_type : undefined;
    const revisedPrompt =
        typeof image.revised_prompt === "string" ? image.revised_prompt : undefined;
    if (!url && !b64) return null;
    if (b64) {
        return {
            type: "message" as const,
            role: "assistant" as const,
            content: [
                {
                    type: "image" as const,
                    source: {
                        kind: "base64" as const,
                        data: b64,
                        mimeType: mimeType ?? "image/png",
                    },
                    ...(revisedPrompt ? { revisedPrompt } : {}),
                },
            ],
        };
    }
    if (url == null) return null;
    return {
        type: "message" as const,
        role: "assistant" as const,
        content: [
            {
                type: "image" as const,
                source: { kind: "url" as const, url },
                ...(mimeType ? { mimeType } : {}),
                ...(revisedPrompt ? { revisedPrompt } : {}),
            },
        ],
    };
}

function isDefined<T>(value: T | null): value is T {
    return value !== null;
}
