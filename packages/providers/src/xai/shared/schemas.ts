import { z } from "zod";

export type XAIResponseStreamEvent =
    | {
          type: "error";
          message?: string;
          [key: string]: unknown;
      }
    | {
          type: "response.completed";
          response: unknown;
          [key: string]: unknown;
      }
    | {
          type:
              | "response.reasoning_summary_part.added"
              | "response.reasoning_summary_text.done"
              | "response.reasoning_text.done"
              | "response.output_text.done";
          [key: string]: unknown;
      }
    | {
          type:
              | "response.reasoning_summary_text.delta"
              | "response.reasoning_text.delta"
              | "response.output_text.delta"
              | "response.function_call_arguments.delta";
          delta?: string;
          item_id?: string;
          call_id?: string;
          [key: string]: unknown;
      }
    | {
          type: "response.function_call_arguments.done";
          item_id?: string;
          call_id?: string;
          [key: string]: unknown;
      }
    | {
          type: "response.output_item.added" | "response.output_item.done";
          item: {
              type: string;
              id?: string;
              call_id?: string;
              name?: string;
              status?: string;
              [key: string]: unknown;
          };
          [key: string]: unknown;
      }
    | {
          type:
              | "response.web_search_call.in_progress"
              | "response.web_search_call.searching"
              | "response.web_search_call.completed"
              | "response.x_search_call.in_progress"
              | "response.x_search_call.searching"
              | "response.x_search_call.completed"
              | "response.file_search_call.in_progress"
              | "response.file_search_call.searching"
              | "response.file_search_call.completed"
              | "response.code_interpreter_call.in_progress"
              | "response.code_interpreter_call.interpreting"
              | "response.code_interpreter_call.completed"
              | "response.code_execution_call.in_progress"
              | "response.code_execution_call.interpreting"
              | "response.code_execution_call.completed"
              | "response.mcp_call.in_progress"
              | "response.mcp_call.completed"
              | "response.mcp_call.failed"
              | "response.mcp_list_tools.in_progress"
              | "response.mcp_list_tools.completed"
              | "response.mcp_list_tools.failed";
          item_id?: string;
          [key: string]: unknown;
      };

export type XAIFileObjectSchema = z.infer<typeof XAIFileObjectSchema>;
export type XAIFileListSchema = z.infer<typeof XAIFileListSchema>;
export type XAIDeleteFileResponseSchema = z.infer<typeof XAIDeleteFileResponseSchema>;

export const XAI_RESPONSE_MODEL_NAMES = [
    "grok-3",
    "grok-3-latest",
    "grok-3-beta",
    "grok-3-fast",
    "grok-3-fast-latest",
    "grok-3-fast-beta",
    "grok-3-mini",
    "grok-4",
    "grok-4-1-fast-reasoning",
    "grok-4.20-beta-latest-non-reasoning",
    "grok-4.20-multi-agent-beta-0309",
    "grok-code-fast-1",
] as const;

export const XAI_IMAGE_MODEL_NAMES = ["grok-imagine-image"] as const;

export const XAIResponseModels = z
    .enum(XAI_RESPONSE_MODEL_NAMES)
    .describe(
        "Current documented xAI response model names. For the latest team-specific availability, also check <https://console.x.ai/team/default/models> and <https://docs.x.ai/docs/models>.",
    );

export const XAIImageModels = z
    .enum(XAI_IMAGE_MODEL_NAMES)
    .describe(
        "Current documented xAI image model names. For the latest team-specific availability, also check <https://console.x.ai/team/default/models> and <https://docs.x.ai/docs/models>.",
    );

export type XAIResponseModels = z.infer<typeof XAIResponseModels>;
export type XAIImageModels = z.infer<typeof XAIImageModels>;
export type XAIModelKind = "text" | "image";

export const XAI_MODEL_KINDS = {
    "grok-3": "text",
    "grok-3-latest": "text",
    "grok-3-beta": "text",
    "grok-3-fast": "text",
    "grok-3-fast-latest": "text",
    "grok-3-fast-beta": "text",
    "grok-3-mini": "text",
    "grok-4": "text",
    "grok-4-1-fast-reasoning": "text",
    "grok-4.20-beta-latest-non-reasoning": "text",
    "grok-4.20-multi-agent-beta-0309": "text",
    "grok-code-fast-1": "text",
    "grok-imagine-image": "image",
} as const satisfies Record<XAIResponseModels | XAIImageModels, XAIModelKind>;

export const getXAIModelKind = (modelId: string): XAIModelKind | undefined =>
    (XAI_MODEL_KINDS as Record<string, XAIModelKind | undefined>)[modelId];

const XAIFileObjectSchema = z
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
    .describe("xAI file object.");

const XAIFileListSchema = z
    .object({
        object: z.string().optional().describe("List object type."),
        data: z.array(XAIFileObjectSchema).describe("Files returned by the provider."),
        first_id: z.string().nullish().optional().describe("First file id in the page."),
        last_id: z.string().nullish().optional().describe("Last file id in the page."),
        has_more: z.boolean().optional().describe("Whether additional pages are available."),
    })
    .passthrough()
    .describe("xAI files list response.");

const XAIDeleteFileResponseSchema = z
    .object({
        id: z.string().describe("Deleted file identifier."),
        object: z.string().optional().describe("Delete response object type."),
        deleted: z.boolean().describe("Whether the file was deleted."),
    })
    .passthrough()
    .describe("xAI delete file response.");

export { type XAIDeleteFileResponseSchema, type XAIFileListSchema, XAIFileObjectSchema };
