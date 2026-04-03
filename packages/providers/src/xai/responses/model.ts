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

import type { createXAIClient } from "../client/create-client";
import type { XAIResponseStreamEvent } from "../shared/schemas";
import {
    mapFromXAIResponsesResponse,
    mapFromXAIResponsesStreamEvent,
    mapToXAIResponsesRequest,
} from "./mappers";
import type {
    XAIResponseCaps,
    XAIResponseEndpointOptions,
    XAIResponseGenerativeModel,
    XAIResponseModelId,
} from "./types";

export const XAI_RESPONSE_CAPS = {
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
} as const satisfies XAIResponseCaps;

const createDeferred = <T>() => {
    let resolve!: (value: T | PromiseLike<T>) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
};

export const createXAIResponsesModel = <M extends XAIResponseModelId>(
    modelId: M,
    client: ReturnType<typeof createXAIClient>,
): XAIResponseGenerativeModel<M> => {
    const doGenerate: NonNullable<XAIResponseGenerativeModel<M>["doGenerate"]> = async <
        const TModalities extends ModalitiesParam<XAIResponseCaps>,
    >(
        options: GenerativeModelCallOptions<
            XAIResponseCaps,
            XAIResponseEndpointOptions,
            TModalities
        >,
        ctx: RunContext,
    ) => {
        const requestBodyResult = mapToXAIResponsesRequest({
            modelId,
            options,
        });
        if (requestBodyResult.isErr()) {
            return err(requestBodyResult.error.at({ at: "xai.generate.mapRequest" }));
        }

        const raw = await client.responses.create(requestBodyResult.value, {
            signal: ctx.signal ?? null,
        });
        if (raw.isErr()) {
            return err(raw.error.at({ at: "xai.generate.http" }));
        }

        const response = mapFromXAIResponsesResponse(raw.value);
        return ok({
            response: {
                ...response,
                request: {
                    body: requestBodyResult.value,
                },
            } satisfies GenerativeModelResponse,
        } satisfies GenerativeModelGenerateResult<XAIResponseCaps>);
    };

    const doGenerateStream: NonNullable<XAIResponseGenerativeModel<M>["doGenerateStream"]> = async <
        const TModalities extends ModalitiesParam<XAIResponseCaps>,
    >(
        options: GenerativeModelCallOptions<
            XAIResponseCaps,
            XAIResponseEndpointOptions,
            TModalities
        >,
        ctx: RunContext,
    ) => {
        const requestBodyResult = mapToXAIResponsesRequest({
            modelId,
            options,
        });
        if (requestBodyResult.isErr()) {
            return err(requestBodyResult.error.at({ at: "xai.generateStream.mapRequest" }));
        }

        const streamResult = await client.responses.stream(requestBodyResult.value, {
            signal: ctx.signal ?? null,
        });
        if (streamResult.isErr()) {
            return err(streamResult.error.at({ at: "xai.generateStream.http" }));
        }

        const {
            promise: final,
            resolve: resolveFinal,
            reject: rejectFinal,
        } = createDeferred<GenerativeModelResponse>();

        const events = (async function* (): AsyncGenerator<Result<Event, BetterAgentError>> {
            const messageId = ctx.generateMessageId();
            let sawFinal = false;

            try {
                for await (const raw of streamResult.value) {
                    if (raw.isErr()) {
                        rejectFinal(raw.error);
                        yield err(raw.error);
                        return;
                    }

                    const mapped = mapFromXAIResponsesStreamEvent(
                        raw.value as XAIResponseStreamEvent,
                        messageId,
                    );
                    if (mapped.isErr()) {
                        const error = mapped.error.at({ at: "xai.generateStream.mapEvent" });
                        rejectFinal(error);
                        yield err(error);
                        return;
                    }

                    const value = mapped.value;
                    if (!value) continue;

                    if (value.kind === "final") {
                        sawFinal = true;
                        resolveFinal(value.response);
                        continue;
                    }

                    yield ok(value.event);
                }
            } finally {
                if (!sawFinal) {
                    rejectFinal(
                        BetterAgentError.fromCode(
                            "UPSTREAM_FAILED",
                            "xAI stream ended without a final response event.",
                            {
                                context: {
                                    provider: "xai",
                                    model: String(modelId),
                                },
                            },
                        ).at({
                            at: "xai.generateStream.final",
                        }),
                    );
                }
            }
        })();

        return ok({ events, final });
    };

    return {
        providerId: "xai",
        modelId,
        caps: XAI_RESPONSE_CAPS,
        doGenerate,
        doGenerateStream,
    };
};
