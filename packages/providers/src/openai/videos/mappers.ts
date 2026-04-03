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
import type { OpenAICreateVideo, OpenAICreateVideoSchema, OpenAIVideoModels } from "./schemas";

/**
 * Keys explicitly handled by the OpenAI videos mapper.
 */
const OPENAI_VIDEO_KNOWN_KEYS: ReadonlySet<string> = new Set([
    // Framework-managed
    "input",
    "tools",
    "toolChoice",
    "modalities",
    "structured_output",
    // Explicitly mapped
    "input_reference",
    "seconds",
    "size",
    "pollIntervalMs",
    "pollTimeoutMs",
]);

export function mapToOpenAIVideosRequest<
    M extends OpenAIVideoModels,
    TModalities extends ModalitiesParam<OpenAICapsFor<M>> = undefined,
>(args: {
    modelId: M;
    options: GenerativeModelCallOptions<OpenAICapsFor<M>, OpenAIOptionsFor<M>, TModalities>;
}): Result<OpenAICreateVideoSchema, BetterAgentError> {
    try {
        const o = args.options;

        let prompt: string | undefined;
        let inputReference: string | undefined = o.input_reference;

        if (typeof o.input === "string") {
            prompt = o.input;
        } else {
            if (o.input.length !== 1) {
                return err(
                    BetterAgentError.fromCode(
                        "VALIDATION_FAILED",
                        "Video generation supports a single input item",
                        { context: { provider: "openai", model: args.modelId } },
                    ).at({
                        at: "openai.videos.map.inputLimit",
                    }),
                );
            }

            const item = o.input[0];
            if (!item) {
                return err(
                    BetterAgentError.fromCode(
                        "VALIDATION_FAILED",
                        "Video generation requires one input item",
                        { context: { provider: "openai", model: args.modelId } },
                    ).at({
                        at: "openai.videos.map.inputMissing",
                    }),
                );
            }

            if (typeof item === "string") {
                prompt = item;
            } else if (item.type === "message") {
                if (typeof item.content === "string") {
                    prompt = item.content;
                } else {
                    const parts = item.content;
                    type MessagePart = (typeof parts)[number];

                    const text = parts
                        .flatMap((part: MessagePart) =>
                            part.type === "text" && "text" in part ? [part.text] : [],
                        )
                        .join("\n")
                        .trim();

                    if (text.length > 0) {
                        prompt = text;
                    }

                    if (!inputReference) {
                        const imagePart = parts.find(
                            (part: MessagePart) => part.type === "image" && "source" in part,
                        );

                        if (imagePart) {
                            if (imagePart.source.kind === "url") {
                                return err(
                                    BetterAgentError.fromCode(
                                        "VALIDATION_FAILED",
                                        "OpenAI video input_reference requires base64 image data",
                                        {
                                            context: {
                                                provider: "openai",
                                                model: args.modelId,
                                            },
                                        },
                                    ).at({
                                        at: "openai.videos.map.inputReferenceUrlUnsupported",
                                    }),
                                );
                            }

                            inputReference = imagePart.source.data;
                        }
                    }
                }
            } else {
                return err(
                    BetterAgentError.fromCode(
                        "VALIDATION_FAILED",
                        "Video generation only accepts message or text prompt input",
                        {
                            context: {
                                provider: "openai",
                                model: args.modelId,
                            },
                        },
                    ).at({
                        at: "openai.videos.map.invalidInputItem",
                    }),
                );
            }
        }

        if (typeof prompt !== "string" || prompt.trim().length === 0) {
            return err(
                BetterAgentError.fromCode(
                    "VALIDATION_FAILED",
                    "Video generation requires a text prompt",
                    { context: { provider: "openai", model: args.modelId } },
                ).at({
                    at: "openai.videos.map.promptMissing",
                }),
            );
        }

        return ok({
            ...extractPassthroughOptions(o as Record<string, unknown>, OPENAI_VIDEO_KNOWN_KEYS),
            model: args.modelId,
            prompt,
            input_reference: inputReference,
            seconds: o.seconds,
            size: o.size,
        });
    } catch (e) {
        return err(
            BetterAgentError.wrap({
                err: e,
                message: "Failed to map OpenAI Videos request",
                opts: { code: "INTERNAL", context: { provider: "openai", model: args.modelId } },
            }).at({
                at: "openai.videos.mapToRequest",
            }),
        );
    }
}

export function mapFromOpenAIVideosResponse(args: {
    raw: OpenAICreateVideo;
    video?: {
        data: string;
        mimeType: string;
    };
}): GenerativeModelResponse {
    const output: GenerativeModelOutputItem[] =
        args.video &&
        args.raw.status === "completed" &&
        typeof args.video.data === "string" &&
        args.video.data.length > 0
            ? [
                  {
                      type: "message",
                      role: "assistant",
                      content: [
                          {
                              type: "video",
                              source: {
                                  kind: "base64",
                                  data: args.video.data,
                                  mimeType: args.video.mimeType,
                              },
                          },
                      ],
                  },
              ]
            : [];

    return {
        output,
        finishReason: args.raw.status === "failed" ? "other" : "stop",
        usage: {},
        response: {
            body: args.raw,
        },
    };
}
