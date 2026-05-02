import { aiSdkEmbeddingModel, aiSdkModel, aiSdkTextModel } from "@better-agent/ai-sdk";
import type {
    AgentCapabilities,
    AgentModel,
    EmbeddingGenerationModel,
    TextGenerationModel,
} from "@better-agent/core";
import type { EmbeddingModel, LanguageModel } from "ai";
import {
    type OllamaChatProviderOptions as AiSdkOllamaChatProviderOptions,
    type OllamaEmbeddingProviderOptions as AiSdkOllamaEmbeddingProviderOptions,
    type OllamaProvider as AiSdkOllamaProvider,
    type OllamaProviderOptions as AiSdkOllamaProviderOptions,
    type OllamaChatSettings,
    type OllamaEmbeddingSettings,
    type OllamaProviderSettings,
    createOllama as createAiSdkOllama,
    ollama as defaultAiSdkOllama,
} from "ai-sdk-ollama";

export type CreateOllamaOptions = OllamaProviderSettings;

export type OllamaProviderOptions = {
    ollama?: AiSdkOllamaProviderOptions;
};
export type OllamaTextProviderOptions = {
    ollama?: AiSdkOllamaChatProviderOptions;
};
export type OllamaEmbeddingProviderOptions = {
    ollama?: AiSdkOllamaEmbeddingProviderOptions;
};
export type OllamaGenerationProviderOptions =
    | OllamaProviderOptions
    | OllamaTextProviderOptions
    | OllamaEmbeddingProviderOptions;

export type OllamaChatModelSettings = OllamaChatSettings;
export type OllamaEmbeddingModelSettings = OllamaEmbeddingSettings;

export type OllamaModelId = string;
export type OllamaTextModelId = OllamaModelId;
export type OllamaEmbeddingModelId = string;

export type OllamaModelOptions = OllamaChatModelSettings;

export type OllamaModel<TModelId extends OllamaModelId = OllamaModelId> = AgentModel<
    AgentCapabilities,
    undefined,
    OllamaProviderOptions,
    TModelId
>;
export type OllamaTextModel<TModelId extends OllamaTextModelId = OllamaTextModelId> =
    TextGenerationModel<OllamaTextProviderOptions, TModelId>;
export type OllamaEmbeddingModel<TModelId extends OllamaEmbeddingModelId = OllamaEmbeddingModelId> =
    EmbeddingGenerationModel<OllamaEmbeddingProviderOptions, TModelId>;

export type OllamaProvider = {
    <TModelId extends OllamaModelId>(
        modelId: TModelId,
        options?: OllamaModelOptions,
    ): OllamaModel<TModelId>;
    text<TModelId extends OllamaTextModelId>(
        modelId: TModelId,
        settings?: OllamaChatModelSettings,
    ): OllamaTextModel<TModelId>;
    embedding<TModelId extends OllamaEmbeddingModelId>(
        modelId: TModelId,
        settings?: OllamaEmbeddingModelSettings,
    ): OllamaEmbeddingModel<TModelId>;
};

const ollamaCapabilities = {
    identity: {
        provider: "ollama",
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
        parallelCalls: false,
    },
    reasoning: {
        supported: true,
    },
} as const satisfies AgentCapabilities;

const toAiSdkLanguageModel = (model: ReturnType<AiSdkOllamaProvider>): LanguageModel => {
    return model;
};

const toAiSdkEmbeddingModel = (
    model: ReturnType<AiSdkOllamaProvider["embedding"]>,
): EmbeddingModel => {
    return model;
};

const createAgentModel = <TModelId extends OllamaModelId>(
    provider: AiSdkOllamaProvider,
    modelId: TModelId,
    options: OllamaModelOptions | undefined,
): OllamaModel<TModelId> => {
    return aiSdkModel<AgentCapabilities, OllamaProviderOptions, TModelId>({
        model: toAiSdkLanguageModel(provider(modelId, options)),
        providerId: "ollama",
        modelId,
        capabilities: ollamaCapabilities,
    });
};

const createTextModel = <TModelId extends OllamaTextModelId>(
    provider: AiSdkOllamaProvider,
    modelId: TModelId,
    settings?: OllamaChatModelSettings,
): OllamaTextModel<TModelId> => {
    return aiSdkTextModel<OllamaTextProviderOptions, TModelId>({
        model: toAiSdkLanguageModel(provider(modelId, settings)),
        providerId: "ollama",
        modelId,
    });
};

const createEmbeddingModel = <TModelId extends OllamaEmbeddingModelId>(
    provider: AiSdkOllamaProvider,
    modelId: TModelId,
    settings?: OllamaEmbeddingModelSettings,
): OllamaEmbeddingModel<TModelId> => {
    return aiSdkEmbeddingModel<OllamaEmbeddingProviderOptions, TModelId>({
        model: toAiSdkEmbeddingModel(provider.embedding(modelId, settings)),
        providerId: "ollama",
        modelId,
    });
};

const createProvider = (provider: AiSdkOllamaProvider): OllamaProvider => {
    const createOllamaModel: OllamaProvider = Object.assign(
        <TModelId extends OllamaModelId>(
            modelId: TModelId,
            options?: OllamaModelOptions,
        ): OllamaModel<TModelId> => {
            return createAgentModel(provider, modelId, options);
        },
        {
            text<TModelId extends OllamaTextModelId>(
                modelId: TModelId,
                settings?: OllamaChatModelSettings,
            ): OllamaTextModel<TModelId> {
                return createTextModel(provider, modelId, settings);
            },
            embedding<TModelId extends OllamaEmbeddingModelId>(
                modelId: TModelId,
                settings?: OllamaEmbeddingModelSettings,
            ): OllamaEmbeddingModel<TModelId> {
                return createEmbeddingModel(provider, modelId, settings);
            },
        },
    );

    return createOllamaModel;
};

export const createOllama = (options: CreateOllamaOptions = {}): OllamaProvider => {
    return createProvider(createAiSdkOllama(options));
};

export const ollama = createProvider(defaultAiSdkOllama);
