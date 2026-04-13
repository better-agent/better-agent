import type { createOpenRouterClient } from "../client/create-client";
import { createOpenRouterAudioModel } from "../audio/model";
import { createOpenRouterImagesModel } from "../images/model";
import { createOpenRouterResponsesModel } from "../responses/model";
import type {
    OpenRouterAudioGenerativeModel,
    OpenRouterAudioModelId,
    OpenRouterGenerativeModel,
    OpenRouterImageGenerativeModel,
    OpenRouterImageModelId,
    OpenRouterModelId,
    OpenRouterResponseGenerativeModel,
    OpenRouterResponseModelId,
    OpenRouterRouteHint,
} from "../types";

export function createOpenRouterGenerativeModel<M extends OpenRouterResponseModelId>(
    modelId: M,
    client: ReturnType<typeof createOpenRouterClient>,
    routeHint: "responses",
): OpenRouterResponseGenerativeModel<M>;
export function createOpenRouterGenerativeModel<M extends OpenRouterImageModelId>(
    modelId: M,
    client: ReturnType<typeof createOpenRouterClient>,
    routeHint: "images",
): OpenRouterImageGenerativeModel<M>;
export function createOpenRouterGenerativeModel<M extends OpenRouterAudioModelId>(
    modelId: M,
    client: ReturnType<typeof createOpenRouterClient>,
    routeHint: "audio",
): OpenRouterAudioGenerativeModel<M>;
export function createOpenRouterGenerativeModel<M extends OpenRouterModelId>(
    modelId: M,
    client: ReturnType<typeof createOpenRouterClient>,
): OpenRouterGenerativeModel<M>;
export function createOpenRouterGenerativeModel(
    modelId: OpenRouterModelId,
    client: ReturnType<typeof createOpenRouterClient>,
    routeHint?: OpenRouterRouteHint,
): unknown {
    if (routeHint === "responses") {
        return createOpenRouterResponsesModel(modelId as OpenRouterResponseModelId, client);
    }

    if (routeHint === "images") {
        return createOpenRouterImagesModel(modelId as OpenRouterImageModelId, client);
    }

    if (routeHint === "audio") {
        return createOpenRouterAudioModel(modelId as OpenRouterResponseModelId, client);
    }

    return createOpenRouterResponsesModel(modelId as OpenRouterResponseModelId, client);
}
