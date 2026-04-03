import type { OpenAICreateEmbeddingRequest } from "./schemas";

export type OpenAIEmbeddingCaps = {
    inputModalities: { text: true };
    inputShape: "prompt";
    replayMode: "single_turn_persistent";
    supportsInstruction: false;
    outputModalities: {
        embedding: true;
    };
    additionalSupportedRoles: readonly ["developer"];
};

export type OpenAIEmbeddingEndpointOptions = Omit<OpenAICreateEmbeddingRequest, "input">;
