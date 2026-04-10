import type {
    GenerativeModelCallOptions,
    GenerativeModelGenerateResult,
    GenerativeModelResponse,
} from "@better-agent/core/providers";
import { err, ok } from "@better-agent/shared/neverthrow";
import type { createOpenRouterClient } from "../client/create-client";
import { mapFromOpenRouterImageChatCompletion, mapToOpenRouterImageChatCompletionsRequest } from "./mappers";
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

    return {
        providerId: "openrouter",
        modelId,
        caps: OPENROUTER_IMAGE_CAPS,
        doGenerate,
    };
};
