import type { RunContext } from "@better-agent/core";
import { Events } from "@better-agent/core/events";
import type { Event } from "@better-agent/core/events";
import type {
    GenerativeModelOutputItem,
    GenerativeModelResponse,
} from "@better-agent/core/providers";
import { BetterAgentError } from "@better-agent/shared/errors";
import { OpenAIAudioSpeechModels } from "../audio-speech/schemas";
import { OpenAIAudioTranscriptionModels } from "../audio-transcription/schemas";
import { OpenAIEmbeddingModels } from "../embeddings/schemas";
import { OpenAIImageModels } from "../images/schemas";
import type { OpenAIImageCaps } from "../images/types";
import { OpenAIResponseModels } from "../responses/schemas";
import type { OpenAIResponseCaps } from "../responses/types";
import type {
    OpenAIAudioSpeechCaps,
    OpenAIAudioTranscriptionCaps,
    OpenAIEmbeddingCaps,
} from "../types";
import { OpenAIVideoModels } from "../videos/schemas";
import type { OpenAIVideoCaps } from "../videos/types";

export const isImageModel = (m: unknown): m is OpenAIImageModels =>
    OpenAIImageModels.options.includes(m as OpenAIImageModels);

export const isResponseModel = (m: unknown): m is OpenAIResponseModels =>
    OpenAIResponseModels.options.includes(m as OpenAIResponseModels);

export const isVideoModel = (m: unknown): m is OpenAIVideoModels =>
    OpenAIVideoModels.options.includes(m as OpenAIVideoModels);

export const isAudioSpeechModel = (m: unknown): m is OpenAIAudioSpeechModels =>
    OpenAIAudioSpeechModels.options.includes(m as OpenAIAudioSpeechModels);

export const isAudioTranscriptionModel = (m: unknown): m is OpenAIAudioTranscriptionModels =>
    OpenAIAudioTranscriptionModels.options.includes(m as OpenAIAudioTranscriptionModels);

export const isEmbeddingModel = (m: unknown): m is OpenAIEmbeddingModels =>
    OpenAIEmbeddingModels.options.includes(m as OpenAIEmbeddingModels);

export const OPENAI_RESPONSE_CAPS = {
    inputModalities: { text: true, image: true, file: true },
    inputShape: "chat",
    replayMode: "multi_turn",
    supportsInstruction: true,
    outputModalities: {
        text: {
            options: {},
        },
    },
    tools: true,
    structured_output: true,
    additionalSupportedRoles: ["developer"],
} as const satisfies OpenAIResponseCaps;

export const OPENAI_IMAGE_CAPS = {
    inputModalities: { text: true, image: true },
    inputShape: "prompt",
    replayMode: "single_turn_persistent",
    supportsInstruction: false,
    outputModalities: {
        image: true,
    },
    additionalSupportedRoles: ["developer"],
} as const satisfies OpenAIImageCaps;

export const OPENAI_VIDEO_CAPS = {
    inputModalities: { text: true, image: true },
    inputShape: "prompt",
    replayMode: "single_turn_persistent",
    supportsInstruction: false,
    outputModalities: {
        video: true,
    },
    additionalSupportedRoles: ["developer"],
} as const satisfies OpenAIVideoCaps;

export const OPENAI_AUDIO_SPEECH_CAPS = {
    inputModalities: { text: true },
    inputShape: "prompt",
    replayMode: "single_turn_persistent",
    supportsInstruction: false,
    tools: false,
    outputModalities: {
        audio: true,
    },
    additionalSupportedRoles: ["developer"],
} as const satisfies OpenAIAudioSpeechCaps;

export const OPENAI_AUDIO_TRANSCRIPTION_CAPS = {
    inputModalities: { audio: true },
    inputShape: "prompt",
    replayMode: "single_turn_persistent",
    supportsInstruction: false,
    outputModalities: {
        text: true,
    },
    additionalSupportedRoles: ["developer"],
} as const satisfies OpenAIAudioTranscriptionCaps;

export const OPENAI_EMBEDDING_CAPS = {
    inputModalities: { text: true },
    inputShape: "prompt",
    replayMode: "single_turn_persistent",
    supportsInstruction: false,
    outputModalities: {
        embedding: true,
    },
    additionalSupportedRoles: ["developer"],
} as const satisfies OpenAIEmbeddingCaps;

export const openaiUpstreamError = (
    message: string,
    meta: {
        status?: number;
        code?: string;
        raw?: unknown;
        model?: string;
        provider?: string;
    } = {},
) => {
    const mappedCode =
        meta.code === "ABORTED"
            ? "ABORTED"
            : meta.code === "VIDEO_POLL_TIMEOUT"
              ? "TIMEOUT"
              : "UPSTREAM_FAILED";

    return BetterAgentError.fromCode(mappedCode, message, {
        ...(meta.status !== undefined ? { status: meta.status } : {}),
        context: {
            provider: "openai",
            ...(meta.model !== undefined ? { model: meta.model } : {}),
            ...(meta.code !== undefined &&
            meta.code !== "ABORTED" &&
            meta.code !== "VIDEO_POLL_TIMEOUT"
                ? { upstreamCode: meta.code }
                : {}),
            ...(meta.raw !== undefined ? { raw: meta.raw } : {}),
        },
    });
};

export const createDeferred = <T>() => {
    let resolve!: (value: T | PromiseLike<T>) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
};

export const collectNonStreamOutputEvents = (
    response: GenerativeModelResponse,
    ctx: RunContext,
): Event[] => {
    const events: Event[] = [];
    const pushEvent = (event: Record<string, unknown>) => {
        events.push({ ...event, timestamp: Date.now() } as Event);
    };
    const responseBody = response.response?.body as
        | {
              text?: unknown;
              language?: unknown;
              duration?: unknown;
              segments?: Array<{
                  id?: unknown;
                  start?: unknown;
                  end?: unknown;
                  text?: unknown;
                  speaker?: unknown;
              }>;
              logprobs?: unknown[];
          }
        | undefined;
    const output = response.output;

    const transcriptTextFromOutput = output.find(
        (item): item is Extract<GenerativeModelOutputItem, { type: "message" }> =>
            item.type === "message" && typeof item.content === "string",
    )?.content;
    const transcriptText =
        typeof transcriptTextFromOutput === "string"
            ? transcriptTextFromOutput
            : typeof responseBody?.text === "string"
              ? responseBody.text
              : "";
    const isTranscriptionResponse =
        typeof transcriptText === "string" &&
        transcriptText.length > 0 &&
        (typeof responseBody?.language === "string" ||
            typeof responseBody?.duration === "number" ||
            Array.isArray(responseBody?.segments));

    if (isTranscriptionResponse) {
        const segments = Array.isArray(responseBody?.segments)
            ? responseBody.segments
                  .map((segment) => {
                      if (typeof segment?.id !== "number" && typeof segment?.id !== "string") {
                          return null;
                      }
                      if (typeof segment?.start !== "number" || typeof segment?.end !== "number") {
                          return null;
                      }
                      if (typeof segment?.text !== "string") return null;

                      return {
                          id: String(segment.id),
                          start: segment.start,
                          end: segment.end,
                          text: segment.text,
                          ...(typeof segment.speaker === "string"
                              ? { speaker: segment.speaker }
                              : {}),
                      };
                  })
                  .filter((segment): segment is NonNullable<typeof segment> => segment !== null)
            : [];

        const messageId = ctx.generateMessageId();

        pushEvent({
            type: Events.TRANSCRIPT_MESSAGE_START,
            messageId,
            role: "assistant",
        });

        pushEvent({
            type: Events.TRANSCRIPT_MESSAGE_CONTENT,
            messageId,
            delta: transcriptText,
            ...(Array.isArray(responseBody?.logprobs) ? { logprobs: responseBody.logprobs } : {}),
        });

        for (const segment of segments) {
            pushEvent({
                type: Events.TRANSCRIPT_MESSAGE_SEGMENT,
                messageId,
                segment,
            });
        }

        pushEvent({
            type: Events.TRANSCRIPT_MESSAGE_END,
            messageId,
        });
        return events;
    }

    let lastAssistantMessageId: string | undefined;
    for (const item of output) {
        if (item.type === "tool-call" || item.type === "provider-tool-result") {
            pushEvent({
                type: Events.TOOL_CALL_START,
                parentMessageId: lastAssistantMessageId ?? `tool_call:${item.callId}`,
                toolCallId: item.callId,
                toolCallName: item.name,
                runId: ctx.runId,
                agentName: ctx.agentName,
                toolTarget: "hosted",
            });

            if (item.type === "tool-call" && typeof item.arguments === "string") {
                pushEvent({
                    type: Events.TOOL_CALL_ARGS,
                    parentMessageId: lastAssistantMessageId ?? `tool_call:${item.callId}`,
                    toolCallId: item.callId,
                    toolCallName: item.name,
                    delta: item.arguments,
                    runId: ctx.runId,
                    agentName: ctx.agentName,
                    toolTarget: "hosted",
                });
            }

            if (item.type === "provider-tool-result") {
                pushEvent({
                    type: Events.TOOL_CALL_RESULT,
                    parentMessageId: lastAssistantMessageId ?? `tool_call:${item.callId}`,
                    toolCallId: item.callId,
                    toolCallName: item.name,
                    result: item.result,
                    ...(item.isError ? { isError: item.isError } : {}),
                    runId: ctx.runId,
                    agentName: ctx.agentName,
                    toolTarget: "hosted",
                });
            }

            pushEvent({
                type: Events.TOOL_CALL_END,
                parentMessageId: lastAssistantMessageId ?? `tool_call:${item.callId}`,
                toolCallId: item.callId,
                toolCallName: item.name,
                runId: ctx.runId,
                agentName: ctx.agentName,
                toolTarget: "hosted",
            });
            continue;
        }

        if (item.type !== "message") continue;

        const messageId = ctx.generateMessageId();

        const role = item.role;
        if (role === "assistant") {
            lastAssistantMessageId = messageId;
        }

        const content = item.content;
        if (typeof content === "string") {
            pushEvent({
                type: Events.TEXT_MESSAGE_START,
                messageId,
                role,
            });
            pushEvent({
                type: Events.TEXT_MESSAGE_CONTENT,
                messageId,
                delta: content,
            });
            pushEvent({
                type: Events.TEXT_MESSAGE_END,
                messageId,
            });
            continue;
        }

        for (const part of content) {
            if (part.type === "text") {
                pushEvent({
                    type: Events.TEXT_MESSAGE_START,
                    messageId,
                    role,
                });
                pushEvent({
                    type: Events.TEXT_MESSAGE_CONTENT,
                    messageId,
                    delta: part.text,
                });
                pushEvent({
                    type: Events.TEXT_MESSAGE_END,
                    messageId,
                });
                continue;
            }

            if (part.type === "image") {
                pushEvent({
                    type: Events.IMAGE_MESSAGE_START,
                    messageId,
                    role,
                });
                pushEvent({
                    type: Events.IMAGE_MESSAGE_CONTENT,
                    messageId,
                    delta:
                        part.source.kind === "url"
                            ? { kind: "url", url: part.source.url }
                            : {
                                  kind: "base64",
                                  data: part.source.data,
                                  mimeType: part.source.mimeType,
                              },
                });
                pushEvent({
                    type: Events.IMAGE_MESSAGE_END,
                    messageId,
                });
                continue;
            }

            if (part.type === "video") {
                pushEvent({
                    type: Events.VIDEO_MESSAGE_START,
                    messageId,
                    role,
                });
                pushEvent({
                    type: Events.VIDEO_MESSAGE_CONTENT,
                    messageId,
                    delta:
                        part.source.kind === "url"
                            ? { kind: "url", url: part.source.url }
                            : {
                                  kind: "base64",
                                  data: part.source.data,
                                  mimeType: part.source.mimeType,
                              },
                });
                pushEvent({
                    type: Events.VIDEO_MESSAGE_END,
                    messageId,
                });
                continue;
            }

            if (part.type === "audio" && part.source.kind === "base64") {
                pushEvent({
                    type: Events.AUDIO_MESSAGE_START,
                    messageId,
                    role,
                });
                pushEvent({
                    type: Events.AUDIO_MESSAGE_CONTENT,
                    messageId,
                    delta: {
                        kind: "base64",
                        data: part.source.data,
                        mimeType: part.source.mimeType,
                    },
                });
                pushEvent({
                    type: Events.AUDIO_MESSAGE_END,
                    messageId,
                });
                continue;
            }

            if (part.type === "embedding") {
                pushEvent({
                    type: Events.EMBEDDING_MESSAGE_START,
                    messageId,
                    role,
                });
                pushEvent({
                    type: Events.EMBEDDING_MESSAGE_CONTENT,
                    messageId,
                    delta: part.embedding,
                });
                pushEvent({
                    type: Events.EMBEDDING_MESSAGE_END,
                    messageId,
                });
            }
        }
    }
    return events;
};
