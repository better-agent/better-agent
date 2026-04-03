import type { AnthropicResponseStreamEvent } from "./responses/schemas";
import type { AnthropicResponseGenerativeModel, AnthropicResponseModelId } from "./responses/types";
import type { AnthropicNativeToolBuilders } from "./tools";

export type AnthropicConfig = {
    apiKey?: string;
    authToken?: string;
    baseURL?: string;
    headers?: Record<string, string>;
    anthropicVersion?: string;
};

export type AnthropicError = {
    error?: {
        type?: string;
        message?: string;
    };
};

export type AnthropicModelId = AnthropicResponseModelId;
export type AnthropicGenerativeModel<M extends AnthropicModelId = AnthropicModelId> =
    AnthropicResponseGenerativeModel<M>;

export interface AnthropicProvider {
    readonly id: "anthropic";
    readonly tools: AnthropicNativeToolBuilders;
    model<M extends AnthropicModelId>(modelId: M): AnthropicGenerativeModel<M>;
    text<M extends AnthropicResponseModelId>(modelId: M): AnthropicResponseGenerativeModel<M>;
}

export type { AnthropicResponseStreamEvent };
export type {
    AnthropicResponseCaps,
    AnthropicResponseEndpointOptions,
    AnthropicResponseGenerativeModel,
    AnthropicResponseModelId,
} from "./responses/types";
