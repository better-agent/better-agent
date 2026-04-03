import { z } from "zod";
import {
    findFirstJsonSchemaNode,
    findJsonSchemaArrayItems,
    findJsonSchemaProperty,
    toZodJsonSchema,
} from "../../utils/schema-utils";
import { CreateSpeechRequest } from "../audio-speech/schemas";
import { CreateEmbeddingRequest } from "../embeddings/schemas";
import { OpenAICreateImageSchema } from "../images/schemas";
import { OpenAICreateResponseSchema } from "../responses/schemas";
import { OpenAICreateVideoSchema } from "../videos/schemas";

export type OpenAIImageStreamEvent =
    | {
          type: "image_generation.partial_image";
          b64_json: string;
          created_at: number;
          size?: string;
          quality?: string;
          background?: string;
          output_format?: string;
          partial_image_index?: number;
      }
    | {
          type: "image_generation.completed";
          b64_json: string;
          created_at: number;
          size?: string;
          quality?: string;
          background?: string;
          output_format?: string;
          usage?: {
              input_tokens?: number;
              output_tokens?: number;
              total_tokens?: number;
          };
      };

export type OpenAISpeechStreamEvent =
    | {
          type: "speech.audio.delta";
          audio: string;
      }
    | {
          type: "speech.audio.done";
          usage?: {
              input_tokens?: number;
              output_tokens?: number;
              total_tokens?: number;
          };
      };

export type OpenAITranscriptionStreamEvent =
    | {
          type: "transcript.text.delta";
          delta: string;
          logprobs?: unknown[];
          segment_id?: string;
      }
    | {
          type: "transcript.text.segment";
          id: string;
          start: number;
          end: number;
          text: string;
          speaker?: string;
      }
    | {
          type: "transcript.text.done";
          text: string;
          logprobs?: unknown[];
          usage?: {
              input_tokens?: number;
              output_tokens?: number;
              total_tokens?: number;
          };
      };

export type OpenAIFileObject = z.infer<typeof OpenAIFileObject>;
export type OpenAIFileList = z.infer<typeof OpenAIFileList>;
export type OpenAIDeleteFileResponse = z.infer<typeof OpenAIDeleteFileResponse>;

export const OpenAIFileObject = z
    .object({
        id: z.string().describe("Unique file identifier."),
        object: z.string().optional().describe("Object type, typically `file`."),
        bytes: z.number().int().nonnegative().optional().describe("File size in bytes."),
        created_at: z
            .number()
            .int()
            .optional()
            .describe("Unix timestamp when the file was created."),
        expires_at: z.number().int().nullish().describe("Optional expiration time."),
        filename: z.string().optional().describe("Original file name."),
        purpose: z.string().optional().describe("Declared file purpose."),
        status: z.string().optional().describe("Provider-side processing status."),
        status_details: z.any().optional().describe("Provider-side status details."),
    })
    .passthrough()
    .describe("OpenAI file object.");

export const OpenAIFileList = z
    .object({
        object: z.string().optional().describe("List object type."),
        data: z.array(OpenAIFileObject).describe("Files returned by the provider."),
        first_id: z.string().nullish().optional().describe("First file id in the page."),
        last_id: z.string().nullish().optional().describe("Last file id in the page."),
        has_more: z.boolean().optional().describe("Whether additional pages are available."),
    })
    .passthrough()
    .describe("OpenAI files list response.");

export const OpenAIDeleteFileResponse = z
    .object({
        id: z.string().describe("Deleted file identifier."),
        object: z.string().optional().describe("Delete response object type."),
        deleted: z.boolean().describe("Whether the file was deleted."),
    })
    .passthrough()
    .describe("OpenAI delete file response.");

const responseRequestJsonSchema = toZodJsonSchema(OpenAICreateResponseSchema);
const responseInputJsonSchema =
    findJsonSchemaProperty(responseRequestJsonSchema, "input") ?? ({} as Record<string, unknown>);

const responseArrayItemJsonSchema =
    findJsonSchemaArrayItems(
        findFirstJsonSchemaNode(
            responseInputJsonSchema,
            (node) => node.type === "array" && "items" in node,
        ),
    ) ?? ({} as Record<string, unknown>);

export const OpenAIResponsesModelInputJsonSchema = responseInputJsonSchema;

export const OpenAIImagesModelInputJsonSchema =
    findJsonSchemaProperty(toZodJsonSchema(OpenAICreateImageSchema), "prompt") ??
    ({} as Record<string, unknown>);

export const OpenAIVideosModelInputJsonSchema = {
    anyOf: [
        findJsonSchemaProperty(toZodJsonSchema(OpenAICreateVideoSchema), "prompt") ??
            ({} as Record<string, unknown>),
        {
            type: "array",
            minItems: 1,
            maxItems: 1,
            items: responseArrayItemJsonSchema,
        },
    ],
} satisfies Record<string, unknown>;

export const OpenAIAudioSpeechModelInputJsonSchema =
    findJsonSchemaProperty(toZodJsonSchema(CreateSpeechRequest), "input") ??
    ({} as Record<string, unknown>);

export const OpenAIAudioTranscriptionModelInputJsonSchema = responseInputJsonSchema;

export const OpenAIEmbeddingModelInputJsonSchema =
    findJsonSchemaProperty(toZodJsonSchema(CreateEmbeddingRequest), "input") ??
    ({} as Record<string, unknown>);
