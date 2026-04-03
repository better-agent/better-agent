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
import type { OpenAITranscriptionStreamEvent } from "../shared/schemas";
import type {
    OpenAIAudioTranscriptionModels,
    OpenAICreateTranscriptionRequest,
    OpenAICreateTranscriptionResponse,
} from "./schemas";
import type {
    OpenAIAudioTranscriptionCaps,
    OpenAIAudioTranscriptionEndpointOptions,
} from "./types";

/**
 * Keys explicitly handled by the OpenAI audio transcription mapper.
 */
const OPENAI_AUDIO_TRANSCRIPTION_KNOWN_KEYS: ReadonlySet<string> = new Set([
    // Framework-managed
    "input",
    "tools",
    "toolChoice",
    "modalities",
    "structured_output",
    // Explicitly mapped
    "language",
    "prompt",
    "response_format",
    "temperature",
    "include",
    "timestamp_granularities",
    "stream",
    "chunking_strategy",
    "known_speaker_names",
    "known_speaker_references",
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

export function mapToOpenAIAudioTranscriptionRequest<
    M extends OpenAIAudioTranscriptionModels,
    TModalities extends ModalitiesParam<OpenAIAudioTranscriptionCaps> = undefined,
>(args: {
    modelId: M;
    options: GenerativeModelCallOptions<
        OpenAIAudioTranscriptionCaps,
        OpenAIAudioTranscriptionEndpointOptions,
        TModalities
    >;
}): Result<OpenAICreateTranscriptionRequest, BetterAgentError> {
    try {
        const o = args.options;

        const audioFile = "file" in o ? o.file : undefined;

        if (typeof audioFile !== "string" || !audioFile) {
            return err(
                BetterAgentError.fromCode(
                    "VALIDATION_FAILED",
                    "Audio transcription requires an audio file (base64 string or data URL)",
                    {
                        context: {
                            provider: "openai",
                            model: args.modelId,
                        },
                    },
                ).at({
                    at: "openai.audio.transcription.map.fileMissing",
                }),
            );
        }

        return ok({
            ...extractPassthroughOptions(
                o as Record<string, unknown>,
                OPENAI_AUDIO_TRANSCRIPTION_KNOWN_KEYS,
            ),
            file: audioFile as string,
            model: args.modelId,
            language: o.language,
            prompt: o.prompt,
            response_format: o.response_format,
            temperature: o.temperature,
            timestamp_granularities: o.timestamp_granularities,
            chunking_strategy: o.chunking_strategy,
            include: o.include,
            stream: o.stream,
        });
    } catch (e) {
        return err(
            BetterAgentError.wrap({
                err: e,
                message: "Failed to map OpenAI Audio Transcription request",
                opts: { code: "INTERNAL", context: { provider: "openai", model: args.modelId } },
            }).at({
                at: "openai.audio.transcription.mapToRequest",
            }),
        );
    }
}

export function mapFromOpenAIAudioTranscriptionResponse(
    raw: OpenAICreateTranscriptionResponse,
): GenerativeModelResponse {
    const text = raw.text ?? "";

    const output: GenerativeModelOutputItem[] = [];
    if (text) {
        output.push({
            type: "message",
            role: "assistant",
            content: text,
        });
    }

    return {
        output,
        finishReason: "stop",
        usage: {},
        response: {
            body: raw,
        },
    };
}

export function mapFromOpenAIAudioTranscriptionStreamEvent(
    event: OpenAITranscriptionStreamEvent,
    args: {
        messageId: string;
        text: string;
        logprobs?: unknown[];
        segments: Array<{
            id: string;
            start: number;
            end: number;
            text: string;
            speaker?: string;
        }>;
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
    if (event.type === "transcript.text.delta") {
        return ok({
            kind: "event",
            event: {
                type: Events.TRANSCRIPT_MESSAGE_CONTENT,
                messageId: args.messageId,
                delta: event.delta ?? "",
                timestamp: Date.now(),
                ...omitNullish({
                    logprobs: event.logprobs,
                    segmentId: event.segment_id,
                }),
            },
        });
    }

    if (event.type === "transcript.text.segment") {
        return ok({
            kind: "event",
            event: {
                type: Events.TRANSCRIPT_MESSAGE_SEGMENT,
                messageId: args.messageId,
                segment: {
                    id: event.id,
                    start: event.start,
                    end: event.end,
                    text: event.text,
                    ...omitNullish({ speaker: event.speaker }),
                },
                timestamp: Date.now(),
            },
        });
    }

    if (event.type === "transcript.text.done") {
        const response: GenerativeModelResponse = {
            output: args.text
                ? [
                      {
                          type: "message",
                          role: "assistant",
                          content: args.text,
                      },
                  ]
                : [],
            finishReason: "stop",
            usage: mapOpenAIUsage(event.usage),
            response: {
                body: {
                    text: args.text,
                    logprobs: args.logprobs,
                    segments: args.segments,
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
