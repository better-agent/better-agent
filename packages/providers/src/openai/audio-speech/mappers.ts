import { Events } from "@better-agent/core/events";
import type { Event } from "@better-agent/core/events";
import type {
    GenerativeModelCallOptions,
    GenerativeModelOutputItem,
    GenerativeModelResponse,
    GenerativeModelUsage,
    ModalitiesParam,
} from "@better-agent/core/providers";
import { BetterAgentError } from "@better-agent/shared/errors";
import type { Result } from "@better-agent/shared/neverthrow";
import { err, ok } from "@better-agent/shared/neverthrow";
import { extractPassthroughOptions, omitNullish } from "../../utils/object-utils";
import type { OpenAISpeechStreamEvent } from "../shared/schemas";
import type { OpenAICapsFor, OpenAIOptionsFor } from "../types";
import type { OpenAIAudioSpeechModels, OpenAICreateSpeechRequest } from "./schemas";
import type { OpenAIAudioSpeechEndpointOptions } from "./types";

/**
 * Keys explicitly handled by the OpenAI audio speech mapper.
 */
const OPENAI_AUDIO_SPEECH_KNOWN_KEYS: ReadonlySet<string> = new Set([
    // Framework-managed
    "input",
    "tools",
    "toolChoice",
    "modalities",
    "structured_output",
    // Explicitly mapped
    "instructions",
    "voice",
    "response_format",
    "speed",
    "stream_format",
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

export function mapToOpenAIAudioSpeechRequest<
    M extends OpenAIAudioSpeechModels,
    TModalities extends ModalitiesParam<OpenAICapsFor<M>> = undefined,
>(args: {
    modelId: M;
    options: GenerativeModelCallOptions<OpenAICapsFor<M>, OpenAIOptionsFor<M>, TModalities>;
}): Result<OpenAICreateSpeechRequest, BetterAgentError> {
    try {
        const o = args.options;
        const raw = o as unknown as OpenAIAudioSpeechEndpointOptions;

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
                    "Audio speech generation requires a text input",
                    { context: { provider: "openai", model: args.modelId } },
                ).at({
                    at: "openai.audio.speech.map.inputMissing",
                }),
            );
        }

        const voice = o.voice ?? "alloy";

        return ok({
            ...extractPassthroughOptions(
                o as Record<string, unknown>,
                OPENAI_AUDIO_SPEECH_KNOWN_KEYS,
            ),
            model: args.modelId,
            input,
            voice,
            response_format: o.response_format,
            speed: o.speed,
            instructions: raw.instructions,
            stream_format: o.stream_format,
        });
    } catch (e) {
        return err(
            BetterAgentError.wrap({
                err: e,
                message: "Failed to map OpenAI Audio Speech request",
                opts: { code: "INTERNAL", context: { provider: "openai", model: args.modelId } },
            }).at({
                at: "openai.audio.speech.mapToRequest",
            }),
        );
    }
}

export function mapFromOpenAIAudioSpeechResponse(
    raw: ArrayBuffer,
    responseFormat?: string,
): GenerativeModelResponse {
    const base64 = Buffer.from(raw).toString("base64");

    const toOpenAIAudioMimeType = (format?: string): string => {
        switch (format) {
            case "mp3":
                return "audio/mpeg";
            case "wav":
                return "audio/wav";
            case "flac":
                return "audio/flac";
            case "aac":
                return "audio/aac";
            case "opus":
                return "audio/opus";
            case "pcm":
                return "audio/pcm";
            default:
                return "audio/mpeg";
        }
    };

    const mimeType = toOpenAIAudioMimeType(responseFormat);

    const output: GenerativeModelOutputItem[] = [
        {
            type: "message",
            role: "assistant",
            content: [
                {
                    type: "audio",
                    source: {
                        kind: "base64",
                        data: base64,
                        mimeType,
                    },
                },
            ],
        },
    ];

    return {
        output,
        finishReason: "stop",
        usage: {},
        response: {
            body: {
                audioData: raw,
            },
        },
    };
}

export function mapFromOpenAIAudioSpeechStreamEvent(
    event: OpenAISpeechStreamEvent,
    args: {
        messageId: string;
        mimeType: string;
        audioBase64?: string;
    },
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
    if (event.type === "speech.audio.delta") {
        return ok({
            kind: "event",
            event: {
                type: Events.AUDIO_MESSAGE_CONTENT,
                messageId: args.messageId,
                delta: {
                    kind: "base64",
                    data: event.audio,
                    mimeType: args.mimeType,
                },
                timestamp: Date.now(),
            },
        });
    }

    if (event.type === "speech.audio.done") {
        const audioBase64 = args.audioBase64 ?? "";
        const response: GenerativeModelResponse = {
            output: [
                {
                    type: "message",
                    role: "assistant",
                    content: [
                        {
                            type: "audio",
                            source: {
                                kind: "base64",
                                data: audioBase64,
                                mimeType: args.mimeType,
                            },
                        },
                    ],
                },
            ],
            finishReason: "stop",
            usage: mapOpenAIUsage(event.usage),
            response: {
                body: {
                    audio: audioBase64,
                    usage: event.usage,
                },
            },
        };

        return ok({
            kind: "final",
            response,
        });
    }

    return ok(null);
}
