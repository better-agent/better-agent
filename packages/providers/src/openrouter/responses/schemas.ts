import { z } from "zod";

export type OpenRouterChatCompletionsRequestSchema = z.input<
    typeof OpenRouterChatCompletionsRequestSchema
>;
export type OpenRouterChatCompletionResponse = z.infer<typeof OpenRouterChatCompletionResponseSchema>;
export type OpenRouterChatCompletionChunk = z.infer<typeof OpenRouterChatCompletionChunkSchema>;

const OpenRouterContentPartTextSchema = z.object({
    type: z.literal("text"),
    text: z.string(),
});

const OpenRouterContentPartImageSchema = z.object({
    type: z.literal("image_url"),
    image_url: z.union([
        z.string(),
        z.object({
            url: z.string(),
        }),
    ]),
});

const OpenRouterContentPartFileSchema = z.object({
    type: z.literal("file"),
    file: z.object({
        filename: z.string().optional(),
        file_data: z.string(),
    }),
});

const OpenRouterContentPartInputAudioSchema = z.object({
    type: z.literal("input_audio"),
    inputAudio: z.object({
        data: z.string(),
        format: z.string(),
    }),
});

const OpenRouterMessageContentSchema = z.union([
    z.string(),
    z.array(
        z.union([
            OpenRouterContentPartTextSchema,
            OpenRouterContentPartImageSchema,
            OpenRouterContentPartFileSchema,
            OpenRouterContentPartInputAudioSchema,
        ]),
    ),
]);

const OpenRouterToolFunctionSchema = z.object({
    name: z.string(),
    description: z.string().optional(),
    parameters: z.record(z.string(), z.unknown()).optional(),
    strict: z.boolean().optional(),
});

const OpenRouterFunctionToolSchema = z.object({
    type: z.literal("function"),
    function: OpenRouterToolFunctionSchema,
});

const OpenRouterWebSearchToolSchema = z.object({
    type: z.literal("web_search"),
    search_context_size: z.enum(["low", "medium", "high"]).optional(),
});

const OpenRouterToolChoiceSchema = z.union([
    z.literal("none"),
    z.literal("auto"),
    z.literal("required"),
    z.object({
        type: z.literal("function"),
        function: z.object({
            name: z.string(),
        }),
    }),
]);

const OpenRouterReasoningSchema = z
    .object({
        effort: z.enum(["low", "medium", "high"]).optional(),
        max_tokens: z.number().int().positive().optional(),
        exclude: z.boolean().optional(),
    })
    .passthrough();

const OpenRouterResponseFormatSchema = z
    .union([
        z.object({
            type: z.literal("json_object"),
        }),
        z.object({
            type: z.literal("json_schema"),
            json_schema: z.object({
                name: z.string(),
                strict: z.boolean().optional(),
                schema: z.record(z.string(), z.unknown()),
            }),
        }),
    ])
    .optional();

const OpenRouterAudioRequestSchema = z.object({
    voice: z.string(),
    format: z.string(),
});

const OpenRouterAudioResponseSchema = z.object({
    data: z.string().optional(),
    transcript: z.string().optional(),
});

const OpenRouterMessageSchema = z.object({
    role: z.string(),
    content: OpenRouterMessageContentSchema.nullish(),
    tool_calls: z
        .array(
            z.object({
                id: z.string().optional(),
                type: z.literal("function").optional(),
                function: z.object({
                    name: z.string().optional(),
                    arguments: z.string().optional(),
                }),
            }),
        )
        .optional(),
    tool_call_id: z.string().optional(),
    images: z
        .array(
            z.union([
                z.string(),
                z.object({
                    type: z.literal("image_url").optional(),
                    image_url: z.union([
                        z.string(),
                        z.object({
                            url: z.string(),
                        }),
                    ]),
                }),
            ]),
        )
        .optional(),
    audio: OpenRouterAudioResponseSchema.optional(),
});

export const OpenRouterChatCompletionsRequestSchema = z
    .object({
        model: z.string(),
        messages: z.array(OpenRouterMessageSchema),
        modalities: z.array(z.enum(["text", "image", "audio"])).optional(),
        audio: OpenRouterAudioRequestSchema.optional(),
        tools: z.array(z.union([OpenRouterFunctionToolSchema, OpenRouterWebSearchToolSchema])).optional(),
        tool_choice: OpenRouterToolChoiceSchema.optional(),
        response_format: OpenRouterResponseFormatSchema,
        stream: z.boolean().optional(),
        max_tokens: z.number().int().positive().optional(),
        temperature: z.number().gte(0).lte(2).optional(),
        top_p: z.number().gt(0).lte(1).optional(),
        frequency_penalty: z.number().gte(-2).lte(2).optional(),
        presence_penalty: z.number().gte(-2).lte(2).optional(),
        seed: z.number().int().optional(),
        user: z.string().optional(),
        reasoning: OpenRouterReasoningSchema.optional(),
        include_reasoning: z.boolean().optional(),
        prediction: z.unknown().optional(),
        transforms: z.array(z.string()).optional(),
        route: z.string().optional(),
        provider: z.unknown().optional(),
        plugins: z.array(z.unknown()).optional(),
    })
    .passthrough();

export const OpenRouterChatCompletionResponseSchema = z
    .object({
        id: z.string().optional(),
        object: z.string().optional(),
        created: z.number().int().optional(),
        model: z.string().optional(),
        choices: z.array(
            z.object({
                index: z.number().int().optional(),
                finish_reason: z.string().nullish(),
                message: OpenRouterMessageSchema,
            }),
        ),
        usage: z
            .object({
                prompt_tokens: z.number().int().optional(),
                completion_tokens: z.number().int().optional(),
                total_tokens: z.number().int().optional(),
            })
            .nullish(),
    })
    .passthrough();

export const OpenRouterChatCompletionChunkSchema = z
    .object({
        id: z.string().optional(),
        object: z.string().optional(),
        created: z.number().int().optional(),
        model: z.string().optional(),
        choices: z.array(
            z.object({
                index: z.number().int().optional(),
                finish_reason: z.string().nullish(),
                delta: z
                    .object({
                        role: z.string().optional(),
                        content: z.string().optional(),
                        images: z
                            .array(
                                z.union([
                                    z.string(),
                                    z.object({
                                        type: z.literal("image_url").optional(),
                                        image_url: z.union([
                                            z.string(),
                                            z.object({
                                                url: z.string(),
                                            }),
                                        ]),
                                    }),
                                ]),
                            )
                            .optional(),
                        reasoning: z.string().optional(),
                        audio: OpenRouterAudioResponseSchema.optional(),
                        tool_calls: z
                            .array(
                                z.object({
                                    index: z.number().int().optional(),
                                    id: z.string().optional(),
                                    type: z.literal("function").optional(),
                                    function: z
                                        .object({
                                            name: z.string().optional(),
                                            arguments: z.string().optional(),
                                        })
                                        .optional(),
                                }),
                            )
                            .optional(),
                    })
                    .optional(),
            }),
        ),
    })
    .passthrough();
