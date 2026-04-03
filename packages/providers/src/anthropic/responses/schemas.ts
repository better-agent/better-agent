import { z } from "zod";

export const ANTHROPIC_KNOWN_RESPONSE_MODELS = [
    "claude-3-haiku-20240307",
    "claude-haiku-4-5-20251001",
    "claude-haiku-4-5",
    "claude-opus-4-0",
    "claude-opus-4-20250514",
    "claude-opus-4-1-20250805",
    "claude-opus-4-1",
    "claude-opus-4-5",
    "claude-opus-4-5-20251101",
    "claude-sonnet-4-0",
    "claude-sonnet-4-20250514",
    "claude-sonnet-4-5-20250929",
    "claude-sonnet-4-5",
    "claude-sonnet-4-6",
    "claude-opus-4-6",
] as const;

export type AnthropicMessagesRequestSchema = z.input<typeof AnthropicMessagesRequestSchema>;
export type AnthropicMessagesResponseSchema = z.infer<typeof AnthropicMessagesResponseSchema>;
export type AnthropicMessagesResponse = z.infer<typeof AnthropicMessagesResponseSchema>;
export type AnthropicResponseStreamEvent = z.infer<typeof AnthropicResponseStreamEventSchema>;
export type AnthropicResponseModels = (typeof ANTHROPIC_KNOWN_RESPONSE_MODELS)[number];

export const AnthropicKnownResponseModelsSchema = z.enum(ANTHROPIC_KNOWN_RESPONSE_MODELS);
export const AnthropicResponseModelIdSchema = z.string();

export const AnthropicCacheControlSchema = z.object({
    type: z.literal("ephemeral"),
    ttl: z.enum(["5m", "1h"]).optional(),
});

const AnthropicTextContentSchema = z.object({
    type: z.literal("text"),
    text: z.string(),
    citations: z.array(z.unknown()).optional(),
    cache_control: AnthropicCacheControlSchema.optional(),
});

const AnthropicThinkingContentSchema = z.object({
    type: z.literal("thinking"),
    thinking: z.string(),
    signature: z.string(),
});

const AnthropicRedactedThinkingContentSchema = z.object({
    type: z.literal("redacted_thinking"),
    data: z.string(),
});

const AnthropicContentSourceSchema = z.discriminatedUnion("type", [
    z.object({
        type: z.literal("base64"),
        media_type: z.string(),
        data: z.string(),
    }),
    z.object({
        type: z.literal("url"),
        url: z.string(),
    }),
    z.object({
        type: z.literal("text"),
        media_type: z.literal("text/plain"),
        data: z.string(),
    }),
]);

const AnthropicImageContentSchema = z.object({
    type: z.literal("image"),
    source: AnthropicContentSourceSchema,
    cache_control: AnthropicCacheControlSchema.optional(),
});

const AnthropicDocumentContentSchema = z.object({
    type: z.literal("document"),
    source: AnthropicContentSourceSchema,
    title: z.string().optional(),
    context: z.string().optional(),
    citations: z.object({ enabled: z.boolean() }).optional(),
    cache_control: AnthropicCacheControlSchema.optional(),
});

const AnthropicToolResultContentSchema = z.object({
    type: z.literal("tool_result"),
    tool_use_id: z.string(),
    content: z.union([z.string(), z.array(z.unknown())]),
    is_error: z.boolean().optional(),
    cache_control: AnthropicCacheControlSchema.optional(),
});

const AnthropicToolCallContentSchema = z.object({
    type: z.literal("tool_use"),
    id: z.string(),
    name: z.string(),
    input: z.unknown(),
    cache_control: AnthropicCacheControlSchema.optional(),
});

const AnthropicServerToolUseContentSchema = z.object({
    type: z.literal("server_tool_use"),
    id: z.string(),
    name: z.enum([
        "web_fetch",
        "web_search",
        "code_execution",
        "bash_code_execution",
        "text_editor_code_execution",
        "tool_search_tool_regex",
        "tool_search_tool_bm25",
    ]),
    input: z.unknown(),
    cache_control: AnthropicCacheControlSchema.optional(),
});

const AnthropicProviderToolResultSchema = z
    .object({
        tool_use_id: z.string(),
        cache_control: AnthropicCacheControlSchema.optional(),
    })
    .passthrough();

const AnthropicWebSearchToolResultContentSchema = AnthropicProviderToolResultSchema.extend({
    type: z.literal("web_search_tool_result"),
    content: z.array(
        z.object({
            url: z.string(),
            title: z.string().nullable(),
            page_age: z.string().nullable(),
            encrypted_content: z.string(),
            type: z.string(),
        }),
    ),
});

const AnthropicWebFetchToolResultContentSchema = AnthropicProviderToolResultSchema.extend({
    type: z.literal("web_fetch_tool_result"),
    content: z.unknown(),
});

const AnthropicToolSearchToolResultContentSchema = AnthropicProviderToolResultSchema.extend({
    type: z.literal("tool_search_tool_result"),
    content: z.unknown(),
});

const AnthropicCodeExecutionToolResultContentSchema = AnthropicProviderToolResultSchema.extend({
    type: z.literal("code_execution_tool_result"),
    content: z.unknown(),
});

const AnthropicBashCodeExecutionToolResultContentSchema = AnthropicProviderToolResultSchema.extend({
    type: z.literal("bash_code_execution_tool_result"),
    content: z.unknown(),
});

const AnthropicTextEditorCodeExecutionToolResultContentSchema =
    AnthropicProviderToolResultSchema.extend({
        type: z.literal("text_editor_code_execution_tool_result"),
        content: z.unknown(),
    });

const AnthropicMcpToolUseContentSchema = z
    .object({
        type: z.literal("mcp_tool_use"),
        id: z.string(),
        name: z.string(),
        server_name: z.string().optional(),
        input: z.unknown(),
        cache_control: AnthropicCacheControlSchema.optional(),
    })
    .passthrough();

const AnthropicMcpToolResultContentSchema = z
    .object({
        type: z.literal("mcp_tool_result"),
        tool_use_id: z.string(),
        content: z.unknown(),
        is_error: z.boolean().optional(),
        cache_control: AnthropicCacheControlSchema.optional(),
    })
    .passthrough();

const AnthropicCompactionContentSchema = z.object({
    type: z.literal("compaction"),
    content: z.string(),
    cache_control: AnthropicCacheControlSchema.optional(),
});

export const AnthropicResponseContentBlockSchema = z.discriminatedUnion("type", [
    AnthropicTextContentSchema,
    AnthropicThinkingContentSchema,
    AnthropicRedactedThinkingContentSchema,
    AnthropicImageContentSchema,
    AnthropicDocumentContentSchema,
    AnthropicToolResultContentSchema,
    AnthropicToolCallContentSchema,
    AnthropicServerToolUseContentSchema,
    AnthropicWebSearchToolResultContentSchema,
    AnthropicWebFetchToolResultContentSchema,
    AnthropicToolSearchToolResultContentSchema,
    AnthropicCodeExecutionToolResultContentSchema,
    AnthropicBashCodeExecutionToolResultContentSchema,
    AnthropicTextEditorCodeExecutionToolResultContentSchema,
    AnthropicMcpToolUseContentSchema,
    AnthropicMcpToolResultContentSchema,
    AnthropicCompactionContentSchema,
]);

const AnthropicMessageSchema = z.object({
    role: z.enum(["user", "assistant"]),
    content: z.array(
        z.union([
            AnthropicTextContentSchema,
            AnthropicImageContentSchema,
            AnthropicDocumentContentSchema,
            AnthropicToolResultContentSchema,
            AnthropicThinkingContentSchema,
            AnthropicRedactedThinkingContentSchema,
            AnthropicToolCallContentSchema,
            AnthropicServerToolUseContentSchema,
            AnthropicWebSearchToolResultContentSchema,
            AnthropicWebFetchToolResultContentSchema,
            AnthropicToolSearchToolResultContentSchema,
            AnthropicCodeExecutionToolResultContentSchema,
            AnthropicBashCodeExecutionToolResultContentSchema,
            AnthropicTextEditorCodeExecutionToolResultContentSchema,
            AnthropicMcpToolUseContentSchema,
            AnthropicMcpToolResultContentSchema,
            AnthropicCompactionContentSchema,
        ]),
    ),
});

const AnthropicMetadataSchema = z.object({
    user_id: z.string().optional(),
});

const AnthropicThinkingConfigSchema = z.discriminatedUnion("type", [
    z.object({
        type: z.literal("adaptive"),
    }),
    z.object({
        type: z.literal("enabled"),
        budget_tokens: z.number().optional(),
    }),
    z.object({
        type: z.literal("disabled"),
    }),
]);

const AnthropicToolChoiceSchema = z.discriminatedUnion("type", [
    z.object({
        type: z.literal("auto"),
        disable_parallel_tool_use: z.boolean().optional(),
    }),
    z.object({
        type: z.literal("any"),
        disable_parallel_tool_use: z.boolean().optional(),
    }),
    z.object({
        type: z.literal("tool"),
        name: z.string(),
        disable_parallel_tool_use: z.boolean().optional(),
    }),
]);

const AnthropicFunctionToolSchema = z.object({
    name: z.string(),
    description: z.string().optional(),
    input_schema: z.record(z.string(), z.unknown()),
    cache_control: AnthropicCacheControlSchema.optional(),
    strict: z.boolean().optional(),
    eager_input_streaming: z.boolean().optional(),
    defer_loading: z.boolean().optional(),
    allowed_callers: z
        .array(z.enum(["direct", "code_execution_20250825", "code_execution_20260120"]))
        .optional(),
    input_examples: z.array(z.unknown()).optional(),
});

const AnthropicCodeExecution20250522ToolSchema = z.object({
    type: z.literal("code_execution_20250522"),
    name: z.literal("code_execution"),
    cache_control: AnthropicCacheControlSchema.optional(),
});

const AnthropicCodeExecution20250825ToolSchema = z.object({
    type: z.literal("code_execution_20250825"),
    name: z.literal("code_execution"),
});

const AnthropicCodeExecution20260120ToolSchema = z.object({
    type: z.literal("code_execution_20260120"),
    name: z.literal("code_execution"),
});

const AnthropicComputerBaseToolSchema = z.object({
    display_width_px: z.number().int(),
    display_height_px: z.number().int(),
    display_number: z.number().int().optional(),
    cache_control: AnthropicCacheControlSchema.optional(),
});

const AnthropicComputer20241022ToolSchema = AnthropicComputerBaseToolSchema.extend({
    type: z.literal("computer_20241022"),
    name: z.literal("computer"),
});

const AnthropicComputer20250124ToolSchema = AnthropicComputerBaseToolSchema.extend({
    type: z.literal("computer_20250124"),
    name: z.literal("computer"),
});

const AnthropicComputer20251124ToolSchema = AnthropicComputerBaseToolSchema.extend({
    type: z.literal("computer_20251124"),
    name: z.literal("computer"),
    enable_zoom: z.boolean().optional(),
});

const AnthropicTextEditor20241022ToolSchema = z.object({
    type: z.literal("text_editor_20241022"),
    name: z.literal("str_replace_editor"),
    cache_control: AnthropicCacheControlSchema.optional(),
});

const AnthropicTextEditor20250124ToolSchema = z.object({
    type: z.literal("text_editor_20250124"),
    name: z.literal("str_replace_editor"),
    cache_control: AnthropicCacheControlSchema.optional(),
});

const AnthropicTextEditor20250429ToolSchema = z.object({
    type: z.literal("text_editor_20250429"),
    name: z.literal("str_replace_based_edit_tool"),
    cache_control: AnthropicCacheControlSchema.optional(),
});

const AnthropicTextEditor20250728ToolSchema = z.object({
    type: z.literal("text_editor_20250728"),
    name: z.literal("str_replace_based_edit_tool"),
    max_characters: z.number().optional(),
    cache_control: AnthropicCacheControlSchema.optional(),
});

const AnthropicBash20241022ToolSchema = z.object({
    type: z.literal("bash_20241022"),
    name: z.literal("bash"),
    cache_control: AnthropicCacheControlSchema.optional(),
});

const AnthropicBash20250124ToolSchema = z.object({
    type: z.literal("bash_20250124"),
    name: z.literal("bash"),
    cache_control: AnthropicCacheControlSchema.optional(),
});

const AnthropicMemory20250818ToolSchema = z.object({
    type: z.literal("memory_20250818"),
    name: z.literal("memory"),
});

const AnthropicWebSearchUserLocationSchema = z.object({
    type: z.literal("approximate"),
    city: z.string().optional(),
    region: z.string().optional(),
    country: z.string().optional(),
    timezone: z.string().optional(),
});

const AnthropicWebSearch20250305ToolSchema = z.object({
    type: z.literal("web_search_20250305"),
    name: z.literal("web_search"),
    max_uses: z.number().optional(),
    allowed_domains: z.array(z.string()).optional(),
    blocked_domains: z.array(z.string()).optional(),
    user_location: AnthropicWebSearchUserLocationSchema.optional(),
    cache_control: AnthropicCacheControlSchema.optional(),
});

const AnthropicWebSearch20260209ToolSchema = z.object({
    type: z.literal("web_search_20260209"),
    name: z.literal("web_search"),
    max_uses: z.number().optional(),
    allowed_domains: z.array(z.string()).optional(),
    blocked_domains: z.array(z.string()).optional(),
    user_location: AnthropicWebSearchUserLocationSchema.optional(),
    cache_control: AnthropicCacheControlSchema.optional(),
});

const AnthropicWebFetchBaseToolSchema = z.object({
    max_uses: z.number().optional(),
    allowed_domains: z.array(z.string()).optional(),
    blocked_domains: z.array(z.string()).optional(),
    citations: z.object({ enabled: z.boolean() }).optional(),
    max_content_tokens: z.number().optional(),
    cache_control: AnthropicCacheControlSchema.optional(),
});

const AnthropicWebFetch20250910ToolSchema = AnthropicWebFetchBaseToolSchema.extend({
    type: z.literal("web_fetch_20250910"),
    name: z.literal("web_fetch"),
});

const AnthropicWebFetch20260209ToolSchema = AnthropicWebFetchBaseToolSchema.extend({
    type: z.literal("web_fetch_20260209"),
    name: z.literal("web_fetch"),
});

const AnthropicToolSearchRegex20251119ToolSchema = z.object({
    type: z.literal("tool_search_tool_regex_20251119"),
    name: z.literal("tool_search_tool_regex"),
});

const AnthropicToolSearchBm2520251119ToolSchema = z.object({
    type: z.literal("tool_search_tool_bm25_20251119"),
    name: z.literal("tool_search_tool_bm25"),
});

export const AnthropicHostedToolRequestSchema = z.union([
    AnthropicCodeExecution20250522ToolSchema,
    AnthropicCodeExecution20250825ToolSchema,
    AnthropicCodeExecution20260120ToolSchema,
    AnthropicComputer20241022ToolSchema,
    AnthropicComputer20250124ToolSchema,
    AnthropicComputer20251124ToolSchema,
    AnthropicTextEditor20241022ToolSchema,
    AnthropicTextEditor20250124ToolSchema,
    AnthropicTextEditor20250429ToolSchema,
    AnthropicTextEditor20250728ToolSchema,
    AnthropicBash20241022ToolSchema,
    AnthropicBash20250124ToolSchema,
    AnthropicMemory20250818ToolSchema,
    AnthropicWebSearch20250305ToolSchema,
    AnthropicWebSearch20260209ToolSchema,
    AnthropicWebFetch20250910ToolSchema,
    AnthropicWebFetch20260209ToolSchema,
    AnthropicToolSearchRegex20251119ToolSchema,
    AnthropicToolSearchBm2520251119ToolSchema,
]);

export const AnthropicMessagesToolSchema = z.union([
    AnthropicFunctionToolSchema,
    AnthropicHostedToolRequestSchema,
]);

export const AnthropicMessagesRequestSchema = z
    .object({
        model: AnthropicResponseModelIdSchema,
        max_tokens: z.number().int().positive(),
        messages: z.array(AnthropicMessageSchema),
        system: z.union([z.string(), z.array(AnthropicTextContentSchema)]).optional(),
        cache_control: AnthropicCacheControlSchema.optional(),
        metadata: AnthropicMetadataSchema.optional(),
        output_config: z
            .object({
                effort: z.enum(["low", "medium", "high", "max"]).optional(),
                format: z
                    .object({
                        type: z.literal("json_schema"),
                        schema: z.record(z.string(), z.unknown()),
                    })
                    .optional(),
            })
            .optional(),
        stop_sequences: z.array(z.string()).optional(),
        stream: z.boolean().optional(),
        speed: z.enum(["fast", "standard"]).optional(),
        temperature: z.number().optional(),
        thinking: AnthropicThinkingConfigSchema.optional(),
        tool_choice: AnthropicToolChoiceSchema.optional(),
        tools: z.array(AnthropicMessagesToolSchema).optional(),
        top_k: z.number().optional(),
        top_p: z.number().optional(),
        mcp_servers: z
            .array(
                z.object({
                    type: z.literal("url"),
                    name: z.string(),
                    url: z.string(),
                    authorization_token: z.string().nullish(),
                    tool_configuration: z
                        .object({
                            enabled: z.boolean().nullish(),
                            allowed_tools: z.array(z.string()).nullish(),
                        })
                        .nullish(),
                }),
            )
            .optional(),
        container: z
            .object({
                id: z.string().optional(),
                skills: z
                    .array(
                        z.object({
                            type: z.enum(["anthropic", "custom"]),
                            skill_id: z.string(),
                            version: z.string().optional(),
                        }),
                    )
                    .optional(),
            })
            .optional(),
        context_management: z
            .object({
                edits: z.array(z.unknown()),
            })
            .optional(),
    })
    .passthrough();

const AnthropicUsageSchema = z.object({
    input_tokens: z.number().int().optional(),
    output_tokens: z.number().int().optional(),
    cache_creation_input_tokens: z.number().int().optional(),
    cache_read_input_tokens: z.number().int().optional(),
    iterations: z
        .array(
            z.object({
                type: z.enum(["compaction", "message"]),
                input_tokens: z.number().int(),
                output_tokens: z.number().int(),
            }),
        )
        .optional(),
});

export const AnthropicMessagesResponseSchema = z
    .object({
        id: z.string(),
        type: z.literal("message"),
        role: z.literal("assistant"),
        model: AnthropicResponseModelIdSchema,
        content: z.array(AnthropicResponseContentBlockSchema),
        stop_reason: z.string().nullable().optional(),
        stop_sequence: z.string().nullable().optional(),
        usage: AnthropicUsageSchema.default({}),
    })
    .passthrough();

const AnthropicContentBlockDeltaSchema = z.discriminatedUnion("type", [
    z.object({
        type: z.literal("text_delta"),
        text: z.string(),
    }),
    z.object({
        type: z.literal("thinking_delta"),
        thinking: z.string(),
    }),
    z.object({
        type: z.literal("input_json_delta"),
        partial_json: z.string(),
    }),
    z.object({
        type: z.literal("signature_delta"),
        signature: z.string(),
    }),
    z.object({
        type: z.literal("citations_delta"),
        citation: z.unknown(),
    }),
    z.object({
        type: z.literal("compaction_delta"),
        content: z.string().optional(),
    }),
]);

export const AnthropicResponseStreamEventSchema = z.discriminatedUnion("type", [
    z.object({
        type: z.literal("ping"),
    }),
    z.object({
        type: z.literal("message_start"),
        message: AnthropicMessagesResponseSchema,
    }),
    z.object({
        type: z.literal("message_delta"),
        delta: z
            .object({
                stop_reason: z.string().nullable().optional(),
                stop_sequence: z.string().nullable().optional(),
            })
            .passthrough(),
        usage: z
            .object({
                input_tokens: z.number().int().optional(),
                output_tokens: z.number().int().optional(),
                cache_creation_input_tokens: z.number().int().optional(),
                cache_read_input_tokens: z.number().int().optional(),
                iterations: z
                    .array(
                        z.object({
                            type: z.enum(["compaction", "message"]),
                            input_tokens: z.number().int(),
                            output_tokens: z.number().int(),
                        }),
                    )
                    .optional(),
            })
            .passthrough()
            .optional(),
    }),
    z.object({
        type: z.literal("message_stop"),
    }),
    z.object({
        type: z.literal("content_block_start"),
        index: z.number().int(),
        content_block: AnthropicResponseContentBlockSchema,
    }),
    z.object({
        type: z.literal("content_block_delta"),
        index: z.number().int(),
        delta: AnthropicContentBlockDeltaSchema,
    }),
    z.object({
        type: z.literal("content_block_stop"),
        index: z.number().int(),
    }),
    z.object({
        type: z.literal("error"),
        error: z
            .object({
                type: z.string().optional(),
                message: z.string().optional(),
            })
            .passthrough(),
    }),
]);
