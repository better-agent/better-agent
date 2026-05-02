import {
    type OpenAICompatibleEmbeddingProviderOptions,
    type OpenAICompatibleProviderOptions,
    type OpenAICompatibleProviderSettings,
    createOpenAICompatible as createAiSdkOpenAICompatible,
} from "@ai-sdk/openai-compatible";
import {
    aiSdkEmbeddingModel,
    aiSdkImageModel,
    aiSdkModel,
    aiSdkTextModel,
} from "@better-agent/ai-sdk";
import type {
    AgentCapabilities,
    AgentModel,
    EmbeddingGenerationModel,
    ImageGenerationModel,
    TextGenerationModel,
} from "@better-agent/core";

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

export type OpenRouterModelId = string;
type OpenRouterCompletionModelId = string & {};
export type OpenRouterEmbeddingModelId = string & {};
export type OpenRouterImageModelId = string & {};

type AiSdkOpenRouterProvider = ReturnType<typeof createOpenAICompatibleOpenRouter>;

export type CreateOpenRouterOptions = Omit<OpenAICompatibleProviderSettings, "baseURL" | "name"> & {
    baseURL?: string;
};

export type OpenRouterProviderOptions = {
    openrouter?: OpenAICompatibleProviderOptions & Record<string, unknown>;
};
export type OpenRouterTextProviderOptions = OpenRouterProviderOptions;
export type OpenRouterEmbeddingProviderOptions = {
    openrouter?: OpenAICompatibleEmbeddingProviderOptions & Record<string, unknown>;
};
export type OpenRouterImageProviderOptions = {
    openrouter?: Record<string, unknown>;
};
export type OpenRouterGenerationProviderOptions =
    | OpenRouterProviderOptions
    | OpenRouterTextProviderOptions
    | OpenRouterEmbeddingProviderOptions
    | OpenRouterImageProviderOptions;

export type OpenRouterTextModelId = OpenRouterModelId;

export type OpenRouterModel<TModelId extends OpenRouterModelId = OpenRouterModelId> = AgentModel<
    AgentCapabilities,
    undefined,
    OpenRouterProviderOptions,
    TModelId
>;
export type OpenRouterTextModel<TModelId extends OpenRouterTextModelId = OpenRouterTextModelId> =
    TextGenerationModel<OpenRouterTextProviderOptions, TModelId>;
export type OpenRouterEmbeddingModel<
    TModelId extends OpenRouterEmbeddingModelId = OpenRouterEmbeddingModelId,
> = EmbeddingGenerationModel<OpenRouterEmbeddingProviderOptions, TModelId>;
export type OpenRouterImageModel<TModelId extends OpenRouterImageModelId = OpenRouterImageModelId> =
    ImageGenerationModel<OpenRouterImageProviderOptions, TModelId>;

export type OpenRouterProvider = {
    <TModelId extends OpenRouterModelId>(modelId: TModelId): OpenRouterModel<TModelId>;
    text<TModelId extends OpenRouterTextModelId>(modelId: TModelId): OpenRouterTextModel<TModelId>;
    embedding<TModelId extends OpenRouterEmbeddingModelId>(
        modelId: TModelId,
    ): OpenRouterEmbeddingModel<TModelId>;
    image<TModelId extends OpenRouterImageModelId>(
        modelId: TModelId,
    ): OpenRouterImageModel<TModelId>;
};

const openRouterCapabilities = {
    identity: {
        provider: "openrouter",
    },
    transport: {
        streaming: true,
    },
    output: {
        supportedMimeTypes: ["text/plain", "application/json"],
    },
} as const satisfies AgentCapabilities;

const createOpenAICompatibleOpenRouter = (options: CreateOpenRouterOptions = {}) => {
    return createAiSdkOpenAICompatible<
        OpenRouterModelId,
        OpenRouterCompletionModelId,
        OpenRouterEmbeddingModelId,
        OpenRouterImageModelId
    >({
        ...options,
        name: "openrouter",
        baseURL: options.baseURL ?? OPENROUTER_BASE_URL,
    });
};

const createAgentModel = <TModelId extends OpenRouterModelId>(
    provider: AiSdkOpenRouterProvider,
    modelId: TModelId,
): OpenRouterModel<TModelId> => {
    return aiSdkModel<AgentCapabilities, OpenRouterProviderOptions, TModelId>({
        model: provider(modelId),
        providerId: "openrouter",
        modelId,
        capabilities: openRouterCapabilities,
    });
};

const createTextModel = <TModelId extends OpenRouterTextModelId>(
    provider: AiSdkOpenRouterProvider,
    modelId: TModelId,
): OpenRouterTextModel<TModelId> => {
    return aiSdkTextModel<OpenRouterTextProviderOptions, TModelId>({
        model: provider(modelId),
        providerId: "openrouter",
        modelId,
    });
};

const createEmbeddingModel = <TModelId extends OpenRouterEmbeddingModelId>(
    provider: AiSdkOpenRouterProvider,
    modelId: TModelId,
): OpenRouterEmbeddingModel<TModelId> => {
    return aiSdkEmbeddingModel<OpenRouterEmbeddingProviderOptions, TModelId>({
        model: provider.embeddingModel(modelId),
        providerId: "openrouter",
        modelId,
    });
};

const createImageModel = <TModelId extends OpenRouterImageModelId>(
    provider: AiSdkOpenRouterProvider,
    modelId: TModelId,
): OpenRouterImageModel<TModelId> => {
    return aiSdkImageModel<OpenRouterImageProviderOptions, TModelId>({
        model: provider.imageModel(modelId),
        providerId: "openrouter",
        modelId,
    });
};

const createProvider = (provider: AiSdkOpenRouterProvider): OpenRouterProvider => {
    const createOpenRouterModel: OpenRouterProvider = Object.assign(
        <TModelId extends OpenRouterModelId>(modelId: TModelId): OpenRouterModel<TModelId> => {
            return createAgentModel(provider, modelId);
        },
        {
            text<TModelId extends OpenRouterTextModelId>(
                modelId: TModelId,
            ): OpenRouterTextModel<TModelId> {
                return createTextModel(provider, modelId);
            },
            embedding<TModelId extends OpenRouterEmbeddingModelId>(
                modelId: TModelId,
            ): OpenRouterEmbeddingModel<TModelId> {
                return createEmbeddingModel(provider, modelId);
            },
            image<TModelId extends OpenRouterImageModelId>(
                modelId: TModelId,
            ): OpenRouterImageModel<TModelId> {
                return createImageModel(provider, modelId);
            },
        },
    );

    return createOpenRouterModel;
};

export const createOpenRouter = (options: CreateOpenRouterOptions = {}): OpenRouterProvider => {
    return createProvider(createOpenAICompatibleOpenRouter(options));
};
