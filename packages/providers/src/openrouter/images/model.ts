import type { RunContext } from "@better-agent/core";
import { Events } from "@better-agent/core/events";
import type { Event } from "@better-agent/core/events";
import type {
    GenerativeModelCallOptions,
    GenerativeModelGenerateResult,
    GenerativeModelResponse,
} from "@better-agent/core/providers";
import { BetterAgentError } from "@better-agent/shared/errors";
import { type Result, err, ok } from "@better-agent/shared/neverthrow";
import type { createOpenRouterClient } from "../client/create-client";
import {
    mapFromOpenRouterImageChatCompletion,
    mapFromOpenRouterImageChatCompletionChunk,
    mapToOpenRouterImageChatCompletionsRequest,
} from "./mappers";
import type {
    OpenRouterImageCaps,
    OpenRouterImageEndpointOptions,
    OpenRouterImageGenerativeModel,
} from "./types";

export const OPENROUTER_IMAGE_CAPS = {
    inputModalities: { text: true, image: true },
    inputShape: "prompt",
    replayMode: "single_turn_persistent",
    supportsInstruction: false,
    outputModalities: {
        image: true,
    },
    additionalSupportedRoles: ["developer"],
} as const satisfies OpenRouterImageCaps;

export const createOpenRouterImagesModel = <M extends string>(
    modelId: M,
    client: ReturnType<typeof createOpenRouterClient>,
): OpenRouterImageGenerativeModel<M> => {
    const createDeferred = <T>() => {
        let resolve!: (value: T | PromiseLike<T>) => void;
        let reject!: (reason?: unknown) => void;
        const promise = new Promise<T>((res, rej) => {
            resolve = res;
            reject = rej;
        });
        return { promise, resolve, reject };
    };

    const doGenerate: NonNullable<OpenRouterImageGenerativeModel<M>["doGenerate"]> = async (
        options,
        ctx,
    ) => {
        const requestBodyResult = mapToOpenRouterImageChatCompletionsRequest({
            modelId,
            options: options as GenerativeModelCallOptions<OpenRouterImageCaps, OpenRouterImageEndpointOptions>,
        });
        if (requestBodyResult.isErr()) {
            return err(requestBodyResult.error.at({ at: "openrouter.images.generate.mapRequest" }));
        }

        const raw = await client.chat.create(requestBodyResult.value, {
            signal: ctx.signal ?? null,
        });
        if (raw.isErr()) {
            return err(raw.error.at({ at: "openrouter.images.generate.http" }));
        }

        const response = mapFromOpenRouterImageChatCompletion(raw.value);
        return ok({
            response: {
                ...response,
                request: {
                    body: requestBodyResult.value,
                },
            } satisfies GenerativeModelResponse,
        } satisfies GenerativeModelGenerateResult<OpenRouterImageCaps>);
    };

    const doGenerateStream: NonNullable<OpenRouterImageGenerativeModel<M>["doGenerateStream"]> =
        async (options, ctx: RunContext) => {
            const requestBodyResult = mapToOpenRouterImageChatCompletionsRequest({
                modelId,
                options: options as GenerativeModelCallOptions<
                    OpenRouterImageCaps,
                    OpenRouterImageEndpointOptions
                >,
            });
            if (requestBodyResult.isErr()) {
                return err(
                    requestBodyResult.error.at({ at: "openrouter.images.generateStream.mapRequest" }),
                );
            }

            const requestBody = {
                ...requestBodyResult.value,
                stream: true,
            };
            const streamResult = await client.chat.stream(requestBody, {
                signal: ctx.signal ?? null,
            });
            if (streamResult.isErr()) {
                return err(streamResult.error.at({ at: "openrouter.images.generateStream.http" }));
            }

            const { promise: final, resolve: resolveFinal, reject: rejectFinal } =
                createDeferred<GenerativeModelResponse>();

            const events = (async function* (): AsyncGenerator<
                Result<Event, BetterAgentError>
            > {
                const messageId = ctx.generateMessageId();
                let started = false;
                let finished = false;
                let streamedImageUrl: string | undefined;

                try {
                    for await (const raw of streamResult.value) {
                        if (raw.isErr()) {
                            rejectFinal(raw.error);
                            yield err(raw.error);
                            return;
                        }

                        const mapped = mapFromOpenRouterImageChatCompletionChunk(raw.value, messageId);
                        if (mapped.isErr()) {
                            const error = mapped.error.at({
                                at: "openrouter.images.generateStream.mapEvent",
                            });
                            rejectFinal(error);
                            yield err(error);
                            return;
                        }

                        if (!mapped.value) continue;

                        if (!started) {
                            started = true;
                            yield ok({
                                type: Events.IMAGE_MESSAGE_START,
                                messageId,
                                role: "assistant",
                                timestamp: Date.now(),
                            });
                        }

                        if (mapped.value.kind === "final") {
                            finished = true;
                            const finalResponse =
                                mapped.value.response.output.length > 0 || !streamedImageUrl
                                    ? mapped.value.response
                                    : {
                                          ...mapped.value.response,
                                          output: [
                                              {
                                                  type: "message" as const,
                                                  role: "assistant" as const,
                                                  content: [
                                                      {
                                                          type: "image" as const,
                                                          source: {
                                                              kind: "url" as const,
                                                              url: streamedImageUrl,
                                                          },
                                                      },
                                                  ],
                                              },
                                          ],
                                      };
                            yield ok({
                                type: Events.IMAGE_MESSAGE_END,
                                messageId,
                                timestamp: Date.now(),
                            });
                            resolveFinal({
                                ...finalResponse,
                                request: { body: requestBody },
                            });
                            return;
                        }

                        if (
                            mapped.value.event.type === Events.IMAGE_MESSAGE_CONTENT &&
                            mapped.value.event.delta.kind === "url"
                        ) {
                            streamedImageUrl = mapped.value.event.delta.url;
                        }

                        yield ok(mapped.value.event);
                    }
                } finally {
                    if (!finished) {
                        rejectFinal(
                            BetterAgentError.fromCode(
                                "UPSTREAM_FAILED",
                                "OpenRouter image stream ended without a final response event.",
                                {
                                    context: {
                                        provider: "openrouter",
                                        model: String(modelId),
                                    },
                                },
                            ).at({ at: "openrouter.images.generateStream.final" }),
                        );
                    }
                }
            })();

            return ok({ events, final });
        };

    return {
        providerId: "openrouter",
        modelId,
        caps: OPENROUTER_IMAGE_CAPS,
        doGenerate,
        doGenerateStream,
    };
};
