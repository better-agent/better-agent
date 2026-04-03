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
    OPENAI_AUDIO_TRANSCRIPTION_CAPS,
    collectNonStreamOutputEvents,
    createDeferred,
    openaiUpstreamError,
} from "../shared/runtime";
import type {
    OpenAIAudioTranscriptionGenerativeModel,
    OpenAIAudioTranscriptionModelId,
} from "../types";
import {
    mapFromOpenAIAudioTranscriptionResponse,
    mapFromOpenAIAudioTranscriptionStreamEvent,
    mapToOpenAIAudioTranscriptionRequest,
} from "./mappers";
import type { OpenAIAudioTranscriptionModels } from "./schemas";
import type {
    OpenAIAudioTranscriptionCaps,
    OpenAIAudioTranscriptionEndpointOptions,
} from "./types";

export const createOpenAIAudioTranscriptionModel = <M extends OpenAIAudioTranscriptionModelId>(
    modelId: M,
    client: ReturnType<typeof createOpenAIClient>,
): OpenAIAudioTranscriptionGenerativeModel<M> => {
    const doGenerate = (async <
        TModalities extends ModalitiesParam<OpenAIAudioTranscriptionCaps> = undefined,
    >(
        options: GenerativeModelCallOptions<
            OpenAIAudioTranscriptionCaps,
            OpenAIAudioTranscriptionEndpointOptions,
            TModalities
        >,
        ctx: RunContext,
    ) => {
        const requestBodyResult = mapToOpenAIAudioTranscriptionRequest({
            modelId: modelId as OpenAIAudioTranscriptionModels,
            options,
        });
        if (requestBodyResult.isErr()) {
            return err(
                requestBodyResult.error.at({
                    at: "openai.generate.mapRequest",
                    data: {
                        modelId,
                        endpoint: "audio.transcriptions",
                    },
                }),
            );
        }

        const requestBody = requestBodyResult.value;

        const raw = await client.audio.transcriptions(requestBody, {
            signal: ctx.signal ?? null,
        });
        if (raw.isErr()) {
            return err(
                raw.error
                    .at({ at: "openai.generate.modelContext", data: { model: String(modelId) } })
                    .at({
                        at: "openai.generate.http",
                        data: {
                            modelId,
                            endpoint: "audio.transcriptions",
                            path: "/v1/audio/transcriptions",
                        },
                    }),
            );
        }

        const response = mapFromOpenAIAudioTranscriptionResponse(raw.value);
        return ok({
            response: {
                ...response,
                request: {
                    body: requestBody,
                },
            } satisfies GenerativeModelResponse,
            events: collectNonStreamOutputEvents(response, ctx),
        });
    }) as NonNullable<OpenAIAudioTranscriptionGenerativeModel<M>["doGenerate"]>;

    const doGenerateStream = (async <
        const TModalities extends ModalitiesParam<OpenAIAudioTranscriptionCaps> = undefined,
    >(
        options: GenerativeModelCallOptions<
            OpenAIAudioTranscriptionCaps,
            OpenAIAudioTranscriptionEndpointOptions,
            TModalities
        >,
        ctx: RunContext,
    ) => {
        const requestBodyResult = mapToOpenAIAudioTranscriptionRequest({
            modelId: modelId as OpenAIAudioTranscriptionModels,
            options,
        });
        if (requestBodyResult.isErr()) {
            return err(
                requestBodyResult.error.at({
                    at: "openai.generateStream.mapRequest",
                    data: {
                        modelId,
                        endpoint: "audio.transcriptions",
                    },
                }),
            );
        }

        const requestBody = {
            ...requestBodyResult.value,
            stream: true,
        };

        const streamResult = await client.audio.transcriptionsStream(requestBody, {
            signal: ctx.signal ?? null,
        });
        if (streamResult.isErr()) {
            return err(
                streamResult.error
                    .at({ at: "openai.generate.modelContext", data: { model: String(modelId) } })
                    .at({
                        at: "openai.generateStream.http",
                        data: {
                            modelId,
                            endpoint: "audio.transcriptions",
                            path: "/v1/audio/transcriptions",
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
            const textParts: string[] = [];
            const segments: Array<{
                id: string;
                start: number;
                end: number;
                text: string;
                speaker?: string;
            }> = [];
            let finalLogprobs: unknown[] | undefined;
            let started = false;
            let sawFinal = false;
            let finalResolved = false;

            try {
                for await (const raw of streamResult.value) {
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

                    if (raw.value.type === "transcript.text.delta") {
                        textParts.push(raw.value.delta ?? "");
                        finalLogprobs = raw.value.logprobs ?? finalLogprobs;
                    }

                    if (raw.value.type === "transcript.text.segment") {
                        segments.push({
                            id: raw.value.id,
                            start: raw.value.start,
                            end: raw.value.end,
                            text: raw.value.text,
                            ...(raw.value.speaker !== undefined
                                ? { speaker: raw.value.speaker }
                                : {}),
                        });
                    }

                    if (raw.value.type === "transcript.text.done") {
                        finalLogprobs = raw.value.logprobs ?? finalLogprobs;
                    }

                    const text =
                        raw.value.type === "transcript.text.done"
                            ? (raw.value.text ?? textParts.join(""))
                            : "";

                    const mapped = mapFromOpenAIAudioTranscriptionStreamEvent(raw.value, {
                        messageId,
                        text,
                        ...(finalLogprobs !== undefined ? { logprobs: finalLogprobs } : {}),
                        segments,
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
                            type: Events.TRANSCRIPT_MESSAGE_START,
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
                        type: Events.TRANSCRIPT_MESSAGE_END,
                        messageId,
                        timestamp: Date.now(),
                    });
                    return;
                }

                if (!sawFinal) {
                    const missingFinal = openaiUpstreamError(
                        "Stream ended without transcript.text.done",
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
            } catch (e) {
                const appErr = BetterAgentError.wrap({
                    err: e,
                    message: "OpenAI audio transcription streaming failed",
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
    }) as NonNullable<OpenAIAudioTranscriptionGenerativeModel<M>["doGenerateStream"]>;

    return {
        providerId: "openai",
        modelId,
        caps: OPENAI_AUDIO_TRANSCRIPTION_CAPS,
        doGenerate,
        doGenerateStream,
    } as OpenAIAudioTranscriptionGenerativeModel<M>;
};
