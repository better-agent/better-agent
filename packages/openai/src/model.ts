import {
    type OpenAIEmbeddingModelOptions,
    type OpenAILanguageModelResponsesOptions,
    type OpenAIProviderSettings,
    type OpenAISpeechModelOptions,
    type OpenAITranscriptionModelOptions,
    createOpenAI as createAiSdkOpenAI,
    openai as defaultAiSdkOpenAI,
} from "@ai-sdk/openai";
import type {
    OpenAIEmbeddingModelId as AiSdkOpenAIEmbeddingModelId,
    OpenAIImageModelId as AiSdkOpenAIImageModelId,
    OpenAISpeechModelId as AiSdkOpenAISpeechModelId,
    OpenAITranscriptionModelId as AiSdkOpenAITranscriptionModelId,
    OpenAIResponsesLanguageModel,
} from "@ai-sdk/openai/internal";
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

export type CreateOpenAIOptions = OpenAIProviderSettings;

export type OpenAIProviderOptions = {
    openai?: OpenAILanguageModelResponsesOptions;
};
export type OpenAITextProviderOptions = OpenAIProviderOptions;
export type OpenAIEmbeddingProviderOptions = {
    openai?: OpenAIEmbeddingModelOptions;
};
export type OpenAIImageProviderOptions = {
    openai?: Record<string, unknown>;
};
export type OpenAISpeechProviderOptions = {
    openai?: OpenAISpeechModelOptions;
};
export type OpenAITranscriptionProviderOptions = {
    openai?: OpenAITranscriptionModelOptions;
};
export type OpenAIGenerationProviderOptions =
    | OpenAIProviderOptions
    | OpenAITextProviderOptions
    | OpenAIEmbeddingProviderOptions
    | OpenAIImageProviderOptions
    | OpenAISpeechProviderOptions
    | OpenAITranscriptionProviderOptions;

type AiSdkOpenAIProvider = typeof defaultAiSdkOpenAI;

export type OpenAIModelId = ConstructorParameters<typeof OpenAIResponsesLanguageModel>[0];
export type OpenAITextModelId = OpenAIModelId;
export type OpenAIEmbeddingModelId = AiSdkOpenAIEmbeddingModelId;
export type OpenAIImageModelId = AiSdkOpenAIImageModelId;
export type OpenAISpeechModelId = AiSdkOpenAISpeechModelId;
export type OpenAITranscriptionModelId = AiSdkOpenAITranscriptionModelId;

export type OpenAIModel<TModelId extends OpenAIModelId = OpenAIModelId> = AgentModel<
    AgentCapabilities,
    undefined,
    OpenAIProviderOptions,
    TModelId
>;
export type OpenAITextModel<TModelId extends OpenAITextModelId = OpenAITextModelId> =
    TextGenerationModel<OpenAITextProviderOptions, TModelId>;
export type OpenAIEmbeddingModel<TModelId extends OpenAIEmbeddingModelId = OpenAIEmbeddingModelId> =
    EmbeddingGenerationModel<OpenAIEmbeddingProviderOptions, TModelId>;
export type OpenAIImageModel<TModelId extends OpenAIImageModelId = OpenAIImageModelId> =
    ImageGenerationModel<OpenAIImageProviderOptions, TModelId>;
export type OpenAISpeechModel<TModelId extends OpenAISpeechModelId = OpenAISpeechModelId> =
    SpeechGenerationModel<OpenAISpeechProviderOptions, TModelId>;
export type OpenAITranscriptionModel<
    TModelId extends OpenAITranscriptionModelId = OpenAITranscriptionModelId,
> = TranscriptionGenerationModel<OpenAITranscriptionProviderOptions, TModelId>;

export type OpenAIProvider = {
    <TModelId extends OpenAIModelId>(modelId: TModelId): OpenAIModel<TModelId>;
    text<TModelId extends OpenAITextModelId>(modelId: TModelId): OpenAITextModel<TModelId>;
    embedding<TModelId extends OpenAIEmbeddingModelId>(
        modelId: TModelId,
    ): OpenAIEmbeddingModel<TModelId>;
    image<TModelId extends OpenAIImageModelId>(modelId: TModelId): OpenAIImageModel<TModelId>;
    speech<TModelId extends OpenAISpeechModelId>(modelId: TModelId): OpenAISpeechModel<TModelId>;
    transcription<TModelId extends OpenAITranscriptionModelId>(
        modelId: TModelId,
    ): OpenAITranscriptionModel<TModelId>;
    tools: typeof defaultAiSdkOpenAI.tools;
};

const openAITextCapabilities = {
    identity: {
        provider: "openai",
    },
    transport: {
        streaming: true,
    },
    output: {
        structuredOutput: true,
        supportedMimeTypes: ["text/plain", "application/json", "image/png"],
    },
    multimodal: {
        input: {
            image: true,
            pdf: true,
            file: true,
        },
        output: {
            image: true,
        },
    },
    tools: {
        supported: true,
        parallelCalls: true,
    },
    reasoning: {
        supported: true,
    },
} as const satisfies AgentCapabilities;

const createAgentModel = <TModelId extends OpenAIModelId>(
    provider: AiSdkOpenAIProvider,
    modelId: TModelId,
): OpenAIModel<TModelId> => {
    return aiSdkModel<AgentCapabilities, OpenAIProviderOptions, TModelId>({
        model: provider(modelId as never),
        providerId: "openai",
        modelId,
        capabilities: openAITextCapabilities,
    });
};

const createTextModel = <TModelId extends OpenAITextModelId>(
    provider: AiSdkOpenAIProvider,
    modelId: TModelId,
): OpenAITextModel<TModelId> => {
    return aiSdkTextModel<OpenAITextProviderOptions, TModelId>({
        model: provider.responses(modelId as never),
        providerId: "openai",
        modelId,
    });
};

const createEmbeddingModel = <TModelId extends OpenAIEmbeddingModelId>(
    provider: AiSdkOpenAIProvider,
    modelId: TModelId,
): OpenAIEmbeddingModel<TModelId> => {
    return aiSdkEmbeddingModel<OpenAIEmbeddingProviderOptions, TModelId>({
        model: provider.embedding(modelId as never),
        providerId: "openai",
        modelId,
    });
};

const createImageModel = <TModelId extends OpenAIImageModelId>(
    provider: AiSdkOpenAIProvider,
    modelId: TModelId,
): OpenAIImageModel<TModelId> => {
    return aiSdkImageModel<OpenAIImageProviderOptions, TModelId>({
        model: provider.image(modelId as never),
        providerId: "openai",
        modelId,
    });
};

const createSpeechModel = <TModelId extends OpenAISpeechModelId>(
    provider: AiSdkOpenAIProvider,
    modelId: TModelId,
): OpenAISpeechModel<TModelId> => {
    return aiSdkSpeechModel<OpenAISpeechProviderOptions, TModelId>({
        model: provider.speech(modelId as never),
        providerId: "openai",
        modelId,
    });
};

const createTranscriptionModel = <TModelId extends OpenAITranscriptionModelId>(
    provider: AiSdkOpenAIProvider,
    modelId: TModelId,
): OpenAITranscriptionModel<TModelId> => {
    return aiSdkTranscriptionModel<OpenAITranscriptionProviderOptions, TModelId>({
        model: provider.transcription(modelId as never),
        providerId: "openai",
        modelId,
    });
};

const createProvider = (provider: AiSdkOpenAIProvider): OpenAIProvider => {
    const createOpenAIModel: OpenAIProvider = Object.assign(
        <TModelId extends OpenAIModelId>(modelId: TModelId): OpenAIModel<TModelId> => {
            return createAgentModel(provider, modelId);
        },
        {
            text<TModelId extends OpenAITextModelId>(modelId: TModelId): OpenAITextModel<TModelId> {
                return createTextModel(provider, modelId);
            },
            embedding<TModelId extends OpenAIEmbeddingModelId>(
                modelId: TModelId,
            ): OpenAIEmbeddingModel<TModelId> {
                return createEmbeddingModel(provider, modelId);
            },
            image<TModelId extends OpenAIImageModelId>(
                modelId: TModelId,
            ): OpenAIImageModel<TModelId> {
                return createImageModel(provider, modelId);
            },
            speech<TModelId extends OpenAISpeechModelId>(
                modelId: TModelId,
            ): OpenAISpeechModel<TModelId> {
                return createSpeechModel(provider, modelId);
            },
            transcription<TModelId extends OpenAITranscriptionModelId>(
                modelId: TModelId,
            ): OpenAITranscriptionModel<TModelId> {
                return createTranscriptionModel(provider, modelId);
            },
            tools: provider.tools,
        },
    );

    return createOpenAIModel;
};

export const createOpenAI = (options: CreateOpenAIOptions = {}): OpenAIProvider => {
    return createProvider(createAiSdkOpenAI(options));
};

export const openai = createProvider(defaultAiSdkOpenAI);
