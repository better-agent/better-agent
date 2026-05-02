import {
    aiSdkEmbeddingModel,
    aiSdkImageModel,
    aiSdkModel,
    aiSdkSpeechModel,
    aiSdkTextModel,
    aiSdkTranscriptionModel,
} from "@better-agent/ai-sdk";
import type {
    AgentCapabilities,
    AgentModel,
    EmbeddingGenerationModel,
    ImageGenerationModel,
    SpeechGenerationModel,
    TextGenerationModel,
    TranscriptionGenerationModel,
} from "@better-agent/core";
import { createWorkersAI as createAiSdkWorkersAI } from "workers-ai-provider";

export type CreateWorkersAIOptions = Parameters<typeof createAiSdkWorkersAI>[0];

type AiSdkWorkersAIProvider = ReturnType<typeof createAiSdkWorkersAI>;

export type WorkersAIProviderOptions = {
    "workers-ai"?: Record<string, unknown>;
};
export type WorkersAITextProviderOptions = WorkersAIProviderOptions;
export type WorkersAIEmbeddingProviderOptions = {
    "workers-ai"?: Record<string, unknown>;
};
export type WorkersAIImageProviderOptions = {
    "workers-ai"?: Record<string, unknown>;
};
export type WorkersAISpeechProviderOptions = {
    "workers-ai"?: Record<string, unknown>;
};
export type WorkersAITranscriptionProviderOptions = {
    "workers-ai"?: Record<string, unknown>;
};
export type WorkersAIGenerationProviderOptions =
    | WorkersAIProviderOptions
    | WorkersAITextProviderOptions
    | WorkersAIEmbeddingProviderOptions
    | WorkersAIImageProviderOptions
    | WorkersAISpeechProviderOptions
    | WorkersAITranscriptionProviderOptions;

export type WorkersAIModelId = Parameters<AiSdkWorkersAIProvider>[0];
export type WorkersAITextModelId = WorkersAIModelId;
export type WorkersAIEmbeddingModelId = Parameters<AiSdkWorkersAIProvider["textEmbedding"]>[0];
export type WorkersAIImageModelId = Parameters<AiSdkWorkersAIProvider["image"]>[0];
export type WorkersAISpeechModelId = Parameters<AiSdkWorkersAIProvider["speech"]>[0];
export type WorkersAITranscriptionModelId = Parameters<AiSdkWorkersAIProvider["transcription"]>[0];
export type WorkersAITextOptions = NonNullable<Parameters<AiSdkWorkersAIProvider>[1]>;
export type WorkersAIEmbeddingOptions = NonNullable<
    Parameters<AiSdkWorkersAIProvider["textEmbedding"]>[1]
>;
export type WorkersAIImageOptions = NonNullable<Parameters<AiSdkWorkersAIProvider["image"]>[1]>;
export type WorkersAISpeechOptions = NonNullable<Parameters<AiSdkWorkersAIProvider["speech"]>[1]>;
export type WorkersAITranscriptionOptions = NonNullable<
    Parameters<AiSdkWorkersAIProvider["transcription"]>[1]
>;

export type WorkersAIModelOptions = WorkersAITextOptions;

export type WorkersAIModel<TModelId extends WorkersAIModelId = WorkersAIModelId> = AgentModel<
    AgentCapabilities,
    undefined,
    WorkersAIProviderOptions,
    TModelId
>;
export type WorkersAITextModel<TModelId extends WorkersAITextModelId = WorkersAITextModelId> =
    TextGenerationModel<WorkersAITextProviderOptions, TModelId>;
export type WorkersAIEmbeddingModel<
    TModelId extends WorkersAIEmbeddingModelId = WorkersAIEmbeddingModelId,
> = EmbeddingGenerationModel<WorkersAIEmbeddingProviderOptions, TModelId>;
export type WorkersAIImageModel<TModelId extends WorkersAIImageModelId = WorkersAIImageModelId> =
    ImageGenerationModel<WorkersAIImageProviderOptions, TModelId>;
export type WorkersAISpeechModel<TModelId extends WorkersAISpeechModelId = WorkersAISpeechModelId> =
    SpeechGenerationModel<WorkersAISpeechProviderOptions, TModelId>;
export type WorkersAITranscriptionModel<
    TModelId extends WorkersAITranscriptionModelId = WorkersAITranscriptionModelId,
> = TranscriptionGenerationModel<WorkersAITranscriptionProviderOptions, TModelId>;

export type WorkersAIProvider = {
    <TModelId extends WorkersAIModelId>(
        modelId: TModelId,
        options?: WorkersAIModelOptions,
    ): WorkersAIModel<TModelId>;
    text<TModelId extends WorkersAITextModelId>(
        modelId: TModelId,
        options?: WorkersAITextOptions,
    ): WorkersAITextModel<TModelId>;
    embedding<TModelId extends WorkersAIEmbeddingModelId>(
        modelId: TModelId,
        options?: WorkersAIEmbeddingOptions,
    ): WorkersAIEmbeddingModel<TModelId>;
    image<TModelId extends WorkersAIImageModelId>(
        modelId: TModelId,
        options?: WorkersAIImageOptions,
    ): WorkersAIImageModel<TModelId>;
    speech<TModelId extends WorkersAISpeechModelId>(
        modelId: TModelId,
        options?: WorkersAISpeechOptions,
    ): WorkersAISpeechModel<TModelId>;
    transcription<TModelId extends WorkersAITranscriptionModelId>(
        modelId: TModelId,
        options?: WorkersAITranscriptionOptions,
    ): WorkersAITranscriptionModel<TModelId>;
};

const workersAICapabilities = {
    identity: {
        provider: "workers-ai",
    },
    transport: {
        streaming: true,
    },
    output: {
        structuredOutput: true,
        supportedMimeTypes: ["text/plain", "application/json"],
    },
    multimodal: {
        input: {
            image: true,
        },
    },
    tools: {
        supported: true,
    },
} as const satisfies AgentCapabilities;

const createAgentModel = <TModelId extends WorkersAIModelId>(
    provider: AiSdkWorkersAIProvider,
    modelId: TModelId,
    options?: WorkersAITextOptions,
): WorkersAIModel<TModelId> => {
    return aiSdkModel<AgentCapabilities, WorkersAIProviderOptions, TModelId>({
        model: provider(modelId, options),
        providerId: "workers-ai",
        modelId,
        capabilities: workersAICapabilities,
    });
};

const createTextModel = <TModelId extends WorkersAITextModelId>(
    provider: AiSdkWorkersAIProvider,
    modelId: TModelId,
    options?: WorkersAITextOptions,
): WorkersAITextModel<TModelId> => {
    return aiSdkTextModel<WorkersAITextProviderOptions, TModelId>({
        model: provider(modelId, options),
        providerId: "workers-ai",
        modelId,
    });
};

const createEmbeddingModel = <TModelId extends WorkersAIEmbeddingModelId>(
    provider: AiSdkWorkersAIProvider,
    modelId: TModelId,
    options?: WorkersAIEmbeddingOptions,
): WorkersAIEmbeddingModel<TModelId> => {
    return aiSdkEmbeddingModel<WorkersAIEmbeddingProviderOptions, TModelId>({
        model: provider.textEmbedding(modelId, options),
        providerId: "workers-ai",
        modelId,
    });
};

const createImageModel = <TModelId extends WorkersAIImageModelId>(
    provider: AiSdkWorkersAIProvider,
    modelId: TModelId,
    options?: WorkersAIImageOptions,
): WorkersAIImageModel<TModelId> => {
    return aiSdkImageModel<WorkersAIImageProviderOptions, TModelId>({
        model: provider.image(modelId, options),
        providerId: "workers-ai",
        modelId,
    });
};

const createSpeechModel = <TModelId extends WorkersAISpeechModelId>(
    provider: AiSdkWorkersAIProvider,
    modelId: TModelId,
    options?: WorkersAISpeechOptions,
): WorkersAISpeechModel<TModelId> => {
    return aiSdkSpeechModel<WorkersAISpeechProviderOptions, TModelId>({
        model: provider.speech(modelId, options),
        providerId: "workers-ai",
        modelId,
    });
};

const createTranscriptionModel = <TModelId extends WorkersAITranscriptionModelId>(
    provider: AiSdkWorkersAIProvider,
    modelId: TModelId,
    options?: WorkersAITranscriptionOptions,
): WorkersAITranscriptionModel<TModelId> => {
    return aiSdkTranscriptionModel<WorkersAITranscriptionProviderOptions, TModelId>({
        model: provider.transcription(modelId, options),
        providerId: "workers-ai",
        modelId,
    });
};

const createProvider = (provider: AiSdkWorkersAIProvider): WorkersAIProvider => {
    const createWorkersAIModel: WorkersAIProvider = Object.assign(
        <TModelId extends WorkersAIModelId>(
            modelId: TModelId,
            options?: WorkersAIModelOptions,
        ): WorkersAIModel<TModelId> => {
            return createAgentModel(provider, modelId, options);
        },
        {
            text<TModelId extends WorkersAITextModelId>(
                modelId: TModelId,
                options?: WorkersAITextOptions,
            ): WorkersAITextModel<TModelId> {
                return createTextModel(provider, modelId, options);
            },
            embedding<TModelId extends WorkersAIEmbeddingModelId>(
                modelId: TModelId,
                options?: WorkersAIEmbeddingOptions,
            ): WorkersAIEmbeddingModel<TModelId> {
                return createEmbeddingModel(provider, modelId, options);
            },
            image<TModelId extends WorkersAIImageModelId>(
                modelId: TModelId,
                options?: WorkersAIImageOptions,
            ): WorkersAIImageModel<TModelId> {
                return createImageModel(provider, modelId, options);
            },
            speech<TModelId extends WorkersAISpeechModelId>(
                modelId: TModelId,
                options?: WorkersAISpeechOptions,
            ): WorkersAISpeechModel<TModelId> {
                return createSpeechModel(provider, modelId, options);
            },
            transcription<TModelId extends WorkersAITranscriptionModelId>(
                modelId: TModelId,
                options?: WorkersAITranscriptionOptions,
            ): WorkersAITranscriptionModel<TModelId> {
                return createTranscriptionModel(provider, modelId, options);
            },
        },
    );

    return createWorkersAIModel;
};

export const createWorkersAI = (options: CreateWorkersAIOptions): WorkersAIProvider => {
    return createProvider(createAiSdkWorkersAI(options));
};
