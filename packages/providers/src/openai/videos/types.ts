import type { OpenAICreateVideoSchema } from "./schemas";

export type OpenAIVideoCaps = {
    inputModalities: { text: true; image: true };
    inputShape: "prompt";
    replayMode: "single_turn_persistent";
    supportsInstruction: false;
    outputModalities: {
        video: true;
    };
    additionalSupportedRoles: readonly ["developer"];
};

export type OpenAIVideoEndpointOptions = {
    input_reference?: OpenAICreateVideoSchema["input_reference"];
    seconds?: OpenAICreateVideoSchema["seconds"];
    size?: OpenAICreateVideoSchema["size"];
    pollIntervalMs?: number;
    pollTimeoutMs?: number;
};
