import { createOpenRouterClient as createOpenRouterHttpClient } from "./client";
import { createOpenRouterImagesModel } from "./images/model";
import { createOpenRouterResponsesModel } from "./responses/model";
import { createOpenRouterNativeToolBuilders } from "./tools";
import type {
    OpenRouterConfig,
    OpenRouterGenerativeModel,
    OpenRouterResponseGenerativeModel,
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
            return createOpenRouterResponsesModel(
                modelId as OpenRouterResponseModelId,
                httpClient,
            ) as unknown as OpenRouterGenerativeModel<M>;
        },

        text<M extends OpenRouterResponseModelId>(modelId: M) {
            return createOpenRouterResponsesModel(modelId, httpClient);
        },

        image<M extends OpenRouterImageModelId>(modelId: M) {
            return createOpenRouterImagesModel(modelId, httpClient);
        },
    };

    return provider;
};
