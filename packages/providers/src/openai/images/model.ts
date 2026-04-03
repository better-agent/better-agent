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
    OPENAI_IMAGE_CAPS,
    collectNonStreamOutputEvents,
    createDeferred,
    openaiUpstreamError,
} from "../shared/runtime";
import type { OpenAICapsFor, OpenAIGenerativeModel, OpenAIOptionsFor } from "../types";
import {
    mapFromOpenAIImagesResponse,
    mapFromOpenAIImagesStreamEvent,
    mapToOpenAIImagesRequest,
} from "./mappers";
import type { OpenAIImageModels } from "./schemas";

export const createOpenAIImagesModel = <M extends OpenAIImageModels>(
    modelId: M,
    client: ReturnType<typeof createOpenAIClient>,
): OpenAIGenerativeModel<M> => {
    const doGenerate: NonNullable<OpenAIGenerativeModel<M>["doGenerate"]> = async <
        TModalities extends ModalitiesParam<OpenAICapsFor<M>> = undefined,
    >(
        options: GenerativeModelCallOptions<OpenAICapsFor<M>, OpenAIOptionsFor<M>, TModalities>,
        ctx: RunContext,
    ) => {
        const requestBodyResult = mapToOpenAIImagesRequest({ modelId, options });
        if (requestBodyResult.isErr()) {
            return err(
                requestBodyResult.error.at({
                    at: "openai.generate.mapRequest",
                    data: { modelId, endpoint: "images" },
                }),
            );
        }

        const request = requestBodyResult.value;
        const raw =
            request.mode === "edit"
                ? await client.images.edit(request.body, { signal: ctx.signal ?? null })
                : await client.images.create(request.body, { signal: ctx.signal ?? null });
        if (raw.isErr()) {
            return err(
                raw.error
                    .at({ at: "openai.generate.modelContext", data: { model: String(modelId) } })
                    .at({
                        at: "openai.generate.http",
                        data: {
                            modelId,
                            endpoint: "images",
                            path:
                                request.mode === "edit"
                                    ? "/v1/images/edits"
                                    : "/v1/images/generations",
                        },
                    }),
            );
        }

        const response = mapFromOpenAIImagesResponse(raw.value);
        return ok({
            response: {
                ...response,
                request: { body: request.body },
            } satisfies GenerativeModelResponse,
            events: collectNonStreamOutputEvents(response, ctx),
        });
    };

    const doGenerateStream: NonNullable<OpenAIGenerativeModel<M>["doGenerateStream"]> = async <
        const TModalities extends ModalitiesParam<OpenAICapsFor<M>> = undefined,
    >(
        options: GenerativeModelCallOptions<OpenAICapsFor<M>, OpenAIOptionsFor<M>, TModalities>,
        ctx: RunContext,
    ) => {
        const requestBodyResult = mapToOpenAIImagesRequest({ modelId, options });
        if (requestBodyResult.isErr()) {
            return err(
                requestBodyResult.error.at({
                    at: "openai.generateStream.mapRequest",
                    data: { modelId, endpoint: "images" },
                }),
            );
        }

        const request = requestBodyResult.value;
        const streamResult =
            request.mode === "edit"
                ? await client.images.streamEdit(request.body, { signal: ctx.signal ?? null })
                : await client.images.stream(request.body, { signal: ctx.signal ?? null });
        if (streamResult.isErr()) {
            return err(
                streamResult.error
                    .at({ at: "openai.generate.modelContext", data: { model: String(modelId) } })
                    .at({
                        at: "openai.generateStream.http",
                        data: {
                            modelId,
                            endpoint: "images",
                            path:
                                request.mode === "edit"
                                    ? "/v1/images/edits"
                                    : "/v1/images/generations",
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
            let started = false;
            let sawFinal = false;

            try {
                for await (const raw of streamResult.value) {
                    if (raw.isErr()) {
                        const appErr = BetterAgentError.wrap({
                            err: raw.error,
                            message: "OpenAI stream chunk error",
                            opts: { code: "UPSTREAM_FAILED" },
                        }).at({ at: "openai.generateStream.chunk" });
                        yield err(appErr);
                        rejectFinal(appErr);
                        return;
                    }

                    const mapped = mapFromOpenAIImagesStreamEvent(raw.value, messageId);
                    if (mapped.isErr()) {
                        const appErr = mapped.error.at({ at: "openai.generateStream.mapEvent" });
                        yield err(appErr);
                        rejectFinal(appErr);
                        return;
                    }

                    const m = mapped.value;
                    if (!m) continue;

                    if (!started) {
                        started = true;
                        yield ok({
                            type: Events.IMAGE_MESSAGE_START,
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
                    resolveFinal({ ...m.response, request: { body: request.body } });
                    yield ok({
                        type: Events.IMAGE_MESSAGE_END,
                        messageId,
                        timestamp: Date.now(),
                    });
                    return;
                }

                if (!sawFinal) {
                    const missingFinal = openaiUpstreamError(
                        "Stream ended without image_generation.completed",
                        { provider: "openai", code: "STREAM_MISSING_FINAL" },
                    ).at({ at: "openai.generateStream.missingFinal" });
                    yield err(missingFinal);
                    rejectFinal(missingFinal);
                    return;
                }
            } catch (e) {
                const appErr = BetterAgentError.wrap({
                    err: e,
                    message: "OpenAI image streaming failed",
                    opts: {
                        code: "UPSTREAM_FAILED",
                        context: { provider: "openai", model: String(modelId) },
                    },
                }).at({ at: "openai.generateStream.generator" });
                yield err(appErr);
                rejectFinal(appErr);
                return;
            }
        })();

        return ok({ events, final });
    };

    return {
        providerId: "openai",
        modelId,
        caps: OPENAI_IMAGE_CAPS as OpenAICapsFor<M>,
        doGenerate,
        doGenerateStream,
    };
};
