import { z } from "zod";

import { XAIResponseModels as XAIResponseModelsSchema } from "../shared/schemas";

export type XAICreateResponseSchema = z.input<typeof XAICreateResponseSchema>;
export type XAIResponseSchema = z.infer<typeof XAIResponseSchema>;
export type XAICreateResponse = z.infer<typeof XAIResponseSchema>;

const XAIFunctionToolSchema = z
    .object({
        type: z.literal("function"),
        name: z.string().describe("Function tool name."),
        description: z.string().nullish().describe("Function tool description."),
        parameters: z.any().describe("JSON Schema describing the function arguments."),
        strict: z.boolean().nullish().describe("Whether strict schema validation is enabled."),
    })
    .describe("Custom function tool definition.");

const XAIWebSearchToolSchema = z
    .object({
        type: z.literal("web_search"),
        filters: z
            .object({
                allowed_websites: z.array(z.string()).max(5).optional(),
                excluded_websites: z.array(z.string()).max(5).optional(),
            })
            .optional(),
        enable_image_understanding: z.boolean().optional(),
    })
    .describe("xAI web search hosted tool.");

const XAIXSearchToolSchema = z
    .object({
        type: z.literal("x_search"),
        max_results: z.number().int().positive().optional(),
        mode: z.enum(["auto", "on", "off"]).optional(),
        return_citations: z.boolean().optional(),
        from_date: z.string().optional(),
        to_date: z.string().optional(),
        included_x_handles: z.array(z.string()).max(10).optional(),
        excluded_x_handles: z.array(z.string()).max(10).optional(),
        post_favorite_count: z.number().int().nonnegative().optional(),
        post_view_count: z.number().int().nonnegative().optional(),
    })
    .describe("xAI X search hosted tool.");

const XAICodeExecutionToolSchema = z.object({ type: z.literal("code_execution") });
const XAICodeInterpreterToolSchema = z.object({ type: z.literal("code_interpreter") });
const XAIAttachmentSearchToolSchema = z.object({ type: z.literal("attachment_search") });
const XAICollectionsSearchToolSchema = z.object({
    type: z.literal("collections_search"),
    collection_ids: z.array(z.string()).min(1).optional(),
});
const XAIFileSearchToolSchema = z.object({
    type: z.literal("file_search"),
    vector_store_ids: z.array(z.string()).min(1).optional(),
    max_num_results: z.number().int().positive().optional(),
});
const XAIMcpToolSchema = z.object({
    type: z.literal("mcp"),
    server_url: z.string().url(),
    server_label: z.string().optional(),
    server_description: z.string().optional(),
    authorization: z.string().optional(),
    extra_headers: z.record(z.string(), z.string()).optional(),
    allowed_tool_names: z.array(z.string()).optional(),
});

export const XAIResponseToolSchema = z
    .union([
        XAIFunctionToolSchema,
        XAIWebSearchToolSchema,
        XAIXSearchToolSchema,
        XAICodeExecutionToolSchema,
        XAICodeInterpreterToolSchema,
        XAIAttachmentSearchToolSchema,
        XAICollectionsSearchToolSchema,
        XAIFileSearchToolSchema,
        XAIMcpToolSchema,
    ])
    .describe("Supported xAI Responses API tool definitions.");

const XAIToolChoiceSchema = z.union([
    z.literal("none"),
    z.literal("auto"),
    z.literal("required"),
    z.object({
        type: z.literal("function"),
        name: z.string(),
    }),
]);

const XAIResponseMessageOutputSchema = z.object({
    type: z.literal("message"),
    role: z.enum(["assistant", "user", "system", "developer"]),
    content: z.array(
        z.union([
            z.object({ type: z.literal("output_text"), text: z.string() }),
            z.object({ type: z.literal("image"), image_url: z.string().url() }),
        ]),
    ),
});

const XAIResponseFunctionCallOutputSchema = z.object({
    type: z.literal("function_call"),
    name: z.string(),
    arguments: z.string(),
    call_id: z.string(),
});

const XAIResponseHostedToolCallSchema = z
    .object({
        type: z.enum([
            "web_search_call",
            "x_search_call",
            "file_search_call",
            "code_interpreter_call",
            "code_execution_call",
            "attachment_search_call",
            "collections_search_call",
            "mcp_call",
        ]),
        id: z.string(),
        status: z.string().optional(),
    })
    .passthrough();

const XAIResponseHostedToolCallOutputSchema = z
    .object({
        type: z.enum([
            "web_search_call_output",
            "x_search_call_output",
            "file_search_call_output",
            "code_interpreter_call_output",
            "code_execution_call_output",
            "attachment_search_call_output",
            "collections_search_call_output",
            "mcp_call_output",
        ]),
        call_id: z.string(),
    })
    .passthrough();

const XAIResponseOutputItemSchema = z.union([
    XAIResponseMessageOutputSchema,
    XAIResponseFunctionCallOutputSchema,
    XAIResponseHostedToolCallSchema,
    XAIResponseHostedToolCallOutputSchema,
]);

export const XAICreateResponseSchema = z.object({
    background: z.union([z.boolean(), z.null()]).default(false),
    include: z.union([z.array(z.string()), z.null()]).optional(),
    input: z.any(),
    instructions: z.union([z.string(), z.null()]).optional(),
    logprobs: z.union([z.boolean(), z.null()]).default(false),
    max_output_tokens: z.union([z.number().int(), z.null()]).optional(),
    metadata: z.any().optional(),
    model: XAIResponseModelsSchema,
    parallel_tool_calls: z.union([z.boolean(), z.null()]).default(true),
    previous_response_id: z.union([z.string(), z.null()]).optional(),
    reasoning: z.union([z.any(), z.null()]).optional(),
    search_parameters: z.union([z.any(), z.null()]).optional(),
    service_tier: z.union([z.string(), z.null()]).optional(),
    store: z.union([z.boolean(), z.null()]).default(true),
    stream: z.union([z.boolean(), z.null()]).default(false),
    temperature: z.union([z.number().gte(0).lte(2), z.null()]).default(1),
    text: z.union([z.any(), z.null()]).optional(),
    tool_choice: z.union([XAIToolChoiceSchema, z.null()]).optional(),
    tools: z.union([z.array(XAIResponseToolSchema).max(128), z.null()]).optional(),
    top_logprobs: z.union([z.number().int().gte(0).lte(8), z.null()]).optional(),
    top_p: z.union([z.number().gt(0).lte(1), z.null()]).optional(),
    user: z.union([z.string(), z.null()]).optional(),
});

export const XAIResponseSchema = z.object({
    id: z.string(),
    object: z.string().optional(),
    created_at: z.number().int().optional(),
    error: z.any().optional(),
    incomplete_details: z
        .union([z.object({ reason: z.string().optional() }).passthrough(), z.null()])
        .optional(),
    instructions: z.string().nullish().optional(),
    metadata: z.any().optional(),
    model: XAIResponseModelsSchema,
    output: z.array(XAIResponseOutputItemSchema).optional(),
    parallel_tool_calls: z.boolean().default(true),
    status: z.string().optional(),
    store: z.boolean().default(true),
    temperature: z.union([z.number().gte(0).lte(2), z.null()]).default(1),
    text: z.any(),
    tool_choice: XAIToolChoiceSchema,
    tools: z.array(XAIResponseToolSchema).max(128),
    top_p: z.union([z.number().gt(0).lte(1), z.null()]).default(1),
    usage: z.union([z.any(), z.null()]).optional(),
    user: z.union([z.string(), z.null()]).optional(),
});

export type XAIResponseModels = z.infer<typeof XAIResponseModelsSchema>;
