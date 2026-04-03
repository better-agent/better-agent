import type { GenerativeModel } from "@better-agent/core/providers";

import type { XAIImageModels } from "../shared/schemas";
import type { XAICreateImageSchema, XAIEditImageSchema } from "./schemas";

export type XAIImageCaps = {
    inputModalities: { text: true; image: true };
    inputShape: "prompt";
    replayMode: "single_turn_persistent";
    supportsInstruction: false;
    outputModalities: {
        image: true;
    };
    additionalSupportedRoles: readonly ["developer"];
};

export type XAIImageEndpointOptions = {
    n?: XAICreateImageSchema["n"];
    quality?: XAICreateImageSchema["quality"];
    response_format?: XAICreateImageSchema["response_format"];
    size?: XAICreateImageSchema["size"];
    style?: XAICreateImageSchema["style"];
    aspect_ratio?: XAIEditImageSchema["aspect_ratio"];
    resolution?: XAIEditImageSchema["resolution"];
    user?: XAICreateImageSchema["user"];
};

type SuggestedModelId<TKnown extends string> = TKnown | (string & {});
export type XAIImageModelId = SuggestedModelId<XAIImageModels>;

export type XAIImageGenerativeModel<M extends XAIImageModelId = XAIImageModelId> = GenerativeModel<
    XAIImageEndpointOptions,
    "xai",
    M,
    XAIImageCaps
>;
