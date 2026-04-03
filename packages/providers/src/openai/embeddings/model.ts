import type { RunContext } from "@better-agent/core";
import type {
    GenerativeModelCallOptions,
    GenerativeModelResponse,
    ModalitiesParam,
} from "@better-agent/core/providers";
import { err, ok } from "@better-agent/shared/neverthrow";
import type { createOpenAIClient } from "../client";
import { OPENAI_EMBEDDING_CAPS, collectNonStreamOutputEvents } from "../shared/runtime";
import type { OpenAICapsFor, OpenAIGenerativeModel, OpenAIOptionsFor } from "../types";
import { mapFromOpenAIEmbeddingResponse, mapToOpenAIEmbeddingRequest } from "./mappers";
import type { OpenAIEmbeddingModels } from "./schemas";

export const createOpenAIEmbeddingModel = <M extends OpenAIEmbeddingModels>(
    modelId: M,
    client: ReturnType<typeof createOpenAIClient>,
): OpenAIGenerativeModel<M> => {
    const doGenerate: NonNullable<OpenAIGenerativeModel<M>["doGenerate"]> = async <
        TModalities extends ModalitiesParam<OpenAICapsFor<M>> = undefined,
    >(
        options: GenerativeModelCallOptions<OpenAICapsFor<M>, OpenAIOptionsFor<M>, TModalities>,
        ctx: RunContext,
    ) => {
        const requestBodyResult = mapToOpenAIEmbeddingRequest({
            modelId,
            options,
        });
        if (requestBodyResult.isErr()) {
            return err(
                requestBodyResult.error.at({
                    at: "openai.generate.mapRequest",
                    data: {
                        modelId,
                        endpoint: "embeddings",
                    },
                }),
            );
        }

        const requestBody = requestBodyResult.value;

        const raw = await client.embeddings.create(requestBody, { signal: ctx.signal ?? null });
        if (raw.isErr()) {
            return err(
                raw.error
                    .at({ at: "openai.generate.modelContext", data: { model: String(modelId) } })
                    .at({
                        at: "openai.generate.http",
                        data: {
                            modelId,
                            endpoint: "embeddings",
                            path: "/v1/embeddings",
                        },
                    }),
            );
        }

        const response = mapFromOpenAIEmbeddingResponse(raw.value);
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

    return {
        providerId: "openai",
        modelId,
        caps: OPENAI_EMBEDDING_CAPS as OpenAICapsFor<M>,
        doGenerate,
    };
};
