import { createOpenAIAudioTranscriptionModel } from "./audio-transcription/model";
import { createOpenAIClient as createOpenAIHttpClient } from "./client";
import { createOpenAIGenerativeModel } from "./models";
import { createOpenAINativeToolBuilders } from "./tools";
import type {
    OpenAIAudioSpeechModelId,
    OpenAIAudioTranscriptionModelId,
    OpenAIConfig,
    OpenAIEmbeddingModelId,
    OpenAIImageModelId,
    OpenAIModelId,
    OpenAIProvider,
    OpenAIResponseModelId,
    OpenAIVideoModelId,
} from "./types";

export const createOpenAI = (config: OpenAIConfig): OpenAIProvider => {
    const httpClient = createOpenAIHttpClient(config);
    const tools = createOpenAINativeToolBuilders();

    const provider: OpenAIProvider = {
        id: "openai",
        tools,
        files: httpClient.files,

        model(modelId: OpenAIModelId) {
            return createOpenAIGenerativeModel(modelId, httpClient);
        },

        text(modelId: OpenAIResponseModelId) {
            return createOpenAIGenerativeModel(modelId, httpClient, "responses");
        },

        image(modelId: OpenAIImageModelId) {
            return createOpenAIGenerativeModel(modelId, httpClient, "images");
        },

        video(modelId: OpenAIVideoModelId) {
            return createOpenAIGenerativeModel(modelId, httpClient, "videos");
        },

        audio(modelId: OpenAIAudioSpeechModelId) {
            return createOpenAIGenerativeModel(modelId, httpClient, "audio.speech");
        },

        transcription(modelId: OpenAIAudioTranscriptionModelId) {
            return createOpenAIAudioTranscriptionModel(modelId, httpClient);
        },

        embedding(modelId: OpenAIEmbeddingModelId) {
            return createOpenAIGenerativeModel(modelId, httpClient, "embeddings");
        },
    };

    return provider;
};
