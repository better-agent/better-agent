import type { BetterAgentError } from "@better-agent/shared/errors";
import type { Result } from "@better-agent/shared/neverthrow";
import type {
    GenerativeModel,
    GenerativeModelCallOptions,
    ModalitiesParam,
} from "@better-agent/core/providers";
import type { OpenRouterAudioCaps, OpenRouterAudioEndpointOptions } from "./audio/types";
import type { OpenRouterImageCaps, OpenRouterImageEndpointOptions } from "./images/types";
import type {
    OpenRouterResponseCaps,
    OpenRouterResponseEndpointOptions,
} from "./responses/types";
import type { OpenRouterNativeToolBuilders } from "./tools";

type SuggestedModelId<TKnown extends string> = TKnown | (string & {});

export type OpenRouterResponseModelId = SuggestedModelId<never>;
export type OpenRouterImageModelId = SuggestedModelId<never>;
export type OpenRouterAudioModelId = SuggestedModelId<never>;
export type OpenRouterModelId =
    | OpenRouterResponseModelId
    | OpenRouterImageModelId
    | OpenRouterAudioModelId;
export type OpenRouterRouteHint = "responses" | "images" | "audio";

export type OpenRouterCapsFor<M extends OpenRouterModelId> = M extends OpenRouterImageModelId
    ? OpenRouterImageCaps
    : M extends OpenRouterAudioModelId
        ? OpenRouterAudioCaps
        : OpenRouterResponseCaps;

export type OpenRouterOptionsFor<M extends OpenRouterModelId> = M extends OpenRouterImageModelId
    ? OpenRouterImageEndpointOptions
    : M extends OpenRouterAudioModelId
        ? OpenRouterAudioEndpointOptions
        : OpenRouterResponseEndpointOptions;

export type OpenRouterGenerativeModel<M extends OpenRouterModelId = OpenRouterModelId> =
    M extends OpenRouterImageModelId
        ? OpenRouterImageGenerativeModel<M>
        : M extends OpenRouterAudioModelId
            ? OpenRouterAudioGenerativeModel<M>
            : OpenRouterResponseGenerativeModel<M>;

export type OpenRouterResponseGenerativeModel<
    M extends OpenRouterResponseModelId = OpenRouterResponseModelId,
> = GenerativeModel<OpenRouterResponseEndpointOptions, "openrouter", M, OpenRouterResponseCaps>;

export type OpenRouterImageGenerativeModel<
    M extends OpenRouterImageModelId = OpenRouterImageModelId,
> = GenerativeModel<OpenRouterImageEndpointOptions, "openrouter", M, OpenRouterImageCaps>;

export type OpenRouterAudioGenerativeModel<
    M extends OpenRouterAudioModelId = OpenRouterAudioModelId,
> = GenerativeModel<OpenRouterAudioEndpointOptions, "openrouter", M, OpenRouterAudioCaps>;

export interface OpenRouterProvider {
    readonly id: "openrouter";
    readonly tools: OpenRouterNativeToolBuilders;
    model<M extends OpenRouterModelId>(modelId: M): OpenRouterGenerativeModel<M>;
    text<M extends OpenRouterResponseModelId>(modelId: M): OpenRouterResponseGenerativeModel<M>;
    audio<M extends OpenRouterAudioModelId>(modelId: M): OpenRouterAudioGenerativeModel<M>;
    image<M extends OpenRouterImageModelId>(modelId: M): OpenRouterImageGenerativeModel<M>;
}

export type OpenRouterCallOptions<
    M extends OpenRouterModelId,
    TModalities extends ModalitiesParam<OpenRouterCapsFor<M>> = undefined,
> = GenerativeModelCallOptions<OpenRouterCapsFor<M>, OpenRouterOptionsFor<M>, TModalities>;

export interface OpenRouterConfig {
    apiKey?: string;
    baseURL?: string;
    headers?: Record<string, string>;
    siteURL?: string;
    appName?: string;
}

export interface OpenRouterError {
    error?: {
        code?: string | number;
        message?: string;
        type?: string;
        metadata?: Record<string, unknown>;
    };
}

export interface OpenRouterModelsClient {
    list(options?: {
        signal?: AbortSignal | null;
    }): Promise<Result<unknown, BetterAgentError>>;
}
