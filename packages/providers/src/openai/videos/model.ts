import type { RunContext } from "@better-agent/core";
import { Events } from "@better-agent/core/events";
import type { Event } from "@better-agent/core/events";
import type {
    GenerativeModelCallOptions,
    GenerativeModelOutputItem,
    GenerativeModelResponse,
    ModalitiesParam,
} from "@better-agent/core/providers";
import { BetterAgentError } from "@better-agent/shared/errors";
import { type Result, err, ok } from "@better-agent/shared/neverthrow";
import type { createOpenAIClient } from "../client";
import {
    OPENAI_VIDEO_CAPS,
    collectNonStreamOutputEvents,
    createDeferred,
    openaiUpstreamError,
} from "../shared/runtime";
import type { OpenAICapsFor, OpenAIGenerativeModel, OpenAIOptionsFor } from "../types";
import { mapFromOpenAIVideosResponse, mapToOpenAIVideosRequest } from "./mappers";
import type { OpenAIVideoModels } from "./schemas";

export const createOpenAIVideoModel = <M extends OpenAIVideoModels>(
    modelId: M,
    client: ReturnType<typeof createOpenAIClient>,
): OpenAIGenerativeModel<M> => {
    const resolveVideoId = (value: unknown): string | undefined => {
        if (!value || typeof value !== "object") return undefined;
        const obj = value as Record<string, unknown>;
        const candidate = obj.id;
        return typeof candidate === "string" && candidate.length > 0 ? candidate : undefined;
    };

    const doGenerate: NonNullable<OpenAIGenerativeModel<M>["doGenerate"]> = async <
        TModalities extends ModalitiesParam<OpenAICapsFor<M>> = undefined,
    >(
        options: GenerativeModelCallOptions<OpenAICapsFor<M>, OpenAIOptionsFor<M>, TModalities>,
        ctx: RunContext,
    ) => {
        const requestBodyResult = mapToOpenAIVideosRequest({ modelId, options });
        if (requestBodyResult.isErr()) {
            return err(
                requestBodyResult.error.at({
                    at: "openai.generate.mapRequest",
                    data: { modelId, endpoint: "videos" },
                }),
            );
        }

        const requestBody = requestBodyResult.value;
        const pollIntervalMs = Math.max(250, options.pollIntervalMs ?? 2000);
        const pollTimeoutMs = Math.max(5000, options.pollTimeoutMs ?? 10 * 60 * 1000);
        const startedAt = Date.now();

        const sleep = async (ms: number): Promise<void> => {
            await new Promise<void>((resolve, reject) => {
                const timer = setTimeout(() => {
                    ctx.signal?.removeEventListener("abort", onAbort);
                    resolve();
                }, ms);

                const onAbort = () => {
                    clearTimeout(timer);
                    ctx.signal?.removeEventListener("abort", onAbort);
                    reject(
                        openaiUpstreamError("OpenAI video generation aborted", {
                            provider: "openai",
                            model: String(modelId),
                            code: "ABORTED",
                        }).at({ at: "openai.videos.poll.sleep.aborted" }),
                    );
                };

                if (ctx.signal) {
                    if (ctx.signal.aborted) {
                        onAbort();
                        return;
                    }
                    ctx.signal.addEventListener("abort", onAbort, { once: true });
                }
            });
        };

        const created = await client.videos.create(requestBody, { signal: ctx.signal ?? null });
        if (created.isErr()) {
            return err(
                created.error
                    .at({ at: "openai.generate.modelContext", data: { model: String(modelId) } })
                    .at({
                        at: "openai.generate.http",
                        data: { modelId, endpoint: "videos", path: "/v1/videos" },
                    }),
            );
        }

        let latest = created.value;
        const initialVideoId = resolveVideoId(latest);
        if (!initialVideoId) {
            return err(
                openaiUpstreamError("OpenAI video response missing id", {
                    provider: "openai",
                    model: String(modelId),
                    code: "VIDEO_ID_MISSING",
                    raw: latest,
                }).at({ at: "openai.videos.create.missingId" }),
            );
        }
        let videoId = initialVideoId;

        while (latest.status === "queued" || latest.status === "in_progress") {
            if (ctx.signal?.aborted) {
                return err(
                    openaiUpstreamError("OpenAI video generation aborted", {
                        provider: "openai",
                        model: String(modelId),
                        code: "ABORTED",
                    }).at({ at: "openai.videos.poll.aborted", data: { videoId } }),
                );
            }

            if (Date.now() - startedAt > pollTimeoutMs) {
                return err(
                    openaiUpstreamError("OpenAI video generation timed out", {
                        provider: "openai",
                        model: String(modelId),
                        code: "VIDEO_POLL_TIMEOUT",
                    }).at({
                        at: "openai.videos.poll.timeout",
                        data: { videoId, timeoutMs: pollTimeoutMs, lastStatus: latest.status },
                    }),
                );
            }

            try {
                await sleep(pollIntervalMs);
            } catch (e) {
                return err(
                    BetterAgentError.wrap({
                        err: e,
                        message: "OpenAI video generation aborted",
                        opts: {
                            code: "ABORTED",
                            context: { provider: "openai", model: String(modelId) },
                        },
                    }).at({ at: "openai.videos.poll.sleep", data: { videoId } }),
                );
            }

            const status = await client.videos.get(videoId, { signal: ctx.signal ?? null });
            if (status.isErr()) {
                return err(
                    status.error
                        .at({
                            at: "openai.generate.modelContext",
                            data: { model: String(modelId) },
                        })
                        .at({
                            at: "openai.generate.http",
                            data: { modelId, endpoint: "videos", path: `/v1/videos/${videoId}` },
                        }),
                );
            }
            latest = status.value;
            videoId = resolveVideoId(latest) ?? videoId;
        }

        if (latest.status === "failed") {
            return err(
                openaiUpstreamError(latest.error?.message ?? "OpenAI video generation failed", {
                    provider: "openai",
                    model: String(modelId),
                    code: latest.error?.code ?? "VIDEO_GENERATION_FAILED",
                    raw: latest,
                }).at({ at: "openai.videos.poll.failed", data: { videoId } }),
            );
        }

        const videoData = await client.videos.content(videoId, { signal: ctx.signal ?? null });
        if (videoData.isErr()) {
            return err(
                videoData.error
                    .at({ at: "openai.generate.modelContext", data: { model: String(modelId) } })
                    .at({
                        at: "openai.generate.http",
                        data: {
                            modelId,
                            endpoint: "videos",
                            path: `/v1/videos/${videoId}/content`,
                        },
                    }),
            );
        }

        const response = mapFromOpenAIVideosResponse({
            raw: latest,
            video: {
                data: Buffer.from(videoData.value.data).toString("base64"),
                mimeType: videoData.value.mimeType,
            },
        });
        return ok({
            response: {
                ...response,
                request: { body: requestBody },
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
        const requestBodyResult = mapToOpenAIVideosRequest({ modelId, options });
        if (requestBodyResult.isErr()) {
            return err(
                requestBodyResult.error.at({
                    at: "openai.generateStream.mapRequest",
                    data: { modelId, endpoint: "videos" },
                }),
            );
        }

        const requestBody = requestBodyResult.value;
        const pollIntervalMs = Math.max(250, options.pollIntervalMs ?? 2000);
        const pollTimeoutMs = Math.max(5000, options.pollTimeoutMs ?? 10 * 60 * 1000);

        const sleep = async (ms: number): Promise<void> => {
            await new Promise<void>((resolve, reject) => {
                const timer = setTimeout(() => {
                    ctx.signal?.removeEventListener("abort", onAbort);
                    resolve();
                }, ms);

                const onAbort = () => {
                    clearTimeout(timer);
                    ctx.signal?.removeEventListener("abort", onAbort);
                    reject(
                        openaiUpstreamError("OpenAI video generation aborted", {
                            provider: "openai",
                            model: String(modelId),
                            code: "ABORTED",
                        }).at({ at: "openai.videos.poll.sleep.aborted" }),
                    );
                };

                if (ctx.signal) {
                    if (ctx.signal.aborted) {
                        onAbort();
                        return;
                    }
                    ctx.signal.addEventListener("abort", onAbort, { once: true });
                }
            });
        };

        const {
            promise: final,
            resolve: resolveFinal,
            reject: rejectFinal,
        } = createDeferred<GenerativeModelResponse>();

        const events = (async function* (): AsyncGenerator<Result<Event, BetterAgentError>> {
            const startedAt = Date.now();
            const messageId = ctx.generateMessageId();
            let finalResolved = false;
            let started = false;

            try {
                const created = await client.videos.create(requestBody, {
                    signal: ctx.signal ?? null,
                });
                if (created.isErr()) {
                    const appErr = created.error
                        .at({
                            at: "openai.generate.modelContext",
                            data: { model: String(modelId) },
                        })
                        .at({
                            at: "openai.generateStream.http",
                            data: { modelId, endpoint: "videos", path: "/v1/videos" },
                        });
                    yield err(appErr);
                    rejectFinal(appErr);
                    return;
                }

                let latest = created.value;
                const initialVideoId = resolveVideoId(latest);
                if (!initialVideoId) {
                    const appErr = openaiUpstreamError("OpenAI video response missing id", {
                        provider: "openai",
                        model: String(modelId),
                        code: "VIDEO_ID_MISSING",
                        raw: latest,
                    }).at({ at: "openai.videos.create.missingId" });
                    yield err(appErr);
                    rejectFinal(appErr);
                    return;
                }
                let videoId = initialVideoId;

                yield ok({
                    type: Events.DATA_PART,
                    id: videoId,
                    data: {
                        endpoint: "videos",
                        status: latest.status,
                        raw: latest,
                    },
                    timestamp: Date.now(),
                });

                while (latest.status === "queued" || latest.status === "in_progress") {
                    if (ctx.signal?.aborted) {
                        const appErr = openaiUpstreamError("OpenAI video generation aborted", {
                            provider: "openai",
                            model: String(modelId),
                            code: "ABORTED",
                        }).at({ at: "openai.videos.poll.aborted", data: { videoId } });
                        yield err(appErr);
                        rejectFinal(appErr);
                        return;
                    }

                    if (Date.now() - startedAt > pollTimeoutMs) {
                        const appErr = openaiUpstreamError("OpenAI video generation timed out", {
                            provider: "openai",
                            model: String(modelId),
                            code: "VIDEO_POLL_TIMEOUT",
                        }).at({
                            at: "openai.videos.poll.timeout",
                            data: { videoId, timeoutMs: pollTimeoutMs, lastStatus: latest.status },
                        });
                        yield err(appErr);
                        rejectFinal(appErr);
                        return;
                    }

                    try {
                        await sleep(pollIntervalMs);
                    } catch (e) {
                        const appErr = BetterAgentError.wrap({
                            err: e,
                            message: "OpenAI video generation aborted",
                            opts: {
                                code: "ABORTED",
                                context: { provider: "openai", model: String(modelId) },
                            },
                        }).at({ at: "openai.videos.poll.sleep", data: { videoId } });
                        yield err(appErr);
                        rejectFinal(appErr);
                        return;
                    }

                    const status = await client.videos.get(videoId, { signal: ctx.signal ?? null });
                    if (status.isErr()) {
                        const appErr = status.error
                            .at({
                                at: "openai.generate.modelContext",
                                data: { model: String(modelId) },
                            })
                            .at({
                                at: "openai.generateStream.http",
                                data: {
                                    modelId,
                                    endpoint: "videos",
                                    path: `/v1/videos/${videoId}`,
                                },
                            });
                        yield err(appErr);
                        rejectFinal(appErr);
                        return;
                    }

                    latest = status.value;
                    videoId = resolveVideoId(latest) ?? videoId;

                    yield ok({
                        type: Events.DATA_PART,
                        id: videoId,
                        data: {
                            endpoint: "videos",
                            status: latest.status,
                            raw: latest,
                        },
                        timestamp: Date.now(),
                    });
                }

                if (latest.status === "failed") {
                    const appErr = openaiUpstreamError(
                        latest.error?.message ?? "OpenAI video generation failed",
                        {
                            provider: "openai",
                            model: String(modelId),
                            code: latest.error?.code ?? "VIDEO_GENERATION_FAILED",
                            raw: latest,
                        },
                    ).at({ at: "openai.videos.poll.failed", data: { videoId } });
                    yield err(appErr);
                    rejectFinal(appErr);
                    return;
                }

                const videoData = await client.videos.content(videoId, {
                    signal: ctx.signal ?? null,
                });
                if (videoData.isErr()) {
                    const appErr = videoData.error
                        .at({
                            at: "openai.generate.modelContext",
                            data: { model: String(modelId) },
                        })
                        .at({
                            at: "openai.generateStream.http",
                            data: {
                                modelId,
                                endpoint: "videos",
                                path: `/v1/videos/${videoId}/content`,
                            },
                        });
                    yield err(appErr);
                    rejectFinal(appErr);
                    return;
                }

                const response = mapFromOpenAIVideosResponse({
                    raw: latest,
                    video: {
                        data: Buffer.from(videoData.value.data).toString("base64"),
                        mimeType: videoData.value.mimeType,
                    },
                });

                const message = response.output.find(
                    (item): item is Extract<GenerativeModelOutputItem, { type: "message" }> =>
                        item.type === "message",
                );
                const videoPart =
                    message && Array.isArray(message.content)
                        ? message.content.find((part) => part.type === "video")
                        : undefined;

                if (videoPart && videoPart.type === "video") {
                    if (!started) {
                        started = true;
                        yield ok({
                            type: Events.VIDEO_MESSAGE_START,
                            messageId,
                            role: "assistant",
                            timestamp: Date.now(),
                        });
                    }

                    yield ok({
                        type: Events.VIDEO_MESSAGE_CONTENT,
                        messageId,
                        delta:
                            videoPart.source.kind === "url"
                                ? { kind: "url", url: videoPart.source.url }
                                : {
                                      kind: "base64",
                                      data: videoPart.source.data,
                                      mimeType: videoPart.source.mimeType,
                                  },
                        timestamp: Date.now(),
                    });

                    yield ok({
                        type: Events.VIDEO_MESSAGE_END,
                        messageId,
                        timestamp: Date.now(),
                    });
                }

                resolveFinal({ ...response, request: { body: requestBody } });
                finalResolved = true;
                return;
            } catch (e) {
                const appErr = BetterAgentError.wrap({
                    err: e,
                    message: "OpenAI video streaming failed",
                    opts: {
                        code: "UPSTREAM_FAILED",
                        context: { provider: "openai", model: String(modelId) },
                    },
                }).at({ at: "openai.generateStream.generator" });

                if (!finalResolved) rejectFinal(appErr);
                yield err(appErr);
                return;
            }
        })();

        return ok({ events, final });
    };

    return {
        providerId: "openai",
        modelId,
        caps: OPENAI_VIDEO_CAPS as OpenAICapsFor<M>,
        doGenerate,
        doGenerateStream,
    };
};
