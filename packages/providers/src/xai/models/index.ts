import type { createXAIClient } from "../client/create-client";
import { createXAIImagesModel } from "../images/model";
import type { XAIImageGenerativeModel, XAIImageModelId } from "../images/types";
import { createXAIResponsesModel } from "../responses/model";
import type { XAIResponseGenerativeModel, XAIResponseModelId } from "../responses/types";
import { getXAIModelKind } from "../shared/schemas";
import type { XAIGenerativeModel, XAIModelId } from "../types";

export function createXAIModel<M extends XAIModelId>(
    modelId: M,
    client: ReturnType<typeof createXAIClient>,
): XAIGenerativeModel<M>;
export function createXAIModel<M extends XAIImageModelId>(
    modelId: M,
    client: ReturnType<typeof createXAIClient>,
): XAIImageGenerativeModel<M>;
export function createXAIModel<M extends XAIResponseModelId>(
    modelId: M,
    client: ReturnType<typeof createXAIClient>,
): XAIResponseGenerativeModel<M>;
export function createXAIModel(modelId: string, client: ReturnType<typeof createXAIClient>) {
    if (getXAIModelKind(modelId) === "image") {
        return createXAIImagesModel(modelId as XAIImageModelId, client);
    }
    return createXAIResponsesModel(modelId as XAIResponseModelId, client);
}
