import type {
    GenerativeModel,
    GenerativeModelCallOptions,
    ModalitiesParam,
    ModelDescriptor,
} from "@better-agent/core/providers";
import type { BetterAgentError } from "@better-agent/shared/errors";
import type { Result } from "@better-agent/shared/neverthrow";

import type { OpenAIAudioSpeechModels } from "./audio-speech/schemas";
import type { OpenAIAudioSpeechCaps, OpenAIAudioSpeechEndpointOptions } from "./audio-speech/types";
import type { OpenAIAudioTranscriptionModels } from "./audio-transcription/schemas";
import type {
    OpenAIAudioTranscriptionCaps,
    OpenAIAudioTranscriptionEndpointOptions,
} from "./audio-transcription/types";
import type { OpenAIEmbeddingModels } from "./embeddings/schemas";
import type { OpenAIEmbeddingCaps, OpenAIEmbeddingEndpointOptions } from "./embeddings/types";
import type { OpenAIImageModels } from "./images/schemas";
import type { OpenAIImageCaps, OpenAIImageEndpointOptions } from "./images/types";
import type { OpenAIResponseModels } from "./responses/schemas";
import type { OpenAIResponseCaps, OpenAIResponseEndpointOptions } from "./responses/types";
import type { OpenAIDeleteFileResponse, OpenAIFileList, OpenAIFileObject } from "./shared/schemas";
import type { OpenAINativeToolBuilders } from "./tools";
import type { OpenAIVideoModels } from "./videos/schemas";
import type { OpenAIVideoCaps, OpenAIVideoEndpointOptions } from "./videos/types";

export type { OpenAIAudioSpeechCaps, OpenAIAudioSpeechEndpointOptions } from "./audio-speech/types";
export type {
    OpenAIAudioTranscriptionCaps,
    OpenAIAudioTranscriptionEndpointOptions,
} from "./audio-transcription/types";
export type { OpenAIEmbeddingCaps, OpenAIEmbeddingEndpointOptions } from "./embeddings/types";
export type { OpenAIImageCaps, OpenAIImageEndpointOptions } from "./images/types";
export type { OpenAIResponseCaps, OpenAIResponseEndpointOptions } from "./responses/types";
export type { OpenAIVideoCaps, OpenAIVideoEndpointOptions } from "./videos/types";

export type OpenAIUploadableFile = Blob | File | Uint8Array | ArrayBuffer;

export type OpenAIFileUploadRequest = {
    file: OpenAIUploadableFile;
    filename?: string;
    mimeType?: string;
    purpose?: string;
};

export interface OpenAIFilesClient {
    /** Uploads a file and returns the provider-managed file object. */
    upload(
        body: OpenAIFileUploadRequest,
        options?: {
            signal?: AbortSignal | null;
        },
    ): Promise<Result<OpenAIFileObject, BetterAgentError>>;
    /** Lists files available to the current OpenAI project. */
    list(options?: {
        signal?: AbortSignal | null;
    }): Promise<Result<OpenAIFileList, BetterAgentError>>;
    /** Retrieves metadata for a single OpenAI file id. */
    retrieve(
        fileId: string,
        options?: {
            signal?: AbortSignal | null;
        },
    ): Promise<Result<OpenAIFileObject, BetterAgentError>>;
    /** Deletes a provider-managed OpenAI file. */
    delete(
        fileId: string,
        options?: {
            signal?: AbortSignal | null;
        },
    ): Promise<Result<OpenAIDeleteFileResponse, BetterAgentError>>;
    /** Downloads raw file content for a provider-managed OpenAI file. */
    content(
        fileId: string,
        options?: {
            signal?: AbortSignal | null;
        },
    ): Promise<Result<{ data: ArrayBuffer; mimeType: string }, BetterAgentError>>;
}

type SuggestedModelId<TKnown extends string> = TKnown | (string & {});

type OpenAIKnownModelId =
    | OpenAIResponseModels
    | OpenAIImageModels
    | OpenAIVideoModels
    | OpenAIAudioSpeechModels
    | OpenAIAudioTranscriptionModels
    | OpenAIEmbeddingModels;

export type OpenAIResponseModelId = SuggestedModelId<OpenAIResponseModels>;
export type OpenAIImageModelId = SuggestedModelId<OpenAIImageModels>;
export type OpenAIVideoModelId = SuggestedModelId<OpenAIVideoModels>;
export type OpenAIAudioSpeechModelId = SuggestedModelId<OpenAIAudioSpeechModels>;
export type OpenAIAudioTranscriptionModelId = SuggestedModelId<OpenAIAudioTranscriptionModels>;
export type OpenAIEmbeddingModelId = SuggestedModelId<OpenAIEmbeddingModels>;
export type OpenAIModelId = SuggestedModelId<OpenAIKnownModelId>;
export type OpenAIRouteHint =
    | "responses"
    | "images"
    | "videos"
    | "audio.speech"
    | "audio.transcription"
    | "embeddings";

export type OpenAICapsFor<M extends OpenAIModelId> = M extends OpenAIResponseModels
    ? OpenAIResponseCaps
    : M extends OpenAIImageModels
      ? OpenAIImageCaps
      : M extends OpenAIVideoModels
        ? OpenAIVideoCaps
        : M extends OpenAIAudioSpeechModels
          ? OpenAIAudioSpeechCaps
          : M extends OpenAIAudioTranscriptionModels
            ? OpenAIAudioTranscriptionCaps
            : M extends OpenAIEmbeddingModels
              ? OpenAIEmbeddingCaps
              : OpenAIResponseCaps;

export type OpenAIOptionsFor<M extends OpenAIModelId> = M extends OpenAIResponseModels
    ? OpenAIResponseEndpointOptions
    : M extends OpenAIImageModels
      ? OpenAIImageEndpointOptions
      : M extends OpenAIVideoModels
        ? OpenAIVideoEndpointOptions
        : M extends OpenAIAudioSpeechModels
          ? OpenAIAudioSpeechEndpointOptions
          : M extends OpenAIAudioTranscriptionModels
            ? OpenAIAudioTranscriptionEndpointOptions
            : M extends OpenAIEmbeddingModels
              ? OpenAIEmbeddingEndpointOptions
              : OpenAIResponseEndpointOptions;

export type OpenAIModelsDescriptor = {
    [M in OpenAIKnownModelId]: ModelDescriptor<OpenAIOptionsFor<M>, OpenAICapsFor<M>>;
};

export type OpenAIGenerativeModel<M extends OpenAIModelId> = GenerativeModel<
    OpenAIOptionsFor<M>,
    "openai",
    M,
    OpenAICapsFor<M>
>;

export type OpenAIResponseGenerativeModel<M extends OpenAIResponseModelId = OpenAIResponseModelId> =
    GenerativeModel<OpenAIResponseEndpointOptions, "openai", M, OpenAIResponseCaps>;

export type OpenAIImageGenerativeModel<M extends OpenAIImageModelId = OpenAIImageModelId> =
    GenerativeModel<OpenAIImageEndpointOptions, "openai", M, OpenAIImageCaps>;

export type OpenAIVideoGenerativeModel<M extends OpenAIVideoModelId = OpenAIVideoModelId> =
    GenerativeModel<OpenAIVideoEndpointOptions, "openai", M, OpenAIVideoCaps>;

export type OpenAIAudioSpeechGenerativeModel<
    M extends OpenAIAudioSpeechModelId = OpenAIAudioSpeechModelId,
> = GenerativeModel<OpenAIAudioSpeechEndpointOptions, "openai", M, OpenAIAudioSpeechCaps>;

export type OpenAIAudioTranscriptionGenerativeModel<
    M extends OpenAIAudioTranscriptionModelId = OpenAIAudioTranscriptionModelId,
> = GenerativeModel<
    OpenAIAudioTranscriptionEndpointOptions,
    "openai",
    M,
    OpenAIAudioTranscriptionCaps
>;

export type OpenAIEmbeddingGenerativeModel<
    M extends OpenAIEmbeddingModelId = OpenAIEmbeddingModelId,
> = GenerativeModel<OpenAIEmbeddingEndpointOptions, "openai", M, OpenAIEmbeddingCaps>;

export interface OpenAIProvider {
    readonly id: "openai";
    readonly tools: OpenAINativeToolBuilders;
    readonly files: OpenAIFilesClient;
    model<M extends OpenAIKnownModelId>(modelId: M): OpenAIGenerativeModel<M>;
    model<M extends OpenAIModelId>(modelId: M): OpenAIGenerativeModel<M>;
    text<M extends OpenAIResponseModels>(modelId: M): OpenAIResponseGenerativeModel<M>;
    text<M extends OpenAIResponseModelId>(modelId: M): OpenAIResponseGenerativeModel<M>;
    image<M extends OpenAIImageModels>(modelId: M): OpenAIImageGenerativeModel<M>;
    image<M extends OpenAIImageModelId>(modelId: M): OpenAIImageGenerativeModel<M>;
    video<M extends OpenAIVideoModels>(modelId: M): OpenAIVideoGenerativeModel<M>;
    video<M extends OpenAIVideoModelId>(modelId: M): OpenAIVideoGenerativeModel<M>;
    audio<M extends OpenAIAudioSpeechModels>(modelId: M): OpenAIAudioSpeechGenerativeModel<M>;
    audio<M extends OpenAIAudioSpeechModelId>(modelId: M): OpenAIAudioSpeechGenerativeModel<M>;
    transcription<M extends OpenAIAudioTranscriptionModels>(
        modelId: M,
    ): OpenAIAudioTranscriptionGenerativeModel<M>;
    transcription<M extends OpenAIAudioTranscriptionModelId>(
        modelId: M,
    ): OpenAIAudioTranscriptionGenerativeModel<M>;
    embedding<M extends OpenAIEmbeddingModels>(modelId: M): OpenAIEmbeddingGenerativeModel<M>;
    embedding<M extends OpenAIEmbeddingModelId>(modelId: M): OpenAIEmbeddingGenerativeModel<M>;
}

export type OpenAICallOptions<
    M extends OpenAIModelId,
    TModalities extends ModalitiesParam<OpenAICapsFor<M>> = undefined,
> = GenerativeModelCallOptions<OpenAICapsFor<M>, OpenAIOptionsFor<M>, TModalities>;

export interface OpenAIConfig {
    baseURL?: string;
    apiKey?: string;
    organization?: string;
    project?: string;
    headers?: Record<string, string>;
}

export interface OpenAIError {
    error: {
        message: string;
        type: string;
        param: string | null;
        code: string;
    };
}
