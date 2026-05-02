import {
    type AnthropicLanguageModelOptions,
    type AnthropicProviderSettings,
    createAnthropic as createAiSdkAnthropic,
    anthropic as defaultAiSdkAnthropic,
} from "@ai-sdk/anthropic";
import type { AnthropicMessagesModelId as AiSdkAnthropicMessagesModelId } from "@ai-sdk/anthropic/internal";
import { aiSdkModel, aiSdkTextModel } from "@better-agent/ai-sdk";
import type { AgentCapabilities, AgentModel, TextGenerationModel } from "@better-agent/core";

export type CreateAnthropicOptions = AnthropicProviderSettings;

export type AnthropicProviderOptions = {
    anthropic?: AnthropicLanguageModelOptions;
};
export type AnthropicTextProviderOptions = AnthropicProviderOptions;
export type AnthropicGenerationProviderOptions = AnthropicProviderOptions;

type AiSdkAnthropicProvider = typeof defaultAiSdkAnthropic;

export type AnthropicModelId = AiSdkAnthropicMessagesModelId;
export type AnthropicTextModelId = AnthropicModelId;

export type AnthropicModel<TModelId extends AnthropicModelId = AnthropicModelId> = AgentModel<
    AgentCapabilities,
    undefined,
    AnthropicProviderOptions,
    TModelId
>;
export type AnthropicTextModel<TModelId extends AnthropicTextModelId = AnthropicTextModelId> =
    TextGenerationModel<AnthropicTextProviderOptions, TModelId>;

export type AnthropicProvider = {
    <TModelId extends AnthropicModelId>(modelId: TModelId): AnthropicModel<TModelId>;
    text<TModelId extends AnthropicTextModelId>(modelId: TModelId): AnthropicTextModel<TModelId>;
    tools: typeof defaultAiSdkAnthropic.tools;
};

const anthropicCapabilities = {
    identity: {
        provider: "anthropic",
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

const createAgentModel = <TModelId extends AnthropicModelId>(
    provider: AiSdkAnthropicProvider,
    modelId: TModelId,
): AnthropicModel<TModelId> => {
    return aiSdkModel<AgentCapabilities, AnthropicProviderOptions, TModelId>({
        model: provider(modelId),
        providerId: "anthropic",
        modelId,
        capabilities: anthropicCapabilities,
    });
};

const createTextModel = <TModelId extends AnthropicTextModelId>(
    provider: AiSdkAnthropicProvider,
    modelId: TModelId,
): AnthropicTextModel<TModelId> => {
    return aiSdkTextModel<AnthropicTextProviderOptions, TModelId>({
        model: provider(modelId),
        providerId: "anthropic",
        modelId,
    });
};

const createProvider = (provider: AiSdkAnthropicProvider): AnthropicProvider => {
    const createAnthropicModel: AnthropicProvider = Object.assign(
        <TModelId extends AnthropicModelId>(modelId: TModelId): AnthropicModel<TModelId> => {
            return createAgentModel(provider, modelId);
        },
        {
            text<TModelId extends AnthropicTextModelId>(
                modelId: TModelId,
            ): AnthropicTextModel<TModelId> {
                return createTextModel(provider, modelId);
            },
            tools: provider.tools,
        },
    );

    return createAnthropicModel;
};

export const createAnthropic = (options: CreateAnthropicOptions = {}): AnthropicProvider => {
    return createProvider(createAiSdkAnthropic(options));
};

export const anthropic = createProvider(defaultAiSdkAnthropic);
