type GenerativeModelBinaryMediaSource =
    | {
          kind: "url";
          url: string;
      }
    | {
          kind: "base64";
          data: string;
          mimeType: string;
      };

/**
 * Image source supported by input and output content.
 */
export type GenerativeModelImageSource = GenerativeModelBinaryMediaSource;

/**
 * Base text content shape.
 */
export type TextContentBase = {
    type: "text";
    text: string;
    providerMetadata?: Record<string, unknown>;
};

/**
 * Base image content shape.
 */
export type ImageContentBase = {
    type: "image";
    source: GenerativeModelImageSource;
    providerMetadata?: Record<string, unknown>;
};

/**
 * File source supported by input content.
 *
 * Prefer `url` or `base64` when the content is portable across providers.
 *
 * Use `provider-file` as a deliberate escape hatch for provider-managed asset
 * references when the upstream provider expects a previously uploaded file or
 * asset id rather than inline bytes.
 */
export type GenerativeModelFileSource =
    | {
          kind: "url";
          url: string;
          mimeType?: string;
          filename?: string;
      }
    | {
          kind: "base64";
          data: string;
          mimeType: string;
          filename?: string;
      }
    | {
          kind: "provider-file";
          ref: {
              provider: string;
              id: string;
          };
          mimeType?: string;
          filename?: string;
      };

/**
 * Base file content shape.
 */
export type FileContentBase = {
    type: "file";
    source: GenerativeModelFileSource;
    providerMetadata?: Record<string, unknown>;
};

/**
 * Audio source supported by input and output content.
 */
export type GenerativeModelAudioSource = GenerativeModelBinaryMediaSource;

/**
 * Base audio content shape.
 */
export type AudioContentBase = {
    type: "audio";
    source: GenerativeModelAudioSource;
    providerMetadata?: Record<string, unknown>;
};

/**
 * Base embedding content shape.
 */
export type EmbeddingContentBase = {
    type: "embedding";
    embedding: number[];
    providerMetadata?: Record<string, unknown>;
};

/**
 * Base transcript content shape.
 */
export type TranscriptContentBase = {
    type: "transcript";
    text: string;
    segments?: Array<{
        id: string;
        start: number;
        end: number;
        text: string;
        speaker?: string;
    }>;
    providerMetadata?: Record<string, unknown>;
};

/**
 * Base reasoning content shape.
 */
export type ReasoningContentBase = {
    type: "reasoning";
    text: string;
    visibility: "summary" | "full";
    provider?: string;
    providerMetadata?: Record<string, unknown>;
};

/**
 * Video source supported by input and output content.
 */
export type GenerativeModelVideoSource = GenerativeModelBinaryMediaSource;

/**
 * Base video content shape.
 */
export type VideoContentBase = {
    type: "video";
    source: GenerativeModelVideoSource;
    providerMetadata?: Record<string, unknown>;
};
