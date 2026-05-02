import {
    type XaiImageModelOptions,
    type XaiLanguageModelResponsesOptions,
    type XaiProviderSettings,
    type XaiVideoModelOptions,
    createXai as createAiSdkXai,
    xai as defaultAiSdkXai,
} from "@ai-sdk/xai";
import { aiSdkImageModel, aiSdkModel, aiSdkTextModel, aiSdkVideoModel } from "@better-agent/ai-sdk";
import type {
    AgentCapabilities,
    AgentModel,
    ImageGenerationModel,
    TextGenerationModel,
    VideoGenerationModel,
} from "@better-agent/core";

export type CreateXaiOptions = XaiProviderSettings;

export type XaiProviderOptions = {
    xai?: XaiLanguageModelResponsesOptions;
};
export type XaiTextProviderOptions = XaiProviderOptions;
export type XaiImageProviderOptions = {
    xai?: XaiImageModelOptions;
};
export type XaiVideoProviderOptions = {
    xai?: XaiVideoModelOptions;
};
export type XaiGenerationProviderOptions =
    | XaiProviderOptions
    | XaiTextProviderOptions
    | XaiImageProviderOptions
    | XaiVideoProviderOptions;

type AiSdkXaiProvider = typeof defaultAiSdkXai;

export type XaiModelId = Parameters<AiSdkXaiProvider["responses"]>[0];
export type XaiTextModelId = XaiModelId;
export type XaiImageModelId = Parameters<AiSdkXaiProvider["image"]>[0];
export type XaiVideoModelId = Parameters<AiSdkXaiProvider["video"]>[0];

export type XaiModel<TModelId extends XaiModelId = XaiModelId> = AgentModel<
    AgentCapabilities,
    undefined,
    XaiProviderOptions,
    TModelId
>;
export type XaiTextModel<TModelId extends XaiTextModelId = XaiTextModelId> = TextGenerationModel<
    XaiTextProviderOptions,
    TModelId
>;
export type XaiImageModel<TModelId extends XaiImageModelId = XaiImageModelId> =
    ImageGenerationModel<XaiImageProviderOptions, TModelId>;
export type XaiVideoModel<TModelId extends XaiVideoModelId = XaiVideoModelId> =
    VideoGenerationModel<XaiVideoProviderOptions, TModelId>;

export type XaiProvider = {
    <TModelId extends XaiModelId>(modelId: TModelId): XaiModel<TModelId>;
    text<TModelId extends XaiTextModelId>(modelId: TModelId): XaiTextModel<TModelId>;
    image<TModelId extends XaiImageModelId>(modelId: TModelId): XaiImageModel<TModelId>;
    video<TModelId extends XaiVideoModelId>(modelId: TModelId): XaiVideoModel<TModelId>;
    tools: typeof defaultAiSdkXai.tools;
};

const xaiCapabilities = {
    identity: {
        provider: "xai",
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
        parallelCalls: true,
    },
    reasoning: {
        supported: true,
    },
} as const satisfies AgentCapabilities;

const createAgentModel = <TModelId extends XaiModelId>(
    provider: AiSdkXaiProvider,
    modelId: TModelId,
): XaiModel<TModelId> => {
    return aiSdkModel<AgentCapabilities, XaiProviderOptions, TModelId>({
        model: provider.responses(modelId),
        providerId: "xai",
        modelId,
        capabilities: xaiCapabilities,
    });
};

const createTextModel = <TModelId extends XaiTextModelId>(
    provider: AiSdkXaiProvider,
    modelId: TModelId,
): XaiTextModel<TModelId> => {
    return aiSdkTextModel<XaiTextProviderOptions, TModelId>({
        model: provider.responses(modelId),
        providerId: "xai",
        modelId,
    });
};

const createImageModel = <TModelId extends XaiImageModelId>(
    provider: AiSdkXaiProvider,
    modelId: TModelId,
): XaiImageModel<TModelId> => {
    return aiSdkImageModel<XaiImageProviderOptions, TModelId>({
        model: provider.image(modelId),
        providerId: "xai",
        modelId,
    });
};

const createVideoModel = <TModelId extends XaiVideoModelId>(
    provider: AiSdkXaiProvider,
    modelId: TModelId,
): XaiVideoModel<TModelId> => {
    return aiSdkVideoModel<XaiVideoProviderOptions, TModelId>({
        model: provider.video(modelId),
        providerId: "xai",
        modelId,
    });
};

const createProvider = (provider: AiSdkXaiProvider): XaiProvider => {
    const createXaiModel: XaiProvider = Object.assign(
        <TModelId extends XaiModelId>(modelId: TModelId): XaiModel<TModelId> => {
            return createAgentModel(provider, modelId);
        },
        {
            text<TModelId extends XaiTextModelId>(modelId: TModelId): XaiTextModel<TModelId> {
                return createTextModel(provider, modelId);
            },
            image<TModelId extends XaiImageModelId>(modelId: TModelId): XaiImageModel<TModelId> {
                return createImageModel(provider, modelId);
            },
            video<TModelId extends XaiVideoModelId>(modelId: TModelId): XaiVideoModel<TModelId> {
                return createVideoModel(provider, modelId);
            },
            tools: provider.tools,
        },
    );

    return createXaiModel;
};

export const createXai = (options: CreateXaiOptions = {}): XaiProvider => {
    return createProvider(createAiSdkXai(options));
};

export const xai = createProvider(defaultAiSdkXai);
