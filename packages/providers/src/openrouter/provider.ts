import { createOpenRouterClient as createOpenRouterHttpClient } from "./client";
import { createOpenRouterGenerativeModel } from "./models";
import { createOpenRouterNativeToolBuilders } from "./tools";
import type {
    OpenRouterAudioModelId,
    OpenRouterConfig,
    OpenRouterImageModelId,
    OpenRouterModelId,
    OpenRouterProvider,
    OpenRouterResponseModelId,
} from "./types";

export const createOpenRouter = (config: OpenRouterConfig): OpenRouterProvider => {
    const httpClient = createOpenRouterHttpClient(config);
    const tools = createOpenRouterNativeToolBuilders();

    const provider: OpenRouterProvider = {
        id: "openrouter",
        tools,

        model<M extends OpenRouterModelId>(modelId: M) {
            return createOpenRouterGenerativeModel(modelId, httpClient);
        },

        text<M extends OpenRouterResponseModelId>(modelId: M) {
            return createOpenRouterGenerativeModel(modelId, httpClient, "responses");
        },

        audio<M extends OpenRouterAudioModelId>(modelId: M) {
            return createOpenRouterGenerativeModel(modelId, httpClient, "audio");
        },

        image<M extends OpenRouterImageModelId>(modelId: M) {
            return createOpenRouterGenerativeModel(modelId, httpClient, "images");
        },
    };

    return provider;
};
