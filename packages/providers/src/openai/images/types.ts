import type { OpenAICreateImageSchema, OpenAIEditImageSchema } from "./schemas";

export type OpenAIImageCaps = {
    inputModalities: { text: true; image: true };
    inputShape: "prompt";
    replayMode: "single_turn_persistent";
    supportsInstruction: false;
    outputModalities: {
        image: true;
    };
    additionalSupportedRoles: readonly ["developer"];
};

export type OpenAIImageEndpointOptions = {
    n?: OpenAICreateImageSchema["n"];
    quality?: OpenAICreateImageSchema["quality"];
    response_format?: OpenAICreateImageSchema["response_format"];
    output_format?: OpenAICreateImageSchema["output_format"];
    output_compression?: OpenAICreateImageSchema["output_compression"];
    stream?: OpenAICreateImageSchema["stream"];
    partial_images?: OpenAICreateImageSchema["partial_images"];
    size?: OpenAICreateImageSchema["size"];
    moderation?: OpenAICreateImageSchema["moderation"];
    background?: OpenAICreateImageSchema["background"];
    style?: OpenAICreateImageSchema["style"];
    input_fidelity?: OpenAIEditImageSchema["input_fidelity"];
    user?: OpenAICreateImageSchema["user"];
};
