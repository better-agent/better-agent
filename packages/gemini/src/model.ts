import {
    type GoogleEmbeddingModelOptions,
    type GoogleGenerativeAIProviderSettings,
    type GoogleImageModelOptions,
    type GoogleLanguageModelOptions,
    type GoogleVideoModelOptions,
    createGoogleGenerativeAI as createAiSdkGoogle,
    google as defaultAiSdkGoogle,
} from "@ai-sdk/google";
import {
    aiSdkEmbeddingModel,
    aiSdkImageModel,
    aiSdkModel,
    aiSdkTextModel,
    aiSdkVideoModel,
} from "@better-agent/ai-sdk";
import type {
    AgentCapabilities,
    AgentModel,
    EmbeddingGenerationModel,
    ImageGenerationModel,
    TextGenerationModel,
    VideoGenerationModel,
} from "@better-agent/core";

export type CreateGeminiOptions = GoogleGenerativeAIProviderSettings;

export type GeminiProviderOptions = {
    google?: GoogleLanguageModelOptions;
};
export type GeminiTextProviderOptions = GeminiProviderOptions;
export type GeminiEmbeddingProviderOptions = {
    google?: GoogleEmbeddingModelOptions;
};
export type GeminiImageProviderOptions = {
    google?: GoogleImageModelOptions;
};
export type GeminiVideoProviderOptions = {
    google?: GoogleVideoModelOptions;
};
export type GeminiGenerationProviderOptions =
    | GeminiProviderOptions
    | GeminiTextProviderOptions
    | GeminiEmbeddingProviderOptions
    | GeminiImageProviderOptions
    | GeminiVideoProviderOptions;

type AiSdkGoogleProvider = typeof defaultAiSdkGoogle;

export type GeminiModelId = Parameters<AiSdkGoogleProvider>[0];
export type GeminiTextModelId = GeminiModelId;
export type GeminiEmbeddingModelId = Parameters<AiSdkGoogleProvider["embedding"]>[0];
export type GeminiImageModelId = Parameters<AiSdkGoogleProvider["image"]>[0];
export type GeminiImageOptions = Parameters<AiSdkGoogleProvider["image"]>[1];
export type GeminiVideoModelId = Parameters<AiSdkGoogleProvider["video"]>[0];

export type GeminiModel<TModelId extends GeminiModelId = GeminiModelId> = AgentModel<
    AgentCapabilities,
    undefined,
    GeminiProviderOptions,
    TModelId
>;
export type GeminiTextModel<TModelId extends GeminiTextModelId = GeminiTextModelId> =
    TextGenerationModel<GeminiTextProviderOptions, TModelId>;
export type GeminiEmbeddingModel<TModelId extends GeminiEmbeddingModelId = GeminiEmbeddingModelId> =
    EmbeddingGenerationModel<GeminiEmbeddingProviderOptions, TModelId>;
export type GeminiImageModel<TModelId extends GeminiImageModelId = GeminiImageModelId> =
    ImageGenerationModel<GeminiImageProviderOptions, TModelId>;
export type GeminiVideoModel<TModelId extends GeminiVideoModelId = GeminiVideoModelId> =
    VideoGenerationModel<GeminiVideoProviderOptions, TModelId>;

export type GeminiProvider = {
    <TModelId extends GeminiModelId>(modelId: TModelId): GeminiModel<TModelId>;
    text<TModelId extends GeminiTextModelId>(modelId: TModelId): GeminiTextModel<TModelId>;
    embedding<TModelId extends GeminiEmbeddingModelId>(
        modelId: TModelId,
    ): GeminiEmbeddingModel<TModelId>;
    image<TModelId extends GeminiImageModelId>(
        modelId: TModelId,
        options?: GeminiImageOptions,
    ): GeminiImageModel<TModelId>;
    video<TModelId extends GeminiVideoModelId>(modelId: TModelId): GeminiVideoModel<TModelId>;
    tools: typeof defaultAiSdkGoogle.tools;
};

const geminiCapabilities = {
    identity: {
        provider: "gemini",
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
            pdf: true,
            file: true,
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

const createAgentModel = <TModelId extends GeminiModelId>(
    provider: AiSdkGoogleProvider,
    modelId: TModelId,
): GeminiModel<TModelId> => {
    return aiSdkModel<AgentCapabilities, GeminiProviderOptions, TModelId>({
        model: provider(modelId),
        providerId: "gemini",
        modelId,
        capabilities: geminiCapabilities,
    });
};

const createTextModel = <TModelId extends GeminiTextModelId>(
    provider: AiSdkGoogleProvider,
    modelId: TModelId,
): GeminiTextModel<TModelId> => {
    return aiSdkTextModel<GeminiTextProviderOptions, TModelId>({
        model: provider(modelId),
        providerId: "gemini",
        modelId,
    });
};

const createEmbeddingModel = <TModelId extends GeminiEmbeddingModelId>(
    provider: AiSdkGoogleProvider,
    modelId: TModelId,
): GeminiEmbeddingModel<TModelId> => {
    return aiSdkEmbeddingModel<GeminiEmbeddingProviderOptions, TModelId>({
        model: provider.embedding(modelId),
        providerId: "gemini",
        modelId,
    });
};

const createImageModel = <TModelId extends GeminiImageModelId>(
    provider: AiSdkGoogleProvider,
    modelId: TModelId,
    options?: GeminiImageOptions,
): GeminiImageModel<TModelId> => {
    return aiSdkImageModel<GeminiImageProviderOptions, TModelId>({
        model: provider.image(modelId, options),
        providerId: "gemini",
        modelId,
    });
};

const createVideoModel = <TModelId extends GeminiVideoModelId>(
    provider: AiSdkGoogleProvider,
    modelId: TModelId,
): GeminiVideoModel<TModelId> => {
    return aiSdkVideoModel<GeminiVideoProviderOptions, TModelId>({
        model: provider.video(modelId),
        providerId: "gemini",
        modelId,
    });
};

const createProvider = (provider: AiSdkGoogleProvider): GeminiProvider => {
    const createGeminiModel: GeminiProvider = Object.assign(
        <TModelId extends GeminiModelId>(modelId: TModelId): GeminiModel<TModelId> => {
            return createAgentModel(provider, modelId);
        },
        {
            text<TModelId extends GeminiTextModelId>(modelId: TModelId): GeminiTextModel<TModelId> {
                return createTextModel(provider, modelId);
            },
            embedding<TModelId extends GeminiEmbeddingModelId>(
                modelId: TModelId,
            ): GeminiEmbeddingModel<TModelId> {
                return createEmbeddingModel(provider, modelId);
            },
            image<TModelId extends GeminiImageModelId>(
                modelId: TModelId,
                options?: GeminiImageOptions,
            ): GeminiImageModel<TModelId> {
                return createImageModel(provider, modelId, options);
            },
            video<TModelId extends GeminiVideoModelId>(
                modelId: TModelId,
            ): GeminiVideoModel<TModelId> {
                return createVideoModel(provider, modelId);
            },
            tools: provider.tools,
        },
    );

    return createGeminiModel;
};

export const createGemini = (options: CreateGeminiOptions = {}): GeminiProvider => {
    return createProvider(createAiSdkGoogle(options));
};

export const gemini = createProvider(defaultAiSdkGoogle);
