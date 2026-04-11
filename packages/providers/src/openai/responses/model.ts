import type { RunContext } from "@better-agent/core";
import type { Event } from "@better-agent/core/events";
import type {
    GenerativeModelCallOptions,
    GenerativeModelGenerateResult,
    GenerativeModelResponse,
    ModalitiesParam,
} from "@better-agent/core/providers";
import { BetterAgentError } from "@better-agent/shared/errors";
import type { Result } from "@better-agent/shared/neverthrow";
import { err, ok } from "@better-agent/shared/neverthrow";

import type { createAnthropicClient } from "../client/create-client";
import {
    createAnthropicStreamState,
    mapFromAnthropicMessagesResponse,
    mapFromAnthropicStreamEvent,
    mapToAnthropicMessagesRequest,
} from "./mappers";
import type { AnthropicResponseStreamEvent } from "./schemas";
import type {
    AnthropicResponseCaps,
    AnthropicResponseEndpointOptions,
    AnthropicResponseGenerativeModel,
    AnthropicResponseModelId,
} from "./types";

export const ANTHROPIC_RESPONSE_CAPS = {
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
} as const satisfies AnthropicResponseCaps;

const createDeferred = <T>() => {
    let resolve!: (value: T | PromiseLike<T>) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
};

export const createAnthropicResponsesModel = <M extends AnthropicResponseModelId>(
    modelId: M,
    client: ReturnType<typeof createAnthropicClient>,
): AnthropicResponseGenerativeModel<M> => {
    const doGenerate: NonNullable<AnthropicResponseGenerativeModel<M>["doGenerate"]> = async <
        const TModalities extends ModalitiesParam<AnthropicResponseCaps>,
    >(
        options: GenerativeModelCallOptions<
            AnthropicResponseCaps,
            AnthropicResponseEndpointOptions,
            TModalities
        >,
        ctx: RunContext,
    ) => {
        const mappedRequest = mapToAnthropicMessagesRequest({
            modelId,
            options,
            stream: false,
        });
        if (mappedRequest.isErr()) {
            return err(mappedRequest.error.at({ at: "anthropic.generate.mapRequest" }));
        }

        const raw = await client.messages.create(mappedRequest.value.request, {
            signal: ctx.signal ?? null,
            beta: mappedRequest.value.betas,
        });
        if (raw.isErr()) {
            return err(raw.error.at({ at: "anthropic.generate.http" }));
        }

        const response = mapFromAnthropicMessagesResponse({
            response: raw.value,
            usesJsonResponseTool: mappedRequest.value.usesJsonResponseTool,
        });

        return ok({
            response: {
                ...response,
                request: {
                    body: mappedRequest.value.request,
                },
            } satisfies GenerativeModelResponse,
        } satisfies GenerativeModelGenerateResult<AnthropicResponseCaps>);
    };

    const doGenerateStream: NonNullable<
        AnthropicResponseGenerativeModel<M>["doGenerateStream"]
    > = async <const TModalities extends ModalitiesParam<AnthropicResponseCaps>>(
        options: GenerativeModelCallOptions<
            AnthropicResponseCaps,
            AnthropicResponseEndpointOptions,
            TModalities
        >,
        ctx: RunContext,
    ) => {
        const mappedRequest = mapToAnthropicMessagesRequest({
            modelId,
            options,
            stream: true,
        });
        if (mappedRequest.isErr()) {
            return err(mappedRequest.error.at({ at: "anthropic.generateStream.mapRequest" }));
        }

        const streamResult = await client.messages.stream(
            {
                ...mappedRequest.value.request,
                stream: true,
            },
            {
                signal: ctx.signal ?? null,
                beta: mappedRequest.value.betas,
            },
        );
        if (streamResult.isErr()) {
            return err(streamResult.error.at({ at: "anthropic.generateStream.http" }));
        }

        const {
            promise: final,
            resolve: resolveFinal,
            reject: rejectFinal,
        } = createDeferred<GenerativeModelResponse>();

        const events = (async function* (): AsyncGenerator<Result<Event, BetterAgentError>> {
            const responseMessageId = ctx.generateMessageId();
            const state = createAnthropicStreamState(
                responseMessageId,
                mappedRequest.value.usesJsonResponseTool,
            );
            let sawFinal = false;

            try {
                for await (const raw of streamResult.value) {
                    if (raw.isErr()) {
                        rejectFinal(raw.error);
                        yield err(raw.error);
                        return;
                    }

                    const mapped = mapFromAnthropicStreamEvent(
                        raw.value as AnthropicResponseStreamEvent,
                        state,
                    );
                    if (mapped.isErr()) {
                        const error = mapped.error.at({ at: "anthropic.generateStream.mapEvent" });
                        rejectFinal(error);
                        yield err(error);
                        return;
                    }

                    if (!mapped.value) continue;

                    if (mapped.value.kind === "final") {
                        sawFinal = true;
                        resolveFinal({
                            ...mapped.value.response,
                            request: {
                                body: mappedRequest.value.request,
                            },
                        });
                        continue;
                    }

                    yield ok(mapped.value.event);
                }
            } finally {
                if (!sawFinal) {
                    rejectFinal(
                        BetterAgentError.fromCode(
                            "UPSTREAM_FAILED",
                            "Anthropic stream ended without a final response event.",
                            {
                                context: {
                                    provider: "anthropic",
                                    model: String(modelId),
                                },
                            },
                        ).at({
                            at: "anthropic.generateStream.final",
                        }),
                    );
                }
            }
        })();

        return ok({ events, final });
    };

    return {
        providerId: "anthropic",
        modelId,
        caps: ANTHROPIC_RESPONSE_CAPS,
        doGenerate,
        doGenerateStream,
    };
};
