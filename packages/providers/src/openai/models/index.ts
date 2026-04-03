import { createOpenAIAudioSpeechModel } from "../audio-speech/model";
import type { OpenAIAudioSpeechModels } from "../audio-speech/schemas";
import { createOpenAIAudioTranscriptionModel } from "../audio-transcription/model";
import type { OpenAIAudioTranscriptionModels } from "../audio-transcription/schemas";
import type { createOpenAIClient } from "../client/create-client";
import { createOpenAIEmbeddingModel } from "../embeddings/model";
import type { OpenAIEmbeddingModels } from "../embeddings/schemas";
import { createOpenAIImagesModel } from "../images/model";
import type { OpenAIImageModels } from "../images/schemas";
import { createOpenAIResponsesModel } from "../responses/model";
import type { OpenAIResponseModels } from "../responses/schemas";
import {
    isAudioSpeechModel,
    isAudioTranscriptionModel,
    isEmbeddingModel,
    isImageModel,
    isResponseModel,
    isVideoModel,
} from "../shared/runtime";
import type {
    OpenAIAudioSpeechGenerativeModel,
    OpenAIAudioSpeechModelId,
    OpenAIEmbeddingGenerativeModel,
    OpenAIEmbeddingModelId,
    OpenAIGenerativeModel,
    OpenAIImageGenerativeModel,
    OpenAIImageModelId,
    OpenAIModelId,
    OpenAIResponseGenerativeModel,
    OpenAIResponseModelId,
    OpenAIRouteHint,
    OpenAIVideoGenerativeModel,
    OpenAIVideoModelId,
} from "../types";
import { createOpenAIVideoModel } from "../videos/model";
import type { OpenAIVideoModels } from "../videos/schemas";

export function createOpenAIGenerativeModel<M extends OpenAIResponseModelId>(
    modelId: M,
    client: ReturnType<typeof createOpenAIClient>,
    routeHint: "responses",
): OpenAIResponseGenerativeModel<M>;
export function createOpenAIGenerativeModel<M extends OpenAIImageModelId>(
    modelId: M,
    client: ReturnType<typeof createOpenAIClient>,
    routeHint: "images",
): OpenAIImageGenerativeModel<M>;
export function createOpenAIGenerativeModel<M extends OpenAIVideoModelId>(
    modelId: M,
    client: ReturnType<typeof createOpenAIClient>,
    routeHint: "videos",
): OpenAIVideoGenerativeModel<M>;
export function createOpenAIGenerativeModel<M extends OpenAIAudioSpeechModelId>(
    modelId: M,
    client: ReturnType<typeof createOpenAIClient>,
    routeHint: "audio.speech",
): OpenAIAudioSpeechGenerativeModel<M>;
export function createOpenAIGenerativeModel<M extends OpenAIEmbeddingModelId>(
    modelId: M,
    client: ReturnType<typeof createOpenAIClient>,
    routeHint: "embeddings",
): OpenAIEmbeddingGenerativeModel<M>;
export function createOpenAIGenerativeModel<M extends OpenAIModelId>(
    modelId: M,
    client: ReturnType<typeof createOpenAIClient>,
): OpenAIGenerativeModel<M>;
export function createOpenAIGenerativeModel(
    modelId: OpenAIModelId,
    client: ReturnType<typeof createOpenAIClient>,
    routeHint?: OpenAIRouteHint,
): unknown {
    if (routeHint === "responses") {
        return createOpenAIResponsesModel(modelId as OpenAIResponseModels, client);
    }

    if (routeHint === "images") {
        return createOpenAIImagesModel(modelId as OpenAIImageModels, client);
    }

    if (routeHint === "videos") {
        return createOpenAIVideoModel(modelId as OpenAIVideoModels, client);
    }

    if (routeHint === "audio.speech") {
        return createOpenAIAudioSpeechModel(modelId as OpenAIAudioSpeechModels, client);
    }

    if (routeHint === "audio.transcription") {
        return createOpenAIAudioTranscriptionModel(
            modelId as OpenAIAudioTranscriptionModels,
            client,
        );
    }

    if (routeHint === "embeddings") {
        return createOpenAIEmbeddingModel(modelId as OpenAIEmbeddingModels, client);
    }

    if (isResponseModel(modelId)) {
        return createOpenAIResponsesModel(modelId, client);
    }

    if (isImageModel(modelId)) {
        return createOpenAIImagesModel(modelId, client);
    }

    if (isVideoModel(modelId)) {
        return createOpenAIVideoModel(modelId, client);
    }

    if (isAudioSpeechModel(modelId)) {
        return createOpenAIAudioSpeechModel(modelId, client);
    }

    if (isAudioTranscriptionModel(modelId)) {
        return createOpenAIAudioTranscriptionModel(modelId, client);
    }

    if (isEmbeddingModel(modelId)) {
        return createOpenAIEmbeddingModel(modelId, client);
    }

    return createOpenAIResponsesModel(modelId as OpenAIResponseModels, client);
}
