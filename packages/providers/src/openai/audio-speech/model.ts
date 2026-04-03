import type { RunContext } from "@better-agent/core";
import { Events } from "@better-agent/core/events";
import type { Event } from "@better-agent/core/events";
import type {
    GenerativeModelCallOptions,
    GenerativeModelResponse,
    ModalitiesParam,
} from "@better-agent/core/providers";
import { BetterAgentError } from "@better-agent/shared/errors";
import { type Result, err, ok } from "@better-agent/shared/neverthrow";
import type { createOpenAIClient } from "../client";
import {
    OPENAI_AUDIO_SPEECH_CAPS,
    collectNonStreamOutputEvents,
    createDeferred,
    openaiUpstreamError,
} from "../shared/runtime";
import type { OpenAISpeechStreamEvent } from "../shared/schemas";
import type { OpenAICapsFor, OpenAIGenerativeModel, OpenAIOptionsFor } from "../types";
import {
    mapFromOpenAIAudioSpeechResponse,
    mapFromOpenAIAudioSpeechStreamEvent,
    mapToOpenAIAudioSpeechRequest,
} from "./mappers";
import type { OpenAIAudioSpeechModels } from "./schemas";

export const createOpenAIAudioSpeechModel = <M extends OpenAIAudioSpeechModels>(
    modelId: M,
    client: ReturnType<typeof createOpenAIClient>,
): OpenAIGenerativeModel<M> => {
    const supportsSse = modelId === "gpt-4o-mini-tts";

    const doGenerate: NonNullable<OpenAIGenerativeModel<M>["doGenerate"]> = async <
        TModalities extends ModalitiesParam<OpenAICapsFor<M>> = undefined,
    >(
        options: GenerativeModelCallOptions<OpenAICapsFor<M>, OpenAIOptionsFor<M>, TModalities>,
        ctx: RunContext,
    ) => {
        const requestBodyResult = mapToOpenAIAudioSpeechRequest({ modelId, options });
        if (requestBodyResult.isErr()) {
            return err(
                requestBodyResult.error.at({
                    at: "openai.generate.mapRequest",
                    data: {
                        modelId,
                        endpoint: "audio.speech",
                    },
                }),
            );
        }

        const requestBody = requestBodyResult.value;

        const raw = await client.audio.speech(requestBody, { signal: ctx.signal ?? null });
        if (raw.isErr()) {
            return err(
                raw.error
                    .at({ at: "openai.generate.modelContext", data: { model: String(modelId) } })
                    .at({
                        at: "openai.generate.http",
                        data: {
                            modelId,
                            endpoint: "audio.speech",
                            path: "/v1/audio/speech",
                        },
                    }),
            );
        }

        const response = mapFromOpenAIAudioSpeechResponse(raw.value, requestBody.response_format);
        return ok({
            response: {
                ...response,
                request: {
                    body: requestBody,
                },
            } satisfies GenerativeModelResponse,
            events: collectNonStreamOutputEvents(response, ctx),
        });
    };

    const doGenerateStream: NonNullable<OpenAIGenerativeModel<M>["doGenerateStream"]> = async <
        const TModalities extends ModalitiesParam<OpenAICapsFor<M>>,
    >(
        options: GenerativeModelCallOptions<OpenAICapsFor<M>, OpenAIOptionsFor<M>, TModalities>,
        ctx: RunContext,
    ) => {
        const requestBodyResult = mapToOpenAIAudioSpeechRequest({ modelId, options });
        if (requestBodyResult.isErr()) {
            return err(
                requestBodyResult.error.at({
                    at: "openai.generateStream.mapRequest",
                    data: {
                        modelId,
                        endpoint: "audio.speech",
                    },
                }),
            );
        }

        const requestBody = {
            ...requestBodyResult.value,
            stream: true,
            stream_format: supportsSse ? ("sse" as const) : ("audio" as const),
        };

        const streamResult = supportsSse
            ? await client.audio.speechStream(requestBody, { signal: ctx.signal ?? null })
            : await client.audio.speechStreamAudio(requestBody, { signal: ctx.signal ?? null });
        if (streamResult.isErr()) {
            return err(
                streamResult.error
                    .at({ at: "openai.generate.modelContext", data: { model: String(modelId) } })
                    .at({
                        at: "openai.generateStream.http",
                        data: {
                            modelId,
                            endpoint: "audio.speech",
                            path: "/v1/audio/speech",
                        },
                    }),
            );
        }

        const {
            promise: final,
            resolve: resolveFinal,
            reject: rejectFinal,
        } = createDeferred<GenerativeModelResponse>();

        const events = (async function* (): AsyncGenerator<Result<Event, BetterAgentError>> {
            const messageId = ctx.generateMessageId();

            const toAudioMimeType = (format?: string) => {
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

            const mimeType = toAudioMimeType(requestBody.response_format);
            const chunks: Array<ReturnType<typeof Buffer.from>> = [];
            let started = false;
            let sawFinal = false;
            let finalResolved = false;

            try {
                if (supportsSse) {
                    const sseStream = streamResult.value as AsyncGenerator<
                        Result<OpenAISpeechStreamEvent, BetterAgentError>
                    >;
                    for await (const raw of sseStream) {
                        if (raw.isErr()) {
                            const appErr = BetterAgentError.wrap({
                                err: raw.error,
                                message: "OpenAI stream chunk error",
                                opts: {
                                    code: "UPSTREAM_FAILED",
                                },
                            }).at({
                                at: "openai.generateStream.chunk",
                            });

                            yield err(appErr);
                            rejectFinal(appErr);
                            return;
                        }

                        if (raw.value.type === "speech.audio.delta") {
                            chunks.push(Buffer.from(raw.value.audio, "base64"));
                        }

                        const audioBase64 =
                            raw.value.type === "speech.audio.done"
                                ? chunks.length
                                    ? Buffer.concat(chunks).toString("base64")
                                    : ""
                                : undefined;

                        const mapped = mapFromOpenAIAudioSpeechStreamEvent(raw.value, {
                            messageId,
                            mimeType,
                            ...(audioBase64 !== undefined ? { audioBase64 } : {}),
                        });
                        if (mapped.isErr()) {
                            const appErr = mapped.error.at({
                                at: "openai.generateStream.mapEvent",
                            });

                            yield err(appErr);
                            rejectFinal(appErr);
                            return;
                        }

                        const m = mapped.value;
                        if (!m) continue;

                        if (!started) {
                            started = true;
                            yield ok({
                                type: Events.AUDIO_MESSAGE_START,
                                messageId,
                                role: "assistant",
                                timestamp: Date.now(),
                            });
                        }

                        if (m.kind === "event") {
                            yield ok(m.event);
                            continue;
                        }

                        sawFinal = true;
                        resolveFinal({
                            ...m.response,
                            request: {
                                body: requestBody,
                            },
                        });
                        finalResolved = true;

                        yield ok({
                            type: Events.AUDIO_MESSAGE_END,
                            messageId,
                            timestamp: Date.now(),
                        });

                        return;
                    }

                    if (!sawFinal) {
                        const missingFinal = openaiUpstreamError(
                            "Stream ended without speech.audio.done",
                            {
                                provider: "openai",
                                code: "STREAM_MISSING_FINAL",
                            },
                        ).at({
                            at: "openai.generateStream.missingFinal",
                        });

                        yield err(missingFinal);
                        rejectFinal(missingFinal);
                        return;
                    }
                } else {
                    const audioStream = streamResult.value as AsyncGenerator<
                        Result<Uint8Array, BetterAgentError>
                    >;
                    for await (const raw of audioStream) {
                        if (raw.isErr()) {
                            const appErr = BetterAgentError.wrap({
                                err: raw.error,
                                message: "OpenAI stream chunk error",
                                opts: {
                                    code: "UPSTREAM_FAILED",
                                },
                            }).at({
                                at: "openai.generateStream.chunk",
                            });

                            yield err(appErr);
                            rejectFinal(appErr);
                            return;
                        }

                        if (!started) {
                            started = true;
                            yield ok({
                                type: Events.AUDIO_MESSAGE_START,
                                messageId,
                                role: "assistant",
                                timestamp: Date.now(),
                            });
                        }

                        const chunk = raw.value;
                        const base64 = Buffer.from(chunk).toString("base64");
                        chunks.push(Buffer.from(chunk));
                        yield ok({
                            type: Events.AUDIO_MESSAGE_CONTENT,
                            messageId,
                            delta: {
                                kind: "base64",
                                data: base64,
                                mimeType,
                            },
                            timestamp: Date.now(),
                        });
                    }

                    const audioBuffer = chunks.length ? Buffer.concat(chunks) : Buffer.alloc(0);
                    const base64 = audioBuffer.toString("base64");
                    resolveFinal({
                        output: [
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
                        ],
                        finishReason: "stop",
                        usage: {},
                        request: {
                            body: requestBody,
                        },
                        response: {
                            body: {
                                audio: base64,
                            },
                        },
                    });
                    finalResolved = true;
                    sawFinal = true;

                    yield ok({
                        type: Events.AUDIO_MESSAGE_END,
                        messageId,
                        timestamp: Date.now(),
                    });
                }
            } catch (e) {
                const appErr = BetterAgentError.wrap({
                    err: e,
                    message: "OpenAI audio speech streaming failed",
                    opts: {
                        code: "UPSTREAM_FAILED",
                        context: { provider: "openai", model: String(modelId) },
                    },
                }).at({
                    at: "openai.generateStream.generator",
                });

                if (!finalResolved) {
                    rejectFinal(appErr);
                }
                yield err(appErr);
                return;
            }
        })();

        return ok({
            events,
            final,
        });
    };

    return {
        providerId: "openai",
        modelId,
        caps: OPENAI_AUDIO_SPEECH_CAPS as OpenAICapsFor<M>,
        doGenerate,
        doGenerateStream,
    };
};
