import type {
    GenerativeModelCallOptions,
    GenerativeModelGenerateResult,
    GenerativeModelResponse,
} from "@better-agent/core/providers";
import { err, ok } from "@better-agent/shared/neverthrow";

import type { createXAIClient } from "../client/create-client";
import { mapFromXAIImagesResponse, mapToXAIImagesRequest } from "./mappers";
import type {
    XAIImageCaps,
    XAIImageEndpointOptions,
    XAIImageGenerativeModel,
    XAIImageModelId,
} from "./types";

export const XAI_IMAGE_CAPS = {
    inputModalities: { text: true, image: true },
    inputShape: "prompt",
    replayMode: "single_turn_persistent",
    supportsInstruction: false,
    outputModalities: {
        image: true,
    },
    additionalSupportedRoles: ["developer"],
} as const satisfies XAIImageCaps;

export const createXAIImagesModel = <M extends XAIImageModelId>(
    modelId: M,
    client: ReturnType<typeof createXAIClient>,
): XAIImageGenerativeModel<M> => {
    const doGenerate: NonNullable<XAIImageGenerativeModel<M>["doGenerate"]> = async (
        options,
        ctx,
    ) => {
        const requestBodyResult = mapToXAIImagesRequest({
            modelId,
            options: options as GenerativeModelCallOptions<XAIImageCaps, XAIImageEndpointOptions>,
        });
        if (requestBodyResult.isErr()) {
            return err(requestBodyResult.error.at({ at: "xai.images.generate.mapRequest" }));
        }

        const request = requestBodyResult.value;
        const raw =
            request.mode === "edit"
                ? await client.images.edit(request.body, {
                      signal: ctx.signal ?? null,
                  })
                : await client.images.create(request.body, {
                      signal: ctx.signal ?? null,
                  });
        if (raw.isErr()) {
            return err(raw.error.at({ at: "xai.images.generate.http" }));
        }

        const response = mapFromXAIImagesResponse(raw.value);
        return ok({
            response: {
                ...response,
                request: {
                    body: request.body,
                },
            } satisfies GenerativeModelResponse,
        } satisfies GenerativeModelGenerateResult<XAIImageCaps>);
    };

    return {
        providerId: "xai",
        modelId,
        caps: XAI_IMAGE_CAPS,
        doGenerate,
    };
};
