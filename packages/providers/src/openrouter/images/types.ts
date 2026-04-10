import type { GenerativeModel } from "@better-agent/core/providers";

export type OpenRouterImageCaps = {
    inputModalities: { text: true; image: true };
    inputShape: "prompt";
    replayMode: "single_turn_persistent";
    supportsInstruction: false;
    outputModalities: {
        image: true;
    };
    additionalSupportedRoles: readonly ["developer"];
};

export type OpenRouterImageEndpointOptions = {
    max_tokens?: number;
    temperature?: number;
    top_p?: number;
    frequency_penalty?: number;
    presence_penalty?: number;
    seed?: number;
    user?: string;
    route?: string;
    provider?: unknown;
    plugins?: unknown[];
};

export type OpenRouterImageGenerativeModel<
    M extends string = string,
> = GenerativeModel<OpenRouterImageEndpointOptions, "openrouter", M, OpenRouterImageCaps>;
