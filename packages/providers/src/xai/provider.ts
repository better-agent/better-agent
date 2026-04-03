import { createXAIClient as createXAIHttpClient } from "./client";
import { createXAIImagesModel } from "./images/model";
import { createXAIModel } from "./models";
import { createXAIResponsesModel } from "./responses/model";
import { createXAINativeToolBuilders } from "./tools";
import type {
    XAIConfig,
    XAIGenerativeModel,
    XAIImageModelId,
    XAIModelId,
    XAIProvider,
    XAIResponseModelId,
} from "./types";

export const createXAI = (config: XAIConfig): XAIProvider => {
    const httpClient = createXAIHttpClient(config);
    const tools = createXAINativeToolBuilders();

    const provider: XAIProvider = {
        id: "xai",
        tools,
        files: httpClient.files,

        model<M extends XAIModelId>(modelId: M) {
            return createXAIModel(modelId, httpClient) as XAIGenerativeModel<M>;
        },

        text<M extends XAIResponseModelId>(modelId: M) {
            return createXAIResponsesModel(modelId, httpClient);
        },

        image<M extends XAIImageModelId>(modelId: M) {
            return createXAIImagesModel(modelId, httpClient);
        },
    };

    return provider;
};
