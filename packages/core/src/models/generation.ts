import type { AgentEvent } from "../ag-ui/events";
import type { AgentMessageContent } from "../ag-ui/messages";
import type { FinishReason, TokenUsage } from "../runtime/results";

export type GenerationModelKind =
    | "text"
    | "embedding"
    | "image"
    | "video"
    | "speech"
    | "transcription";

export interface BaseGenerationModel<
    TKind extends GenerationModelKind,
    TModelId extends string = string,
> {
    providerId: string;
    modelId: TModelId;
    kind: TKind;
}

export type GenerationMessage =
    | {
          role: "system" | "developer";
          content: string;
      }
    | {
          role: "user" | "assistant";
          content: AgentMessageContent;
      };

export type TextGenerationInputValue = string | GenerationMessage[];
export type TranscriptionGenerationInputValue =
    | ArrayBuffer
    | Blob
    | string
    | Uint8Array
    | GeneratedFile;

export type GeneratedFile =
    | {
          sourceType: "data";
          data: Uint8Array;
          mediaType?: string;
          providerMetadata?: unknown;
      }
    | {
          sourceType: "url";
          url: string;
          mediaType?: string;
          providerMetadata?: unknown;
      };

export type GeneratedImage = GeneratedFile;
export type GeneratedVideo = GeneratedFile;

export type VideoGenerationImageInput = string | Uint8Array | GeneratedFile;
export type VideoGenerationInputValue =
    | string
    | {
          image: VideoGenerationImageInput;
          text?: string;
      };

export interface TextGenerationInput<TProviderOptions = unknown> {
    input: TextGenerationInputValue;
    providerOptions?: TProviderOptions;
    signal?: AbortSignal;
}

export interface TextGenerationResult {
    text: string;
    files: GeneratedFile[];
    finishReason?: FinishReason;
    usage?: TokenUsage;
    providerMetadata?: unknown;
}

export interface TextGenerationStreamResult {
    events: AsyncIterable<AgentEvent>;
    final: Promise<TextGenerationResult>;
}

export interface TextGenerationModel<TProviderOptions = unknown, TModelId extends string = string>
    extends BaseGenerationModel<"text", TModelId> {
    generate(input: TextGenerationInput<TProviderOptions>): Promise<TextGenerationResult>;
    stream(input: TextGenerationInput<TProviderOptions>): Promise<TextGenerationStreamResult>;
}

export interface EmbeddingGenerationInput<TProviderOptions = unknown> {
    input: string;
    providerOptions?: TProviderOptions;
    signal?: AbortSignal;
}

export interface EmbeddingGenerationManyInput<TProviderOptions = unknown> {
    input: string[];
    providerOptions?: TProviderOptions;
    signal?: AbortSignal;
}

export interface EmbeddingGenerationResult {
    embedding: number[];
    usage?: {
        tokens?: number;
    };
    providerMetadata?: unknown;
}

export interface EmbeddingGenerationManyResult {
    embeddings: number[][];
    usage?: {
        tokens?: number;
    };
    providerMetadata?: unknown;
}

export interface EmbeddingGenerationModel<
    TProviderOptions = unknown,
    TModelId extends string = string,
> extends BaseGenerationModel<"embedding", TModelId> {
    embed(input: EmbeddingGenerationInput<TProviderOptions>): Promise<EmbeddingGenerationResult>;
    embedMany(
        input: EmbeddingGenerationManyInput<TProviderOptions>,
    ): Promise<EmbeddingGenerationManyResult>;
}

export interface ImageGenerationInput<TProviderOptions = unknown> {
    input: string;
    n?: number;
    size?: string;
    aspectRatio?: string;
    providerOptions?: TProviderOptions;
    signal?: AbortSignal;
}

export interface ImageGenerationResult {
    images: GeneratedImage[];
    providerMetadata?: unknown;
}

export interface ImageGenerationModel<TProviderOptions = unknown, TModelId extends string = string>
    extends BaseGenerationModel<"image", TModelId> {
    generate(input: ImageGenerationInput<TProviderOptions>): Promise<ImageGenerationResult>;
}

export interface VideoGenerationInput<TProviderOptions = unknown> {
    input: VideoGenerationInputValue;
    n?: number;
    aspectRatio?: string;
    resolution?: string;
    duration?: number;
    providerOptions?: TProviderOptions;
    signal?: AbortSignal;
}

export interface VideoGenerationResult {
    videos: GeneratedVideo[];
    providerMetadata?: unknown;
}

export interface VideoGenerationModel<TProviderOptions = unknown, TModelId extends string = string>
    extends BaseGenerationModel<"video", TModelId> {
    generate(input: VideoGenerationInput<TProviderOptions>): Promise<VideoGenerationResult>;
}

export interface SpeechGenerationInput<TProviderOptions = unknown> {
    input: string;
    voice?: string;
    providerOptions?: TProviderOptions;
    signal?: AbortSignal;
}

export interface SpeechGenerationResult {
    audio: GeneratedFile;
    providerMetadata?: unknown;
}

export interface SpeechGenerationModel<TProviderOptions = unknown, TModelId extends string = string>
    extends BaseGenerationModel<"speech", TModelId> {
    generate(input: SpeechGenerationInput<TProviderOptions>): Promise<SpeechGenerationResult>;
}

export interface TranscriptionGenerationInput<TProviderOptions = unknown> {
    input: TranscriptionGenerationInputValue;
    providerOptions?: TProviderOptions;
    signal?: AbortSignal;
}

export interface TranscriptionGenerationResult {
    text: string;
    segments?: unknown;
    providerMetadata?: unknown;
}

export interface TranscriptionGenerationModel<
    TProviderOptions = unknown,
    TModelId extends string = string,
> extends BaseGenerationModel<"transcription", TModelId> {
    transcribe(
        input: TranscriptionGenerationInput<TProviderOptions>,
    ): Promise<TranscriptionGenerationResult>;
}
