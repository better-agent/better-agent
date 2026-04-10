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
import type { createOpenRouterClient } from "../client/create-client";
import type { OpenRouterResponseGenerativeModel, OpenRouterResponseModelId } from "../types";
import {
    createOpenRouterStreamState,
    mapFromOpenRouterChatCompletion,
    mapFromOpenRouterChatCompletionChunk,
    mapToOpenRouterChatCompletionsRequest,
} from "./mappers";
import type { OpenRouterResponseCaps, OpenRouterResponseEndpointOptions } from "./types";

export const OPENROUTER_RESPONSE_CAPS = {
    inputModalities: { text: true, image: true, file: true },
    inputShape: "chat",
    replayMode: "multi_turn",
    supportsInstruction: true,
    outputModalities: {
        text: {
            options: {},
        },
        image: true,
    },
    tools: true,
    structured_output: true,
    additionalSupportedRoles: ["developer"],
} as const satisfies OpenRouterResponseCaps;

const createDeferred = <T>() => {
    let resolve!: (value: T | PromiseLike<T>) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
};

export const createOpenRouterResponsesModel = <M extends OpenRouterResponseModelId>(
    modelId: M,
    client: ReturnType<typeof createOpenRouterClient>,
): OpenRouterResponseGenerativeModel<M> => {
    const doGenerate: NonNullable<OpenRouterResponseGenerativeModel<M>["doGenerate"]> = async <
        const TModalities extends ModalitiesParam<OpenRouterResponseCaps>,
    >(
        options: GenerativeModelCallOptions<OpenRouterResponseCaps, OpenRouterResponseEndpointOptions, TModalities>,
        ctx: RunContext,
    ) => {
        const requestBodyResult = mapToOpenRouterChatCompletionsRequest({ modelId, options });
        if (requestBodyResult.isErr()) {
            return err(requestBodyResult.error.at({ at: "openrouter.generate.mapRequest" }));
        }

        const raw = await client.chat.create(requestBodyResult.value, {
            signal: ctx.signal ?? null,
        });
        if (raw.isErr()) {
            return err(raw.error.at({ at: "openrouter.generate.http" }));
        }

        const response = mapFromOpenRouterChatCompletion(raw.value);
        return ok({
            response: {
                ...response,
                request: {
                    body: requestBodyResult.value,
                },
            } satisfies GenerativeModelResponse<OpenRouterResponseCaps>,
        });
    };

    const doGenerateStream: NonNullable<OpenRouterResponseGenerativeModel<M>["doGenerateStream"]> = async <
        const TModalities extends ModalitiesParam<OpenRouterResponseCaps>,
    >(
        options: GenerativeModelCallOptions<OpenRouterResponseCaps, OpenRouterResponseEndpointOptions, TModalities>,
        ctx: RunContext,
    ) => {
        const requestBodyResult = mapToOpenRouterChatCompletionsRequest({ modelId, options });
        if (requestBodyResult.isErr()) {
            return err(requestBodyResult.error.at({ at: "openrouter.generateStream.mapRequest" }));
        }

        const streamResult = await client.chat.stream(requestBodyResult.value, {
            signal: ctx.signal ?? null,
        });
        if (streamResult.isErr()) {
            return err(streamResult.error.at({ at: "openrouter.generateStream.http" }));
        }

        const { promise: final, resolve: resolveFinal, reject: rejectFinal } =
            createDeferred<GenerativeModelResponse<OpenRouterResponseCaps>>();

        const events = (async function* (): AsyncGenerator<Result<Event, BetterAgentError>> {
            const messageId = ctx.generateMessageId();
            const state = createOpenRouterStreamState();
            let started = false;
            let finished = false;

            try {
                for await (const raw of streamResult.value) {
                    if (raw.isErr()) {
                        rejectFinal(raw.error);
                        yield err(raw.error);
                        return;
                    }

                    const mapped = mapFromOpenRouterChatCompletionChunk(raw.value, state);
                    if (mapped.isErr()) {
                        const error = mapped.error.at({ at: "openrouter.generateStream.mapEvent" });
                        rejectFinal(error);
                        yield err(error);
                        return;
                    }

                    if (!mapped.value) continue;

                    if (!started) {
                        started = true;
                        yield ok({
                            type: Events.TEXT_MESSAGE_START,
                            messageId,
                            role: "assistant",
                            timestamp: Date.now(),
                        });
                    }

                    if (mapped.value.kind === "final") {
                        finished = true;
                        if (state.text.length > 0) {
                            yield ok({
                                type: Events.TEXT_MESSAGE_END,
                                messageId,
                                timestamp: Date.now(),
                            });
                        }
                        resolveFinal({
                            ...mapped.value.response,
                            request: { body: requestBodyResult.value },
                        });
                        return;
                    }

                    yield ok({
                        type: Events.TEXT_MESSAGE_CONTENT,
                        messageId,
                        delta: mapped.value.delta,
                        timestamp: Date.now(),
                    });
                }
            } finally {
                if (!finished) {
                    rejectFinal(
                        BetterAgentError.fromCode(
                            "UPSTREAM_FAILED",
                            "OpenRouter stream ended without a final response event.",
                            {
                                context: {
                                    provider: "openrouter",
                                    model: String(modelId),
                                },
                            },
                        ).at({ at: "openrouter.generateStream.final" }),
                    );
                }
            }
        })();

        return ok({ events, final });
    };

    return {
        providerId: "openrouter",
        modelId,
        caps: OPENROUTER_RESPONSE_CAPS,
        doGenerate,
        doGenerateStream,
    };
};
