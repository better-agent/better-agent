import { createAnthropicClient as createAnthropicHttpClient } from "./client";
import { createAnthropicResponsesModel } from "./responses/model";
import { createAnthropicNativeToolBuilders } from "./tools";
import type {
    AnthropicConfig,
    AnthropicGenerativeModel,
    AnthropicModelId,
    AnthropicProvider,
    AnthropicResponseModelId,
} from "./types";

export const createAnthropic = (config: AnthropicConfig): AnthropicProvider => {
    const httpClient = createAnthropicHttpClient(config);
    const tools = createAnthropicNativeToolBuilders();

    const provider: AnthropicProvider = {
        id: "anthropic",
        tools,

        model<M extends AnthropicModelId>(modelId: M) {
            return createAnthropicResponsesModel(
                modelId,
                httpClient,
            ) as AnthropicGenerativeModel<M>;
        },

        text<M extends AnthropicResponseModelId>(modelId: M) {
            return createAnthropicResponsesModel(modelId, httpClient);
        },
    };

    return provider;
};
