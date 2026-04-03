import { z } from "zod";

export type OpenAICreateResponseSchema = z.infer<typeof OpenAICreateResponseSchema>;

export type OpenAICreateResponse = z.infer<typeof OpenAIResponseSchema>;

export type OpenAIResponseStreamEvent = z.infer<typeof OpenAIResponseStreamEvent>;

// biome-ignore lint/suspicious/noExplicitAny: intentional
export type OpenAIInputItem = Extract<OpenAICreateResponseSchema["input"], readonly any[]>[number];

export type OpenAIMessageItem = Extract<
    OpenAIInputItem,
    {
        role: "user" | "assistant" | "system" | "developer";
        // biome-ignore lint/suspicious/noExplicitAny: intentional
        content: any;
        status?: never;
    }
>;

export type OpenAIFunctionItem = Extract<
    OpenAIInputItem,
    {
        type: "function_call" | "function_call_output";
    }
>;

export type OpenAIResponseModels = z.infer<typeof OpenAIResponseModels>;

export const OpenAIResponseModels = z.enum([
    "gpt-5.1",
    "gpt-5.1-2025-11-13",
    "gpt-5.1-codex",
    "gpt-5.1-codex-mini",
    "gpt-5.1-mini",
    "gpt-5.1-chat-latest",
    "gpt-5",
    "gpt-5-mini",
    "gpt-5-nano",
    "gpt-5-2025-08-07",
    "gpt-5-mini-2025-08-07",
    "gpt-5-nano-2025-08-07",
    "gpt-5-chat-latest",
    "gpt-5.2",
    "gpt-5.2-2025-12-11",
    "gpt-5.2-chat-latest",
    "gpt-5.2-pro",
    "gpt-5.2-pro-2025-12-11",
    "gpt-5.2-codex",
    "gpt-5.3-chat-latest",
    "gpt-5.3-codex",
    "gpt-5.4",
    "gpt-5.4-2026-03-05",
    "gpt-5.4-mini",
    "gpt-5.4-mini-2026-03-17",
    "gpt-5.4-nano",
    "gpt-5.4-nano-2026-03-17",
    "gpt-5.4-pro",
    "gpt-5.4-pro-2026-03-05",
    "gpt-4.1",
    "gpt-4.1-mini",
    "gpt-4.1-nano",
    "gpt-4.1-2025-04-14",
    "gpt-4.1-mini-2025-04-14",
    "gpt-4.1-nano-2025-04-14",
    "o4-mini",
    "o4-mini-2025-04-16",
    "o3",
    "o3-2025-04-16",
    "o3-mini",
    "o3-mini-2025-01-31",
    "o1",
    "o1-2024-12-17",
    "o1-preview",
    "o1-preview-2024-09-12",
    "o1-mini",
    "o1-mini-2024-09-12",
    "gpt-4o",
    "gpt-4o-2024-11-20",
    "gpt-4o-2024-08-06",
    "gpt-4o-2024-05-13",
    "gpt-4o-audio-preview",
    "gpt-4o-audio-preview-2024-10-01",
    "gpt-4o-audio-preview-2024-12-17",
    "gpt-4o-audio-preview-2025-06-03",
    "gpt-4o-mini-audio-preview",
    "gpt-4o-mini-audio-preview-2024-12-17",
    "gpt-4o-search-preview",
    "gpt-4o-mini-search-preview",
    "gpt-4o-search-preview-2025-03-11",
    "gpt-4o-mini-search-preview-2025-03-11",
    "chatgpt-4o-latest",
    "codex-mini-latest",
    "gpt-4o-mini",
    "gpt-4o-mini-2024-07-18",
    "gpt-4-turbo",
    "gpt-4-turbo-2024-04-09",
    "gpt-4-0125-preview",
    "gpt-4-turbo-preview",
    "gpt-4-1106-preview",
    "gpt-4-vision-preview",
    "gpt-4",
    "gpt-4-0314",
    "gpt-4-0613",
    "gpt-4-32k",
    "gpt-4-32k-0314",
    "gpt-4-32k-0613",
    "gpt-3.5-turbo",
    "gpt-3.5-turbo-16k",
    "gpt-3.5-turbo-0301",
    "gpt-3.5-turbo-0613",
    "gpt-3.5-turbo-1106",
    "gpt-3.5-turbo-0125",
    "gpt-3.5-turbo-16k-0613",
    "o1-pro",
    "o1-pro-2025-03-19",
    "o3-pro",
    "o3-pro-2025-06-10",
    "o3-deep-research",
    "o3-deep-research-2025-06-26",
    "o4-mini-deep-research",
    "o4-mini-deep-research-2025-06-26",
    "computer-use-preview",
    "computer-use-preview-2025-03-11",
    "gpt-5-codex",
    "gpt-5-pro",
    "gpt-5-pro-2025-10-06",
    "gpt-5.1-codex-max",
]);

export const OpenAICreateResponseSchema = z.intersection(
    z.intersection(
        z.object({
            metadata: z
                .union([
                    z
                        .record(z.string(), z.string())
                        .describe(
                            "Set of 16 key-value pairs that can be attached to an object. This can be\nuseful for storing additional information about the object in a structured\nformat, and querying for objects via API or the dashboard.\n\nKeys are strings with a maximum length of 64 characters. Values are strings\nwith a maximum length of 512 characters.\n",
                        ),
                    z.null(),
                ])
                .optional(),
            top_logprobs: z
                .union([
                    z
                        .number()
                        .int()
                        .gte(0)
                        .lte(20)
                        .describe(
                            "An integer between 0 and 20 specifying the number of most likely tokens to\nreturn at each token position, each with an associated log probability.\n",
                        ),
                    z.null(),
                ])
                .optional(),
            temperature: z
                .union([
                    z
                        .number()
                        .gte(0)
                        .lte(2)
                        .describe(
                            "What sampling temperature to use, between 0 and 2. Higher values like 0.8 will make the output more random, while lower values like 0.2 will make it more focused and deterministic.\nWe generally recommend altering this or `top_p` but not both.\n",
                        )
                        .default(1),
                    z.null(),
                ])
                .optional(),
            top_p: z
                .union([
                    z
                        .number()
                        .gte(0)
                        .lte(1)
                        .describe(
                            "An alternative to sampling with temperature, called nucleus sampling,\nwhere the model considers the results of the tokens with top_p probability\nmass. So 0.1 means only the tokens comprising the top 10% probability mass\nare considered.\n\nWe generally recommend altering this or `temperature` but not both.\n",
                        )
                        .default(1),
                    z.null(),
                ])
                .optional(),
            /**
             * This field is being replaced by `safety_identifier` and `prompt_cache_key`. Use `prompt_cache_key` instead to maintain caching optimizations.
             * A stable identifier for your end-users.
             * Used to boost cache hit rates by better bucketing similar requests and  to help OpenAI detect and prevent abuse. [Learn more](https://platform.openai.com/docs/guides/safety-best-practices#safety-identifiers).
             *
             */
            user: z
                .string()
                .describe(
                    "This field is being replaced by `safety_identifier` and `prompt_cache_key`. Use `prompt_cache_key` instead to maintain caching optimizations.\nA stable identifier for your end-users.\nUsed to boost cache hit rates by better bucketing similar requests and  to help OpenAI detect and prevent abuse. [Learn more](https://platform.openai.com/docs/guides/safety-best-practices#safety-identifiers).\n",
                )
                .optional(),
            /**
             * A stable identifier used to help detect users of your application that may be violating OpenAI's usage policies.
             * The IDs should be a string that uniquely identifies each user. We recommend hashing their username or email address, in order to avoid sending us any identifying information. [Learn more](https://platform.openai.com/docs/guides/safety-best-practices#safety-identifiers).
             *
             */
            safety_identifier: z
                .string()
                .describe(
                    "A stable identifier used to help detect users of your application that may be violating OpenAI's usage policies.\nThe IDs should be a string that uniquely identifies each user. We recommend hashing their username or email address, in order to avoid sending us any identifying information. [Learn more](https://platform.openai.com/docs/guides/safety-best-practices#safety-identifiers).\n",
                )
                .optional(),
            /**
             * Used by OpenAI to cache responses for similar requests to optimize your cache hit rates. Replaces the `user` field. [Learn more](https://platform.openai.com/docs/guides/prompt-caching).
             *
             */
            prompt_cache_key: z
                .string()
                .describe(
                    "Used by OpenAI to cache responses for similar requests to optimize your cache hit rates. Replaces the `user` field. [Learn more](https://platform.openai.com/docs/guides/prompt-caching).\n",
                )
                .optional(),
            service_tier: z
                .union([
                    z
                        .enum(["auto", "default", "flex", "scale", "priority"])
                        .describe(
                            "Specifies the processing type used for serving the request.\n  - If set to 'auto', then the request will be processed with the service tier configured in the Project settings. Unless otherwise configured, the Project will use 'default'.\n  - If set to 'default', then the request will be processed with the standard pricing and performance for the selected model.\n  - If set to '[flex](https://platform.openai.com/docs/guides/flex-processing)' or '[priority](https://openai.com/api-priority-processing/)', then the request will be processed with the corresponding service tier.\n  - When not set, the default behavior is 'auto'.\n\n  When the `service_tier` parameter is set, the response body will include the `service_tier` value based on the processing mode actually used to serve the request. This response value may be different from the value set in the parameter.\n",
                        )
                        .default("auto"),
                    z.null(),
                ])
                .optional(),
            prompt_cache_retention: z
                .union([
                    z
                        .enum(["in_memory", "24h"])
                        .describe(
                            "The retention policy for the prompt cache. Set to `24h` to enable extended prompt caching, which keeps cached prefixes active for longer, up to a maximum of 24 hours. [Learn more](https://platform.openai.com/docs/guides/prompt-caching#prompt-cache-retention).\n",
                        ),
                    z.null(),
                ])
                .optional(),
        }),
        z.object({
            /**
             * An integer between 0 and 20 specifying the number of most likely tokens to
             * return at each token position, each with an associated log probability.
             *
             */
            top_logprobs: z
                .number()
                .int()
                .gte(0)
                .lte(20)
                .describe(
                    "An integer between 0 and 20 specifying the number of most likely tokens to\nreturn at each token position, each with an associated log probability.\n",
                )
                .optional(),
        }),
    ),
    z.intersection(
        z.object({
            previous_response_id: z
                .union([
                    z
                        .string()
                        .describe(
                            "The unique ID of the previous response to the model. Use this to\ncreate multi-turn conversations. Learn more about\n[conversation state](https://platform.openai.com/docs/guides/conversation-state). Cannot be used in conjunction with `conversation`.\n",
                        ),
                    z.null(),
                ])
                .optional(),
            /**
             * Model ID used to generate the response, like `gpt-4o` or `o3`. OpenAI
             * offers a wide range of models with different capabilities, performance
             * characteristics, and price points. Refer to the [model guide](https://platform.openai.com/docs/models)
             * to browse and compare available models.
             *
             */
            model: z
                .union([z.string(), OpenAIResponseModels])
                .describe(
                    "Model ID used to generate the response, like `gpt-4o` or `o3`. OpenAI\n" +
                        "offers a wide range of models with different capabilities, performance\n" +
                        "characteristics, and price points. Refer to the model guide\n" +
                        "(https://platform.openai.com/docs/models) to browse and compare\n" +
                        "available models.\n",
                )
                .optional(),
            reasoning: z
                .union([
                    z
                        .object({
                            effort: z
                                .union([
                                    z
                                        .enum(["none", "minimal", "low", "medium", "high", "xhigh"])
                                        .describe(
                                            "Constrains effort on reasoning for\n[reasoning models](https://platform.openai.com/docs/guides/reasoning).\nCurrently supported values are `none`, `minimal`, `low`, `medium`, `high`, and `xhigh`. Reducing\nreasoning effort can result in faster responses and fewer tokens used\non reasoning in a response.\n\n- `gpt-5.1` defaults to `none`, which does not perform reasoning. The supported reasoning values for `gpt-5.1` are `none`, `low`, `medium`, and `high`. Tool calls are supported for all reasoning values in gpt-5.1.\n- All models before `gpt-5.1` default to `medium` reasoning effort, and do not support `none`.\n- The `gpt-5-pro` model defaults to (and only supports) `high` reasoning effort.\n- `xhigh` is currently only supported for `gpt-5.1-codex-max`.\n",
                                        )
                                        .default("medium"),
                                    z.null(),
                                ])
                                .optional(),
                            summary: z
                                .union([
                                    z
                                        .enum(["auto", "concise", "detailed"])
                                        .describe(
                                            "A summary of the reasoning performed by the model. This can be\nuseful for debugging and understanding the model's reasoning process.\nOne of `auto`, `concise`, or `detailed`.\n\n`concise` is only supported for `computer-use-preview` models.\n",
                                        ),
                                    z.null(),
                                ])
                                .optional(),
                            generate_summary: z
                                .union([
                                    z
                                        .enum(["auto", "concise", "detailed"])
                                        .describe(
                                            "**Deprecated:** use `summary` instead.\n\nA summary of the reasoning performed by the model. This can be\nuseful for debugging and understanding the model's reasoning process.\nOne of `auto`, `concise`, or `detailed`.\n",
                                        ),
                                    z.null(),
                                ])
                                .optional(),
                        })
                        .describe(
                            "**gpt-5 and o-series models only**\n\nConfiguration options for\n[reasoning models](https://platform.openai.com/docs/guides/reasoning).\n",
                        ),
                    z.null(),
                ])
                .optional(),
            background: z
                .union([
                    z
                        .boolean()
                        .describe(
                            "Whether to run the model response in the background.\n[Learn more](https://platform.openai.com/docs/guides/background).\n",
                        )
                        .default(false),
                    z.null(),
                ])
                .optional(),
            max_output_tokens: z
                .union([
                    z
                        .number()
                        .int()
                        .describe(
                            "An upper bound for the number of tokens that can be generated for a response, including visible output tokens and [reasoning tokens](https://platform.openai.com/docs/guides/reasoning).\n",
                        ),
                    z.null(),
                ])
                .optional(),
            max_tool_calls: z
                .union([
                    z
                        .number()
                        .int()
                        .describe(
                            "The maximum number of total calls to built-in tools that can be processed in a response. This maximum number applies across all built-in tool calls, not per individual tool. Any further attempts to call a tool by the model will be ignored.\n",
                        ),
                    z.null(),
                ])
                .optional(),
            /**
             * Configuration options for a text response from the model. Can be plain
             * text or structured JSON data. Learn more:
             * - [Text inputs and outputs](https://platform.openai.com/docs/guides/text)
             * - [Structured Outputs](https://platform.openai.com/docs/guides/structured-outputs)
             *
             */
            text: z
                .object({
                    /**
                     * An object specifying the format that the model must output.
                     *
                     * Configuring `{ "type": "json_schema" }` enables Structured Outputs,
                     * which ensures the model will match your supplied JSON schema. Learn more in the
                     * [Structured Outputs guide](https://platform.openai.com/docs/guides/structured-outputs).
                     *
                     * The default format is `{ "type": "text" }` with no additional options.
                     *
                     * **Not recommended for gpt-4o and newer models:**
                     *
                     * Setting to `{ "type": "json_object" }` enables the older JSON mode, which
                     * ensures the message the model generates is valid JSON. Using `json_schema`
                     * is preferred for models that support it.
                     *
                     */
                    format: z
                        .union([
                            z
                                .object({
                                    /**The type of response format being defined. Always `text`.*/
                                    type: z
                                        .literal("text")
                                        .describe(
                                            "The type of response format being defined. Always `text`.",
                                        ),
                                })
                                .describe(
                                    "Default response format. Used to generate text responses.\n",
                                ),
                            z
                                .object({
                                    /**The type of response format being defined. Always `json_schema`.*/
                                    type: z
                                        .literal("json_schema")
                                        .describe(
                                            "The type of response format being defined. Always `json_schema`.",
                                        ),
                                    /**
                                     * A description of what the response format is for, used by the model to
                                     * determine how to respond in the format.
                                     *
                                     */
                                    description: z
                                        .string()
                                        .describe(
                                            "A description of what the response format is for, used by the model to\ndetermine how to respond in the format.\n",
                                        )
                                        .optional(),
                                    /**
                                     * The name of the response format. Must be a-z, A-Z, 0-9, or contain
                                     * underscores and dashes, with a maximum length of 64.
                                     *
                                     */
                                    name: z
                                        .string()
                                        .describe(
                                            "The name of the response format. Must be a-z, A-Z, 0-9, or contain\nunderscores and dashes, with a maximum length of 64.\n",
                                        ),
                                    /**
                                     * The schema for the response format, described as a JSON Schema object.
                                     * Learn how to build JSON schemas [here](https://json-schema.org/).
                                     *
                                     */
                                    schema: z
                                        .record(z.string(), z.unknown())
                                        .describe(
                                            "The schema for the response format, described as a JSON Schema object.\nLearn how to build JSON schemas [here](https://json-schema.org/).\n",
                                        ),
                                    strict: z
                                        .union([
                                            z
                                                .boolean()
                                                .describe(
                                                    "Whether to enable strict schema adherence when generating the output.\nIf set to true, the model will always follow the exact schema defined\nin the `schema` field. Only a subset of JSON Schema is supported when\n`strict` is `true`. To learn more, read the [Structured Outputs\nguide](https://platform.openai.com/docs/guides/structured-outputs).\n",
                                                )
                                                .default(false),
                                            z.null(),
                                        ])
                                        .optional(),
                                })
                                .describe(
                                    "JSON Schema response format. Used to generate structured JSON responses.\nLearn more about [Structured Outputs](https://platform.openai.com/docs/guides/structured-outputs).\n",
                                ),
                            z
                                .object({
                                    /**The type of response format being defined. Always `json_object`.*/
                                    type: z
                                        .literal("json_object")
                                        .describe(
                                            "The type of response format being defined. Always `json_object`.",
                                        ),
                                })
                                .describe(
                                    "JSON object response format. An older method of generating JSON responses.\nUsing `json_schema` is recommended for models that support it. Note that the\nmodel will not generate JSON without a system or user message instructing it\nto do so.\n",
                                ),
                        ])
                        .describe(
                            'An object specifying the format that the model must output.\n\nConfiguring `{ "type": "json_schema" }` enables Structured Outputs, \nwhich ensures the model will match your supplied JSON schema. Learn more in the \n[Structured Outputs guide](https://platform.openai.com/docs/guides/structured-outputs).\n\nThe default format is `{ "type": "text" }` with no additional options.\n\n**Not recommended for gpt-4o and newer models:**\n\nSetting to `{ "type": "json_object" }` enables the older JSON mode, which\nensures the message the model generates is valid JSON. Using `json_schema`\nis preferred for models that support it.\n',
                        )
                        .optional(),
                    verbosity: z
                        .union([
                            z
                                .enum(["low", "medium", "high"])
                                .describe(
                                    "Constrains the verbosity of the model's response. Lower values will result in\nmore concise responses, while higher values will result in more verbose responses.\nCurrently supported values are `low`, `medium`, and `high`.\n",
                                )
                                .default("medium"),
                            z.null(),
                        ])
                        .optional(),
                })
                .describe(
                    "Configuration options for a text response from the model. Can be plain\ntext or structured JSON data. Learn more:\n- [Text inputs and outputs](https://platform.openai.com/docs/guides/text)\n- [Structured Outputs](https://platform.openai.com/docs/guides/structured-outputs)\n",
                )
                .optional(),
            /**
             * An array of tools the model may call while generating a response. You
             * can specify which tool to use by setting the `tool_choice` parameter.
             *
             * We support the following categories of tools:
             * - **Built-in tools**: Tools that are provided by OpenAI that extend the
             *   model's capabilities, like [web search](https://platform.openai.com/docs/guides/tools-web-search)
             *   or [file search](https://platform.openai.com/docs/guides/tools-file-search). Learn more about
             *   [built-in tools](https://platform.openai.com/docs/guides/tools).
             * - **MCP Tools**: Integrations with third-party systems via custom MCP servers
             *   or predefined connectors such as Google Drive and SharePoint. Learn more about
             *   [MCP Tools](https://platform.openai.com/docs/guides/tools-connectors-mcp).
             * - **Function calls (custom tools)**: Functions that are defined by you,
             *   enabling the model to call your own code with strongly typed arguments
             *   and outputs. Learn more about
             *   [function calling](https://platform.openai.com/docs/guides/function-calling). You can also use
             *   custom tools to call your own code.
             *
             */
            tools: z
                .array(
                    z
                        .union([
                            z
                                .object({
                                    /**The type of the function tool. Always `function`.*/
                                    type: z
                                        .literal("function")
                                        .describe(
                                            "The type of the function tool. Always `function`.",
                                        )
                                        .default("function"),
                                    /**The name of the function to call.*/
                                    name: z.string().describe("The name of the function to call."),
                                    description: z
                                        .union([
                                            z
                                                .string()
                                                .describe(
                                                    "A description of the function. Used by the model to determine whether or not to call the function.",
                                                ),
                                            z.null(),
                                        ])
                                        .optional(),
                                    parameters: z.union([
                                        z
                                            .record(z.string(), z.unknown())
                                            .describe(
                                                "A JSON schema object describing the parameters of the function.",
                                            ),
                                        z.null(),
                                    ]),
                                    strict: z.union([
                                        z
                                            .boolean()
                                            .describe(
                                                "Whether to enforce strict parameter validation. Default `true`.",
                                            ),
                                        z.null(),
                                    ]),
                                })
                                .describe(
                                    "Defines a function in your own code the model can choose to call. Learn more about [function calling](https://platform.openai.com/docs/guides/function-calling).",
                                ),
                            z
                                .object({
                                    /**The type of the file search tool. Always `file_search`.*/
                                    type: z
                                        .literal("file_search")
                                        .describe(
                                            "The type of the file search tool. Always `file_search`.",
                                        )
                                        .default("file_search"),
                                    /**The IDs of the vector stores to search.*/
                                    vector_store_ids: z
                                        .array(z.string())
                                        .describe("The IDs of the vector stores to search."),
                                    /**The maximum number of results to return. This number should be between 1 and 50 inclusive.*/
                                    max_num_results: z
                                        .number()
                                        .int()
                                        .describe(
                                            "The maximum number of results to return. This number should be between 1 and 50 inclusive.",
                                        )
                                        .optional(),
                                    /**Ranking options for search.*/
                                    ranking_options: z
                                        .object({
                                            /**The ranker to use for the file search.*/
                                            ranker: z
                                                .enum(["auto", "default-2024-11-15"])
                                                .describe("The ranker to use for the file search.")
                                                .optional(),
                                            /**The score threshold for the file search, a number between 0 and 1. Numbers closer to 1 will attempt to return only the most relevant results, but may return fewer results.*/
                                            score_threshold: z
                                                .number()
                                                .describe(
                                                    "The score threshold for the file search, a number between 0 and 1. Numbers closer to 1 will attempt to return only the most relevant results, but may return fewer results.",
                                                )
                                                .optional(),
                                            /**Weights that control how reciprocal rank fusion balances semantic embedding matches versus sparse keyword matches when hybrid search is enabled.*/
                                            hybrid_search: z
                                                .object({
                                                    /**The weight of the embedding in the reciprocal ranking fusion.*/
                                                    embedding_weight: z
                                                        .number()
                                                        .describe(
                                                            "The weight of the embedding in the reciprocal ranking fusion.",
                                                        ),
                                                    /**The weight of the text in the reciprocal ranking fusion.*/
                                                    text_weight: z
                                                        .number()
                                                        .describe(
                                                            "The weight of the text in the reciprocal ranking fusion.",
                                                        ),
                                                })
                                                .describe(
                                                    "Weights that control how reciprocal rank fusion balances semantic embedding matches versus sparse keyword matches when hybrid search is enabled.",
                                                )
                                                .optional(),
                                        })
                                        .describe("Ranking options for search.")
                                        .optional(),
                                    filters: z
                                        .union([
                                            z
                                                .union([
                                                    z
                                                        .object({
                                                            /**
                                                             * Specifies the comparison operator: `eq`, `ne`, `gt`, `gte`, `lt`, `lte`, `in`, `nin`.
                                                             * - `eq`: equals
                                                             * - `ne`: not equal
                                                             * - `gt`: greater than
                                                             * - `gte`: greater than or equal
                                                             * - `lt`: less than
                                                             * - `lte`: less than or equal
                                                             * - `in`: in
                                                             * - `nin`: not in
                                                             *
                                                             */
                                                            type: z
                                                                .enum([
                                                                    "eq",
                                                                    "ne",
                                                                    "gt",
                                                                    "gte",
                                                                    "lt",
                                                                    "lte",
                                                                ])
                                                                .describe(
                                                                    "Specifies the comparison operator: `eq`, `ne`, `gt`, `gte`, `lt`, `lte`, `in`, `nin`.\n- `eq`: equals\n- `ne`: not equal\n- `gt`: greater than\n- `gte`: greater than or equal\n- `lt`: less than\n- `lte`: less than or equal\n- `in`: in\n- `nin`: not in\n",
                                                                )
                                                                .default("eq"),
                                                            /**The key to compare against the value.*/
                                                            key: z
                                                                .string()
                                                                .describe(
                                                                    "The key to compare against the value.",
                                                                ),
                                                            /**The value to compare against the attribute key; supports string, number, or boolean types.*/
                                                            value: z
                                                                .union([
                                                                    z.string(),
                                                                    z.number(),
                                                                    z.boolean(),
                                                                    z.array(
                                                                        z.union([
                                                                            z.string(),
                                                                            z.number(),
                                                                        ]),
                                                                    ),
                                                                ])
                                                                .describe(
                                                                    "The value to compare against the attribute key; supports string, number, or boolean types.",
                                                                ),
                                                        })
                                                        .strict()
                                                        .describe(
                                                            "A filter used to compare a specified attribute key to a given value using a defined comparison operation.\n",
                                                        ),
                                                    z
                                                        .object({
                                                            /**Type of operation: `and` or `or`.*/
                                                            type: z
                                                                .enum(["and", "or"])
                                                                .describe(
                                                                    "Type of operation: `and` or `or`.",
                                                                ),
                                                            /**Array of filters to combine. Items can be `ComparisonFilter` or `CompoundFilter`.*/
                                                            filters: z
                                                                .array(
                                                                    z.union([
                                                                        z
                                                                            .object({
                                                                                /**
                                                                                 * Specifies the comparison operator: `eq`, `ne`, `gt`, `gte`, `lt`, `lte`, `in`, `nin`.
                                                                                 * - `eq`: equals
                                                                                 * - `ne`: not equal
                                                                                 * - `gt`: greater than
                                                                                 * - `gte`: greater than or equal
                                                                                 * - `lt`: less than
                                                                                 * - `lte`: less than or equal
                                                                                 * - `in`: in
                                                                                 * - `nin`: not in
                                                                                 *
                                                                                 */
                                                                                type: z
                                                                                    .enum([
                                                                                        "eq",
                                                                                        "ne",
                                                                                        "gt",
                                                                                        "gte",
                                                                                        "lt",
                                                                                        "lte",
                                                                                    ])
                                                                                    .describe(
                                                                                        "Specifies the comparison operator: `eq`, `ne`, `gt`, `gte`, `lt`, `lte`, `in`, `nin`.\n- `eq`: equals\n- `ne`: not equal\n- `gt`: greater than\n- `gte`: greater than or equal\n- `lt`: less than\n- `lte`: less than or equal\n- `in`: in\n- `nin`: not in\n",
                                                                                    )
                                                                                    .default("eq"),
                                                                                /**The key to compare against the value.*/
                                                                                key: z
                                                                                    .string()
                                                                                    .describe(
                                                                                        "The key to compare against the value.",
                                                                                    ),
                                                                                /**The value to compare against the attribute key; supports string, number, or boolean types.*/
                                                                                value: z
                                                                                    .union([
                                                                                        z.string(),
                                                                                        z.number(),
                                                                                        z.boolean(),
                                                                                        z.array(
                                                                                            z.union(
                                                                                                [
                                                                                                    z.string(),
                                                                                                    z.number(),
                                                                                                ],
                                                                                            ),
                                                                                        ),
                                                                                    ])
                                                                                    .describe(
                                                                                        "The value to compare against the attribute key; supports string, number, or boolean types.",
                                                                                    ),
                                                                            })
                                                                            .strict()
                                                                            .describe(
                                                                                "A filter used to compare a specified attribute key to a given value using a defined comparison operation.\n",
                                                                            ),
                                                                        z.any(),
                                                                    ]),
                                                                )
                                                                .describe(
                                                                    "Array of filters to combine. Items can be `ComparisonFilter` or `CompoundFilter`.",
                                                                ),
                                                        })
                                                        .strict()
                                                        .describe(
                                                            "Combine multiple filters using `and` or `or`.",
                                                        ),
                                                ])
                                                .describe("A filter to apply."),
                                            z.null(),
                                        ])
                                        .optional(),
                                })
                                .describe(
                                    "A tool that searches for relevant content from uploaded files. Learn more about the [file search tool](https://platform.openai.com/docs/guides/tools-file-search).",
                                ),
                            z
                                .object({
                                    /**The type of the computer use tool. Always `computer_use_preview`.*/
                                    type: z
                                        .literal("computer_use_preview")
                                        .describe(
                                            "The type of the computer use tool. Always `computer_use_preview`.",
                                        )
                                        .default("computer_use_preview"),
                                    /**The type of computer environment to control.*/
                                    environment: z
                                        .enum(["windows", "mac", "linux", "ubuntu", "browser"])
                                        .describe("The type of computer environment to control."),
                                    /**The width of the computer display.*/
                                    display_width: z
                                        .number()
                                        .int()
                                        .describe("The width of the computer display."),
                                    /**The height of the computer display.*/
                                    display_height: z
                                        .number()
                                        .int()
                                        .describe("The height of the computer display."),
                                })
                                .describe(
                                    "A tool that controls a virtual computer. Learn more about the [computer tool](https://platform.openai.com/docs/guides/tools-computer-use).",
                                ),
                            z
                                .object({
                                    /**The type of the web search tool. One of `web_search` or `web_search_2025_08_26`.*/
                                    type: z
                                        .enum(["web_search", "web_search_2025_08_26"])
                                        .describe(
                                            "The type of the web search tool. One of `web_search` or `web_search_2025_08_26`.",
                                        )
                                        .default("web_search"),
                                    filters: z
                                        .union([
                                            z
                                                .object({
                                                    allowed_domains: z
                                                        .union([
                                                            z
                                                                .array(
                                                                    z
                                                                        .string()
                                                                        .describe(
                                                                            "Allowed domain for the search.",
                                                                        ),
                                                                )
                                                                .describe(
                                                                    'Allowed domains for the search. If not provided, all domains are allowed.\nSubdomains of the provided domains are allowed as well.\n\nExample: `["pubmed.ncbi.nlm.nih.gov"]`\n',
                                                                )
                                                                .default([]),
                                                            z.null(),
                                                        ])
                                                        .optional(),
                                                })
                                                .describe("Filters for the search.\n"),
                                            z.null(),
                                        ])
                                        .optional(),
                                    user_location: z
                                        .union([
                                            z
                                                .object({
                                                    /**The type of location approximation. Always `approximate`.*/
                                                    type: z
                                                        .literal("approximate")
                                                        .describe(
                                                            "The type of location approximation. Always `approximate`.",
                                                        )
                                                        .default("approximate"),
                                                    country: z
                                                        .union([
                                                            z
                                                                .string()
                                                                .describe(
                                                                    "The two-letter [ISO country code](https://en.wikipedia.org/wiki/ISO_3166-1) of the user, e.g. `US`.",
                                                                ),
                                                            z.null(),
                                                        ])
                                                        .optional(),
                                                    region: z
                                                        .union([
                                                            z
                                                                .string()
                                                                .describe(
                                                                    "Free text input for the region of the user, e.g. `California`.",
                                                                ),
                                                            z.null(),
                                                        ])
                                                        .optional(),
                                                    city: z
                                                        .union([
                                                            z
                                                                .string()
                                                                .describe(
                                                                    "Free text input for the city of the user, e.g. `San Francisco`.",
                                                                ),
                                                            z.null(),
                                                        ])
                                                        .optional(),
                                                    timezone: z
                                                        .union([
                                                            z
                                                                .string()
                                                                .describe(
                                                                    "The [IANA timezone](https://timeapi.io/documentation/iana-timezones) of the user, e.g. `America/Los_Angeles`.",
                                                                ),
                                                            z.null(),
                                                        ])
                                                        .optional(),
                                                })
                                                .describe(
                                                    "The approximate location of the user.\n",
                                                ),
                                            z.null(),
                                        ])
                                        .optional(),
                                    /**High level guidance for the amount of context window space to use for the search. One of `low`, `medium`, or `high`. `medium` is the default.*/
                                    search_context_size: z
                                        .enum(["low", "medium", "high"])
                                        .describe(
                                            "High level guidance for the amount of context window space to use for the search. One of `low`, `medium`, or `high`. `medium` is the default.",
                                        )
                                        .default("medium"),
                                })
                                .describe(
                                    "Search the Internet for sources related to the prompt. Learn more about the\n[web search tool](https://platform.openai.com/docs/guides/tools-web-search).\n",
                                ),
                            z
                                .object({
                                    /**The type of the MCP tool. Always `mcp`.*/
                                    type: z
                                        .literal("mcp")
                                        .describe("The type of the MCP tool. Always `mcp`."),
                                    /**
                                     * A label for this MCP server, used to identify it in tool calls.
                                     *
                                     */
                                    server_label: z
                                        .string()
                                        .describe(
                                            "A label for this MCP server, used to identify it in tool calls.\n",
                                        ),
                                    /**
                                     * The URL for the MCP server. One of `server_url` or `connector_id` must be
                                     * provided.
                                     *
                                     */
                                    server_url: z
                                        .string()
                                        .describe(
                                            "The URL for the MCP server. One of `server_url` or `connector_id` must be\nprovided.\n",
                                        )
                                        .optional(),
                                    /**
                                     * Identifier for service connectors, like those available in ChatGPT. One of
                                     * `server_url` or `connector_id` must be provided. Learn more about service
                                     * connectors [here](https://platform.openai.com/docs/guides/tools-remote-mcp#connectors).
                                     *
                                     * Currently supported `connector_id` values are:
                                     *
                                     * - Dropbox: `connector_dropbox`
                                     * - Gmail: `connector_gmail`
                                     * - Google Calendar: `connector_googlecalendar`
                                     * - Google Drive: `connector_googledrive`
                                     * - Microsoft Teams: `connector_microsoftteams`
                                     * - Outlook Calendar: `connector_outlookcalendar`
                                     * - Outlook Email: `connector_outlookemail`
                                     * - SharePoint: `connector_sharepoint`
                                     *
                                     */
                                    connector_id: z
                                        .enum([
                                            "connector_dropbox",
                                            "connector_gmail",
                                            "connector_googlecalendar",
                                            "connector_googledrive",
                                            "connector_microsoftteams",
                                            "connector_outlookcalendar",
                                            "connector_outlookemail",
                                            "connector_sharepoint",
                                        ])
                                        .describe(
                                            "Identifier for service connectors, like those available in ChatGPT. One of\n`server_url` or `connector_id` must be provided. Learn more about service\nconnectors [here](https://platform.openai.com/docs/guides/tools-remote-mcp#connectors).\n\nCurrently supported `connector_id` values are:\n\n- Dropbox: `connector_dropbox`\n- Gmail: `connector_gmail`\n- Google Calendar: `connector_googlecalendar`\n- Google Drive: `connector_googledrive`\n- Microsoft Teams: `connector_microsoftteams`\n- Outlook Calendar: `connector_outlookcalendar`\n- Outlook Email: `connector_outlookemail`\n- SharePoint: `connector_sharepoint`\n",
                                        )
                                        .optional(),
                                    /**
                                     * An OAuth access token that can be used with a remote MCP server, either
                                     * with a custom MCP server URL or a service connector. Your application
                                     * must handle the OAuth authorization flow and provide the token here.
                                     *
                                     */
                                    authorization: z
                                        .string()
                                        .describe(
                                            "An OAuth access token that can be used with a remote MCP server, either\nwith a custom MCP server URL or a service connector. Your application\nmust handle the OAuth authorization flow and provide the token here.\n",
                                        )
                                        .optional(),
                                    /**
                                     * Optional description of the MCP server, used to provide more context.
                                     *
                                     */
                                    server_description: z
                                        .string()
                                        .describe(
                                            "Optional description of the MCP server, used to provide more context.\n",
                                        )
                                        .optional(),
                                    headers: z
                                        .union([
                                            z
                                                .record(z.string(), z.string())
                                                .describe(
                                                    "Optional HTTP headers to send to the MCP server. Use for authentication\nor other purposes.\n",
                                                ),
                                            z.null(),
                                        ])
                                        .optional(),
                                    allowed_tools: z
                                        .union([
                                            z
                                                .union([
                                                    z
                                                        .array(z.string())
                                                        .describe(
                                                            "A string array of allowed tool names",
                                                        ),
                                                    z
                                                        .object({
                                                            /**List of allowed tool names.*/
                                                            tool_names: z
                                                                .array(z.string())
                                                                .describe(
                                                                    "List of allowed tool names.",
                                                                )
                                                                .optional(),
                                                            /**
                                                             * Indicates whether or not a tool modifies data or is read-only. If an
                                                             * MCP server is [annotated with `readOnlyHint`](https://modelcontextprotocol.io/specification/2025-06-18/schema#toolannotations-readonlyhint),
                                                             * it will match this filter.
                                                             *
                                                             */
                                                            read_only: z
                                                                .boolean()
                                                                .describe(
                                                                    "Indicates whether or not a tool modifies data or is read-only. If an\nMCP server is [annotated with `readOnlyHint`](https://modelcontextprotocol.io/specification/2025-06-18/schema#toolannotations-readonlyhint),\nit will match this filter.\n",
                                                                )
                                                                .optional(),
                                                        })
                                                        .strict()
                                                        .describe(
                                                            "A filter object to specify which tools are allowed.\n",
                                                        ),
                                                ])
                                                .describe(
                                                    "List of allowed tool names or a filter object.\n",
                                                ),
                                            z.null(),
                                        ])
                                        .optional(),
                                    require_approval: z
                                        .union([
                                            z
                                                .union([
                                                    z
                                                        .object({
                                                            /**
                                                             * A filter object to specify which tools are allowed.
                                                             *
                                                             */
                                                            always: z
                                                                .object({
                                                                    /**List of allowed tool names.*/
                                                                    tool_names: z
                                                                        .array(z.string())
                                                                        .describe(
                                                                            "List of allowed tool names.",
                                                                        )
                                                                        .optional(),
                                                                    /**
                                                                     * Indicates whether or not a tool modifies data or is read-only. If an
                                                                     * MCP server is [annotated with `readOnlyHint`](https://modelcontextprotocol.io/specification/2025-06-18/schema#toolannotations-readonlyhint),
                                                                     * it will match this filter.
                                                                     *
                                                                     */
                                                                    read_only: z
                                                                        .boolean()
                                                                        .describe(
                                                                            "Indicates whether or not a tool modifies data or is read-only. If an\nMCP server is [annotated with `readOnlyHint`](https://modelcontextprotocol.io/specification/2025-06-18/schema#toolannotations-readonlyhint),\nit will match this filter.\n",
                                                                        )
                                                                        .optional(),
                                                                })
                                                                .strict()
                                                                .describe(
                                                                    "A filter object to specify which tools are allowed.\n",
                                                                )
                                                                .optional(),
                                                            /**
                                                             * A filter object to specify which tools are allowed.
                                                             *
                                                             */
                                                            never: z
                                                                .object({
                                                                    /**List of allowed tool names.*/
                                                                    tool_names: z
                                                                        .array(z.string())
                                                                        .describe(
                                                                            "List of allowed tool names.",
                                                                        )
                                                                        .optional(),
                                                                    /**
                                                                     * Indicates whether or not a tool modifies data or is read-only. If an
                                                                     * MCP server is [annotated with `readOnlyHint`](https://modelcontextprotocol.io/specification/2025-06-18/schema#toolannotations-readonlyhint),
                                                                     * it will match this filter.
                                                                     *
                                                                     */
                                                                    read_only: z
                                                                        .boolean()
                                                                        .describe(
                                                                            "Indicates whether or not a tool modifies data or is read-only. If an\nMCP server is [annotated with `readOnlyHint`](https://modelcontextprotocol.io/specification/2025-06-18/schema#toolannotations-readonlyhint),\nit will match this filter.\n",
                                                                        )
                                                                        .optional(),
                                                                })
                                                                .strict()
                                                                .describe(
                                                                    "A filter object to specify which tools are allowed.\n",
                                                                )
                                                                .optional(),
                                                        })
                                                        .strict()
                                                        .describe(
                                                            "Specify which of the MCP server's tools require approval. Can be\n`always`, `never`, or a filter object associated with tools\nthat require approval.\n",
                                                        ),
                                                    z
                                                        .enum(["always", "never"])
                                                        .describe(
                                                            "Specify a single approval policy for all tools. One of `always` or\n`never`. When set to `always`, all tools will require approval. When\nset to `never`, all tools will not require approval.\n",
                                                        ),
                                                ])
                                                .describe(
                                                    "Specify which of the MCP server's tools require approval.",
                                                )
                                                .default("always"),
                                            z.null(),
                                        ])
                                        .optional(),
                                })
                                .describe(
                                    "Give the model access to additional tools via remote Model Context Protocol\n(MCP) servers. [Learn more about MCP](https://platform.openai.com/docs/guides/tools-remote-mcp).\n",
                                ),
                            z
                                .object({
                                    /**
                                     * The type of the code interpreter tool. Always `code_interpreter`.
                                     *
                                     */
                                    type: z
                                        .literal("code_interpreter")
                                        .describe(
                                            "The type of the code interpreter tool. Always `code_interpreter`.\n",
                                        ),
                                    /**
                                     * The code interpreter container. Can be a container ID or an object that
                                     * specifies uploaded file IDs to make available to your code, along with an
                                     * optional `memory_limit` setting.
                                     *
                                     */
                                    container: z
                                        .union([
                                            z.string().describe("The container ID."),
                                            z
                                                .object({
                                                    /**Always `auto`.*/
                                                    type: z
                                                        .literal("auto")
                                                        .describe("Always `auto`.")
                                                        .default("auto"),
                                                    /**An optional list of uploaded files to make available to your code.*/
                                                    file_ids: z
                                                        .array(z.string())
                                                        .max(50)
                                                        .describe(
                                                            "An optional list of uploaded files to make available to your code.",
                                                        )
                                                        .optional(),
                                                    memory_limit: z
                                                        .union([
                                                            z.enum(["1g", "4g", "16g", "64g"]),
                                                            z.null(),
                                                        ])
                                                        .optional(),
                                                })
                                                .describe(
                                                    "Configuration for a code interpreter container. Optionally specify the IDs of the files to run the code on.",
                                                ),
                                        ])
                                        .describe(
                                            "The code interpreter container. Can be a container ID or an object that\nspecifies uploaded file IDs to make available to your code, along with an\noptional `memory_limit` setting.\n",
                                        ),
                                })
                                .describe(
                                    "A tool that runs Python code to help generate a response to a prompt.\n",
                                ),
                            z
                                .object({
                                    /**
                                     * The type of the image generation tool. Always `image_generation`.
                                     *
                                     */
                                    type: z
                                        .literal("image_generation")
                                        .describe(
                                            "The type of the image generation tool. Always `image_generation`.\n",
                                        ),
                                    /**
                                     * The image generation model to use. Default: `gpt-image-1`.
                                     *
                                     */
                                    model: z
                                        .enum(["gpt-image-1", "gpt-image-1-mini"])
                                        .describe(
                                            "The image generation model to use. Default: `gpt-image-1`.\n",
                                        )
                                        .default("gpt-image-1"),
                                    /**
                                     * The quality of the generated image. One of `low`, `medium`, `high`,
                                     * or `auto`. Default: `auto`.
                                     *
                                     */
                                    quality: z
                                        .enum(["low", "medium", "high", "auto"])
                                        .describe(
                                            "The quality of the generated image. One of `low`, `medium`, `high`,\nor `auto`. Default: `auto`.\n",
                                        )
                                        .default("auto"),
                                    /**
                                     * The size of the generated image. One of `1024x1024`, `1024x1536`,
                                     * `1536x1024`, or `auto`. Default: `auto`.
                                     *
                                     */
                                    size: z
                                        .enum(["1024x1024", "1024x1536", "1536x1024", "auto"])
                                        .describe(
                                            "The size of the generated image. One of `1024x1024`, `1024x1536`,\n`1536x1024`, or `auto`. Default: `auto`.\n",
                                        )
                                        .default("auto"),
                                    /**
                                     * The output format of the generated image. One of `png`, `webp`, or
                                     * `jpeg`. Default: `png`.
                                     *
                                     */
                                    output_format: z
                                        .enum(["png", "webp", "jpeg"])
                                        .describe(
                                            "The output format of the generated image. One of `png`, `webp`, or\n`jpeg`. Default: `png`.\n",
                                        )
                                        .default("png"),
                                    /**
                                     * Compression level for the output image. Default: 100.
                                     *
                                     */
                                    output_compression: z
                                        .number()
                                        .int()
                                        .gte(0)
                                        .lte(100)
                                        .describe(
                                            "Compression level for the output image. Default: 100.\n",
                                        )
                                        .default(100),
                                    /**
                                     * Moderation level for the generated image. Default: `auto`.
                                     *
                                     */
                                    moderation: z
                                        .enum(["auto", "low"])
                                        .describe(
                                            "Moderation level for the generated image. Default: `auto`.\n",
                                        )
                                        .default("auto"),
                                    /**
                                     * Background type for the generated image. One of `transparent`,
                                     * `opaque`, or `auto`. Default: `auto`.
                                     *
                                     */
                                    background: z
                                        .enum(["transparent", "opaque", "auto"])
                                        .describe(
                                            "Background type for the generated image. One of `transparent`,\n`opaque`, or `auto`. Default: `auto`.\n",
                                        )
                                        .default("auto"),
                                    input_fidelity: z
                                        .union([
                                            z
                                                .enum(["high", "low"])
                                                .describe(
                                                    "Control how much effort the model will exert to match the style and features, especially facial features, of input images. This parameter is only supported for `gpt-image-1`. Unsupported for `gpt-image-1-mini`. Supports `high` and `low`. Defaults to `low`.",
                                                ),
                                            z.null(),
                                        ])
                                        .optional(),
                                    /**
                                     * Optional mask for inpainting. Contains `image_url`
                                     * (string, optional) and `file_id` (string, optional).
                                     *
                                     */
                                    input_image_mask: z
                                        .object({
                                            /**
                                             * Base64-encoded mask image.
                                             *
                                             */
                                            image_url: z
                                                .string()
                                                .describe("Base64-encoded mask image.\n")
                                                .optional(),
                                            /**
                                             * File ID for the mask image.
                                             *
                                             */
                                            file_id: z
                                                .string()
                                                .describe("File ID for the mask image.\n")
                                                .optional(),
                                        })
                                        .strict()
                                        .describe(
                                            "Optional mask for inpainting. Contains `image_url`\n(string, optional) and `file_id` (string, optional).\n",
                                        )
                                        .optional(),
                                    /**
                                     * Number of partial images to generate in streaming mode, from 0 (default value) to 3.
                                     *
                                     */
                                    partial_images: z
                                        .number()
                                        .int()
                                        .gte(0)
                                        .lte(3)
                                        .describe(
                                            "Number of partial images to generate in streaming mode, from 0 (default value) to 3.\n",
                                        )
                                        .default(0),
                                })
                                .describe(
                                    "A tool that generates images using a model like `gpt-image-1`.\n",
                                ),
                            z
                                .object({
                                    /**The type of the local shell tool. Always `local_shell`.*/
                                    type: z
                                        .literal("local_shell")
                                        .describe(
                                            "The type of the local shell tool. Always `local_shell`.",
                                        )
                                        .default("local_shell"),
                                })
                                .describe(
                                    "A tool that allows the model to execute shell commands in a local environment.",
                                ),
                            z
                                .object({
                                    /**The type of the shell tool. Always `shell`.*/
                                    type: z
                                        .literal("shell")
                                        .describe("The type of the shell tool. Always `shell`.")
                                        .default("shell"),
                                })
                                .describe(
                                    "A tool that allows the model to execute shell commands.",
                                ),
                            z
                                .object({
                                    /**The type of the custom tool. Always `custom`.*/
                                    type: z
                                        .literal("custom")
                                        .describe("The type of the custom tool. Always `custom`.")
                                        .default("custom"),
                                    /**The name of the custom tool, used to identify it in tool calls.*/
                                    name: z
                                        .string()
                                        .describe(
                                            "The name of the custom tool, used to identify it in tool calls.",
                                        ),
                                    /**Optional description of the custom tool, used to provide more context.*/
                                    description: z
                                        .string()
                                        .describe(
                                            "Optional description of the custom tool, used to provide more context.",
                                        )
                                        .optional(),
                                    /**The input format for the custom tool. Default is unconstrained text.*/
                                    format: z
                                        .union([
                                            z
                                                .object({
                                                    /**Unconstrained text format. Always `text`.*/
                                                    type: z
                                                        .literal("text")
                                                        .describe(
                                                            "Unconstrained text format. Always `text`.",
                                                        )
                                                        .default("text"),
                                                })
                                                .describe("Unconstrained free-form text."),
                                            z
                                                .object({
                                                    /**Grammar format. Always `grammar`.*/
                                                    type: z
                                                        .literal("grammar")
                                                        .describe(
                                                            "Grammar format. Always `grammar`.",
                                                        )
                                                        .default("grammar"),
                                                    /**The syntax of the grammar definition. One of `lark` or `regex`.*/
                                                    syntax: z
                                                        .enum(["lark", "regex"])
                                                        .describe(
                                                            "The syntax of the grammar definition. One of `lark` or `regex`.",
                                                        ),
                                                    /**The grammar definition.*/
                                                    definition: z
                                                        .string()
                                                        .describe("The grammar definition."),
                                                })
                                                .describe("A grammar defined by the user."),
                                        ])
                                        .describe(
                                            "The input format for the custom tool. Default is unconstrained text.",
                                        )
                                        .optional(),
                                })
                                .describe(
                                    "A custom tool that processes input using a specified format. Learn more about   [custom tools](https://platform.openai.com/docs/guides/function-calling#custom-tools)",
                                ),
                            z
                                .object({
                                    /**The type of the web search tool. One of `web_search_preview` or `web_search_preview_2025_03_11`.*/
                                    type: z
                                        .enum([
                                            "web_search_preview",
                                            "web_search_preview_2025_03_11",
                                        ])
                                        .describe(
                                            "The type of the web search tool. One of `web_search_preview` or `web_search_preview_2025_03_11`.",
                                        )
                                        .default("web_search_preview"),
                                    user_location: z
                                        .union([
                                            z
                                                .object({
                                                    /**The type of location approximation. Always `approximate`.*/
                                                    type: z
                                                        .literal("approximate")
                                                        .describe(
                                                            "The type of location approximation. Always `approximate`.",
                                                        )
                                                        .default("approximate"),
                                                    country: z
                                                        .union([
                                                            z
                                                                .string()
                                                                .describe(
                                                                    "The two-letter [ISO country code](https://en.wikipedia.org/wiki/ISO_3166-1) of the user, e.g. `US`.",
                                                                ),
                                                            z.null(),
                                                        ])
                                                        .optional(),
                                                    region: z
                                                        .union([
                                                            z
                                                                .string()
                                                                .describe(
                                                                    "Free text input for the region of the user, e.g. `California`.",
                                                                ),
                                                            z.null(),
                                                        ])
                                                        .optional(),
                                                    city: z
                                                        .union([
                                                            z
                                                                .string()
                                                                .describe(
                                                                    "Free text input for the city of the user, e.g. `San Francisco`.",
                                                                ),
                                                            z.null(),
                                                        ])
                                                        .optional(),
                                                    timezone: z
                                                        .union([
                                                            z
                                                                .string()
                                                                .describe(
                                                                    "The [IANA timezone](https://timeapi.io/documentation/iana-timezones) of the user, e.g. `America/Los_Angeles`.",
                                                                ),
                                                            z.null(),
                                                        ])
                                                        .optional(),
                                                })
                                                .describe("The user's location."),
                                            z.null(),
                                        ])
                                        .optional(),
                                    /**High level guidance for the amount of context window space to use for the search. One of `low`, `medium`, or `high`. `medium` is the default.*/
                                    search_context_size: z
                                        .enum(["low", "medium", "high"])
                                        .describe(
                                            "High level guidance for the amount of context window space to use for the search. One of `low`, `medium`, or `high`. `medium` is the default.",
                                        )
                                        .optional(),
                                })
                                .describe(
                                    "This tool searches the web for relevant results to use in a response. Learn more about the [web search tool](https://platform.openai.com/docs/guides/tools-web-search).",
                                ),
                            z
                                .object({
                                    /**The type of the tool. Always `apply_patch`.*/
                                    type: z
                                        .literal("apply_patch")
                                        .describe("The type of the tool. Always `apply_patch`.")
                                        .default("apply_patch"),
                                })
                                .describe(
                                    "Allows the assistant to create, delete, or update files using unified diffs.",
                                ),
                        ])
                        .describe("A tool that can be used to generate a response.\n"),
                )
                .describe(
                    "An array of tools the model may call while generating a response. You\ncan specify which tool to use by setting the `tool_choice` parameter.\n\nWe support the following categories of tools:\n- **Built-in tools**: Tools that are provided by OpenAI that extend the\n  model's capabilities, like [web search](https://platform.openai.com/docs/guides/tools-web-search)\n  or [file search](https://platform.openai.com/docs/guides/tools-file-search). Learn more about\n  [built-in tools](https://platform.openai.com/docs/guides/tools).\n- **MCP Tools**: Integrations with third-party systems via custom MCP servers\n  or predefined connectors such as Google Drive and SharePoint. Learn more about\n  [MCP Tools](https://platform.openai.com/docs/guides/tools-connectors-mcp).\n- **Function calls (custom tools)**: Functions that are defined by you,\n  enabling the model to call your own code with strongly typed arguments\n  and outputs. Learn more about\n  [function calling](https://platform.openai.com/docs/guides/function-calling). You can also use\n  custom tools to call your own code.\n",
                )
                .optional(),
            /**
             * How the model should select which tool (or tools) to use when generating
             * a response. See the `tools` parameter to see how to specify which tools
             * the model can call.
             *
             */
            tool_choice: z
                .union([
                    z
                        .enum(["none", "auto", "required"])
                        .describe(
                            "Controls which (if any) tool is called by the model.\n\n`none` means the model will not call any tool and instead generates a message.\n\n`auto` means the model can pick between generating a message or calling one or\nmore tools.\n\n`required` means the model must call one or more tools.\n",
                        ),
                    z
                        .object({
                            /**Allowed tool configuration type. Always `allowed_tools`.*/
                            type: z
                                .literal("allowed_tools")
                                .describe(
                                    "Allowed tool configuration type. Always `allowed_tools`.",
                                ),
                            /**
                             * Constrains the tools available to the model to a pre-defined set.
                             *
                             * `auto` allows the model to pick from among the allowed tools and generate a
                             * message.
                             *
                             * `required` requires the model to call one or more of the allowed tools.
                             *
                             */
                            mode: z
                                .enum(["auto", "required"])
                                .describe(
                                    "Constrains the tools available to the model to a pre-defined set.\n\n`auto` allows the model to pick from among the allowed tools and generate a\nmessage.\n\n`required` requires the model to call one or more of the allowed tools.\n",
                                ),
                            /**
                             * A list of tool definitions that the model should be allowed to call.
                             *
                             * For the Responses API, the list of tool definitions might look like:
                             * ```json
                             * [
                             *   { "type": "function", "name": "get_weather" },
                             *   { "type": "mcp", "server_label": "deepwiki" },
                             *   { "type": "image_generation" }
                             * ]
                             * ```
                             *
                             */
                            tools: z
                                .array(
                                    z
                                        .record(z.string(), z.unknown())
                                        .describe(
                                            "A tool definition that the model should be allowed to call.\n",
                                        ),
                                )
                                .describe(
                                    'A list of tool definitions that the model should be allowed to call.\n\nFor the Responses API, the list of tool definitions might look like:\n```json\n[\n  { "type": "function", "name": "get_weather" },\n  { "type": "mcp", "server_label": "deepwiki" },\n  { "type": "image_generation" }\n]\n```\n',
                                ),
                        })
                        .describe(
                            "Constrains the tools available to the model to a pre-defined set.\n",
                        ),
                    z
                        .object({
                            /**
                             * The type of hosted tool the model should to use. Learn more about
                             * [built-in tools](https://platform.openai.com/docs/guides/tools).
                             *
                             * Allowed values are:
                             * - `file_search`
                             * - `web_search_preview`
                             * - `computer_use_preview`
                             * - `code_interpreter`
                             * - `image_generation`
                             *
                             */
                            type: z
                                .enum([
                                    "file_search",
                                    "web_search_preview",
                                    "computer_use_preview",
                                    "web_search_preview_2025_03_11",
                                    "image_generation",
                                    "code_interpreter",
                                ])
                                .describe(
                                    "The type of hosted tool the model should to use. Learn more about\n[built-in tools](https://platform.openai.com/docs/guides/tools).\n\nAllowed values are:\n- `file_search`\n- `web_search_preview`\n- `computer_use_preview`\n- `code_interpreter`\n- `image_generation`\n",
                                ),
                        })
                        .describe(
                            "Indicates that the model should use a built-in tool to generate a response.\n[Learn more about built-in tools](https://platform.openai.com/docs/guides/tools).\n",
                        ),
                    z
                        .object({
                            /**For function calling, the type is always `function`.*/
                            type: z
                                .literal("function")
                                .describe("For function calling, the type is always `function`."),
                            /**The name of the function to call.*/
                            name: z.string().describe("The name of the function to call."),
                        })
                        .describe(
                            "Use this option to force the model to call a specific function.\n",
                        ),
                    z
                        .object({
                            /**For MCP tools, the type is always `mcp`.*/
                            type: z
                                .literal("mcp")
                                .describe("For MCP tools, the type is always `mcp`."),
                            /**
                             * The label of the MCP server to use.
                             *
                             */
                            server_label: z
                                .string()
                                .describe("The label of the MCP server to use.\n"),
                            name: z
                                .union([
                                    z
                                        .string()
                                        .describe("The name of the tool to call on the server.\n"),
                                    z.null(),
                                ])
                                .optional(),
                        })
                        .describe(
                            "Use this option to force the model to call a specific tool on a remote MCP server.\n",
                        ),
                    z
                        .object({
                            /**For custom tool calling, the type is always `custom`.*/
                            type: z
                                .literal("custom")
                                .describe("For custom tool calling, the type is always `custom`."),
                            /**The name of the custom tool to call.*/
                            name: z.string().describe("The name of the custom tool to call."),
                        })
                        .describe(
                            "Use this option to force the model to call a specific custom tool.\n",
                        ),
                    z
                        .object({
                            /**The tool to call. Always `apply_patch`.*/
                            type: z
                                .literal("apply_patch")
                                .describe("The tool to call. Always `apply_patch`.")
                                .default("apply_patch"),
                        })
                        .describe(
                            "Forces the model to call the apply_patch tool when executing a tool call.",
                        ),
                    z
                        .object({
                            /**The tool to call. Always `shell`.*/
                            type: z
                                .literal("shell")
                                .describe("The tool to call. Always `shell`.")
                                .default("shell"),
                        })
                        .describe(
                            "Forces the model to call the shell tool when a tool call is required.",
                        ),
                ])
                .describe(
                    "How the model should select which tool (or tools) to use when generating\na response. See the `tools` parameter to see how to specify which tools\nthe model can call.\n",
                )
                .optional(),
            prompt: z
                .union([
                    z
                        .object({
                            /**The unique identifier of the prompt template to use.*/
                            id: z
                                .string()
                                .describe("The unique identifier of the prompt template to use."),
                            version: z
                                .union([
                                    z.string().describe("Optional version of the prompt template."),
                                    z.null(),
                                ])
                                .optional(),
                            variables: z
                                .union([
                                    z
                                        .record(
                                            z.string(),
                                            z.union([
                                                z.string(),
                                                z
                                                    .object({
                                                        /**The type of the input item. Always `input_text`.*/
                                                        type: z
                                                            .literal("input_text")
                                                            .describe(
                                                                "The type of the input item. Always `input_text`.",
                                                            )
                                                            .default("input_text"),
                                                        /**The text input to the model.*/
                                                        text: z
                                                            .string()
                                                            .describe(
                                                                "The text input to the model.",
                                                            ),
                                                    })
                                                    .describe("A text input to the model."),
                                                z
                                                    .object({
                                                        /**The type of the input item. Always `input_image`.*/
                                                        type: z
                                                            .literal("input_image")
                                                            .describe(
                                                                "The type of the input item. Always `input_image`.",
                                                            )
                                                            .default("input_image"),
                                                        image_url: z
                                                            .union([
                                                                z
                                                                    .string()
                                                                    .describe(
                                                                        "The URL of the image to be sent to the model. A fully qualified URL or base64 encoded image in a data URL.",
                                                                    ),
                                                                z.null(),
                                                            ])
                                                            .optional(),
                                                        file_id: z
                                                            .union([
                                                                z
                                                                    .string()
                                                                    .describe(
                                                                        "The ID of the file to be sent to the model.",
                                                                    ),
                                                                z.null(),
                                                            ])
                                                            .optional(),
                                                        /**The detail level of the image to be sent to the model. One of `high`, `low`, or `auto`. Defaults to `auto`.*/
                                                        detail: z
                                                            .enum(["low", "high", "auto"])
                                                            .describe(
                                                                "The detail level of the image to be sent to the model. One of `high`, `low`, or `auto`. Defaults to `auto`.",
                                                            ),
                                                    })
                                                    .describe(
                                                        "An image input to the model. Learn about [image inputs](https://platform.openai.com/docs/guides/vision).",
                                                    ),
                                                z
                                                    .object({
                                                        /**The type of the input item. Always `input_file`.*/
                                                        type: z
                                                            .literal("input_file")
                                                            .describe(
                                                                "The type of the input item. Always `input_file`.",
                                                            )
                                                            .default("input_file"),
                                                        file_id: z
                                                            .union([
                                                                z
                                                                    .string()
                                                                    .describe(
                                                                        "The ID of the file to be sent to the model.",
                                                                    ),
                                                                z.null(),
                                                            ])
                                                            .optional(),
                                                        /**The name of the file to be sent to the model.*/
                                                        filename: z
                                                            .string()
                                                            .describe(
                                                                "The name of the file to be sent to the model.",
                                                            )
                                                            .optional(),
                                                        /**The URL of the file to be sent to the model.*/
                                                        file_url: z
                                                            .string()
                                                            .describe(
                                                                "The URL of the file to be sent to the model.",
                                                            )
                                                            .optional(),
                                                        /**
                                                         * The content of the file to be sent to the model.
                                                         *
                                                         */
                                                        file_data: z
                                                            .string()
                                                            .describe(
                                                                "The content of the file to be sent to the model.\n",
                                                            )
                                                            .optional(),
                                                    })
                                                    .describe("A file input to the model."),
                                            ]),
                                        )
                                        .describe(
                                            "Optional map of values to substitute in for variables in your\nprompt. The substitution values can either be strings, or other\nResponse input types like images or files.\n",
                                        ),
                                    z.null(),
                                ])
                                .optional(),
                        })
                        .describe(
                            "Reference to a prompt template and its variables.\n[Learn more](https://platform.openai.com/docs/guides/text?api-mode=responses#reusable-prompts).\n",
                        ),
                    z.null(),
                ])
                .optional(),
            truncation: z
                .union([
                    z
                        .enum(["auto", "disabled"])
                        .describe(
                            "The truncation strategy to use for the model response.\n- `auto`: If the input to this Response exceeds\n  the model's context window size, the model will truncate the\n  response to fit the context window by dropping items from the beginning of the conversation.\n- `disabled` (default): If the input size will exceed the context window\n  size for a model, the request will fail with a 400 error.\n",
                        )
                        .default("disabled"),
                    z.null(),
                ])
                .optional(),
        }),
        z.object({
            /**
             * Text, image, or file inputs to the model, used to generate a response.
             *
             * Learn more:
             * - [Text inputs and outputs](https://platform.openai.com/docs/guides/text)
             * - [Image inputs](https://platform.openai.com/docs/guides/images)
             * - [File inputs](https://platform.openai.com/docs/guides/pdf-files)
             * - [Conversation state](https://platform.openai.com/docs/guides/conversation-state)
             * - [Function calling](https://platform.openai.com/docs/guides/function-calling)
             *
             */
            input: z
                .union([
                    z
                        .string()
                        .describe(
                            "A text input to the model, equivalent to a text input with the\n`user` role.\n",
                        ),
                    z
                        .array(
                            z.union([
                                z
                                    .object({
                                        /**
                                         * The role of the message input. One of `user`, `assistant`, `system`, or
                                         * `developer`.
                                         *
                                         */
                                        role: z
                                            .enum(["user", "assistant", "system", "developer"])
                                            .describe(
                                                "The role of the message input. One of `user`, `assistant`, `system`, or\n`developer`.\n",
                                            ),
                                        /**
                                         * Text, image, or audio input to the model, used to generate a response.
                                         * Can also contain previous assistant responses.
                                         *
                                         */
                                        content: z
                                            .union([
                                                z.string().describe("A text input to the model.\n"),
                                                z
                                                    .array(
                                                        z.union([
                                                            z
                                                                .object({
                                                                    /**The type of the input item. Always `input_text`.*/
                                                                    type: z
                                                                        .literal("input_text")
                                                                        .describe(
                                                                            "The type of the input item. Always `input_text`.",
                                                                        )
                                                                        .default("input_text"),
                                                                    /**The text input to the model.*/
                                                                    text: z
                                                                        .string()
                                                                        .describe(
                                                                            "The text input to the model.",
                                                                        ),
                                                                })
                                                                .describe(
                                                                    "A text input to the model.",
                                                                ),
                                                            z
                                                                .object({
                                                                    /**The type of the input item. Always `input_image`.*/
                                                                    type: z
                                                                        .literal("input_image")
                                                                        .describe(
                                                                            "The type of the input item. Always `input_image`.",
                                                                        )
                                                                        .default("input_image"),
                                                                    image_url: z
                                                                        .union([
                                                                            z
                                                                                .string()
                                                                                .describe(
                                                                                    "The URL of the image to be sent to the model. A fully qualified URL or base64 encoded image in a data URL.",
                                                                                ),
                                                                            z.null(),
                                                                        ])
                                                                        .optional(),
                                                                    file_id: z
                                                                        .union([
                                                                            z
                                                                                .string()
                                                                                .describe(
                                                                                    "The ID of the file to be sent to the model.",
                                                                                ),
                                                                            z.null(),
                                                                        ])
                                                                        .optional(),
                                                                    /**The detail level of the image to be sent to the model. One of `high`, `low`, or `auto`. Defaults to `auto`.*/
                                                                    detail: z
                                                                        .enum([
                                                                            "low",
                                                                            "high",
                                                                            "auto",
                                                                        ])
                                                                        .describe(
                                                                            "The detail level of the image to be sent to the model. One of `high`, `low`, or `auto`. Defaults to `auto`.",
                                                                        ),
                                                                })
                                                                .describe(
                                                                    "An image input to the model. Learn about [image inputs](https://platform.openai.com/docs/guides/vision).",
                                                                ),
                                                            z
                                                                .object({
                                                                    /**The type of the input item. Always `input_file`.*/
                                                                    type: z
                                                                        .literal("input_file")
                                                                        .describe(
                                                                            "The type of the input item. Always `input_file`.",
                                                                        )
                                                                        .default("input_file"),
                                                                    file_id: z
                                                                        .union([
                                                                            z
                                                                                .string()
                                                                                .describe(
                                                                                    "The ID of the file to be sent to the model.",
                                                                                ),
                                                                            z.null(),
                                                                        ])
                                                                        .optional(),
                                                                    /**The name of the file to be sent to the model.*/
                                                                    filename: z
                                                                        .string()
                                                                        .describe(
                                                                            "The name of the file to be sent to the model.",
                                                                        )
                                                                        .optional(),
                                                                    /**The URL of the file to be sent to the model.*/
                                                                    file_url: z
                                                                        .string()
                                                                        .describe(
                                                                            "The URL of the file to be sent to the model.",
                                                                        )
                                                                        .optional(),
                                                                    /**
                                                                     * The content of the file to be sent to the model.
                                                                     *
                                                                     */
                                                                    file_data: z
                                                                        .string()
                                                                        .describe(
                                                                            "The content of the file to be sent to the model.\n",
                                                                        )
                                                                        .optional(),
                                                                })
                                                                .describe(
                                                                    "A file input to the model.",
                                                                ),
                                                        ]),
                                                    )
                                                    .describe(
                                                        "A list of one or many input items to the model, containing different content \ntypes.\n",
                                                    ),
                                            ])
                                            .describe(
                                                "Text, image, or audio input to the model, used to generate a response.\nCan also contain previous assistant responses.\n",
                                            ),
                                        /**
                                         * The type of the message input. Always `message`.
                                         *
                                         */
                                        type: z
                                            .literal("message")
                                            .describe(
                                                "The type of the message input. Always `message`.\n",
                                            )
                                            .optional(),
                                    })
                                    .describe(
                                        "A message input to the model with a role indicating instruction following\nhierarchy. Instructions given with the `developer` or `system` role take\nprecedence over instructions given with the `user` role. Messages with the\n`assistant` role are presumed to have been generated by the model in previous\ninteractions.\n",
                                    ),
                                z
                                    .union([
                                        z
                                            .object({
                                                /**
                                                 * The type of the message input. Always set to `message`.
                                                 *
                                                 */
                                                type: z
                                                    .literal("message")
                                                    .describe(
                                                        "The type of the message input. Always set to `message`.\n",
                                                    )
                                                    .optional(),
                                                /**
                                                 * The role of the message input. One of `user`, `system`, or `developer`.
                                                 *
                                                 */
                                                role: z
                                                    .enum(["user", "system", "developer"])
                                                    .describe(
                                                        "The role of the message input. One of `user`, `system`, or `developer`.\n",
                                                    ),
                                                /**
                                                 * The status of item. One of `in_progress`, `completed`, or
                                                 * `incomplete`. Populated when items are returned via API.
                                                 *
                                                 */
                                                status: z
                                                    .enum([
                                                        "in_progress",
                                                        "completed",
                                                        "incomplete",
                                                    ])
                                                    .describe(
                                                        "The status of item. One of `in_progress`, `completed`, or\n`incomplete`. Populated when items are returned via API.\n",
                                                    )
                                                    .optional(),
                                                /**
                                                 * A list of one or many input items to the model, containing different content
                                                 * types.
                                                 *
                                                 */
                                                content: z
                                                    .array(
                                                        z.union([
                                                            z
                                                                .object({
                                                                    /**The type of the input item. Always `input_text`.*/
                                                                    type: z
                                                                        .literal("input_text")
                                                                        .describe(
                                                                            "The type of the input item. Always `input_text`.",
                                                                        )
                                                                        .default("input_text"),
                                                                    /**The text input to the model.*/
                                                                    text: z
                                                                        .string()
                                                                        .describe(
                                                                            "The text input to the model.",
                                                                        ),
                                                                })
                                                                .describe(
                                                                    "A text input to the model.",
                                                                ),
                                                            z
                                                                .object({
                                                                    /**The type of the input item. Always `input_image`.*/
                                                                    type: z
                                                                        .literal("input_image")
                                                                        .describe(
                                                                            "The type of the input item. Always `input_image`.",
                                                                        )
                                                                        .default("input_image"),
                                                                    image_url: z
                                                                        .union([
                                                                            z
                                                                                .string()
                                                                                .describe(
                                                                                    "The URL of the image to be sent to the model. A fully qualified URL or base64 encoded image in a data URL.",
                                                                                ),
                                                                            z.null(),
                                                                        ])
                                                                        .optional(),
                                                                    file_id: z
                                                                        .union([
                                                                            z
                                                                                .string()
                                                                                .describe(
                                                                                    "The ID of the file to be sent to the model.",
                                                                                ),
                                                                            z.null(),
                                                                        ])
                                                                        .optional(),
                                                                    /**The detail level of the image to be sent to the model. One of `high`, `low`, or `auto`. Defaults to `auto`.*/
                                                                    detail: z
                                                                        .enum([
                                                                            "low",
                                                                            "high",
                                                                            "auto",
                                                                        ])
                                                                        .describe(
                                                                            "The detail level of the image to be sent to the model. One of `high`, `low`, or `auto`. Defaults to `auto`.",
                                                                        ),
                                                                })
                                                                .describe(
                                                                    "An image input to the model. Learn about [image inputs](https://platform.openai.com/docs/guides/vision).",
                                                                ),
                                                            z
                                                                .object({
                                                                    /**The type of the input item. Always `input_file`.*/
                                                                    type: z
                                                                        .literal("input_file")
                                                                        .describe(
                                                                            "The type of the input item. Always `input_file`.",
                                                                        )
                                                                        .default("input_file"),
                                                                    file_id: z
                                                                        .union([
                                                                            z
                                                                                .string()
                                                                                .describe(
                                                                                    "The ID of the file to be sent to the model.",
                                                                                ),
                                                                            z.null(),
                                                                        ])
                                                                        .optional(),
                                                                    /**The name of the file to be sent to the model.*/
                                                                    filename: z
                                                                        .string()
                                                                        .describe(
                                                                            "The name of the file to be sent to the model.",
                                                                        )
                                                                        .optional(),
                                                                    /**The URL of the file to be sent to the model.*/
                                                                    file_url: z
                                                                        .string()
                                                                        .describe(
                                                                            "The URL of the file to be sent to the model.",
                                                                        )
                                                                        .optional(),
                                                                    /**
                                                                     * The content of the file to be sent to the model.
                                                                     *
                                                                     */
                                                                    file_data: z
                                                                        .string()
                                                                        .describe(
                                                                            "The content of the file to be sent to the model.\n",
                                                                        )
                                                                        .optional(),
                                                                })
                                                                .describe(
                                                                    "A file input to the model.",
                                                                ),
                                                        ]),
                                                    )
                                                    .describe(
                                                        "A list of one or many input items to the model, containing different content \ntypes.\n",
                                                    ),
                                            })
                                            .describe(
                                                "A message input to the model with a role indicating instruction following\nhierarchy. Instructions given with the `developer` or `system` role take\nprecedence over instructions given with the `user` role.\n",
                                            ),
                                        z
                                            .object({
                                                /**
                                                 * The unique ID of the output message.
                                                 *
                                                 */
                                                id: z
                                                    .string()
                                                    .describe(
                                                        "The unique ID of the output message.\n",
                                                    ),
                                                /**
                                                 * The type of the output message. Always `message`.
                                                 *
                                                 */
                                                type: z
                                                    .literal("message")
                                                    .describe(
                                                        "The type of the output message. Always `message`.\n",
                                                    ),
                                                /**
                                                 * The role of the output message. Always `assistant`.
                                                 *
                                                 */
                                                role: z
                                                    .literal("assistant")
                                                    .describe(
                                                        "The role of the output message. Always `assistant`.\n",
                                                    ),
                                                /**
                                                 * The content of the output message.
                                                 *
                                                 */
                                                content: z
                                                    .array(
                                                        z.union([
                                                            z
                                                                .object({
                                                                    /**The type of the output text. Always `output_text`.*/
                                                                    type: z
                                                                        .literal("output_text")
                                                                        .describe(
                                                                            "The type of the output text. Always `output_text`.",
                                                                        )
                                                                        .default("output_text"),
                                                                    /**The text output from the model.*/
                                                                    text: z
                                                                        .string()
                                                                        .describe(
                                                                            "The text output from the model.",
                                                                        ),
                                                                    /**The annotations of the text output.*/
                                                                    annotations: z
                                                                        .array(
                                                                            z.union([
                                                                                z
                                                                                    .object({
                                                                                        /**The type of the file citation. Always `file_citation`.*/
                                                                                        type: z
                                                                                            .literal(
                                                                                                "file_citation",
                                                                                            )
                                                                                            .describe(
                                                                                                "The type of the file citation. Always `file_citation`.",
                                                                                            )
                                                                                            .default(
                                                                                                "file_citation",
                                                                                            ),
                                                                                        /**The ID of the file.*/
                                                                                        file_id: z
                                                                                            .string()
                                                                                            .describe(
                                                                                                "The ID of the file.",
                                                                                            ),
                                                                                        /**The index of the file in the list of files.*/
                                                                                        index: z
                                                                                            .number()
                                                                                            .int()
                                                                                            .describe(
                                                                                                "The index of the file in the list of files.",
                                                                                            ),
                                                                                        /**The filename of the file cited.*/
                                                                                        filename: z
                                                                                            .string()
                                                                                            .describe(
                                                                                                "The filename of the file cited.",
                                                                                            ),
                                                                                    })
                                                                                    .describe(
                                                                                        "A citation to a file.",
                                                                                    ),
                                                                                z
                                                                                    .object({
                                                                                        /**The type of the URL citation. Always `url_citation`.*/
                                                                                        type: z
                                                                                            .literal(
                                                                                                "url_citation",
                                                                                            )
                                                                                            .describe(
                                                                                                "The type of the URL citation. Always `url_citation`.",
                                                                                            )
                                                                                            .default(
                                                                                                "url_citation",
                                                                                            ),
                                                                                        /**The URL of the web resource.*/
                                                                                        url: z
                                                                                            .string()
                                                                                            .describe(
                                                                                                "The URL of the web resource.",
                                                                                            ),
                                                                                        /**The index of the first character of the URL citation in the message.*/
                                                                                        start_index:
                                                                                            z
                                                                                                .number()
                                                                                                .int()
                                                                                                .describe(
                                                                                                    "The index of the first character of the URL citation in the message.",
                                                                                                ),
                                                                                        /**The index of the last character of the URL citation in the message.*/
                                                                                        end_index: z
                                                                                            .number()
                                                                                            .int()
                                                                                            .describe(
                                                                                                "The index of the last character of the URL citation in the message.",
                                                                                            ),
                                                                                        /**The title of the web resource.*/
                                                                                        title: z
                                                                                            .string()
                                                                                            .describe(
                                                                                                "The title of the web resource.",
                                                                                            ),
                                                                                    })
                                                                                    .describe(
                                                                                        "A citation for a web resource used to generate a model response.",
                                                                                    ),
                                                                                z
                                                                                    .object({
                                                                                        /**The type of the container file citation. Always `container_file_citation`.*/
                                                                                        type: z
                                                                                            .literal(
                                                                                                "container_file_citation",
                                                                                            )
                                                                                            .describe(
                                                                                                "The type of the container file citation. Always `container_file_citation`.",
                                                                                            )
                                                                                            .default(
                                                                                                "container_file_citation",
                                                                                            ),
                                                                                        /**The ID of the container file.*/
                                                                                        container_id:
                                                                                            z
                                                                                                .string()
                                                                                                .describe(
                                                                                                    "The ID of the container file.",
                                                                                                ),
                                                                                        /**The ID of the file.*/
                                                                                        file_id: z
                                                                                            .string()
                                                                                            .describe(
                                                                                                "The ID of the file.",
                                                                                            ),
                                                                                        /**The index of the first character of the container file citation in the message.*/
                                                                                        start_index:
                                                                                            z
                                                                                                .number()
                                                                                                .int()
                                                                                                .describe(
                                                                                                    "The index of the first character of the container file citation in the message.",
                                                                                                ),
                                                                                        /**The index of the last character of the container file citation in the message.*/
                                                                                        end_index: z
                                                                                            .number()
                                                                                            .int()
                                                                                            .describe(
                                                                                                "The index of the last character of the container file citation in the message.",
                                                                                            ),
                                                                                        /**The filename of the container file cited.*/
                                                                                        filename: z
                                                                                            .string()
                                                                                            .describe(
                                                                                                "The filename of the container file cited.",
                                                                                            ),
                                                                                    })
                                                                                    .describe(
                                                                                        "A citation for a container file used to generate a model response.",
                                                                                    ),
                                                                                z
                                                                                    .object({
                                                                                        /**
                                                                                         * The type of the file path. Always `file_path`.
                                                                                         *
                                                                                         */
                                                                                        type: z
                                                                                            .literal(
                                                                                                "file_path",
                                                                                            )
                                                                                            .describe(
                                                                                                "The type of the file path. Always `file_path`.\n",
                                                                                            ),
                                                                                        /**
                                                                                         * The ID of the file.
                                                                                         *
                                                                                         */
                                                                                        file_id: z
                                                                                            .string()
                                                                                            .describe(
                                                                                                "The ID of the file.\n",
                                                                                            ),
                                                                                        /**
                                                                                         * The index of the file in the list of files.
                                                                                         *
                                                                                         */
                                                                                        index: z
                                                                                            .number()
                                                                                            .int()
                                                                                            .describe(
                                                                                                "The index of the file in the list of files.\n",
                                                                                            ),
                                                                                    })
                                                                                    .describe(
                                                                                        "A path to a file.\n",
                                                                                    ),
                                                                            ]),
                                                                        )
                                                                        .describe(
                                                                            "The annotations of the text output.",
                                                                        ),
                                                                    logprobs: z
                                                                        .array(
                                                                            z
                                                                                .object({
                                                                                    token: z.string(),
                                                                                    logprob:
                                                                                        z.number(),
                                                                                    bytes: z.array(
                                                                                        z
                                                                                            .number()
                                                                                            .int(),
                                                                                    ),
                                                                                    top_logprobs:
                                                                                        z.array(
                                                                                            z
                                                                                                .object(
                                                                                                    {
                                                                                                        token: z.string(),
                                                                                                        logprob:
                                                                                                            z.number(),
                                                                                                        bytes: z.array(
                                                                                                            z
                                                                                                                .number()
                                                                                                                .int(),
                                                                                                        ),
                                                                                                    },
                                                                                                )
                                                                                                .describe(
                                                                                                    "The top log probability of a token.",
                                                                                                ),
                                                                                        ),
                                                                                })
                                                                                .describe(
                                                                                    "The log probability of a token.",
                                                                                ),
                                                                        )
                                                                        .optional(),
                                                                })
                                                                .describe(
                                                                    "A text output from the model.",
                                                                ),
                                                            z
                                                                .object({
                                                                    /**The type of the refusal. Always `refusal`.*/
                                                                    type: z
                                                                        .literal("refusal")
                                                                        .describe(
                                                                            "The type of the refusal. Always `refusal`.",
                                                                        )
                                                                        .default("refusal"),
                                                                    /**The refusal explanation from the model.*/
                                                                    refusal: z
                                                                        .string()
                                                                        .describe(
                                                                            "The refusal explanation from the model.",
                                                                        ),
                                                                })
                                                                .describe(
                                                                    "A refusal from the model.",
                                                                ),
                                                        ]),
                                                    )
                                                    .describe(
                                                        "The content of the output message.\n",
                                                    ),
                                                /**
                                                 * The status of the message input. One of `in_progress`, `completed`, or
                                                 * `incomplete`. Populated when input items are returned via API.
                                                 *
                                                 */
                                                status: z
                                                    .enum([
                                                        "in_progress",
                                                        "completed",
                                                        "incomplete",
                                                    ])
                                                    .describe(
                                                        "The status of the message input. One of `in_progress`, `completed`, or\n`incomplete`. Populated when input items are returned via API.\n",
                                                    ),
                                            })
                                            .describe("An output message from the model.\n"),
                                        z
                                            .object({
                                                /**
                                                 * The unique ID of the file search tool call.
                                                 *
                                                 */
                                                id: z
                                                    .string()
                                                    .describe(
                                                        "The unique ID of the file search tool call.\n",
                                                    ),
                                                /**
                                                 * The type of the file search tool call. Always `file_search_call`.
                                                 *
                                                 */
                                                type: z
                                                    .literal("file_search_call")
                                                    .describe(
                                                        "The type of the file search tool call. Always `file_search_call`.\n",
                                                    ),
                                                /**
                                                 * The status of the file search tool call. One of `in_progress`,
                                                 * `searching`, `incomplete` or `failed`,
                                                 *
                                                 */
                                                status: z
                                                    .enum([
                                                        "in_progress",
                                                        "searching",
                                                        "completed",
                                                        "incomplete",
                                                        "failed",
                                                    ])
                                                    .describe(
                                                        "The status of the file search tool call. One of `in_progress`,\n`searching`, `incomplete` or `failed`,\n",
                                                    ),
                                                /**
                                                 * The queries used to search for files.
                                                 *
                                                 */
                                                queries: z
                                                    .array(z.string())
                                                    .describe(
                                                        "The queries used to search for files.\n",
                                                    ),
                                                results: z
                                                    .union([
                                                        z
                                                            .array(
                                                                z.object({
                                                                    /**
                                                                     * The unique ID of the file.
                                                                     *
                                                                     */
                                                                    file_id: z
                                                                        .string()
                                                                        .describe(
                                                                            "The unique ID of the file.\n",
                                                                        )
                                                                        .optional(),
                                                                    /**
                                                                     * The text that was retrieved from the file.
                                                                     *
                                                                     */
                                                                    text: z
                                                                        .string()
                                                                        .describe(
                                                                            "The text that was retrieved from the file.\n",
                                                                        )
                                                                        .optional(),
                                                                    /**
                                                                     * The name of the file.
                                                                     *
                                                                     */
                                                                    filename: z
                                                                        .string()
                                                                        .describe(
                                                                            "The name of the file.\n",
                                                                        )
                                                                        .optional(),
                                                                    attributes: z
                                                                        .union([
                                                                            z
                                                                                .record(
                                                                                    z
                                                                                        .string()
                                                                                        .max(64),
                                                                                    z.union([
                                                                                        z
                                                                                            .string()
                                                                                            .max(
                                                                                                512,
                                                                                            ),
                                                                                        z.number(),
                                                                                        z.boolean(),
                                                                                    ]),
                                                                                )
                                                                                .describe(
                                                                                    "Set of 16 key-value pairs that can be attached to an object. This can be\nuseful for storing additional information about the object in a structured\nformat, and querying for objects via API or the dashboard. Keys are strings\nwith a maximum length of 64 characters. Values are strings with a maximum\nlength of 512 characters, booleans, or numbers.\n",
                                                                                ),
                                                                            z.null(),
                                                                        ])
                                                                        .optional(),
                                                                    /**
                                                                     * The relevance score of the file - a value between 0 and 1.
                                                                     *
                                                                     */
                                                                    score: z
                                                                        .number()
                                                                        .describe(
                                                                            "The relevance score of the file - a value between 0 and 1.\n",
                                                                        )
                                                                        .optional(),
                                                                }),
                                                            )
                                                            .describe(
                                                                "The results of the file search tool call.\n",
                                                            ),
                                                        z.null(),
                                                    ])
                                                    .optional(),
                                            })
                                            .describe(
                                                "The results of a file search tool call. See the\n[file search guide](https://platform.openai.com/docs/guides/tools-file-search) for more information.\n",
                                            ),
                                        z
                                            .object({
                                                /**The type of the computer call. Always `computer_call`.*/
                                                type: z
                                                    .literal("computer_call")
                                                    .describe(
                                                        "The type of the computer call. Always `computer_call`.",
                                                    )
                                                    .default("computer_call"),
                                                /**The unique ID of the computer call.*/
                                                id: z
                                                    .string()
                                                    .describe(
                                                        "The unique ID of the computer call.",
                                                    ),
                                                /**
                                                 * An identifier used when responding to the tool call with output.
                                                 *
                                                 */
                                                call_id: z
                                                    .string()
                                                    .describe(
                                                        "An identifier used when responding to the tool call with output.\n",
                                                    ),
                                                action: z.union([
                                                    z
                                                        .object({
                                                            /**Specifies the event type. For a click action, this property is always `click`.*/
                                                            type: z
                                                                .literal("click")
                                                                .describe(
                                                                    "Specifies the event type. For a click action, this property is always `click`.",
                                                                )
                                                                .default("click"),
                                                            /**Indicates which mouse button was pressed during the click. One of `left`, `right`, `wheel`, `back`, or `forward`.*/
                                                            button: z
                                                                .enum([
                                                                    "left",
                                                                    "right",
                                                                    "wheel",
                                                                    "back",
                                                                    "forward",
                                                                ])
                                                                .describe(
                                                                    "Indicates which mouse button was pressed during the click. One of `left`, `right`, `wheel`, `back`, or `forward`.",
                                                                ),
                                                            /**The x-coordinate where the click occurred.*/
                                                            x: z
                                                                .number()
                                                                .int()
                                                                .describe(
                                                                    "The x-coordinate where the click occurred.",
                                                                ),
                                                            /**The y-coordinate where the click occurred.*/
                                                            y: z
                                                                .number()
                                                                .int()
                                                                .describe(
                                                                    "The y-coordinate where the click occurred.",
                                                                ),
                                                        })
                                                        .describe("A click action."),
                                                    z
                                                        .object({
                                                            /**Specifies the event type. For a double click action, this property is always set to `double_click`.*/
                                                            type: z
                                                                .literal("double_click")
                                                                .describe(
                                                                    "Specifies the event type. For a double click action, this property is always set to `double_click`.",
                                                                )
                                                                .default("double_click"),
                                                            /**The x-coordinate where the double click occurred.*/
                                                            x: z
                                                                .number()
                                                                .int()
                                                                .describe(
                                                                    "The x-coordinate where the double click occurred.",
                                                                ),
                                                            /**The y-coordinate where the double click occurred.*/
                                                            y: z
                                                                .number()
                                                                .int()
                                                                .describe(
                                                                    "The y-coordinate where the double click occurred.",
                                                                ),
                                                        })
                                                        .describe("A double click action."),
                                                    z
                                                        .object({
                                                            /**
                                                             * Specifies the event type. For a drag action, this property is
                                                             * always set to `drag`.
                                                             *
                                                             */
                                                            type: z
                                                                .literal("drag")
                                                                .describe(
                                                                    "Specifies the event type. For a drag action, this property is \nalways set to `drag`.\n",
                                                                )
                                                                .default("drag"),
                                                            /**
                                                             * An array of coordinates representing the path of the drag action. Coordinates will appear as an array
                                                             * of objects, eg
                                                             * ```
                                                             * [
                                                             *   { x: 100, y: 200 },
                                                             *   { x: 200, y: 300 }
                                                             * ]
                                                             * ```
                                                             *
                                                             */
                                                            path: z
                                                                .array(
                                                                    z
                                                                        .object({
                                                                            /**The x-coordinate.*/
                                                                            x: z
                                                                                .number()
                                                                                .int()
                                                                                .describe(
                                                                                    "The x-coordinate.",
                                                                                ),
                                                                            /**The y-coordinate.*/
                                                                            y: z
                                                                                .number()
                                                                                .int()
                                                                                .describe(
                                                                                    "The y-coordinate.",
                                                                                ),
                                                                        })
                                                                        .describe(
                                                                            "An x/y coordinate pair, e.g. `{ x: 100, y: 200 }`.",
                                                                        ),
                                                                )
                                                                .describe(
                                                                    "An array of coordinates representing the path of the drag action. Coordinates will appear as an array\nof objects, eg\n```\n[\n  { x: 100, y: 200 },\n  { x: 200, y: 300 }\n]\n```\n",
                                                                ),
                                                        })
                                                        .describe("A drag action.\n"),
                                                    z
                                                        .object({
                                                            /**Specifies the event type. For a keypress action, this property is always set to `keypress`.*/
                                                            type: z
                                                                .literal("keypress")
                                                                .describe(
                                                                    "Specifies the event type. For a keypress action, this property is always set to `keypress`.",
                                                                )
                                                                .default("keypress"),
                                                            /**The combination of keys the model is requesting to be pressed. This is an array of strings, each representing a key.*/
                                                            keys: z
                                                                .array(
                                                                    z
                                                                        .string()
                                                                        .describe(
                                                                            "One of the keys the model is requesting to be pressed.",
                                                                        ),
                                                                )
                                                                .describe(
                                                                    "The combination of keys the model is requesting to be pressed. This is an array of strings, each representing a key.",
                                                                ),
                                                        })
                                                        .describe(
                                                            "A collection of keypresses the model would like to perform.",
                                                        ),
                                                    z
                                                        .object({
                                                            /**
                                                             * Specifies the event type. For a move action, this property is
                                                             * always set to `move`.
                                                             *
                                                             */
                                                            type: z
                                                                .literal("move")
                                                                .describe(
                                                                    "Specifies the event type. For a move action, this property is \nalways set to `move`.\n",
                                                                )
                                                                .default("move"),
                                                            /**
                                                             * The x-coordinate to move to.
                                                             *
                                                             */
                                                            x: z
                                                                .number()
                                                                .int()
                                                                .describe(
                                                                    "The x-coordinate to move to.\n",
                                                                ),
                                                            /**
                                                             * The y-coordinate to move to.
                                                             *
                                                             */
                                                            y: z
                                                                .number()
                                                                .int()
                                                                .describe(
                                                                    "The y-coordinate to move to.\n",
                                                                ),
                                                        })
                                                        .describe("A mouse move action.\n"),
                                                    z
                                                        .object({
                                                            /**
                                                             * Specifies the event type. For a screenshot action, this property is
                                                             * always set to `screenshot`.
                                                             *
                                                             */
                                                            type: z
                                                                .literal("screenshot")
                                                                .describe(
                                                                    "Specifies the event type. For a screenshot action, this property is \nalways set to `screenshot`.\n",
                                                                )
                                                                .default("screenshot"),
                                                        })
                                                        .describe("A screenshot action.\n"),
                                                    z
                                                        .object({
                                                            /**
                                                             * Specifies the event type. For a scroll action, this property is
                                                             * always set to `scroll`.
                                                             *
                                                             */
                                                            type: z
                                                                .literal("scroll")
                                                                .describe(
                                                                    "Specifies the event type. For a scroll action, this property is \nalways set to `scroll`.\n",
                                                                )
                                                                .default("scroll"),
                                                            /**
                                                             * The x-coordinate where the scroll occurred.
                                                             *
                                                             */
                                                            x: z
                                                                .number()
                                                                .int()
                                                                .describe(
                                                                    "The x-coordinate where the scroll occurred.\n",
                                                                ),
                                                            /**
                                                             * The y-coordinate where the scroll occurred.
                                                             *
                                                             */
                                                            y: z
                                                                .number()
                                                                .int()
                                                                .describe(
                                                                    "The y-coordinate where the scroll occurred.\n",
                                                                ),
                                                            /**
                                                             * The horizontal scroll distance.
                                                             *
                                                             */
                                                            scroll_x: z
                                                                .number()
                                                                .int()
                                                                .describe(
                                                                    "The horizontal scroll distance.\n",
                                                                ),
                                                            /**
                                                             * The vertical scroll distance.
                                                             *
                                                             */
                                                            scroll_y: z
                                                                .number()
                                                                .int()
                                                                .describe(
                                                                    "The vertical scroll distance.\n",
                                                                ),
                                                        })
                                                        .describe("A scroll action.\n"),
                                                    z
                                                        .object({
                                                            /**
                                                             * Specifies the event type. For a type action, this property is
                                                             * always set to `type`.
                                                             *
                                                             */
                                                            type: z
                                                                .literal("type")
                                                                .describe(
                                                                    "Specifies the event type. For a type action, this property is \nalways set to `type`.\n",
                                                                )
                                                                .default("type"),
                                                            /**
                                                             * The text to type.
                                                             *
                                                             */
                                                            text: z
                                                                .string()
                                                                .describe("The text to type.\n"),
                                                        })
                                                        .describe("An action to type in text.\n"),
                                                    z
                                                        .object({
                                                            /**
                                                             * Specifies the event type. For a wait action, this property is
                                                             * always set to `wait`.
                                                             *
                                                             */
                                                            type: z
                                                                .literal("wait")
                                                                .describe(
                                                                    "Specifies the event type. For a wait action, this property is \nalways set to `wait`.\n",
                                                                )
                                                                .default("wait"),
                                                        })
                                                        .describe("A wait action.\n"),
                                                ]),
                                                /**
                                                 * The pending safety checks for the computer call.
                                                 *
                                                 */
                                                pending_safety_checks: z
                                                    .array(
                                                        z
                                                            .object({
                                                                /**The ID of the pending safety check.*/
                                                                id: z
                                                                    .string()
                                                                    .describe(
                                                                        "The ID of the pending safety check.",
                                                                    ),
                                                                code: z
                                                                    .union([
                                                                        z
                                                                            .string()
                                                                            .describe(
                                                                                "The type of the pending safety check.",
                                                                            ),
                                                                        z.null(),
                                                                    ])
                                                                    .optional(),
                                                                message: z
                                                                    .union([
                                                                        z
                                                                            .string()
                                                                            .describe(
                                                                                "Details about the pending safety check.",
                                                                            ),
                                                                        z.null(),
                                                                    ])
                                                                    .optional(),
                                                            })
                                                            .describe(
                                                                "A pending safety check for the computer call.",
                                                            ),
                                                    )
                                                    .describe(
                                                        "The pending safety checks for the computer call.\n",
                                                    ),
                                                /**
                                                 * The status of the item. One of `in_progress`, `completed`, or
                                                 * `incomplete`. Populated when items are returned via API.
                                                 *
                                                 */
                                                status: z
                                                    .enum([
                                                        "in_progress",
                                                        "completed",
                                                        "incomplete",
                                                    ])
                                                    .describe(
                                                        "The status of the item. One of `in_progress`, `completed`, or\n`incomplete`. Populated when items are returned via API.\n",
                                                    ),
                                            })
                                            .describe(
                                                "A tool call to a computer use tool. See the\n[computer use guide](https://platform.openai.com/docs/guides/tools-computer-use) for more information.\n",
                                            ),
                                        z
                                            .object({
                                                id: z
                                                    .union([
                                                        z
                                                            .string()
                                                            .describe(
                                                                "The ID of the computer tool call output.",
                                                            ),
                                                        z.null(),
                                                    ])
                                                    .optional(),
                                                /**The ID of the computer tool call that produced the output.*/
                                                call_id: z
                                                    .string()
                                                    .min(1)
                                                    .max(64)
                                                    .describe(
                                                        "The ID of the computer tool call that produced the output.",
                                                    ),
                                                /**The type of the computer tool call output. Always `computer_call_output`.*/
                                                type: z
                                                    .literal("computer_call_output")
                                                    .describe(
                                                        "The type of the computer tool call output. Always `computer_call_output`.",
                                                    )
                                                    .default("computer_call_output"),
                                                /**
                                                 * A computer screenshot image used with the computer use tool.
                                                 *
                                                 */
                                                output: z
                                                    .object({
                                                        /**
                                                         * Specifies the event type. For a computer screenshot, this property is
                                                         * always set to `computer_screenshot`.
                                                         *
                                                         */
                                                        type: z
                                                            .literal("computer_screenshot")
                                                            .describe(
                                                                "Specifies the event type. For a computer screenshot, this property is \nalways set to `computer_screenshot`.\n",
                                                            )
                                                            .default("computer_screenshot"),
                                                        /**The URL of the screenshot image.*/
                                                        image_url: z
                                                            .string()
                                                            .describe(
                                                                "The URL of the screenshot image.",
                                                            )
                                                            .optional(),
                                                        /**The identifier of an uploaded file that contains the screenshot.*/
                                                        file_id: z
                                                            .string()
                                                            .describe(
                                                                "The identifier of an uploaded file that contains the screenshot.",
                                                            )
                                                            .optional(),
                                                    })
                                                    .describe(
                                                        "A computer screenshot image used with the computer use tool.\n",
                                                    ),
                                                acknowledged_safety_checks: z
                                                    .union([
                                                        z
                                                            .array(
                                                                z
                                                                    .object({
                                                                        /**The ID of the pending safety check.*/
                                                                        id: z
                                                                            .string()
                                                                            .describe(
                                                                                "The ID of the pending safety check.",
                                                                            ),
                                                                        code: z
                                                                            .union([
                                                                                z
                                                                                    .string()
                                                                                    .describe(
                                                                                        "The type of the pending safety check.",
                                                                                    ),
                                                                                z.null(),
                                                                            ])
                                                                            .optional(),
                                                                        message: z
                                                                            .union([
                                                                                z
                                                                                    .string()
                                                                                    .describe(
                                                                                        "Details about the pending safety check.",
                                                                                    ),
                                                                                z.null(),
                                                                            ])
                                                                            .optional(),
                                                                    })
                                                                    .describe(
                                                                        "A pending safety check for the computer call.",
                                                                    ),
                                                            )
                                                            .describe(
                                                                "The safety checks reported by the API that have been acknowledged by the developer.",
                                                            ),
                                                        z.null(),
                                                    ])
                                                    .optional(),
                                                status: z
                                                    .union([
                                                        z
                                                            .enum([
                                                                "in_progress",
                                                                "completed",
                                                                "incomplete",
                                                            ])
                                                            .describe(
                                                                "The status of the message input. One of `in_progress`, `completed`, or `incomplete`. Populated when input items are returned via API.",
                                                            ),
                                                        z.null(),
                                                    ])
                                                    .optional(),
                                            })
                                            .describe("The output of a computer tool call."),
                                        z
                                            .object({
                                                /**
                                                 * The unique ID of the web search tool call.
                                                 *
                                                 */
                                                id: z
                                                    .string()
                                                    .describe(
                                                        "The unique ID of the web search tool call.\n",
                                                    ),
                                                /**
                                                 * The type of the web search tool call. Always `web_search_call`.
                                                 *
                                                 */
                                                type: z
                                                    .literal("web_search_call")
                                                    .describe(
                                                        "The type of the web search tool call. Always `web_search_call`.\n",
                                                    ),
                                                /**
                                                 * The status of the web search tool call.
                                                 *
                                                 */
                                                status: z
                                                    .enum([
                                                        "in_progress",
                                                        "searching",
                                                        "completed",
                                                        "failed",
                                                    ])
                                                    .describe(
                                                        "The status of the web search tool call.\n",
                                                    ),
                                                /**
                                                 * An object describing the specific action taken in this web search call.
                                                 * Includes details on how the model used the web (search, open_page, find).
                                                 *
                                                 */
                                                action: z
                                                    .union([
                                                        z
                                                            .object({
                                                                /**
                                                                 * The action type.
                                                                 *
                                                                 */
                                                                type: z
                                                                    .literal("search")
                                                                    .describe("The action type.\n"),
                                                                /**
                                                                 * The search query.
                                                                 *
                                                                 */
                                                                query: z
                                                                    .string()
                                                                    .describe(
                                                                        "The search query.\n",
                                                                    ),
                                                                /**
                                                                 * The sources used in the search.
                                                                 *
                                                                 */
                                                                sources: z
                                                                    .array(
                                                                        z
                                                                            .object({
                                                                                /**
                                                                                 * The type of source. Always `url`.
                                                                                 *
                                                                                 */
                                                                                type: z
                                                                                    .literal("url")
                                                                                    .describe(
                                                                                        "The type of source. Always `url`.\n",
                                                                                    ),
                                                                                /**
                                                                                 * The URL of the source.
                                                                                 *
                                                                                 */
                                                                                url: z
                                                                                    .string()
                                                                                    .describe(
                                                                                        "The URL of the source.\n",
                                                                                    ),
                                                                            })
                                                                            .describe(
                                                                                "A source used in the search.\n",
                                                                            ),
                                                                    )
                                                                    .describe(
                                                                        "The sources used in the search.\n",
                                                                    )
                                                                    .optional(),
                                                            })
                                                            .describe(
                                                                'Action type "search" - Performs a web search query.\n',
                                                            ),
                                                        z
                                                            .object({
                                                                /**
                                                                 * The action type.
                                                                 *
                                                                 */
                                                                type: z
                                                                    .literal("open_page")
                                                                    .describe("The action type.\n"),
                                                                /**
                                                                 * The URL opened by the model.
                                                                 *
                                                                 */
                                                                url: z
                                                                    .string()
                                                                    .url()
                                                                    .describe(
                                                                        "The URL opened by the model.\n",
                                                                    ),
                                                            })
                                                            .describe(
                                                                'Action type "open_page" - Opens a specific URL from search results.\n',
                                                            ),
                                                        z
                                                            .object({
                                                                /**
                                                                 * The action type.
                                                                 *
                                                                 */
                                                                type: z
                                                                    .literal("find")
                                                                    .describe("The action type.\n"),
                                                                /**
                                                                 * The URL of the page searched for the pattern.
                                                                 *
                                                                 */
                                                                url: z
                                                                    .string()
                                                                    .url()
                                                                    .describe(
                                                                        "The URL of the page searched for the pattern.\n",
                                                                    ),
                                                                /**
                                                                 * The pattern or text to search for within the page.
                                                                 *
                                                                 */
                                                                pattern: z
                                                                    .string()
                                                                    .describe(
                                                                        "The pattern or text to search for within the page.\n",
                                                                    ),
                                                            })
                                                            .describe(
                                                                'Action type "find": Searches for a pattern within a loaded page.\n',
                                                            ),
                                                    ])
                                                    .describe(
                                                        "An object describing the specific action taken in this web search call.\nIncludes details on how the model used the web (search, open_page, find).\n",
                                                    ),
                                            })
                                            .describe(
                                                "The results of a web search tool call. See the\n[web search guide](https://platform.openai.com/docs/guides/tools-web-search) for more information.\n",
                                            ),
                                        z
                                            .object({
                                                /**
                                                 * The unique ID of the function tool call.
                                                 *
                                                 */
                                                id: z
                                                    .string()
                                                    .describe(
                                                        "The unique ID of the function tool call.\n",
                                                    )
                                                    .optional(),
                                                /**
                                                 * The type of the function tool call. Always `function_call`.
                                                 *
                                                 */
                                                type: z
                                                    .literal("function_call")
                                                    .describe(
                                                        "The type of the function tool call. Always `function_call`.\n",
                                                    ),
                                                /**
                                                 * The unique ID of the function tool call generated by the model.
                                                 *
                                                 */
                                                call_id: z
                                                    .string()
                                                    .describe(
                                                        "The unique ID of the function tool call generated by the model.\n",
                                                    ),
                                                /**
                                                 * The name of the function to run.
                                                 *
                                                 */
                                                name: z
                                                    .string()
                                                    .describe("The name of the function to run.\n"),
                                                /**
                                                 * A JSON string of the arguments to pass to the function.
                                                 *
                                                 */
                                                arguments: z
                                                    .string()
                                                    .describe(
                                                        "A JSON string of the arguments to pass to the function.\n",
                                                    ),
                                                /**
                                                 * The status of the item. One of `in_progress`, `completed`, or
                                                 * `incomplete`. Populated when items are returned via API.
                                                 *
                                                 */
                                                status: z
                                                    .enum([
                                                        "in_progress",
                                                        "completed",
                                                        "incomplete",
                                                    ])
                                                    .describe(
                                                        "The status of the item. One of `in_progress`, `completed`, or\n`incomplete`. Populated when items are returned via API.\n",
                                                    )
                                                    .optional(),
                                            })
                                            .describe(
                                                "A tool call to run a function. See the \n[function calling guide](https://platform.openai.com/docs/guides/function-calling) for more information.\n",
                                            ),
                                        z
                                            .object({
                                                id: z
                                                    .union([
                                                        z
                                                            .string()
                                                            .describe(
                                                                "The unique ID of the function tool call output. Populated when this item is returned via API.",
                                                            ),
                                                        z.null(),
                                                    ])
                                                    .optional(),
                                                /**The unique ID of the function tool call generated by the model.*/
                                                call_id: z
                                                    .string()
                                                    .min(1)
                                                    .max(64)
                                                    .describe(
                                                        "The unique ID of the function tool call generated by the model.",
                                                    ),
                                                /**The type of the function tool call output. Always `function_call_output`.*/
                                                type: z
                                                    .literal("function_call_output")
                                                    .describe(
                                                        "The type of the function tool call output. Always `function_call_output`.",
                                                    )
                                                    .default("function_call_output"),
                                                /**Text, image, or file output of the function tool call.*/
                                                output: z
                                                    .union([
                                                        z
                                                            .string()
                                                            .max(10485760)
                                                            .describe(
                                                                "A JSON string of the output of the function tool call.",
                                                            ),
                                                        z.array(
                                                            z.union([
                                                                z
                                                                    .object({
                                                                        /**The type of the input item. Always `input_text`.*/
                                                                        type: z
                                                                            .literal("input_text")
                                                                            .describe(
                                                                                "The type of the input item. Always `input_text`.",
                                                                            )
                                                                            .default("input_text"),
                                                                        /**The text input to the model.*/
                                                                        text: z
                                                                            .string()
                                                                            .max(10485760)
                                                                            .describe(
                                                                                "The text input to the model.",
                                                                            ),
                                                                    })
                                                                    .describe(
                                                                        "A text input to the model.",
                                                                    ),
                                                                z
                                                                    .object({
                                                                        /**The type of the input item. Always `input_image`.*/
                                                                        type: z
                                                                            .literal("input_image")
                                                                            .describe(
                                                                                "The type of the input item. Always `input_image`.",
                                                                            )
                                                                            .default("input_image"),
                                                                        image_url: z
                                                                            .union([
                                                                                z
                                                                                    .string()
                                                                                    .max(20971520)
                                                                                    .describe(
                                                                                        "The URL of the image to be sent to the model. A fully qualified URL or base64 encoded image in a data URL.",
                                                                                    ),
                                                                                z.null(),
                                                                            ])
                                                                            .optional(),
                                                                        file_id: z
                                                                            .union([
                                                                                z
                                                                                    .string()
                                                                                    .describe(
                                                                                        "The ID of the file to be sent to the model.",
                                                                                    ),
                                                                                z.null(),
                                                                            ])
                                                                            .optional(),
                                                                        detail: z
                                                                            .union([
                                                                                z
                                                                                    .enum([
                                                                                        "low",
                                                                                        "high",
                                                                                        "auto",
                                                                                    ])
                                                                                    .describe(
                                                                                        "The detail level of the image to be sent to the model. One of `high`, `low`, or `auto`. Defaults to `auto`.",
                                                                                    ),
                                                                                z.null(),
                                                                            ])
                                                                            .optional(),
                                                                    })
                                                                    .describe(
                                                                        "An image input to the model. Learn about [image inputs](https://platform.openai.com/docs/guides/vision)",
                                                                    ),
                                                                z
                                                                    .object({
                                                                        /**The type of the input item. Always `input_file`.*/
                                                                        type: z
                                                                            .literal("input_file")
                                                                            .describe(
                                                                                "The type of the input item. Always `input_file`.",
                                                                            )
                                                                            .default("input_file"),
                                                                        file_id: z
                                                                            .union([
                                                                                z
                                                                                    .string()
                                                                                    .describe(
                                                                                        "The ID of the file to be sent to the model.",
                                                                                    ),
                                                                                z.null(),
                                                                            ])
                                                                            .optional(),
                                                                        filename: z
                                                                            .union([
                                                                                z
                                                                                    .string()
                                                                                    .describe(
                                                                                        "The name of the file to be sent to the model.",
                                                                                    ),
                                                                                z.null(),
                                                                            ])
                                                                            .optional(),
                                                                        file_data: z
                                                                            .union([
                                                                                z
                                                                                    .string()
                                                                                    .max(33554432)
                                                                                    .describe(
                                                                                        "The base64-encoded data of the file to be sent to the model.",
                                                                                    ),
                                                                                z.null(),
                                                                            ])
                                                                            .optional(),
                                                                        file_url: z
                                                                            .union([
                                                                                z
                                                                                    .string()
                                                                                    .describe(
                                                                                        "The URL of the file to be sent to the model.",
                                                                                    ),
                                                                                z.null(),
                                                                            ])
                                                                            .optional(),
                                                                    })
                                                                    .describe(
                                                                        "A file input to the model.",
                                                                    ),
                                                            ]),
                                                        ),
                                                    ])
                                                    .describe(
                                                        "Text, image, or file output of the function tool call.",
                                                    ),
                                                status: z
                                                    .union([
                                                        z
                                                            .enum([
                                                                "in_progress",
                                                                "completed",
                                                                "incomplete",
                                                            ])
                                                            .describe(
                                                                "The status of the item. One of `in_progress`, `completed`, or `incomplete`. Populated when items are returned via API.",
                                                            ),
                                                        z.null(),
                                                    ])
                                                    .optional(),
                                            })
                                            .describe("The output of a function tool call."),
                                        z
                                            .object({
                                                /**
                                                 * The type of the object. Always `reasoning`.
                                                 *
                                                 */
                                                type: z
                                                    .literal("reasoning")
                                                    .describe(
                                                        "The type of the object. Always `reasoning`.\n",
                                                    ),
                                                /**
                                                 * The unique identifier of the reasoning content.
                                                 *
                                                 */
                                                id: z
                                                    .string()
                                                    .describe(
                                                        "The unique identifier of the reasoning content.\n",
                                                    ),
                                                encrypted_content: z
                                                    .union([
                                                        z
                                                            .string()
                                                            .describe(
                                                                "The encrypted content of the reasoning item - populated when a response is\ngenerated with `reasoning.encrypted_content` in the `include` parameter.\n",
                                                            ),
                                                        z.null(),
                                                    ])
                                                    .optional(),
                                                /**
                                                 * Reasoning summary content.
                                                 *
                                                 */
                                                summary: z
                                                    .array(
                                                        z
                                                            .object({
                                                                /**The type of the object. Always `summary_text`.*/
                                                                type: z
                                                                    .literal("summary_text")
                                                                    .describe(
                                                                        "The type of the object. Always `summary_text`.",
                                                                    )
                                                                    .default("summary_text"),
                                                                /**A summary of the reasoning output from the model so far.*/
                                                                text: z
                                                                    .string()
                                                                    .describe(
                                                                        "A summary of the reasoning output from the model so far.",
                                                                    ),
                                                            })
                                                            .describe(
                                                                "A summary text from the model.",
                                                            ),
                                                    )
                                                    .describe("Reasoning summary content.\n"),
                                                /**
                                                 * Reasoning text content.
                                                 *
                                                 */
                                                content: z
                                                    .array(
                                                        z
                                                            .object({
                                                                /**The type of the reasoning text. Always `reasoning_text`.*/
                                                                type: z
                                                                    .literal("reasoning_text")
                                                                    .describe(
                                                                        "The type of the reasoning text. Always `reasoning_text`.",
                                                                    )
                                                                    .default("reasoning_text"),
                                                                /**The reasoning text from the model.*/
                                                                text: z
                                                                    .string()
                                                                    .describe(
                                                                        "The reasoning text from the model.",
                                                                    ),
                                                            })
                                                            .describe(
                                                                "Reasoning text from the model.",
                                                            ),
                                                    )
                                                    .describe("Reasoning text content.\n")
                                                    .optional(),
                                                /**
                                                 * The status of the item. One of `in_progress`, `completed`, or
                                                 * `incomplete`. Populated when items are returned via API.
                                                 *
                                                 */
                                                status: z
                                                    .enum([
                                                        "in_progress",
                                                        "completed",
                                                        "incomplete",
                                                    ])
                                                    .describe(
                                                        "The status of the item. One of `in_progress`, `completed`, or\n`incomplete`. Populated when items are returned via API.\n",
                                                    )
                                                    .optional(),
                                            })
                                            .describe(
                                                "A description of the chain of thought used by a reasoning model while generating\na response. Be sure to include these items in your `input` to the Responses API\nfor subsequent turns of a conversation if you are manually\n[managing context](https://platform.openai.com/docs/guides/conversation-state).\n",
                                            ),
                                        z
                                            .object({
                                                id: z
                                                    .union([
                                                        z
                                                            .string()
                                                            .describe(
                                                                "The ID of the compaction item.",
                                                            ),
                                                        z.null(),
                                                    ])
                                                    .optional(),
                                                /**The type of the item. Always `compaction`.*/
                                                type: z
                                                    .literal("compaction")
                                                    .describe(
                                                        "The type of the item. Always `compaction`.",
                                                    )
                                                    .default("compaction"),
                                                encrypted_content: z.string().max(10485760),
                                            })
                                            .describe(
                                                "A compaction item generated by the [`v1/responses/compact` API](https://platform.openai.com/docs/api-reference/responses/compact).",
                                            ),
                                        z
                                            .object({
                                                /**
                                                 * The type of the image generation call. Always `image_generation_call`.
                                                 *
                                                 */
                                                type: z
                                                    .literal("image_generation_call")
                                                    .describe(
                                                        "The type of the image generation call. Always `image_generation_call`.\n",
                                                    ),
                                                /**
                                                 * The unique ID of the image generation call.
                                                 *
                                                 */
                                                id: z
                                                    .string()
                                                    .describe(
                                                        "The unique ID of the image generation call.\n",
                                                    ),
                                                /**
                                                 * The status of the image generation call.
                                                 *
                                                 */
                                                status: z
                                                    .enum([
                                                        "in_progress",
                                                        "completed",
                                                        "generating",
                                                        "failed",
                                                    ])
                                                    .describe(
                                                        "The status of the image generation call.\n",
                                                    ),
                                                result: z.union([
                                                    z
                                                        .string()
                                                        .describe(
                                                            "The generated image encoded in base64.\n",
                                                        ),
                                                    z.null(),
                                                ]),
                                            })
                                            .describe(
                                                "An image generation request made by the model.\n",
                                            ),
                                        z
                                            .object({
                                                /**
                                                 * The type of the code interpreter tool call. Always `code_interpreter_call`.
                                                 *
                                                 */
                                                type: z
                                                    .literal("code_interpreter_call")
                                                    .describe(
                                                        "The type of the code interpreter tool call. Always `code_interpreter_call`.\n",
                                                    )
                                                    .default("code_interpreter_call"),
                                                /**
                                                 * The unique ID of the code interpreter tool call.
                                                 *
                                                 */
                                                id: z
                                                    .string()
                                                    .describe(
                                                        "The unique ID of the code interpreter tool call.\n",
                                                    ),
                                                /**
                                                 * The status of the code interpreter tool call. Valid values are `in_progress`, `completed`, `incomplete`, `interpreting`, and `failed`.
                                                 *
                                                 */
                                                status: z
                                                    .enum([
                                                        "in_progress",
                                                        "completed",
                                                        "incomplete",
                                                        "interpreting",
                                                        "failed",
                                                    ])
                                                    .describe(
                                                        "The status of the code interpreter tool call. Valid values are `in_progress`, `completed`, `incomplete`, `interpreting`, and `failed`.\n",
                                                    ),
                                                /**
                                                 * The ID of the container used to run the code.
                                                 *
                                                 */
                                                container_id: z
                                                    .string()
                                                    .describe(
                                                        "The ID of the container used to run the code.\n",
                                                    ),
                                                code: z.union([
                                                    z
                                                        .string()
                                                        .describe(
                                                            "The code to run, or null if not available.\n",
                                                        ),
                                                    z.null(),
                                                ]),
                                                outputs: z.union([
                                                    z
                                                        .array(
                                                            z.union([
                                                                z
                                                                    .object({
                                                                        /**The type of the output. Always `logs`.*/
                                                                        type: z
                                                                            .literal("logs")
                                                                            .describe(
                                                                                "The type of the output. Always `logs`.",
                                                                            )
                                                                            .default("logs"),
                                                                        /**The logs output from the code interpreter.*/
                                                                        logs: z
                                                                            .string()
                                                                            .describe(
                                                                                "The logs output from the code interpreter.",
                                                                            ),
                                                                    })
                                                                    .describe(
                                                                        "The logs output from the code interpreter.",
                                                                    ),
                                                                z
                                                                    .object({
                                                                        /**The type of the output. Always `image`.*/
                                                                        type: z
                                                                            .literal("image")
                                                                            .describe(
                                                                                "The type of the output. Always `image`.",
                                                                            )
                                                                            .default("image"),
                                                                        /**The URL of the image output from the code interpreter.*/
                                                                        url: z
                                                                            .string()
                                                                            .describe(
                                                                                "The URL of the image output from the code interpreter.",
                                                                            ),
                                                                    })
                                                                    .describe(
                                                                        "The image output from the code interpreter.",
                                                                    ),
                                                            ]),
                                                        )
                                                        .describe(
                                                            "The outputs generated by the code interpreter, such as logs or images.\nCan be null if no outputs are available.\n",
                                                        ),
                                                    z.null(),
                                                ]),
                                            })
                                            .describe("A tool call to run code.\n"),
                                        z
                                            .object({
                                                /**
                                                 * The type of the local shell call. Always `local_shell_call`.
                                                 *
                                                 */
                                                type: z
                                                    .literal("local_shell_call")
                                                    .describe(
                                                        "The type of the local shell call. Always `local_shell_call`.\n",
                                                    ),
                                                /**
                                                 * The unique ID of the local shell call.
                                                 *
                                                 */
                                                id: z
                                                    .string()
                                                    .describe(
                                                        "The unique ID of the local shell call.\n",
                                                    ),
                                                /**
                                                 * The unique ID of the local shell tool call generated by the model.
                                                 *
                                                 */
                                                call_id: z
                                                    .string()
                                                    .describe(
                                                        "The unique ID of the local shell tool call generated by the model.\n",
                                                    ),
                                                /**Execute a shell command on the server.*/
                                                action: z
                                                    .object({
                                                        /**The type of the local shell action. Always `exec`.*/
                                                        type: z
                                                            .literal("exec")
                                                            .describe(
                                                                "The type of the local shell action. Always `exec`.",
                                                            )
                                                            .default("exec"),
                                                        /**The command to run.*/
                                                        command: z
                                                            .array(z.string())
                                                            .describe("The command to run."),
                                                        timeout_ms: z
                                                            .union([
                                                                z
                                                                    .number()
                                                                    .int()
                                                                    .describe(
                                                                        "Optional timeout in milliseconds for the command.",
                                                                    ),
                                                                z.null(),
                                                            ])
                                                            .optional(),
                                                        working_directory: z
                                                            .union([
                                                                z
                                                                    .string()
                                                                    .describe(
                                                                        "Optional working directory to run the command in.",
                                                                    ),
                                                                z.null(),
                                                            ])
                                                            .optional(),
                                                        /**Environment variables to set for the command.*/
                                                        env: z
                                                            .record(z.string(), z.string())
                                                            .describe(
                                                                "Environment variables to set for the command.",
                                                            ),
                                                        user: z
                                                            .union([
                                                                z
                                                                    .string()
                                                                    .describe(
                                                                        "Optional user to run the command as.",
                                                                    ),
                                                                z.null(),
                                                            ])
                                                            .optional(),
                                                    })
                                                    .describe(
                                                        "Execute a shell command on the server.",
                                                    ),
                                                /**
                                                 * The status of the local shell call.
                                                 *
                                                 */
                                                status: z
                                                    .enum([
                                                        "in_progress",
                                                        "completed",
                                                        "incomplete",
                                                    ])
                                                    .describe(
                                                        "The status of the local shell call.\n",
                                                    ),
                                            })
                                            .describe(
                                                "A tool call to run a command on the local shell.\n",
                                            ),
                                        z
                                            .object({
                                                /**
                                                 * The type of the local shell tool call output. Always `local_shell_call_output`.
                                                 *
                                                 */
                                                type: z
                                                    .literal("local_shell_call_output")
                                                    .describe(
                                                        "The type of the local shell tool call output. Always `local_shell_call_output`.\n",
                                                    ),
                                                /**
                                                 * The unique ID of the local shell tool call generated by the model.
                                                 *
                                                 */
                                                id: z
                                                    .string()
                                                    .describe(
                                                        "The unique ID of the local shell tool call generated by the model.\n",
                                                    ),
                                                /**
                                                 * A JSON string of the output of the local shell tool call.
                                                 *
                                                 */
                                                output: z
                                                    .string()
                                                    .describe(
                                                        "A JSON string of the output of the local shell tool call.\n",
                                                    ),
                                                status: z
                                                    .union([
                                                        z
                                                            .enum([
                                                                "in_progress",
                                                                "completed",
                                                                "incomplete",
                                                            ])
                                                            .describe(
                                                                "The status of the item. One of `in_progress`, `completed`, or `incomplete`.\n",
                                                            ),
                                                        z.null(),
                                                    ])
                                                    .optional(),
                                            })
                                            .describe("The output of a local shell tool call.\n"),
                                        z
                                            .object({
                                                id: z
                                                    .union([
                                                        z
                                                            .string()
                                                            .describe(
                                                                "The unique ID of the shell tool call. Populated when this item is returned via API.",
                                                            ),
                                                        z.null(),
                                                    ])
                                                    .optional(),
                                                /**The unique ID of the shell tool call generated by the model.*/
                                                call_id: z
                                                    .string()
                                                    .min(1)
                                                    .max(64)
                                                    .describe(
                                                        "The unique ID of the shell tool call generated by the model.",
                                                    ),
                                                /**The type of the item. Always `shell_call`.*/
                                                type: z
                                                    .literal("shell_call")
                                                    .describe(
                                                        "The type of the item. Always `shell_call`.",
                                                    )
                                                    .default("shell_call"),
                                                /**The shell commands and limits that describe how to run the tool call.*/
                                                action: z
                                                    .object({
                                                        /**Ordered shell commands for the execution environment to run.*/
                                                        commands: z
                                                            .array(z.string())
                                                            .describe(
                                                                "Ordered shell commands for the execution environment to run.",
                                                            ),
                                                        timeout_ms: z
                                                            .union([
                                                                z
                                                                    .number()
                                                                    .int()
                                                                    .describe(
                                                                        "Maximum wall-clock time in milliseconds to allow the shell commands to run.",
                                                                    ),
                                                                z.null(),
                                                            ])
                                                            .optional(),
                                                        max_output_length: z
                                                            .union([
                                                                z
                                                                    .number()
                                                                    .int()
                                                                    .describe(
                                                                        "Maximum number of UTF-8 characters to capture from combined stdout and stderr output.",
                                                                    ),
                                                                z.null(),
                                                            ])
                                                            .optional(),
                                                    })
                                                    .describe(
                                                        "The shell commands and limits that describe how to run the tool call.",
                                                    ),
                                                status: z
                                                    .union([
                                                        z
                                                            .enum([
                                                                "in_progress",
                                                                "completed",
                                                                "incomplete",
                                                            ])
                                                            .describe(
                                                                "The status of the shell call. One of `in_progress`, `completed`, or `incomplete`.",
                                                            ),
                                                        z.null(),
                                                    ])
                                                    .optional(),
                                            })
                                            .describe(
                                                "A tool representing a request to execute one or more shell commands.",
                                            ),
                                        z
                                            .object({
                                                id: z
                                                    .union([
                                                        z
                                                            .string()
                                                            .describe(
                                                                "The unique ID of the shell tool call output. Populated when this item is returned via API.",
                                                            ),
                                                        z.null(),
                                                    ])
                                                    .optional(),
                                                /**The unique ID of the shell tool call generated by the model.*/
                                                call_id: z
                                                    .string()
                                                    .min(1)
                                                    .max(64)
                                                    .describe(
                                                        "The unique ID of the shell tool call generated by the model.",
                                                    ),
                                                /**The type of the item. Always `shell_call_output`.*/
                                                type: z
                                                    .literal("shell_call_output")
                                                    .describe(
                                                        "The type of the item. Always `shell_call_output`.",
                                                    )
                                                    .default("shell_call_output"),
                                                /**Captured chunks of stdout and stderr output, along with their associated outcomes.*/
                                                output: z
                                                    .array(
                                                        z
                                                            .object({
                                                                /**Captured stdout output for the shell call.*/
                                                                stdout: z
                                                                    .string()
                                                                    .max(10485760)
                                                                    .describe(
                                                                        "Captured stdout output for the shell call.",
                                                                    ),
                                                                /**Captured stderr output for the shell call.*/
                                                                stderr: z
                                                                    .string()
                                                                    .max(10485760)
                                                                    .describe(
                                                                        "Captured stderr output for the shell call.",
                                                                    ),
                                                                /**The exit or timeout outcome associated with this shell call.*/
                                                                outcome: z
                                                                    .union([
                                                                        z
                                                                            .object({
                                                                                /**The outcome type. Always `timeout`.*/
                                                                                type: z
                                                                                    .literal(
                                                                                        "timeout",
                                                                                    )
                                                                                    .describe(
                                                                                        "The outcome type. Always `timeout`.",
                                                                                    )
                                                                                    .default(
                                                                                        "timeout",
                                                                                    ),
                                                                            })
                                                                            .describe(
                                                                                "Indicates that the shell call exceeded its configured time limit.",
                                                                            ),
                                                                        z
                                                                            .object({
                                                                                /**The outcome type. Always `exit`.*/
                                                                                type: z
                                                                                    .literal("exit")
                                                                                    .describe(
                                                                                        "The outcome type. Always `exit`.",
                                                                                    )
                                                                                    .default(
                                                                                        "exit",
                                                                                    ),
                                                                                /**The exit code returned by the shell process.*/
                                                                                exit_code: z
                                                                                    .number()
                                                                                    .int()
                                                                                    .describe(
                                                                                        "The exit code returned by the shell process.",
                                                                                    ),
                                                                            })
                                                                            .describe(
                                                                                "Indicates that the shell commands finished and returned an exit code.",
                                                                            ),
                                                                    ])
                                                                    .describe(
                                                                        "The exit or timeout outcome associated with this shell call.",
                                                                    ),
                                                            })
                                                            .describe(
                                                                "Captured stdout and stderr for a portion of a shell tool call output.",
                                                            ),
                                                    )
                                                    .describe(
                                                        "Captured chunks of stdout and stderr output, along with their associated outcomes.",
                                                    ),
                                                max_output_length: z
                                                    .union([
                                                        z
                                                            .number()
                                                            .int()
                                                            .describe(
                                                                "The maximum number of UTF-8 characters captured for this shell call's combined output.",
                                                            ),
                                                        z.null(),
                                                    ])
                                                    .optional(),
                                            })
                                            .describe(
                                                "The streamed output items emitted by a shell tool call.",
                                            ),
                                        z
                                            .object({
                                                /**The type of the item. Always `apply_patch_call`.*/
                                                type: z
                                                    .literal("apply_patch_call")
                                                    .describe(
                                                        "The type of the item. Always `apply_patch_call`.",
                                                    )
                                                    .default("apply_patch_call"),
                                                id: z
                                                    .union([
                                                        z
                                                            .string()
                                                            .describe(
                                                                "The unique ID of the apply patch tool call. Populated when this item is returned via API.",
                                                            ),
                                                        z.null(),
                                                    ])
                                                    .optional(),
                                                /**The unique ID of the apply patch tool call generated by the model.*/
                                                call_id: z
                                                    .string()
                                                    .min(1)
                                                    .max(64)
                                                    .describe(
                                                        "The unique ID of the apply patch tool call generated by the model.",
                                                    ),
                                                /**The status of the apply patch tool call. One of `in_progress` or `completed`.*/
                                                status: z
                                                    .enum(["in_progress", "completed"])
                                                    .describe(
                                                        "The status of the apply patch tool call. One of `in_progress` or `completed`.",
                                                    ),
                                                /**The specific create, delete, or update instruction for the apply_patch tool call.*/
                                                operation: z
                                                    .union([
                                                        z
                                                            .object({
                                                                /**The operation type. Always `create_file`.*/
                                                                type: z
                                                                    .literal("create_file")
                                                                    .describe(
                                                                        "The operation type. Always `create_file`.",
                                                                    )
                                                                    .default("create_file"),
                                                                /**Path of the file to create relative to the workspace root.*/
                                                                path: z
                                                                    .string()
                                                                    .min(1)
                                                                    .describe(
                                                                        "Path of the file to create relative to the workspace root.",
                                                                    ),
                                                                /**Unified diff content to apply when creating the file.*/
                                                                diff: z
                                                                    .string()
                                                                    .max(10485760)
                                                                    .describe(
                                                                        "Unified diff content to apply when creating the file.",
                                                                    ),
                                                            })
                                                            .describe(
                                                                "Instruction for creating a new file via the apply_patch tool.",
                                                            ),
                                                        z
                                                            .object({
                                                                /**The operation type. Always `delete_file`.*/
                                                                type: z
                                                                    .literal("delete_file")
                                                                    .describe(
                                                                        "The operation type. Always `delete_file`.",
                                                                    )
                                                                    .default("delete_file"),
                                                                /**Path of the file to delete relative to the workspace root.*/
                                                                path: z
                                                                    .string()
                                                                    .min(1)
                                                                    .describe(
                                                                        "Path of the file to delete relative to the workspace root.",
                                                                    ),
                                                            })
                                                            .describe(
                                                                "Instruction for deleting an existing file via the apply_patch tool.",
                                                            ),
                                                        z
                                                            .object({
                                                                /**The operation type. Always `update_file`.*/
                                                                type: z
                                                                    .literal("update_file")
                                                                    .describe(
                                                                        "The operation type. Always `update_file`.",
                                                                    )
                                                                    .default("update_file"),
                                                                /**Path of the file to update relative to the workspace root.*/
                                                                path: z
                                                                    .string()
                                                                    .min(1)
                                                                    .describe(
                                                                        "Path of the file to update relative to the workspace root.",
                                                                    ),
                                                                /**Unified diff content to apply to the existing file.*/
                                                                diff: z
                                                                    .string()
                                                                    .max(10485760)
                                                                    .describe(
                                                                        "Unified diff content to apply to the existing file.",
                                                                    ),
                                                            })
                                                            .describe(
                                                                "Instruction for updating an existing file via the apply_patch tool.",
                                                            ),
                                                    ])
                                                    .describe(
                                                        "The specific create, delete, or update instruction for the apply_patch tool call.",
                                                    ),
                                            })
                                            .describe(
                                                "A tool call representing a request to create, delete, or update files using diff patches.",
                                            ),
                                        z
                                            .object({
                                                /**The type of the item. Always `apply_patch_call_output`.*/
                                                type: z
                                                    .literal("apply_patch_call_output")
                                                    .describe(
                                                        "The type of the item. Always `apply_patch_call_output`.",
                                                    )
                                                    .default("apply_patch_call_output"),
                                                id: z
                                                    .union([
                                                        z
                                                            .string()
                                                            .describe(
                                                                "The unique ID of the apply patch tool call output. Populated when this item is returned via API.",
                                                            ),
                                                        z.null(),
                                                    ])
                                                    .optional(),
                                                /**The unique ID of the apply patch tool call generated by the model.*/
                                                call_id: z
                                                    .string()
                                                    .min(1)
                                                    .max(64)
                                                    .describe(
                                                        "The unique ID of the apply patch tool call generated by the model.",
                                                    ),
                                                /**The status of the apply patch tool call output. One of `completed` or `failed`.*/
                                                status: z
                                                    .enum(["completed", "failed"])
                                                    .describe(
                                                        "The status of the apply patch tool call output. One of `completed` or `failed`.",
                                                    ),
                                                output: z
                                                    .union([
                                                        z
                                                            .string()
                                                            .max(10485760)
                                                            .describe(
                                                                "Optional human-readable log text from the apply patch tool (e.g., patch results or errors).",
                                                            ),
                                                        z.null(),
                                                    ])
                                                    .optional(),
                                            })
                                            .describe(
                                                "The streamed output emitted by an apply patch tool call.",
                                            ),
                                        z
                                            .object({
                                                /**
                                                 * The type of the item. Always `mcp_list_tools`.
                                                 *
                                                 */
                                                type: z
                                                    .literal("mcp_list_tools")
                                                    .describe(
                                                        "The type of the item. Always `mcp_list_tools`.\n",
                                                    ),
                                                /**
                                                 * The unique ID of the list.
                                                 *
                                                 */
                                                id: z
                                                    .string()
                                                    .describe("The unique ID of the list.\n"),
                                                /**
                                                 * The label of the MCP server.
                                                 *
                                                 */
                                                server_label: z
                                                    .string()
                                                    .describe("The label of the MCP server.\n"),
                                                /**
                                                 * The tools available on the server.
                                                 *
                                                 */
                                                tools: z
                                                    .array(
                                                        z
                                                            .object({
                                                                /**
                                                                 * The name of the tool.
                                                                 *
                                                                 */
                                                                name: z
                                                                    .string()
                                                                    .describe(
                                                                        "The name of the tool.\n",
                                                                    ),
                                                                description: z
                                                                    .union([
                                                                        z
                                                                            .string()
                                                                            .describe(
                                                                                "The description of the tool.\n",
                                                                            ),
                                                                        z.null(),
                                                                    ])
                                                                    .optional(),
                                                                /**
                                                                 * The JSON schema describing the tool's input.
                                                                 *
                                                                 */
                                                                input_schema: z
                                                                    .record(z.string(), z.unknown())
                                                                    .describe(
                                                                        "The JSON schema describing the tool's input.\n",
                                                                    ),
                                                                annotations: z
                                                                    .union([
                                                                        z
                                                                            .record(
                                                                                z.string(),
                                                                                z.unknown(),
                                                                            )
                                                                            .describe(
                                                                                "Additional annotations about the tool.\n",
                                                                            ),
                                                                        z.null(),
                                                                    ])
                                                                    .optional(),
                                                            })
                                                            .describe(
                                                                "A tool available on an MCP server.\n",
                                                            ),
                                                    )
                                                    .describe(
                                                        "The tools available on the server.\n",
                                                    ),
                                                error: z
                                                    .union([
                                                        z
                                                            .string()
                                                            .describe(
                                                                "Error message if the server could not list tools.\n",
                                                            ),
                                                        z.null(),
                                                    ])
                                                    .optional(),
                                            })
                                            .describe(
                                                "A list of tools available on an MCP server.\n",
                                            ),
                                        z
                                            .object({
                                                /**
                                                 * The type of the item. Always `mcp_approval_request`.
                                                 *
                                                 */
                                                type: z
                                                    .literal("mcp_approval_request")
                                                    .describe(
                                                        "The type of the item. Always `mcp_approval_request`.\n",
                                                    ),
                                                /**
                                                 * The unique ID of the approval request.
                                                 *
                                                 */
                                                id: z
                                                    .string()
                                                    .describe(
                                                        "The unique ID of the approval request.\n",
                                                    ),
                                                /**
                                                 * The label of the MCP server making the request.
                                                 *
                                                 */
                                                server_label: z
                                                    .string()
                                                    .describe(
                                                        "The label of the MCP server making the request.\n",
                                                    ),
                                                /**
                                                 * The name of the tool to run.
                                                 *
                                                 */
                                                name: z
                                                    .string()
                                                    .describe("The name of the tool to run.\n"),
                                                /**
                                                 * A JSON string of arguments for the tool.
                                                 *
                                                 */
                                                arguments: z
                                                    .string()
                                                    .describe(
                                                        "A JSON string of arguments for the tool.\n",
                                                    ),
                                            })
                                            .describe(
                                                "A request for human approval of a tool invocation.\n",
                                            ),
                                        z
                                            .object({
                                                /**
                                                 * The type of the item. Always `mcp_approval_response`.
                                                 *
                                                 */
                                                type: z
                                                    .literal("mcp_approval_response")
                                                    .describe(
                                                        "The type of the item. Always `mcp_approval_response`.\n",
                                                    ),
                                                id: z
                                                    .union([
                                                        z
                                                            .string()
                                                            .describe(
                                                                "The unique ID of the approval response\n",
                                                            ),
                                                        z.null(),
                                                    ])
                                                    .optional(),
                                                /**
                                                 * The ID of the approval request being answered.
                                                 *
                                                 */
                                                approval_request_id: z
                                                    .string()
                                                    .describe(
                                                        "The ID of the approval request being answered.\n",
                                                    ),
                                                /**
                                                 * Whether the request was approved.
                                                 *
                                                 */
                                                approve: z
                                                    .boolean()
                                                    .describe(
                                                        "Whether the request was approved.\n",
                                                    ),
                                                reason: z
                                                    .union([
                                                        z
                                                            .string()
                                                            .describe(
                                                                "Optional reason for the decision.\n",
                                                            ),
                                                        z.null(),
                                                    ])
                                                    .optional(),
                                            })
                                            .describe("A response to an MCP approval request.\n"),
                                        z
                                            .object({
                                                /**
                                                 * The type of the item. Always `mcp_call`.
                                                 *
                                                 */
                                                type: z
                                                    .literal("mcp_call")
                                                    .describe(
                                                        "The type of the item. Always `mcp_call`.\n",
                                                    ),
                                                /**
                                                 * The unique ID of the tool call.
                                                 *
                                                 */
                                                id: z
                                                    .string()
                                                    .describe("The unique ID of the tool call.\n"),
                                                /**
                                                 * The label of the MCP server running the tool.
                                                 *
                                                 */
                                                server_label: z
                                                    .string()
                                                    .describe(
                                                        "The label of the MCP server running the tool.\n",
                                                    ),
                                                /**
                                                 * The name of the tool that was run.
                                                 *
                                                 */
                                                name: z
                                                    .string()
                                                    .describe(
                                                        "The name of the tool that was run.\n",
                                                    ),
                                                /**
                                                 * A JSON string of the arguments passed to the tool.
                                                 *
                                                 */
                                                arguments: z
                                                    .string()
                                                    .describe(
                                                        "A JSON string of the arguments passed to the tool.\n",
                                                    ),
                                                output: z
                                                    .union([
                                                        z
                                                            .string()
                                                            .describe(
                                                                "The output from the tool call.\n",
                                                            ),
                                                        z.null(),
                                                    ])
                                                    .optional(),
                                                error: z
                                                    .union([
                                                        z
                                                            .string()
                                                            .describe(
                                                                "The error from the tool call, if any.\n",
                                                            ),
                                                        z.null(),
                                                    ])
                                                    .optional(),
                                                /**
                                                 * The status of the tool call. One of `in_progress`, `completed`, `incomplete`, `calling`, or `failed`.
                                                 *
                                                 */
                                                status: z
                                                    .enum([
                                                        "in_progress",
                                                        "completed",
                                                        "incomplete",
                                                        "calling",
                                                        "failed",
                                                    ])
                                                    .describe(
                                                        "The status of the tool call. One of `in_progress`, `completed`, `incomplete`, `calling`, or `failed`.\n",
                                                    )
                                                    .optional(),
                                                approval_request_id: z
                                                    .union([
                                                        z
                                                            .string()
                                                            .describe(
                                                                "Unique identifier for the MCP tool call approval request.\nInclude this value in a subsequent `mcp_approval_response` input to approve or reject the corresponding tool call.\n",
                                                            ),
                                                        z.null(),
                                                    ])
                                                    .optional(),
                                            })
                                            .describe(
                                                "An invocation of a tool on an MCP server.\n",
                                            ),
                                        z
                                            .object({
                                                /**
                                                 * The type of the custom tool call output. Always `custom_tool_call_output`.
                                                 *
                                                 */
                                                type: z
                                                    .literal("custom_tool_call_output")
                                                    .describe(
                                                        "The type of the custom tool call output. Always `custom_tool_call_output`.\n",
                                                    ),
                                                /**
                                                 * The unique ID of the custom tool call output in the OpenAI platform.
                                                 *
                                                 */
                                                id: z
                                                    .string()
                                                    .describe(
                                                        "The unique ID of the custom tool call output in the OpenAI platform.\n",
                                                    )
                                                    .optional(),
                                                /**
                                                 * The call ID, used to map this custom tool call output to a custom tool call.
                                                 *
                                                 */
                                                call_id: z
                                                    .string()
                                                    .describe(
                                                        "The call ID, used to map this custom tool call output to a custom tool call.\n",
                                                    ),
                                                /**
                                                 * The output from the custom tool call generated by your code.
                                                 * Can be a string or an list of output content.
                                                 *
                                                 */
                                                output: z
                                                    .union([
                                                        z
                                                            .string()
                                                            .describe(
                                                                "A string of the output of the custom tool call.\n",
                                                            ),
                                                        z
                                                            .array(
                                                                z.union([
                                                                    z
                                                                        .object({
                                                                            /**The type of the input item. Always `input_text`.*/
                                                                            type: z
                                                                                .literal(
                                                                                    "input_text",
                                                                                )
                                                                                .describe(
                                                                                    "The type of the input item. Always `input_text`.",
                                                                                )
                                                                                .default(
                                                                                    "input_text",
                                                                                ),
                                                                            /**The text input to the model.*/
                                                                            text: z
                                                                                .string()
                                                                                .describe(
                                                                                    "The text input to the model.",
                                                                                ),
                                                                        })
                                                                        .describe(
                                                                            "A text input to the model.",
                                                                        ),
                                                                    z
                                                                        .object({
                                                                            /**The type of the input item. Always `input_image`.*/
                                                                            type: z
                                                                                .literal(
                                                                                    "input_image",
                                                                                )
                                                                                .describe(
                                                                                    "The type of the input item. Always `input_image`.",
                                                                                )
                                                                                .default(
                                                                                    "input_image",
                                                                                ),
                                                                            image_url: z
                                                                                .union([
                                                                                    z
                                                                                        .string()
                                                                                        .describe(
                                                                                            "The URL of the image to be sent to the model. A fully qualified URL or base64 encoded image in a data URL.",
                                                                                        ),
                                                                                    z.null(),
                                                                                ])
                                                                                .optional(),
                                                                            file_id: z
                                                                                .union([
                                                                                    z
                                                                                        .string()
                                                                                        .describe(
                                                                                            "The ID of the file to be sent to the model.",
                                                                                        ),
                                                                                    z.null(),
                                                                                ])
                                                                                .optional(),
                                                                            /**The detail level of the image to be sent to the model. One of `high`, `low`, or `auto`. Defaults to `auto`.*/
                                                                            detail: z
                                                                                .enum([
                                                                                    "low",
                                                                                    "high",
                                                                                    "auto",
                                                                                ])
                                                                                .describe(
                                                                                    "The detail level of the image to be sent to the model. One of `high`, `low`, or `auto`. Defaults to `auto`.",
                                                                                ),
                                                                        })
                                                                        .describe(
                                                                            "An image input to the model. Learn about [image inputs](https://platform.openai.com/docs/guides/vision).",
                                                                        ),
                                                                    z
                                                                        .object({
                                                                            /**The type of the input item. Always `input_file`.*/
                                                                            type: z
                                                                                .literal(
                                                                                    "input_file",
                                                                                )
                                                                                .describe(
                                                                                    "The type of the input item. Always `input_file`.",
                                                                                )
                                                                                .default(
                                                                                    "input_file",
                                                                                ),
                                                                            file_id: z
                                                                                .union([
                                                                                    z
                                                                                        .string()
                                                                                        .describe(
                                                                                            "The ID of the file to be sent to the model.",
                                                                                        ),
                                                                                    z.null(),
                                                                                ])
                                                                                .optional(),
                                                                            /**The name of the file to be sent to the model.*/
                                                                            filename: z
                                                                                .string()
                                                                                .describe(
                                                                                    "The name of the file to be sent to the model.",
                                                                                )
                                                                                .optional(),
                                                                            /**The URL of the file to be sent to the model.*/
                                                                            file_url: z
                                                                                .string()
                                                                                .describe(
                                                                                    "The URL of the file to be sent to the model.",
                                                                                )
                                                                                .optional(),
                                                                            /**
                                                                             * The content of the file to be sent to the model.
                                                                             *
                                                                             */
                                                                            file_data: z
                                                                                .string()
                                                                                .describe(
                                                                                    "The content of the file to be sent to the model.\n",
                                                                                )
                                                                                .optional(),
                                                                        })
                                                                        .describe(
                                                                            "A file input to the model.",
                                                                        ),
                                                                ]),
                                                            )
                                                            .describe(
                                                                "Text, image, or file output of the custom tool call.\n",
                                                            ),
                                                    ])
                                                    .describe(
                                                        "The output from the custom tool call generated by your code.\nCan be a string or an list of output content.\n",
                                                    ),
                                            })
                                            .describe(
                                                "The output of a custom tool call from your code, being sent back to the model.\n",
                                            ),
                                        z
                                            .object({
                                                /**
                                                 * The type of the custom tool call. Always `custom_tool_call`.
                                                 *
                                                 */
                                                type: z
                                                    .literal("custom_tool_call")
                                                    .describe(
                                                        "The type of the custom tool call. Always `custom_tool_call`.\n",
                                                    ),
                                                /**
                                                 * The unique ID of the custom tool call in the OpenAI platform.
                                                 *
                                                 */
                                                id: z
                                                    .string()
                                                    .describe(
                                                        "The unique ID of the custom tool call in the OpenAI platform.\n",
                                                    )
                                                    .optional(),
                                                /**
                                                 * An identifier used to map this custom tool call to a tool call output.
                                                 *
                                                 */
                                                call_id: z
                                                    .string()
                                                    .describe(
                                                        "An identifier used to map this custom tool call to a tool call output.\n",
                                                    ),
                                                /**
                                                 * The name of the custom tool being called.
                                                 *
                                                 */
                                                name: z
                                                    .string()
                                                    .describe(
                                                        "The name of the custom tool being called.\n",
                                                    ),
                                                /**
                                                 * The input for the custom tool call generated by the model.
                                                 *
                                                 */
                                                input: z
                                                    .string()
                                                    .describe(
                                                        "The input for the custom tool call generated by the model.\n",
                                                    ),
                                            })
                                            .describe(
                                                "A call to a custom tool created by the model.\n",
                                            ),
                                    ])

                                    .describe(
                                        "An item representing part of the context for the response to be\ngenerated by the model. Can contain text, images, and audio inputs,\nas well as previous assistant responses and tool call outputs.\n",
                                    ),
                                z
                                    .object({
                                        type: z
                                            .union([
                                                z
                                                    .literal("item_reference")
                                                    .describe(
                                                        "The type of item to reference. Always `item_reference`.",
                                                    )
                                                    .default("item_reference"),
                                                z.null(),
                                            ])
                                            .optional(),
                                        /**The ID of the item to reference.*/
                                        id: z.string().describe("The ID of the item to reference."),
                                    })
                                    .describe("An internal identifier for an item to reference."),
                            ]),
                        )
                        .describe(
                            "A list of one or many input items to the model, containing\ndifferent content types.\n",
                        ),
                ])
                .describe(
                    "Text, image, or file inputs to the model, used to generate a response.\n\nLearn more:\n- [Text inputs and outputs](https://platform.openai.com/docs/guides/text)\n- [Image inputs](https://platform.openai.com/docs/guides/images)\n- [File inputs](https://platform.openai.com/docs/guides/pdf-files)\n- [Conversation state](https://platform.openai.com/docs/guides/conversation-state)\n- [Function calling](https://platform.openai.com/docs/guides/function-calling)\n",
                )
                .optional(),
            include: z
                .union([
                    z
                        .array(
                            z
                                .enum([
                                    "file_search_call.results",
                                    "web_search_call.results",
                                    "web_search_call.action.sources",
                                    "message.input_image.image_url",
                                    "computer_call_output.output.image_url",
                                    "code_interpreter_call.outputs",
                                    "reasoning.encrypted_content",
                                    "message.output_text.logprobs",
                                ])
                                .describe(
                                    "Specify additional output data to include in the model response. Currently supported values are:\n- `web_search_call.action.sources`: Include the sources of the web search tool call.\n- `code_interpreter_call.outputs`: Includes the outputs of python code execution in code interpreter tool call items.\n- `computer_call_output.output.image_url`: Include image urls from the computer call output.\n- `file_search_call.results`: Include the search results of the file search tool call.\n- `message.input_image.image_url`: Include image urls from the input message.\n- `message.output_text.logprobs`: Include logprobs with assistant messages.\n- `reasoning.encrypted_content`: Includes an encrypted version of reasoning tokens in reasoning item outputs. This enables reasoning items to be used in multi-turn conversations when using the Responses API statelessly (like when the `store` parameter is set to `false`, or when an organization is enrolled in the zero data retention program).",
                                ),
                        )
                        .describe(
                            "Specify additional output data to include in the model response. Currently supported values are:\n- `web_search_call.action.sources`: Include the sources of the web search tool call.\n- `code_interpreter_call.outputs`: Includes the outputs of python code execution in code interpreter tool call items.\n- `computer_call_output.output.image_url`: Include image urls from the computer call output.\n- `file_search_call.results`: Include the search results of the file search tool call.\n- `message.input_image.image_url`: Include image urls from the input message.\n- `message.output_text.logprobs`: Include logprobs with assistant messages.\n- `reasoning.encrypted_content`: Includes an encrypted version of reasoning tokens in reasoning item outputs. This enables reasoning items to be used in multi-turn conversations when using the Responses API statelessly (like when the `store` parameter is set to `false`, or when an organization is enrolled in the zero data retention program).",
                        ),
                    z.null(),
                ])
                .optional(),
            parallel_tool_calls: z
                .union([
                    z
                        .boolean()
                        .describe("Whether to allow the model to run tool calls in parallel.\n")
                        .default(true),
                    z.null(),
                ])
                .optional(),
            store: z
                .union([
                    z
                        .boolean()
                        .describe(
                            "Whether to store the generated model response for later retrieval via\nAPI.\n",
                        )
                        .default(true),
                    z.null(),
                ])
                .optional(),
            instructions: z
                .union([
                    z
                        .string()
                        .describe(
                            "A system (or developer) message inserted into the model's context.\n\nWhen using along with `previous_response_id`, the instructions from a previous\nresponse will not be carried over to the next response. This makes it simple\nto swap out system (or developer) messages in new responses.\n",
                        ),
                    z.null(),
                ])
                .optional(),
            stream: z
                .union([
                    z
                        .boolean()
                        .describe(
                            "If set to true, the model response data will be streamed to the client\nas it is generated using [server-sent events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events#Event_stream_format).\nSee the [Streaming section below](https://platform.openai.com/docs/api-reference/responses-streaming)\nfor more information.\n",
                        )
                        .default(false),
                    z.null(),
                ])
                .optional(),
            stream_options: z
                .union([
                    z
                        .object({
                            /**
                             * When true, stream obfuscation will be enabled. Stream obfuscation adds
                             * random characters to an `obfuscation` field on streaming delta events to
                             * normalize payload sizes as a mitigation to certain side-channel attacks.
                             * These obfuscation fields are included by default, but add a small amount
                             * of overhead to the data stream. You can set `include_obfuscation` to
                             * false to optimize for bandwidth if you trust the network links between
                             * your application and the OpenAI API.
                             *
                             */
                            include_obfuscation: z
                                .boolean()
                                .describe(
                                    "When true, stream obfuscation will be enabled. Stream obfuscation adds\nrandom characters to an `obfuscation` field on streaming delta events to\nnormalize payload sizes as a mitigation to certain side-channel attacks.\nThese obfuscation fields are included by default, but add a small amount\nof overhead to the data stream. You can set `include_obfuscation` to\nfalse to optimize for bandwidth if you trust the network links between\nyour application and the OpenAI API.\n",
                                )
                                .optional(),
                        })
                        .describe(
                            "Options for streaming responses. Only set this when you set `stream: true`.\n",
                        ),
                    z.null(),
                ])
                .optional(),
            conversation: z
                .union([
                    z
                        .union([
                            z.string().describe("The unique ID of the conversation.\n"),
                            z
                                .object({
                                    /**The unique ID of the conversation.*/
                                    id: z.string().describe("The unique ID of the conversation."),
                                })
                                .describe("The conversation that this response belongs to."),
                        ])
                        .describe(
                            "The conversation that this response belongs to. Items from this conversation are prepended to `input_items` for this response request.\nInput items and output items from this response are automatically added to this conversation after this response completes.\n",
                        ),
                    z.null(),
                ])
                .optional(),
        }),
    ),
);

export const OpenAIResponseSchema = z.intersection(
    z.object({
        metadata: z
            .union([
                z
                    .record(z.string(), z.string())
                    .describe(
                        "Set of 16 key-value pairs that can be attached to an object. This can be\nuseful for storing additional information about the object in a structured\nformat, and querying for objects via API or the dashboard.\n\nKeys are strings with a maximum length of 64 characters. Values are strings\nwith a maximum length of 512 characters.\n",
                    ),
                z.null(),
            ])
            .optional(),
        top_logprobs: z
            .union([
                z
                    .number()
                    .int()
                    .gte(0)
                    .lte(20)
                    .describe(
                        "An integer between 0 and 20 specifying the number of most likely tokens to\nreturn at each token position, each with an associated log probability.\n",
                    ),
                z.null(),
            ])
            .optional(),
        temperature: z
            .union([
                z
                    .number()
                    .gte(0)
                    .lte(2)
                    .describe(
                        "What sampling temperature to use, between 0 and 2. Higher values like 0.8 will make the output more random, while lower values like 0.2 will make it more focused and deterministic.\nWe generally recommend altering this or `top_p` but not both.\n",
                    )
                    .default(1),
                z.null(),
            ])
            .optional(),
        top_p: z
            .union([
                z
                    .number()
                    .gte(0)
                    .lte(1)
                    .describe(
                        "An alternative to sampling with temperature, called nucleus sampling,\nwhere the model considers the results of the tokens with top_p probability\nmass. So 0.1 means only the tokens comprising the top 10% probability mass\nare considered.\n\nWe generally recommend altering this or `temperature` but not both.\n",
                    )
                    .default(1),
                z.null(),
            ])
            .optional(),
        /**
         * This field is being replaced by `safety_identifier` and `prompt_cache_key`. Use `prompt_cache_key` instead to maintain caching optimizations.
         * A stable identifier for your end-users.
         * Used to boost cache hit rates by better bucketing similar requests and  to help OpenAI detect and prevent abuse. [Learn more](https://platform.openai.com/docs/guides/safety-best-practices#safety-identifiers).
         *
         */
        user: z
            .string()
            .describe(
                "This field is being replaced by `safety_identifier` and `prompt_cache_key`. Use `prompt_cache_key` instead to maintain caching optimizations.\nA stable identifier for your end-users.\nUsed to boost cache hit rates by better bucketing similar requests and  to help OpenAI detect and prevent abuse. [Learn more](https://platform.openai.com/docs/guides/safety-best-practices#safety-identifiers).\n",
            )
            .optional(),
        /**
         * A stable identifier used to help detect users of your application that may be violating OpenAI's usage policies.
         * The IDs should be a string that uniquely identifies each user. We recommend hashing their username or email address, in order to avoid sending us any identifying information. [Learn more](https://platform.openai.com/docs/guides/safety-best-practices#safety-identifiers).
         *
         */
        safety_identifier: z
            .string()
            .describe(
                "A stable identifier used to help detect users of your application that may be violating OpenAI's usage policies.\nThe IDs should be a string that uniquely identifies each user. We recommend hashing their username or email address, in order to avoid sending us any identifying information. [Learn more](https://platform.openai.com/docs/guides/safety-best-practices#safety-identifiers).\n",
            )
            .optional(),
        /**
         * Used by OpenAI to cache responses for similar requests to optimize your cache hit rates. Replaces the `user` field. [Learn more](https://platform.openai.com/docs/guides/prompt-caching).
         *
         */
        prompt_cache_key: z
            .string()
            .describe(
                "Used by OpenAI to cache responses for similar requests to optimize your cache hit rates. Replaces the `user` field. [Learn more](https://platform.openai.com/docs/guides/prompt-caching).\n",
            )
            .optional(),
        service_tier: z
            .union([
                z
                    .enum(["auto", "default", "flex", "scale", "priority"])
                    .describe(
                        "Specifies the processing type used for serving the request.\n  - If set to 'auto', then the request will be processed with the service tier configured in the Project settings. Unless otherwise configured, the Project will use 'default'.\n  - If set to 'default', then the request will be processed with the standard pricing and performance for the selected model.\n  - If set to '[flex](https://platform.openai.com/docs/guides/flex-processing)' or '[priority](https://openai.com/api-priority-processing/)', then the request will be processed with the corresponding service tier.\n  - When not set, the default behavior is 'auto'.\n\n  When the `service_tier` parameter is set, the response body will include the `service_tier` value based on the processing mode actually used to serve the request. This response value may be different from the value set in the parameter.\n",
                    )
                    .default("auto"),
                z.null(),
            ])
            .optional(),
        prompt_cache_retention: z
            .union([
                z
                    .enum(["in_memory", "24h"])
                    .describe(
                        "The retention policy for the prompt cache. Set to `24h` to enable extended prompt caching, which keeps cached prefixes active for longer, up to a maximum of 24 hours. [Learn more](https://platform.openai.com/docs/guides/prompt-caching#prompt-cache-retention).\n",
                    ),
                z.null(),
            ])
            .optional(),
    }),
    z.intersection(
        z.object({
            previous_response_id: z
                .union([
                    z
                        .string()
                        .describe(
                            "The unique ID of the previous response to the model. Use this to\ncreate multi-turn conversations. Learn more about\n[conversation state](https://platform.openai.com/docs/guides/conversation-state). Cannot be used in conjunction with `conversation`.\n",
                        ),
                    z.null(),
                ])
                .optional(),
            /**
             * Model ID used to generate the response, like `gpt-4o` or `o3`. OpenAI
             * offers a wide range of models with different capabilities, performance
             * characteristics, and price points. Refer to the [model guide](https://platform.openai.com/docs/models)
             * to browse and compare available models.
             *
             */
            model: z
                .union([
                    z.union([
                        z.string(),
                        z.enum([
                            "gpt-5.1",
                            "gpt-5.1-2025-11-13",
                            "gpt-5.1-codex",
                            "gpt-5.1-mini",
                            "gpt-5.1-chat-latest",
                            "gpt-5",
                            "gpt-5-mini",
                            "gpt-5-nano",
                            "gpt-5-2025-08-07",
                            "gpt-5-mini-2025-08-07",
                            "gpt-5-nano-2025-08-07",
                            "gpt-5-chat-latest",
                            "gpt-4.1",
                            "gpt-4.1-mini",
                            "gpt-4.1-nano",
                            "gpt-4.1-2025-04-14",
                            "gpt-4.1-mini-2025-04-14",
                            "gpt-4.1-nano-2025-04-14",
                            "o4-mini",
                            "o4-mini-2025-04-16",
                            "o3",
                            "o3-2025-04-16",
                            "o3-mini",
                            "o3-mini-2025-01-31",
                            "o1",
                            "o1-2024-12-17",
                            "o1-preview",
                            "o1-preview-2024-09-12",
                            "o1-mini",
                            "o1-mini-2024-09-12",
                            "gpt-4o",
                            "gpt-4o-2024-11-20",
                            "gpt-4o-2024-08-06",
                            "gpt-4o-2024-05-13",
                            "gpt-4o-audio-preview",
                            "gpt-4o-audio-preview-2024-10-01",
                            "gpt-4o-audio-preview-2024-12-17",
                            "gpt-4o-audio-preview-2025-06-03",
                            "gpt-4o-mini-audio-preview",
                            "gpt-4o-mini-audio-preview-2024-12-17",
                            "gpt-4o-search-preview",
                            "gpt-4o-mini-search-preview",
                            "gpt-4o-search-preview-2025-03-11",
                            "gpt-4o-mini-search-preview-2025-03-11",
                            "chatgpt-4o-latest",
                            "codex-mini-latest",
                            "gpt-4o-mini",
                            "gpt-4o-mini-2024-07-18",
                            "gpt-4-turbo",
                            "gpt-4-turbo-2024-04-09",
                            "gpt-4-0125-preview",
                            "gpt-4-turbo-preview",
                            "gpt-4-1106-preview",
                            "gpt-4-vision-preview",
                            "gpt-4",
                            "gpt-4-0314",
                            "gpt-4-0613",
                            "gpt-4-32k",
                            "gpt-4-32k-0314",
                            "gpt-4-32k-0613",
                            "gpt-3.5-turbo",
                            "gpt-3.5-turbo-16k",
                            "gpt-3.5-turbo-0301",
                            "gpt-3.5-turbo-0613",
                            "gpt-3.5-turbo-1106",
                            "gpt-3.5-turbo-0125",
                            "gpt-3.5-turbo-16k-0613",
                        ]),
                    ]),
                    z.enum([
                        "o1-pro",
                        "o1-pro-2025-03-19",
                        "o3-pro",
                        "o3-pro-2025-06-10",
                        "o3-deep-research",
                        "o3-deep-research-2025-06-26",
                        "o4-mini-deep-research",
                        "o4-mini-deep-research-2025-06-26",
                        "computer-use-preview",
                        "computer-use-preview-2025-03-11",
                        "gpt-5-codex",
                        "gpt-5-pro",
                        "gpt-5-pro-2025-10-06",
                        "gpt-5.1-codex-max",
                    ]),
                ])
                .describe(
                    "Model ID used to generate the response, like `gpt-4o` or `o3`. OpenAI\noffers a wide range of models with different capabilities, performance\ncharacteristics, and price points. Refer to the [model guide](https://platform.openai.com/docs/models)\nto browse and compare available models.\n",
                )
                .optional(),
            reasoning: z
                .union([
                    z
                        .object({
                            effort: z
                                .union([
                                    z
                                        .enum(["none", "minimal", "low", "medium", "high", "xhigh"])
                                        .describe(
                                            "Constrains effort on reasoning for\n[reasoning models](https://platform.openai.com/docs/guides/reasoning).\nCurrently supported values are `none`, `minimal`, `low`, `medium`, `high`, and `xhigh`. Reducing\nreasoning effort can result in faster responses and fewer tokens used\non reasoning in a response.\n\n- `gpt-5.1` defaults to `none`, which does not perform reasoning. The supported reasoning values for `gpt-5.1` are `none`, `low`, `medium`, and `high`. Tool calls are supported for all reasoning values in gpt-5.1.\n- All models before `gpt-5.1` default to `medium` reasoning effort, and do not support `none`.\n- The `gpt-5-pro` model defaults to (and only supports) `high` reasoning effort.\n- `xhigh` is currently only supported for `gpt-5.1-codex-max`.\n",
                                        )
                                        .default("medium"),
                                    z.null(),
                                ])
                                .optional(),
                            summary: z
                                .union([
                                    z
                                        .enum(["auto", "concise", "detailed"])
                                        .describe(
                                            "A summary of the reasoning performed by the model. This can be\nuseful for debugging and understanding the model's reasoning process.\nOne of `auto`, `concise`, or `detailed`.\n\n`concise` is only supported for `computer-use-preview` models.\n",
                                        ),
                                    z.null(),
                                ])
                                .optional(),
                            generate_summary: z
                                .union([
                                    z
                                        .enum(["auto", "concise", "detailed"])
                                        .describe(
                                            "**Deprecated:** use `summary` instead.\n\nA summary of the reasoning performed by the model. This can be\nuseful for debugging and understanding the model's reasoning process.\nOne of `auto`, `concise`, or `detailed`.\n",
                                        ),
                                    z.null(),
                                ])
                                .optional(),
                        })
                        .describe(
                            "**gpt-5 and o-series models only**\n\nConfiguration options for\n[reasoning models](https://platform.openai.com/docs/guides/reasoning).\n",
                        ),
                    z.null(),
                ])
                .optional(),
            background: z
                .union([
                    z
                        .boolean()
                        .describe(
                            "Whether to run the model response in the background.\n[Learn more](https://platform.openai.com/docs/guides/background).\n",
                        )
                        .default(false),
                    z.null(),
                ])
                .optional(),
            max_output_tokens: z
                .union([
                    z
                        .number()
                        .int()
                        .describe(
                            "An upper bound for the number of tokens that can be generated for a response, including visible output tokens and [reasoning tokens](https://platform.openai.com/docs/guides/reasoning).\n",
                        ),
                    z.null(),
                ])
                .optional(),
            max_tool_calls: z
                .union([
                    z
                        .number()
                        .int()
                        .describe(
                            "The maximum number of total calls to built-in tools that can be processed in a response. This maximum number applies across all built-in tool calls, not per individual tool. Any further attempts to call a tool by the model will be ignored.\n",
                        ),
                    z.null(),
                ])
                .optional(),
            /**
             * Configuration options for a text response from the model. Can be plain
             * text or structured JSON data. Learn more:
             * - [Text inputs and outputs](https://platform.openai.com/docs/guides/text)
             * - [Structured Outputs](https://platform.openai.com/docs/guides/structured-outputs)
             *
             */
            text: z
                .object({
                    /**
                     * An object specifying the format that the model must output.
                     *
                     * Configuring `{ "type": "json_schema" }` enables Structured Outputs,
                     * which ensures the model will match your supplied JSON schema. Learn more in the
                     * [Structured Outputs guide](https://platform.openai.com/docs/guides/structured-outputs).
                     *
                     * The default format is `{ "type": "text" }` with no additional options.
                     *
                     * **Not recommended for gpt-4o and newer models:**
                     *
                     * Setting to `{ "type": "json_object" }` enables the older JSON mode, which
                     * ensures the message the model generates is valid JSON. Using `json_schema`
                     * is preferred for models that support it.
                     *
                     */
                    format: z
                        .union([
                            z
                                .object({
                                    /**The type of response format being defined. Always `text`.*/
                                    type: z
                                        .literal("text")
                                        .describe(
                                            "The type of response format being defined. Always `text`.",
                                        ),
                                })
                                .describe(
                                    "Default response format. Used to generate text responses.\n",
                                ),
                            z
                                .object({
                                    /**The type of response format being defined. Always `json_schema`.*/
                                    type: z
                                        .literal("json_schema")
                                        .describe(
                                            "The type of response format being defined. Always `json_schema`.",
                                        ),
                                    /**
                                     * A description of what the response format is for, used by the model to
                                     * determine how to respond in the format.
                                     *
                                     */
                                    description: z
                                        .string()
                                        .describe(
                                            "A description of what the response format is for, used by the model to\ndetermine how to respond in the format.\n",
                                        )
                                        .optional(),
                                    /**
                                     * The name of the response format. Must be a-z, A-Z, 0-9, or contain
                                     * underscores and dashes, with a maximum length of 64.
                                     *
                                     */
                                    name: z
                                        .string()
                                        .describe(
                                            "The name of the response format. Must be a-z, A-Z, 0-9, or contain\nunderscores and dashes, with a maximum length of 64.\n",
                                        ),
                                    /**
                                     * The schema for the response format, described as a JSON Schema object.
                                     * Learn how to build JSON schemas [here](https://json-schema.org/).
                                     *
                                     */
                                    schema: z
                                        .record(z.string(), z.unknown())
                                        .describe(
                                            "The schema for the response format, described as a JSON Schema object.\nLearn how to build JSON schemas [here](https://json-schema.org/).\n",
                                        ),
                                    strict: z
                                        .union([
                                            z
                                                .boolean()
                                                .describe(
                                                    "Whether to enable strict schema adherence when generating the output.\nIf set to true, the model will always follow the exact schema defined\nin the `schema` field. Only a subset of JSON Schema is supported when\n`strict` is `true`. To learn more, read the [Structured Outputs\nguide](https://platform.openai.com/docs/guides/structured-outputs).\n",
                                                )
                                                .default(false),
                                            z.null(),
                                        ])
                                        .optional(),
                                })
                                .describe(
                                    "JSON Schema response format. Used to generate structured JSON responses.\nLearn more about [Structured Outputs](https://platform.openai.com/docs/guides/structured-outputs).\n",
                                ),
                            z
                                .object({
                                    /**The type of response format being defined. Always `json_object`.*/
                                    type: z
                                        .literal("json_object")
                                        .describe(
                                            "The type of response format being defined. Always `json_object`.",
                                        ),
                                })
                                .describe(
                                    "JSON object response format. An older method of generating JSON responses.\nUsing `json_schema` is recommended for models that support it. Note that the\nmodel will not generate JSON without a system or user message instructing it\nto do so.\n",
                                ),
                        ])
                        .describe(
                            'An object specifying the format that the model must output.\n\nConfiguring `{ "type": "json_schema" }` enables Structured Outputs, \nwhich ensures the model will match your supplied JSON schema. Learn more in the \n[Structured Outputs guide](https://platform.openai.com/docs/guides/structured-outputs).\n\nThe default format is `{ "type": "text" }` with no additional options.\n\n**Not recommended for gpt-4o and newer models:**\n\nSetting to `{ "type": "json_object" }` enables the older JSON mode, which\nensures the message the model generates is valid JSON. Using `json_schema`\nis preferred for models that support it.\n',
                        )
                        .optional(),
                    verbosity: z
                        .union([
                            z
                                .enum(["low", "medium", "high"])
                                .describe(
                                    "Constrains the verbosity of the model's response. Lower values will result in\nmore concise responses, while higher values will result in more verbose responses.\nCurrently supported values are `low`, `medium`, and `high`.\n",
                                )
                                .default("medium"),
                            z.null(),
                        ])
                        .optional(),
                })
                .describe(
                    "Configuration options for a text response from the model. Can be plain\ntext or structured JSON data. Learn more:\n- [Text inputs and outputs](https://platform.openai.com/docs/guides/text)\n- [Structured Outputs](https://platform.openai.com/docs/guides/structured-outputs)\n",
                )
                .optional(),
            /**
             * An array of tools the model may call while generating a response. You
             * can specify which tool to use by setting the `tool_choice` parameter.
             *
             * We support the following categories of tools:
             * - **Built-in tools**: Tools that are provided by OpenAI that extend the
             *   model's capabilities, like [web search](https://platform.openai.com/docs/guides/tools-web-search)
             *   or [file search](https://platform.openai.com/docs/guides/tools-file-search). Learn more about
             *   [built-in tools](https://platform.openai.com/docs/guides/tools).
             * - **MCP Tools**: Integrations with third-party systems via custom MCP servers
             *   or predefined connectors such as Google Drive and SharePoint. Learn more about
             *   [MCP Tools](https://platform.openai.com/docs/guides/tools-connectors-mcp).
             * - **Function calls (custom tools)**: Functions that are defined by you,
             *   enabling the model to call your own code with strongly typed arguments
             *   and outputs. Learn more about
             *   [function calling](https://platform.openai.com/docs/guides/function-calling). You can also use
             *   custom tools to call your own code.
             *
             */
            tools: z
                .array(
                    z
                        .union([
                            z
                                .object({
                                    /**The type of the function tool. Always `function`.*/
                                    type: z
                                        .literal("function")
                                        .describe(
                                            "The type of the function tool. Always `function`.",
                                        )
                                        .default("function"),
                                    /**The name of the function to call.*/
                                    name: z.string().describe("The name of the function to call."),
                                    description: z
                                        .union([
                                            z
                                                .string()
                                                .describe(
                                                    "A description of the function. Used by the model to determine whether or not to call the function.",
                                                ),
                                            z.null(),
                                        ])
                                        .optional(),
                                    parameters: z.union([
                                        z
                                            .record(z.string(), z.unknown())
                                            .describe(
                                                "A JSON schema object describing the parameters of the function.",
                                            ),
                                        z.null(),
                                    ]),
                                    strict: z.union([
                                        z
                                            .boolean()
                                            .describe(
                                                "Whether to enforce strict parameter validation. Default `true`.",
                                            ),
                                        z.null(),
                                    ]),
                                })
                                .describe(
                                    "Defines a function in your own code the model can choose to call. Learn more about [function calling](https://platform.openai.com/docs/guides/function-calling).",
                                ),
                            z
                                .object({
                                    /**The type of the file search tool. Always `file_search`.*/
                                    type: z
                                        .literal("file_search")
                                        .describe(
                                            "The type of the file search tool. Always `file_search`.",
                                        )
                                        .default("file_search"),
                                    /**The IDs of the vector stores to search.*/
                                    vector_store_ids: z
                                        .array(z.string())
                                        .describe("The IDs of the vector stores to search."),
                                    /**The maximum number of results to return. This number should be between 1 and 50 inclusive.*/
                                    max_num_results: z
                                        .number()
                                        .int()
                                        .describe(
                                            "The maximum number of results to return. This number should be between 1 and 50 inclusive.",
                                        )
                                        .optional(),
                                    /**Ranking options for search.*/
                                    ranking_options: z
                                        .object({
                                            /**The ranker to use for the file search.*/
                                            ranker: z
                                                .enum(["auto", "default-2024-11-15"])
                                                .describe("The ranker to use for the file search.")
                                                .optional(),
                                            /**The score threshold for the file search, a number between 0 and 1. Numbers closer to 1 will attempt to return only the most relevant results, but may return fewer results.*/
                                            score_threshold: z
                                                .number()
                                                .describe(
                                                    "The score threshold for the file search, a number between 0 and 1. Numbers closer to 1 will attempt to return only the most relevant results, but may return fewer results.",
                                                )
                                                .optional(),
                                            /**Weights that control how reciprocal rank fusion balances semantic embedding matches versus sparse keyword matches when hybrid search is enabled.*/
                                            hybrid_search: z
                                                .object({
                                                    /**The weight of the embedding in the reciprocal ranking fusion.*/
                                                    embedding_weight: z
                                                        .number()
                                                        .describe(
                                                            "The weight of the embedding in the reciprocal ranking fusion.",
                                                        ),
                                                    /**The weight of the text in the reciprocal ranking fusion.*/
                                                    text_weight: z
                                                        .number()
                                                        .describe(
                                                            "The weight of the text in the reciprocal ranking fusion.",
                                                        ),
                                                })
                                                .describe(
                                                    "Weights that control how reciprocal rank fusion balances semantic embedding matches versus sparse keyword matches when hybrid search is enabled.",
                                                )
                                                .optional(),
                                        })
                                        .describe("Ranking options for search.")
                                        .optional(),
                                    filters: z
                                        .union([
                                            z
                                                .union([
                                                    z
                                                        .object({
                                                            /**
                                                             * Specifies the comparison operator: `eq`, `ne`, `gt`, `gte`, `lt`, `lte`, `in`, `nin`.
                                                             * - `eq`: equals
                                                             * - `ne`: not equal
                                                             * - `gt`: greater than
                                                             * - `gte`: greater than or equal
                                                             * - `lt`: less than
                                                             * - `lte`: less than or equal
                                                             * - `in`: in
                                                             * - `nin`: not in
                                                             *
                                                             */
                                                            type: z
                                                                .enum([
                                                                    "eq",
                                                                    "ne",
                                                                    "gt",
                                                                    "gte",
                                                                    "lt",
                                                                    "lte",
                                                                ])
                                                                .describe(
                                                                    "Specifies the comparison operator: `eq`, `ne`, `gt`, `gte`, `lt`, `lte`, `in`, `nin`.\n- `eq`: equals\n- `ne`: not equal\n- `gt`: greater than\n- `gte`: greater than or equal\n- `lt`: less than\n- `lte`: less than or equal\n- `in`: in\n- `nin`: not in\n",
                                                                )
                                                                .default("eq"),
                                                            /**The key to compare against the value.*/
                                                            key: z
                                                                .string()
                                                                .describe(
                                                                    "The key to compare against the value.",
                                                                ),
                                                            /**The value to compare against the attribute key; supports string, number, or boolean types.*/
                                                            value: z
                                                                .union([
                                                                    z.string(),
                                                                    z.number(),
                                                                    z.boolean(),
                                                                    z.array(
                                                                        z.union([
                                                                            z.string(),
                                                                            z.number(),
                                                                        ]),
                                                                    ),
                                                                ])
                                                                .describe(
                                                                    "The value to compare against the attribute key; supports string, number, or boolean types.",
                                                                ),
                                                        })
                                                        .strict()
                                                        .describe(
                                                            "A filter used to compare a specified attribute key to a given value using a defined comparison operation.\n",
                                                        ),
                                                    z
                                                        .object({
                                                            /**Type of operation: `and` or `or`.*/
                                                            type: z
                                                                .enum(["and", "or"])
                                                                .describe(
                                                                    "Type of operation: `and` or `or`.",
                                                                ),
                                                            /**Array of filters to combine. Items can be `ComparisonFilter` or `CompoundFilter`.*/
                                                            filters: z
                                                                .array(
                                                                    z.union([
                                                                        z
                                                                            .object({
                                                                                /**
                                                                                 * Specifies the comparison operator: `eq`, `ne`, `gt`, `gte`, `lt`, `lte`, `in`, `nin`.
                                                                                 * - `eq`: equals
                                                                                 * - `ne`: not equal
                                                                                 * - `gt`: greater than
                                                                                 * - `gte`: greater than or equal
                                                                                 * - `lt`: less than
                                                                                 * - `lte`: less than or equal
                                                                                 * - `in`: in
                                                                                 * - `nin`: not in
                                                                                 *
                                                                                 */
                                                                                type: z
                                                                                    .enum([
                                                                                        "eq",
                                                                                        "ne",
                                                                                        "gt",
                                                                                        "gte",
                                                                                        "lt",
                                                                                        "lte",
                                                                                    ])
                                                                                    .describe(
                                                                                        "Specifies the comparison operator: `eq`, `ne`, `gt`, `gte`, `lt`, `lte`, `in`, `nin`.\n- `eq`: equals\n- `ne`: not equal\n- `gt`: greater than\n- `gte`: greater than or equal\n- `lt`: less than\n- `lte`: less than or equal\n- `in`: in\n- `nin`: not in\n",
                                                                                    )
                                                                                    .default("eq"),
                                                                                /**The key to compare against the value.*/
                                                                                key: z
                                                                                    .string()
                                                                                    .describe(
                                                                                        "The key to compare against the value.",
                                                                                    ),
                                                                                /**The value to compare against the attribute key; supports string, number, or boolean types.*/
                                                                                value: z
                                                                                    .union([
                                                                                        z.string(),
                                                                                        z.number(),
                                                                                        z.boolean(),
                                                                                        z.array(
                                                                                            z.union(
                                                                                                [
                                                                                                    z.string(),
                                                                                                    z.number(),
                                                                                                ],
                                                                                            ),
                                                                                        ),
                                                                                    ])
                                                                                    .describe(
                                                                                        "The value to compare against the attribute key; supports string, number, or boolean types.",
                                                                                    ),
                                                                            })
                                                                            .strict()
                                                                            .describe(
                                                                                "A filter used to compare a specified attribute key to a given value using a defined comparison operation.\n",
                                                                            ),
                                                                        z.any(),
                                                                    ]),
                                                                )
                                                                .describe(
                                                                    "Array of filters to combine. Items can be `ComparisonFilter` or `CompoundFilter`.",
                                                                ),
                                                        })
                                                        .strict()
                                                        .describe(
                                                            "Combine multiple filters using `and` or `or`.",
                                                        ),
                                                ])
                                                .describe("A filter to apply."),
                                            z.null(),
                                        ])
                                        .optional(),
                                })
                                .describe(
                                    "A tool that searches for relevant content from uploaded files. Learn more about the [file search tool](https://platform.openai.com/docs/guides/tools-file-search).",
                                ),
                            z
                                .object({
                                    /**The type of the computer use tool. Always `computer_use_preview`.*/
                                    type: z
                                        .literal("computer_use_preview")
                                        .describe(
                                            "The type of the computer use tool. Always `computer_use_preview`.",
                                        )
                                        .default("computer_use_preview"),
                                    /**The type of computer environment to control.*/
                                    environment: z
                                        .enum(["windows", "mac", "linux", "ubuntu", "browser"])
                                        .describe("The type of computer environment to control."),
                                    /**The width of the computer display.*/
                                    display_width: z
                                        .number()
                                        .int()
                                        .describe("The width of the computer display."),
                                    /**The height of the computer display.*/
                                    display_height: z
                                        .number()
                                        .int()
                                        .describe("The height of the computer display."),
                                })
                                .describe(
                                    "A tool that controls a virtual computer. Learn more about the [computer tool](https://platform.openai.com/docs/guides/tools-computer-use).",
                                ),
                            z
                                .object({
                                    /**The type of the web search tool. One of `web_search` or `web_search_2025_08_26`.*/
                                    type: z
                                        .enum(["web_search", "web_search_2025_08_26"])
                                        .describe(
                                            "The type of the web search tool. One of `web_search` or `web_search_2025_08_26`.",
                                        )
                                        .default("web_search"),
                                    filters: z
                                        .union([
                                            z
                                                .object({
                                                    allowed_domains: z
                                                        .union([
                                                            z
                                                                .array(
                                                                    z
                                                                        .string()
                                                                        .describe(
                                                                            "Allowed domain for the search.",
                                                                        ),
                                                                )
                                                                .describe(
                                                                    'Allowed domains for the search. If not provided, all domains are allowed.\nSubdomains of the provided domains are allowed as well.\n\nExample: `["pubmed.ncbi.nlm.nih.gov"]`\n',
                                                                )
                                                                .default([]),
                                                            z.null(),
                                                        ])
                                                        .optional(),
                                                })
                                                .describe("Filters for the search.\n"),
                                            z.null(),
                                        ])
                                        .optional(),
                                    user_location: z
                                        .union([
                                            z
                                                .object({
                                                    /**The type of location approximation. Always `approximate`.*/
                                                    type: z
                                                        .literal("approximate")
                                                        .describe(
                                                            "The type of location approximation. Always `approximate`.",
                                                        )
                                                        .default("approximate"),
                                                    country: z
                                                        .union([
                                                            z
                                                                .string()
                                                                .describe(
                                                                    "The two-letter [ISO country code](https://en.wikipedia.org/wiki/ISO_3166-1) of the user, e.g. `US`.",
                                                                ),
                                                            z.null(),
                                                        ])
                                                        .optional(),
                                                    region: z
                                                        .union([
                                                            z
                                                                .string()
                                                                .describe(
                                                                    "Free text input for the region of the user, e.g. `California`.",
                                                                ),
                                                            z.null(),
                                                        ])
                                                        .optional(),
                                                    city: z
                                                        .union([
                                                            z
                                                                .string()
                                                                .describe(
                                                                    "Free text input for the city of the user, e.g. `San Francisco`.",
                                                                ),
                                                            z.null(),
                                                        ])
                                                        .optional(),
                                                    timezone: z
                                                        .union([
                                                            z
                                                                .string()
                                                                .describe(
                                                                    "The [IANA timezone](https://timeapi.io/documentation/iana-timezones) of the user, e.g. `America/Los_Angeles`.",
                                                                ),
                                                            z.null(),
                                                        ])
                                                        .optional(),
                                                })
                                                .describe(
                                                    "The approximate location of the user.\n",
                                                ),
                                            z.null(),
                                        ])
                                        .optional(),
                                    /**High level guidance for the amount of context window space to use for the search. One of `low`, `medium`, or `high`. `medium` is the default.*/
                                    search_context_size: z
                                        .enum(["low", "medium", "high"])
                                        .describe(
                                            "High level guidance for the amount of context window space to use for the search. One of `low`, `medium`, or `high`. `medium` is the default.",
                                        )
                                        .default("medium"),
                                })
                                .describe(
                                    "Search the Internet for sources related to the prompt. Learn more about the\n[web search tool](https://platform.openai.com/docs/guides/tools-web-search).\n",
                                ),
                            z
                                .object({
                                    /**The type of the MCP tool. Always `mcp`.*/
                                    type: z
                                        .literal("mcp")
                                        .describe("The type of the MCP tool. Always `mcp`."),
                                    /**
                                     * A label for this MCP server, used to identify it in tool calls.
                                     *
                                     */
                                    server_label: z
                                        .string()
                                        .describe(
                                            "A label for this MCP server, used to identify it in tool calls.\n",
                                        ),
                                    /**
                                     * The URL for the MCP server. One of `server_url` or `connector_id` must be
                                     * provided.
                                     *
                                     */
                                    server_url: z
                                        .string()
                                        .describe(
                                            "The URL for the MCP server. One of `server_url` or `connector_id` must be\nprovided.\n",
                                        )
                                        .optional(),
                                    /**
                                     * Identifier for service connectors, like those available in ChatGPT. One of
                                     * `server_url` or `connector_id` must be provided. Learn more about service
                                     * connectors [here](https://platform.openai.com/docs/guides/tools-remote-mcp#connectors).
                                     *
                                     * Currently supported `connector_id` values are:
                                     *
                                     * - Dropbox: `connector_dropbox`
                                     * - Gmail: `connector_gmail`
                                     * - Google Calendar: `connector_googlecalendar`
                                     * - Google Drive: `connector_googledrive`
                                     * - Microsoft Teams: `connector_microsoftteams`
                                     * - Outlook Calendar: `connector_outlookcalendar`
                                     * - Outlook Email: `connector_outlookemail`
                                     * - SharePoint: `connector_sharepoint`
                                     *
                                     */
                                    connector_id: z
                                        .enum([
                                            "connector_dropbox",
                                            "connector_gmail",
                                            "connector_googlecalendar",
                                            "connector_googledrive",
                                            "connector_microsoftteams",
                                            "connector_outlookcalendar",
                                            "connector_outlookemail",
                                            "connector_sharepoint",
                                        ])
                                        .describe(
                                            "Identifier for service connectors, like those available in ChatGPT. One of\n`server_url` or `connector_id` must be provided. Learn more about service\nconnectors [here](https://platform.openai.com/docs/guides/tools-remote-mcp#connectors).\n\nCurrently supported `connector_id` values are:\n\n- Dropbox: `connector_dropbox`\n- Gmail: `connector_gmail`\n- Google Calendar: `connector_googlecalendar`\n- Google Drive: `connector_googledrive`\n- Microsoft Teams: `connector_microsoftteams`\n- Outlook Calendar: `connector_outlookcalendar`\n- Outlook Email: `connector_outlookemail`\n- SharePoint: `connector_sharepoint`\n",
                                        )
                                        .optional(),
                                    /**
                                     * An OAuth access token that can be used with a remote MCP server, either
                                     * with a custom MCP server URL or a service connector. Your application
                                     * must handle the OAuth authorization flow and provide the token here.
                                     *
                                     */
                                    authorization: z
                                        .string()
                                        .describe(
                                            "An OAuth access token that can be used with a remote MCP server, either\nwith a custom MCP server URL or a service connector. Your application\nmust handle the OAuth authorization flow and provide the token here.\n",
                                        )
                                        .optional(),
                                    /**
                                     * Optional description of the MCP server, used to provide more context.
                                     *
                                     */
                                    server_description: z
                                        .string()
                                        .describe(
                                            "Optional description of the MCP server, used to provide more context.\n",
                                        )
                                        .optional(),
                                    headers: z
                                        .union([
                                            z
                                                .record(z.string(), z.string())
                                                .describe(
                                                    "Optional HTTP headers to send to the MCP server. Use for authentication\nor other purposes.\n",
                                                ),
                                            z.null(),
                                        ])
                                        .optional(),
                                    allowed_tools: z
                                        .union([
                                            z
                                                .union([
                                                    z
                                                        .array(z.string())
                                                        .describe(
                                                            "A string array of allowed tool names",
                                                        ),
                                                    z
                                                        .object({
                                                            /**List of allowed tool names.*/
                                                            tool_names: z
                                                                .array(z.string())
                                                                .describe(
                                                                    "List of allowed tool names.",
                                                                )
                                                                .optional(),
                                                            /**
                                                             * Indicates whether or not a tool modifies data or is read-only. If an
                                                             * MCP server is [annotated with `readOnlyHint`](https://modelcontextprotocol.io/specification/2025-06-18/schema#toolannotations-readonlyhint),
                                                             * it will match this filter.
                                                             *
                                                             */
                                                            read_only: z
                                                                .boolean()
                                                                .describe(
                                                                    "Indicates whether or not a tool modifies data or is read-only. If an\nMCP server is [annotated with `readOnlyHint`](https://modelcontextprotocol.io/specification/2025-06-18/schema#toolannotations-readonlyhint),\nit will match this filter.\n",
                                                                )
                                                                .optional(),
                                                        })
                                                        .strict()
                                                        .describe(
                                                            "A filter object to specify which tools are allowed.\n",
                                                        ),
                                                ])
                                                .describe(
                                                    "List of allowed tool names or a filter object.\n",
                                                ),
                                            z.null(),
                                        ])
                                        .optional(),
                                    require_approval: z
                                        .union([
                                            z
                                                .union([
                                                    z
                                                        .object({
                                                            /**
                                                             * A filter object to specify which tools are allowed.
                                                             *
                                                             */
                                                            always: z
                                                                .object({
                                                                    /**List of allowed tool names.*/
                                                                    tool_names: z
                                                                        .array(z.string())
                                                                        .describe(
                                                                            "List of allowed tool names.",
                                                                        )
                                                                        .optional(),
                                                                    /**
                                                                     * Indicates whether or not a tool modifies data or is read-only. If an
                                                                     * MCP server is [annotated with `readOnlyHint`](https://modelcontextprotocol.io/specification/2025-06-18/schema#toolannotations-readonlyhint),
                                                                     * it will match this filter.
                                                                     *
                                                                     */
                                                                    read_only: z
                                                                        .boolean()
                                                                        .describe(
                                                                            "Indicates whether or not a tool modifies data or is read-only. If an\nMCP server is [annotated with `readOnlyHint`](https://modelcontextprotocol.io/specification/2025-06-18/schema#toolannotations-readonlyhint),\nit will match this filter.\n",
                                                                        )
                                                                        .optional(),
                                                                })
                                                                .strict()
                                                                .describe(
                                                                    "A filter object to specify which tools are allowed.\n",
                                                                )
                                                                .optional(),
                                                            /**
                                                             * A filter object to specify which tools are allowed.
                                                             *
                                                             */
                                                            never: z
                                                                .object({
                                                                    /**List of allowed tool names.*/
                                                                    tool_names: z
                                                                        .array(z.string())
                                                                        .describe(
                                                                            "List of allowed tool names.",
                                                                        )
                                                                        .optional(),
                                                                    /**
                                                                     * Indicates whether or not a tool modifies data or is read-only. If an
                                                                     * MCP server is [annotated with `readOnlyHint`](https://modelcontextprotocol.io/specification/2025-06-18/schema#toolannotations-readonlyhint),
                                                                     * it will match this filter.
                                                                     *
                                                                     */
                                                                    read_only: z
                                                                        .boolean()
                                                                        .describe(
                                                                            "Indicates whether or not a tool modifies data or is read-only. If an\nMCP server is [annotated with `readOnlyHint`](https://modelcontextprotocol.io/specification/2025-06-18/schema#toolannotations-readonlyhint),\nit will match this filter.\n",
                                                                        )
                                                                        .optional(),
                                                                })
                                                                .strict()
                                                                .describe(
                                                                    "A filter object to specify which tools are allowed.\n",
                                                                )
                                                                .optional(),
                                                        })
                                                        .strict()
                                                        .describe(
                                                            "Specify which of the MCP server's tools require approval. Can be\n`always`, `never`, or a filter object associated with tools\nthat require approval.\n",
                                                        ),
                                                    z
                                                        .enum(["always", "never"])
                                                        .describe(
                                                            "Specify a single approval policy for all tools. One of `always` or\n`never`. When set to `always`, all tools will require approval. When\nset to `never`, all tools will not require approval.\n",
                                                        ),
                                                ])
                                                .describe(
                                                    "Specify which of the MCP server's tools require approval.",
                                                )
                                                .default("always"),
                                            z.null(),
                                        ])
                                        .optional(),
                                })
                                .describe(
                                    "Give the model access to additional tools via remote Model Context Protocol\n(MCP) servers. [Learn more about MCP](https://platform.openai.com/docs/guides/tools-remote-mcp).\n",
                                ),
                            z
                                .object({
                                    /**
                                     * The type of the code interpreter tool. Always `code_interpreter`.
                                     *
                                     */
                                    type: z
                                        .literal("code_interpreter")
                                        .describe(
                                            "The type of the code interpreter tool. Always `code_interpreter`.\n",
                                        ),
                                    /**
                                     * The code interpreter container. Can be a container ID or an object that
                                     * specifies uploaded file IDs to make available to your code, along with an
                                     * optional `memory_limit` setting.
                                     *
                                     */
                                    container: z
                                        .union([
                                            z.string().describe("The container ID."),
                                            z
                                                .object({
                                                    /**Always `auto`.*/
                                                    type: z
                                                        .literal("auto")
                                                        .describe("Always `auto`.")
                                                        .default("auto"),
                                                    /**An optional list of uploaded files to make available to your code.*/
                                                    file_ids: z
                                                        .array(z.string())
                                                        .max(50)
                                                        .describe(
                                                            "An optional list of uploaded files to make available to your code.",
                                                        )
                                                        .optional(),
                                                    memory_limit: z
                                                        .union([
                                                            z.enum(["1g", "4g", "16g", "64g"]),
                                                            z.null(),
                                                        ])
                                                        .optional(),
                                                })
                                                .describe(
                                                    "Configuration for a code interpreter container. Optionally specify the IDs of the files to run the code on.",
                                                ),
                                        ])
                                        .describe(
                                            "The code interpreter container. Can be a container ID or an object that\nspecifies uploaded file IDs to make available to your code, along with an\noptional `memory_limit` setting.\n",
                                        ),
                                })
                                .describe(
                                    "A tool that runs Python code to help generate a response to a prompt.\n",
                                ),
                            z
                                .object({
                                    /**
                                     * The type of the image generation tool. Always `image_generation`.
                                     *
                                     */
                                    type: z
                                        .literal("image_generation")
                                        .describe(
                                            "The type of the image generation tool. Always `image_generation`.\n",
                                        ),
                                    /**
                                     * The image generation model to use. Default: `gpt-image-1`.
                                     *
                                     */
                                    model: z
                                        .enum(["gpt-image-1", "gpt-image-1-mini"])
                                        .describe(
                                            "The image generation model to use. Default: `gpt-image-1`.\n",
                                        )
                                        .default("gpt-image-1"),
                                    /**
                                     * The quality of the generated image. One of `low`, `medium`, `high`,
                                     * or `auto`. Default: `auto`.
                                     *
                                     */
                                    quality: z
                                        .enum(["low", "medium", "high", "auto"])
                                        .describe(
                                            "The quality of the generated image. One of `low`, `medium`, `high`,\nor `auto`. Default: `auto`.\n",
                                        )
                                        .default("auto"),
                                    /**
                                     * The size of the generated image. One of `1024x1024`, `1024x1536`,
                                     * `1536x1024`, or `auto`. Default: `auto`.
                                     *
                                     */
                                    size: z
                                        .enum(["1024x1024", "1024x1536", "1536x1024", "auto"])
                                        .describe(
                                            "The size of the generated image. One of `1024x1024`, `1024x1536`,\n`1536x1024`, or `auto`. Default: `auto`.\n",
                                        )
                                        .default("auto"),
                                    /**
                                     * The output format of the generated image. One of `png`, `webp`, or
                                     * `jpeg`. Default: `png`.
                                     *
                                     */
                                    output_format: z
                                        .enum(["png", "webp", "jpeg"])
                                        .describe(
                                            "The output format of the generated image. One of `png`, `webp`, or\n`jpeg`. Default: `png`.\n",
                                        )
                                        .default("png"),
                                    /**
                                     * Compression level for the output image. Default: 100.
                                     *
                                     */
                                    output_compression: z
                                        .number()
                                        .int()
                                        .gte(0)
                                        .lte(100)
                                        .describe(
                                            "Compression level for the output image. Default: 100.\n",
                                        )
                                        .default(100),
                                    /**
                                     * Moderation level for the generated image. Default: `auto`.
                                     *
                                     */
                                    moderation: z
                                        .enum(["auto", "low"])
                                        .describe(
                                            "Moderation level for the generated image. Default: `auto`.\n",
                                        )
                                        .default("auto"),
                                    /**
                                     * Background type for the generated image. One of `transparent`,
                                     * `opaque`, or `auto`. Default: `auto`.
                                     *
                                     */
                                    background: z
                                        .enum(["transparent", "opaque", "auto"])
                                        .describe(
                                            "Background type for the generated image. One of `transparent`,\n`opaque`, or `auto`. Default: `auto`.\n",
                                        )
                                        .default("auto"),
                                    input_fidelity: z
                                        .union([
                                            z
                                                .enum(["high", "low"])
                                                .describe(
                                                    "Control how much effort the model will exert to match the style and features, especially facial features, of input images. This parameter is only supported for `gpt-image-1`. Unsupported for `gpt-image-1-mini`. Supports `high` and `low`. Defaults to `low`.",
                                                ),
                                            z.null(),
                                        ])
                                        .optional(),
                                    /**
                                     * Optional mask for inpainting. Contains `image_url`
                                     * (string, optional) and `file_id` (string, optional).
                                     *
                                     */
                                    input_image_mask: z
                                        .object({
                                            /**
                                             * Base64-encoded mask image.
                                             *
                                             */
                                            image_url: z
                                                .string()
                                                .describe("Base64-encoded mask image.\n")
                                                .optional(),
                                            /**
                                             * File ID for the mask image.
                                             *
                                             */
                                            file_id: z
                                                .string()
                                                .describe("File ID for the mask image.\n")
                                                .optional(),
                                        })
                                        .strict()
                                        .describe(
                                            "Optional mask for inpainting. Contains `image_url`\n(string, optional) and `file_id` (string, optional).\n",
                                        )
                                        .optional(),
                                    /**
                                     * Number of partial images to generate in streaming mode, from 0 (default value) to 3.
                                     *
                                     */
                                    partial_images: z
                                        .number()
                                        .int()
                                        .gte(0)
                                        .lte(3)
                                        .describe(
                                            "Number of partial images to generate in streaming mode, from 0 (default value) to 3.\n",
                                        )
                                        .default(0),
                                })
                                .describe(
                                    "A tool that generates images using a model like `gpt-image-1`.\n",
                                ),
                            z
                                .object({
                                    /**The type of the local shell tool. Always `local_shell`.*/
                                    type: z
                                        .literal("local_shell")
                                        .describe(
                                            "The type of the local shell tool. Always `local_shell`.",
                                        )
                                        .default("local_shell"),
                                })
                                .describe(
                                    "A tool that allows the model to execute shell commands in a local environment.",
                                ),
                            z
                                .object({
                                    /**The type of the shell tool. Always `shell`.*/
                                    type: z
                                        .literal("shell")
                                        .describe("The type of the shell tool. Always `shell`.")
                                        .default("shell"),
                                })
                                .describe(
                                    "A tool that allows the model to execute shell commands.",
                                ),
                            z
                                .object({
                                    /**The type of the custom tool. Always `custom`.*/
                                    type: z
                                        .literal("custom")
                                        .describe("The type of the custom tool. Always `custom`.")
                                        .default("custom"),
                                    /**The name of the custom tool, used to identify it in tool calls.*/
                                    name: z
                                        .string()
                                        .describe(
                                            "The name of the custom tool, used to identify it in tool calls.",
                                        ),
                                    /**Optional description of the custom tool, used to provide more context.*/
                                    description: z
                                        .string()
                                        .describe(
                                            "Optional description of the custom tool, used to provide more context.",
                                        )
                                        .optional(),
                                    /**The input format for the custom tool. Default is unconstrained text.*/
                                    format: z
                                        .union([
                                            z
                                                .object({
                                                    /**Unconstrained text format. Always `text`.*/
                                                    type: z
                                                        .literal("text")
                                                        .describe(
                                                            "Unconstrained text format. Always `text`.",
                                                        )
                                                        .default("text"),
                                                })
                                                .describe("Unconstrained free-form text."),
                                            z
                                                .object({
                                                    /**Grammar format. Always `grammar`.*/
                                                    type: z
                                                        .literal("grammar")
                                                        .describe(
                                                            "Grammar format. Always `grammar`.",
                                                        )
                                                        .default("grammar"),
                                                    /**The syntax of the grammar definition. One of `lark` or `regex`.*/
                                                    syntax: z
                                                        .enum(["lark", "regex"])
                                                        .describe(
                                                            "The syntax of the grammar definition. One of `lark` or `regex`.",
                                                        ),
                                                    /**The grammar definition.*/
                                                    definition: z
                                                        .string()
                                                        .describe("The grammar definition."),
                                                })
                                                .describe("A grammar defined by the user."),
                                        ])
                                        .describe(
                                            "The input format for the custom tool. Default is unconstrained text.",
                                        )
                                        .optional(),
                                })
                                .describe(
                                    "A custom tool that processes input using a specified format. Learn more about   [custom tools](https://platform.openai.com/docs/guides/function-calling#custom-tools)",
                                ),
                            z
                                .object({
                                    /**The type of the web search tool. One of `web_search_preview` or `web_search_preview_2025_03_11`.*/
                                    type: z
                                        .enum([
                                            "web_search_preview",
                                            "web_search_preview_2025_03_11",
                                        ])
                                        .describe(
                                            "The type of the web search tool. One of `web_search_preview` or `web_search_preview_2025_03_11`.",
                                        )
                                        .default("web_search_preview"),
                                    user_location: z
                                        .union([
                                            z
                                                .object({
                                                    /**The type of location approximation. Always `approximate`.*/
                                                    type: z
                                                        .literal("approximate")
                                                        .describe(
                                                            "The type of location approximation. Always `approximate`.",
                                                        )
                                                        .default("approximate"),
                                                    country: z
                                                        .union([
                                                            z
                                                                .string()
                                                                .describe(
                                                                    "The two-letter [ISO country code](https://en.wikipedia.org/wiki/ISO_3166-1) of the user, e.g. `US`.",
                                                                ),
                                                            z.null(),
                                                        ])
                                                        .optional(),
                                                    region: z
                                                        .union([
                                                            z
                                                                .string()
                                                                .describe(
                                                                    "Free text input for the region of the user, e.g. `California`.",
                                                                ),
                                                            z.null(),
                                                        ])
                                                        .optional(),
                                                    city: z
                                                        .union([
                                                            z
                                                                .string()
                                                                .describe(
                                                                    "Free text input for the city of the user, e.g. `San Francisco`.",
                                                                ),
                                                            z.null(),
                                                        ])
                                                        .optional(),
                                                    timezone: z
                                                        .union([
                                                            z
                                                                .string()
                                                                .describe(
                                                                    "The [IANA timezone](https://timeapi.io/documentation/iana-timezones) of the user, e.g. `America/Los_Angeles`.",
                                                                ),
                                                            z.null(),
                                                        ])
                                                        .optional(),
                                                })
                                                .describe("The user's location."),
                                            z.null(),
                                        ])
                                        .optional(),
                                    /**High level guidance for the amount of context window space to use for the search. One of `low`, `medium`, or `high`. `medium` is the default.*/
                                    search_context_size: z
                                        .enum(["low", "medium", "high"])
                                        .describe(
                                            "High level guidance for the amount of context window space to use for the search. One of `low`, `medium`, or `high`. `medium` is the default.",
                                        )
                                        .optional(),
                                })
                                .describe(
                                    "This tool searches the web for relevant results to use in a response. Learn more about the [web search tool](https://platform.openai.com/docs/guides/tools-web-search).",
                                ),
                            z
                                .object({
                                    /**The type of the tool. Always `apply_patch`.*/
                                    type: z
                                        .literal("apply_patch")
                                        .describe("The type of the tool. Always `apply_patch`.")
                                        .default("apply_patch"),
                                })
                                .describe(
                                    "Allows the assistant to create, delete, or update files using unified diffs.",
                                ),
                        ])
                        .describe("A tool that can be used to generate a response.\n"),
                )
                .describe(
                    "An array of tools the model may call while generating a response. You\ncan specify which tool to use by setting the `tool_choice` parameter.\n\nWe support the following categories of tools:\n- **Built-in tools**: Tools that are provided by OpenAI that extend the\n  model's capabilities, like [web search](https://platform.openai.com/docs/guides/tools-web-search)\n  or [file search](https://platform.openai.com/docs/guides/tools-file-search). Learn more about\n  [built-in tools](https://platform.openai.com/docs/guides/tools).\n- **MCP Tools**: Integrations with third-party systems via custom MCP servers\n  or predefined connectors such as Google Drive and SharePoint. Learn more about\n  [MCP Tools](https://platform.openai.com/docs/guides/tools-connectors-mcp).\n- **Function calls (custom tools)**: Functions that are defined by you,\n  enabling the model to call your own code with strongly typed arguments\n  and outputs. Learn more about\n  [function calling](https://platform.openai.com/docs/guides/function-calling). You can also use\n  custom tools to call your own code.\n",
                )
                .optional(),
            /**
             * How the model should select which tool (or tools) to use when generating
             * a response. See the `tools` parameter to see how to specify which tools
             * the model can call.
             *
             */
            tool_choice: z
                .union([
                    z
                        .enum(["none", "auto", "required"])
                        .describe(
                            "Controls which (if any) tool is called by the model.\n\n`none` means the model will not call any tool and instead generates a message.\n\n`auto` means the model can pick between generating a message or calling one or\nmore tools.\n\n`required` means the model must call one or more tools.\n",
                        ),
                    z
                        .object({
                            /**Allowed tool configuration type. Always `allowed_tools`.*/
                            type: z
                                .literal("allowed_tools")
                                .describe(
                                    "Allowed tool configuration type. Always `allowed_tools`.",
                                ),
                            /**
                             * Constrains the tools available to the model to a pre-defined set.
                             *
                             * `auto` allows the model to pick from among the allowed tools and generate a
                             * message.
                             *
                             * `required` requires the model to call one or more of the allowed tools.
                             *
                             */
                            mode: z
                                .enum(["auto", "required"])
                                .describe(
                                    "Constrains the tools available to the model to a pre-defined set.\n\n`auto` allows the model to pick from among the allowed tools and generate a\nmessage.\n\n`required` requires the model to call one or more of the allowed tools.\n",
                                ),
                            /**
                             * A list of tool definitions that the model should be allowed to call.
                             *
                             * For the Responses API, the list of tool definitions might look like:
                             * ```json
                             * [
                             *   { "type": "function", "name": "get_weather" },
                             *   { "type": "mcp", "server_label": "deepwiki" },
                             *   { "type": "image_generation" }
                             * ]
                             * ```
                             *
                             */
                            tools: z
                                .array(
                                    z
                                        .record(z.string(), z.unknown())
                                        .describe(
                                            "A tool definition that the model should be allowed to call.\n",
                                        ),
                                )
                                .describe(
                                    'A list of tool definitions that the model should be allowed to call.\n\nFor the Responses API, the list of tool definitions might look like:\n```json\n[\n  { "type": "function", "name": "get_weather" },\n  { "type": "mcp", "server_label": "deepwiki" },\n  { "type": "image_generation" }\n]\n```\n',
                                ),
                        })
                        .describe(
                            "Constrains the tools available to the model to a pre-defined set.\n",
                        ),
                    z
                        .object({
                            /**
                             * The type of hosted tool the model should to use. Learn more about
                             * [built-in tools](https://platform.openai.com/docs/guides/tools).
                             *
                             * Allowed values are:
                             * - `file_search`
                             * - `web_search_preview`
                             * - `computer_use_preview`
                             * - `code_interpreter`
                             * - `image_generation`
                             *
                             */
                            type: z
                                .enum([
                                    "file_search",
                                    "web_search_preview",
                                    "computer_use_preview",
                                    "web_search_preview_2025_03_11",
                                    "image_generation",
                                    "code_interpreter",
                                ])
                                .describe(
                                    "The type of hosted tool the model should to use. Learn more about\n[built-in tools](https://platform.openai.com/docs/guides/tools).\n\nAllowed values are:\n- `file_search`\n- `web_search_preview`\n- `computer_use_preview`\n- `code_interpreter`\n- `image_generation`\n",
                                ),
                        })
                        .describe(
                            "Indicates that the model should use a built-in tool to generate a response.\n[Learn more about built-in tools](https://platform.openai.com/docs/guides/tools).\n",
                        ),
                    z
                        .object({
                            /**For function calling, the type is always `function`.*/
                            type: z
                                .literal("function")
                                .describe("For function calling, the type is always `function`."),
                            /**The name of the function to call.*/
                            name: z.string().describe("The name of the function to call."),
                        })
                        .describe(
                            "Use this option to force the model to call a specific function.\n",
                        ),
                    z
                        .object({
                            /**For MCP tools, the type is always `mcp`.*/
                            type: z
                                .literal("mcp")
                                .describe("For MCP tools, the type is always `mcp`."),
                            /**
                             * The label of the MCP server to use.
                             *
                             */
                            server_label: z
                                .string()
                                .describe("The label of the MCP server to use.\n"),
                            name: z
                                .union([
                                    z
                                        .string()
                                        .describe("The name of the tool to call on the server.\n"),
                                    z.null(),
                                ])
                                .optional(),
                        })
                        .describe(
                            "Use this option to force the model to call a specific tool on a remote MCP server.\n",
                        ),
                    z
                        .object({
                            /**For custom tool calling, the type is always `custom`.*/
                            type: z
                                .literal("custom")
                                .describe("For custom tool calling, the type is always `custom`."),
                            /**The name of the custom tool to call.*/
                            name: z.string().describe("The name of the custom tool to call."),
                        })
                        .describe(
                            "Use this option to force the model to call a specific custom tool.\n",
                        ),
                    z
                        .object({
                            /**The tool to call. Always `apply_patch`.*/
                            type: z
                                .literal("apply_patch")
                                .describe("The tool to call. Always `apply_patch`.")
                                .default("apply_patch"),
                        })
                        .describe(
                            "Forces the model to call the apply_patch tool when executing a tool call.",
                        ),
                    z
                        .object({
                            /**The tool to call. Always `shell`.*/
                            type: z
                                .literal("shell")
                                .describe("The tool to call. Always `shell`.")
                                .default("shell"),
                        })
                        .describe(
                            "Forces the model to call the shell tool when a tool call is required.",
                        ),
                ])
                .describe(
                    "How the model should select which tool (or tools) to use when generating\na response. See the `tools` parameter to see how to specify which tools\nthe model can call.\n",
                )
                .optional(),
            prompt: z
                .union([
                    z
                        .object({
                            /**The unique identifier of the prompt template to use.*/
                            id: z
                                .string()
                                .describe("The unique identifier of the prompt template to use."),
                            version: z
                                .union([
                                    z.string().describe("Optional version of the prompt template."),
                                    z.null(),
                                ])
                                .optional(),
                            variables: z
                                .union([
                                    z
                                        .record(
                                            z.string(),
                                            z.union([
                                                z.string(),
                                                z
                                                    .object({
                                                        /**The type of the input item. Always `input_text`.*/
                                                        type: z
                                                            .literal("input_text")
                                                            .describe(
                                                                "The type of the input item. Always `input_text`.",
                                                            )
                                                            .default("input_text"),
                                                        /**The text input to the model.*/
                                                        text: z
                                                            .string()
                                                            .describe(
                                                                "The text input to the model.",
                                                            ),
                                                    })
                                                    .describe("A text input to the model."),
                                                z
                                                    .object({
                                                        /**The type of the input item. Always `input_image`.*/
                                                        type: z
                                                            .literal("input_image")
                                                            .describe(
                                                                "The type of the input item. Always `input_image`.",
                                                            )
                                                            .default("input_image"),
                                                        image_url: z
                                                            .union([
                                                                z
                                                                    .string()
                                                                    .describe(
                                                                        "The URL of the image to be sent to the model. A fully qualified URL or base64 encoded image in a data URL.",
                                                                    ),
                                                                z.null(),
                                                            ])
                                                            .optional(),
                                                        file_id: z
                                                            .union([
                                                                z
                                                                    .string()
                                                                    .describe(
                                                                        "The ID of the file to be sent to the model.",
                                                                    ),
                                                                z.null(),
                                                            ])
                                                            .optional(),
                                                        /**The detail level of the image to be sent to the model. One of `high`, `low`, or `auto`. Defaults to `auto`.*/
                                                        detail: z
                                                            .enum(["low", "high", "auto"])
                                                            .describe(
                                                                "The detail level of the image to be sent to the model. One of `high`, `low`, or `auto`. Defaults to `auto`.",
                                                            ),
                                                    })
                                                    .describe(
                                                        "An image input to the model. Learn about [image inputs](https://platform.openai.com/docs/guides/vision).",
                                                    ),
                                                z
                                                    .object({
                                                        /**The type of the input item. Always `input_file`.*/
                                                        type: z
                                                            .literal("input_file")
                                                            .describe(
                                                                "The type of the input item. Always `input_file`.",
                                                            )
                                                            .default("input_file"),
                                                        file_id: z
                                                            .union([
                                                                z
                                                                    .string()
                                                                    .describe(
                                                                        "The ID of the file to be sent to the model.",
                                                                    ),
                                                                z.null(),
                                                            ])
                                                            .optional(),
                                                        /**The name of the file to be sent to the model.*/
                                                        filename: z
                                                            .string()
                                                            .describe(
                                                                "The name of the file to be sent to the model.",
                                                            )
                                                            .optional(),
                                                        /**The URL of the file to be sent to the model.*/
                                                        file_url: z
                                                            .string()
                                                            .describe(
                                                                "The URL of the file to be sent to the model.",
                                                            )
                                                            .optional(),
                                                        /**
                                                         * The content of the file to be sent to the model.
                                                         *
                                                         */
                                                        file_data: z
                                                            .string()
                                                            .describe(
                                                                "The content of the file to be sent to the model.\n",
                                                            )
                                                            .optional(),
                                                    })
                                                    .describe("A file input to the model."),
                                            ]),
                                        )
                                        .describe(
                                            "Optional map of values to substitute in for variables in your\nprompt. The substitution values can either be strings, or other\nResponse input types like images or files.\n",
                                        ),
                                    z.null(),
                                ])
                                .optional(),
                        })
                        .describe(
                            "Reference to a prompt template and its variables.\n[Learn more](https://platform.openai.com/docs/guides/text?api-mode=responses#reusable-prompts).\n",
                        ),
                    z.null(),
                ])
                .optional(),
            truncation: z
                .union([
                    z
                        .enum(["auto", "disabled"])
                        .describe(
                            "The truncation strategy to use for the model response.\n- `auto`: If the input to this Response exceeds\n  the model's context window size, the model will truncate the\n  response to fit the context window by dropping items from the beginning of the conversation.\n- `disabled` (default): If the input size will exceed the context window\n  size for a model, the request will fail with a 400 error.\n",
                        )
                        .default("disabled"),
                    z.null(),
                ])
                .optional(),
        }),
        z.object({
            /**
             * Unique identifier for this Response.
             *
             */
            id: z.string().describe("Unique identifier for this Response.\n"),
            /**
             * The object type of this resource - always set to `response`.
             *
             */
            object: z
                .literal("response")
                .describe("The object type of this resource - always set to `response`.\n"),
            /**
             * The status of the response generation. One of `completed`, `failed`,
             * `in_progress`, `cancelled`, `queued`, or `incomplete`.
             *
             */
            status: z
                .enum(["completed", "failed", "in_progress", "cancelled", "queued", "incomplete"])
                .describe(
                    "The status of the response generation. One of `completed`, `failed`,\n`in_progress`, `cancelled`, `queued`, or `incomplete`.\n",
                )
                .optional(),
            /**
             * Unix timestamp (in seconds) of when this Response was created.
             *
             */
            created_at: z
                .number()
                .describe("Unix timestamp (in seconds) of when this Response was created.\n"),
            error: z.union([
                z
                    .object({
                        /**
                         * The error code for the response.
                         *
                         */
                        code: z
                            .enum([
                                "server_error",
                                "rate_limit_exceeded",
                                "invalid_prompt",
                                "vector_store_timeout",
                                "invalid_image",
                                "invalid_image_format",
                                "invalid_base64_image",
                                "invalid_image_url",
                                "image_too_large",
                                "image_too_small",
                                "image_parse_error",
                                "image_content_policy_violation",
                                "invalid_image_mode",
                                "image_file_too_large",
                                "unsupported_image_media_type",
                                "empty_image_file",
                                "failed_to_download_image",
                                "image_file_not_found",
                            ])
                            .describe("The error code for the response.\n"),
                        /**
                         * A human-readable description of the error.
                         *
                         */
                        message: z
                            .string()
                            .describe("A human-readable description of the error.\n"),
                    })
                    .describe(
                        "An error object returned when the model fails to generate a Response.\n",
                    ),
                z.null(),
            ]),
            incomplete_details: z.union([
                z
                    .object({
                        /**The reason why the response is incomplete.*/
                        reason: z
                            .enum(["max_output_tokens", "content_filter"])
                            .describe("The reason why the response is incomplete.")
                            .optional(),
                    })
                    .describe("Details about why the response is incomplete.\n"),
                z.null(),
            ]),
            /**
             * An array of content items generated by the model.
             *
             * - The length and order of items in the `output` array is dependent
             *   on the model's response.
             * - Rather than accessing the first item in the `output` array and
             *   assuming it's an `assistant` message with the content generated by
             *   the model, you might consider using the `output_text` property where
             *   supported in SDKs.
             *
             */
            output: z
                .array(
                    z.union([
                        z
                            .object({
                                /**
                                 * The unique ID of the output message.
                                 *
                                 */
                                id: z.string().describe("The unique ID of the output message.\n"),
                                /**
                                 * The type of the output message. Always `message`.
                                 *
                                 */
                                type: z
                                    .literal("message")
                                    .describe(
                                        "The type of the output message. Always `message`.\n",
                                    ),
                                /**
                                 * The role of the output message. Always `assistant`.
                                 *
                                 */
                                role: z
                                    .literal("assistant")
                                    .describe(
                                        "The role of the output message. Always `assistant`.\n",
                                    ),
                                /**
                                 * The content of the output message.
                                 *
                                 */
                                content: z
                                    .array(
                                        z.union([
                                            z
                                                .object({
                                                    /**The type of the output text. Always `output_text`.*/
                                                    type: z
                                                        .literal("output_text")
                                                        .describe(
                                                            "The type of the output text. Always `output_text`.",
                                                        )
                                                        .default("output_text"),
                                                    /**The text output from the model.*/
                                                    text: z
                                                        .string()
                                                        .describe(
                                                            "The text output from the model.",
                                                        ),
                                                    /**The annotations of the text output.*/
                                                    annotations: z
                                                        .array(
                                                            z.union([
                                                                z
                                                                    .object({
                                                                        /**The type of the file citation. Always `file_citation`.*/
                                                                        type: z
                                                                            .literal(
                                                                                "file_citation",
                                                                            )
                                                                            .describe(
                                                                                "The type of the file citation. Always `file_citation`.",
                                                                            )
                                                                            .default(
                                                                                "file_citation",
                                                                            ),
                                                                        /**The ID of the file.*/
                                                                        file_id: z
                                                                            .string()
                                                                            .describe(
                                                                                "The ID of the file.",
                                                                            ),
                                                                        /**The index of the file in the list of files.*/
                                                                        index: z
                                                                            .number()
                                                                            .int()
                                                                            .describe(
                                                                                "The index of the file in the list of files.",
                                                                            ),
                                                                        /**The filename of the file cited.*/
                                                                        filename: z
                                                                            .string()
                                                                            .describe(
                                                                                "The filename of the file cited.",
                                                                            ),
                                                                    })
                                                                    .describe(
                                                                        "A citation to a file.",
                                                                    ),
                                                                z
                                                                    .object({
                                                                        /**The type of the URL citation. Always `url_citation`.*/
                                                                        type: z
                                                                            .literal("url_citation")
                                                                            .describe(
                                                                                "The type of the URL citation. Always `url_citation`.",
                                                                            )
                                                                            .default(
                                                                                "url_citation",
                                                                            ),
                                                                        /**The URL of the web resource.*/
                                                                        url: z
                                                                            .string()
                                                                            .describe(
                                                                                "The URL of the web resource.",
                                                                            ),
                                                                        /**The index of the first character of the URL citation in the message.*/
                                                                        start_index: z
                                                                            .number()
                                                                            .int()
                                                                            .describe(
                                                                                "The index of the first character of the URL citation in the message.",
                                                                            ),
                                                                        /**The index of the last character of the URL citation in the message.*/
                                                                        end_index: z
                                                                            .number()
                                                                            .int()
                                                                            .describe(
                                                                                "The index of the last character of the URL citation in the message.",
                                                                            ),
                                                                        /**The title of the web resource.*/
                                                                        title: z
                                                                            .string()
                                                                            .describe(
                                                                                "The title of the web resource.",
                                                                            ),
                                                                    })
                                                                    .describe(
                                                                        "A citation for a web resource used to generate a model response.",
                                                                    ),
                                                                z
                                                                    .object({
                                                                        /**The type of the container file citation. Always `container_file_citation`.*/
                                                                        type: z
                                                                            .literal(
                                                                                "container_file_citation",
                                                                            )
                                                                            .describe(
                                                                                "The type of the container file citation. Always `container_file_citation`.",
                                                                            )
                                                                            .default(
                                                                                "container_file_citation",
                                                                            ),
                                                                        /**The ID of the container file.*/
                                                                        container_id: z
                                                                            .string()
                                                                            .describe(
                                                                                "The ID of the container file.",
                                                                            ),
                                                                        /**The ID of the file.*/
                                                                        file_id: z
                                                                            .string()
                                                                            .describe(
                                                                                "The ID of the file.",
                                                                            ),
                                                                        /**The index of the first character of the container file citation in the message.*/
                                                                        start_index: z
                                                                            .number()
                                                                            .int()
                                                                            .describe(
                                                                                "The index of the first character of the container file citation in the message.",
                                                                            ),
                                                                        /**The index of the last character of the container file citation in the message.*/
                                                                        end_index: z
                                                                            .number()
                                                                            .int()
                                                                            .describe(
                                                                                "The index of the last character of the container file citation in the message.",
                                                                            ),
                                                                        /**The filename of the container file cited.*/
                                                                        filename: z
                                                                            .string()
                                                                            .describe(
                                                                                "The filename of the container file cited.",
                                                                            ),
                                                                    })
                                                                    .describe(
                                                                        "A citation for a container file used to generate a model response.",
                                                                    ),
                                                                z
                                                                    .object({
                                                                        /**
                                                                         * The type of the file path. Always `file_path`.
                                                                         *
                                                                         */
                                                                        type: z
                                                                            .literal("file_path")
                                                                            .describe(
                                                                                "The type of the file path. Always `file_path`.\n",
                                                                            ),
                                                                        /**
                                                                         * The ID of the file.
                                                                         *
                                                                         */
                                                                        file_id: z
                                                                            .string()
                                                                            .describe(
                                                                                "The ID of the file.\n",
                                                                            ),
                                                                        /**
                                                                         * The index of the file in the list of files.
                                                                         *
                                                                         */
                                                                        index: z
                                                                            .number()
                                                                            .int()
                                                                            .describe(
                                                                                "The index of the file in the list of files.\n",
                                                                            ),
                                                                    })
                                                                    .describe(
                                                                        "A path to a file.\n",
                                                                    ),
                                                            ]),
                                                        )
                                                        .describe(
                                                            "The annotations of the text output.",
                                                        ),
                                                    logprobs: z
                                                        .array(
                                                            z
                                                                .object({
                                                                    token: z.string(),
                                                                    logprob: z.number(),
                                                                    bytes: z.array(
                                                                        z.number().int(),
                                                                    ),
                                                                    top_logprobs: z.array(
                                                                        z
                                                                            .object({
                                                                                token: z.string(),
                                                                                logprob: z.number(),
                                                                                bytes: z.array(
                                                                                    z
                                                                                        .number()
                                                                                        .int(),
                                                                                ),
                                                                            })
                                                                            .describe(
                                                                                "The top log probability of a token.",
                                                                            ),
                                                                    ),
                                                                })
                                                                .describe(
                                                                    "The log probability of a token.",
                                                                ),
                                                        )
                                                        .optional(),
                                                })
                                                .describe("A text output from the model."),
                                            z
                                                .object({
                                                    /**The type of the refusal. Always `refusal`.*/
                                                    type: z
                                                        .literal("refusal")
                                                        .describe(
                                                            "The type of the refusal. Always `refusal`.",
                                                        )
                                                        .default("refusal"),
                                                    /**The refusal explanation from the model.*/
                                                    refusal: z
                                                        .string()
                                                        .describe(
                                                            "The refusal explanation from the model.",
                                                        ),
                                                })
                                                .describe("A refusal from the model."),
                                        ]),
                                    )
                                    .describe("The content of the output message.\n"),
                                /**
                                 * The status of the message input. One of `in_progress`, `completed`, or
                                 * `incomplete`. Populated when input items are returned via API.
                                 *
                                 */
                                status: z
                                    .enum(["in_progress", "completed", "incomplete"])
                                    .describe(
                                        "The status of the message input. One of `in_progress`, `completed`, or\n`incomplete`. Populated when input items are returned via API.\n",
                                    ),
                            })
                            .describe("An output message from the model.\n"),
                        z
                            .object({
                                /**
                                 * The unique ID of the file search tool call.
                                 *
                                 */
                                id: z
                                    .string()
                                    .describe("The unique ID of the file search tool call.\n"),
                                /**
                                 * The type of the file search tool call. Always `file_search_call`.
                                 *
                                 */
                                type: z
                                    .literal("file_search_call")
                                    .describe(
                                        "The type of the file search tool call. Always `file_search_call`.\n",
                                    ),
                                /**
                                 * The status of the file search tool call. One of `in_progress`,
                                 * `searching`, `incomplete` or `failed`,
                                 *
                                 */
                                status: z
                                    .enum([
                                        "in_progress",
                                        "searching",
                                        "completed",
                                        "incomplete",
                                        "failed",
                                    ])
                                    .describe(
                                        "The status of the file search tool call. One of `in_progress`,\n`searching`, `incomplete` or `failed`,\n",
                                    ),
                                /**
                                 * The queries used to search for files.
                                 *
                                 */
                                queries: z
                                    .array(z.string())
                                    .describe("The queries used to search for files.\n"),
                                results: z
                                    .union([
                                        z
                                            .array(
                                                z.object({
                                                    /**
                                                     * The unique ID of the file.
                                                     *
                                                     */
                                                    file_id: z
                                                        .string()
                                                        .describe("The unique ID of the file.\n")
                                                        .optional(),
                                                    /**
                                                     * The text that was retrieved from the file.
                                                     *
                                                     */
                                                    text: z
                                                        .string()
                                                        .describe(
                                                            "The text that was retrieved from the file.\n",
                                                        )
                                                        .optional(),
                                                    /**
                                                     * The name of the file.
                                                     *
                                                     */
                                                    filename: z
                                                        .string()
                                                        .describe("The name of the file.\n")
                                                        .optional(),
                                                    attributes: z
                                                        .union([
                                                            z
                                                                .record(
                                                                    z.string(),
                                                                    z.union([
                                                                        z.string().max(512),
                                                                        z.number(),
                                                                        z.boolean(),
                                                                    ]),
                                                                )
                                                                .describe(
                                                                    "Set of 16 key-value pairs that can be attached to an object. This can be\nuseful for storing additional information about the object in a structured\nformat, and querying for objects via API or the dashboard. Keys are strings\nwith a maximum length of 64 characters. Values are strings with a maximum\nlength of 512 characters, booleans, or numbers.\n",
                                                                ),
                                                            z.null(),
                                                        ])
                                                        .optional(),
                                                    /**
                                                     * The relevance score of the file - a value between 0 and 1.
                                                     *
                                                     */
                                                    score: z
                                                        .number()
                                                        .describe(
                                                            "The relevance score of the file - a value between 0 and 1.\n",
                                                        )
                                                        .optional(),
                                                }),
                                            )
                                            .describe(
                                                "The results of the file search tool call.\n",
                                            ),
                                        z.null(),
                                    ])
                                    .optional(),
                            })
                            .describe(
                                "The results of a file search tool call. See the\n[file search guide](https://platform.openai.com/docs/guides/tools-file-search) for more information.\n",
                            ),
                        z
                            .object({
                                /**
                                 * The unique ID of the function tool call.
                                 *
                                 */
                                id: z
                                    .string()
                                    .describe("The unique ID of the function tool call.\n")
                                    .optional(),
                                /**
                                 * The type of the function tool call. Always `function_call`.
                                 *
                                 */
                                type: z
                                    .literal("function_call")
                                    .describe(
                                        "The type of the function tool call. Always `function_call`.\n",
                                    ),
                                /**
                                 * The unique ID of the function tool call generated by the model.
                                 *
                                 */
                                call_id: z
                                    .string()
                                    .describe(
                                        "The unique ID of the function tool call generated by the model.\n",
                                    ),
                                /**
                                 * The name of the function to run.
                                 *
                                 */
                                name: z.string().describe("The name of the function to run.\n"),
                                /**
                                 * A JSON string of the arguments to pass to the function.
                                 *
                                 */
                                arguments: z
                                    .string()
                                    .describe(
                                        "A JSON string of the arguments to pass to the function.\n",
                                    ),
                                /**
                                 * The status of the item. One of `in_progress`, `completed`, or
                                 * `incomplete`. Populated when items are returned via API.
                                 *
                                 */
                                status: z
                                    .enum(["in_progress", "completed", "incomplete"])
                                    .describe(
                                        "The status of the item. One of `in_progress`, `completed`, or\n`incomplete`. Populated when items are returned via API.\n",
                                    )
                                    .optional(),
                            })
                            .describe(
                                "A tool call to run a function. See the \n[function calling guide](https://platform.openai.com/docs/guides/function-calling) for more information.\n",
                            ),
                        z
                            .object({
                                /**
                                 * The unique ID of the web search tool call.
                                 *
                                 */
                                id: z
                                    .string()
                                    .describe("The unique ID of the web search tool call.\n"),
                                /**
                                 * The type of the web search tool call. Always `web_search_call`.
                                 *
                                 */
                                type: z
                                    .literal("web_search_call")
                                    .describe(
                                        "The type of the web search tool call. Always `web_search_call`.\n",
                                    ),
                                /**
                                 * The status of the web search tool call.
                                 *
                                 */
                                status: z
                                    .enum(["in_progress", "searching", "completed", "failed"])
                                    .describe("The status of the web search tool call.\n"),
                                /**
                                 * An object describing the specific action taken in this web search call.
                                 * Includes details on how the model used the web (search, open_page, find).
                                 *
                                 */
                                action: z
                                    .record(z.string(), z.unknown())
                                    .and(
                                        z.union([
                                            z
                                                .object({
                                                    /**
                                                     * The action type.
                                                     *
                                                     */
                                                    type: z
                                                        .literal("search")
                                                        .describe("The action type.\n"),
                                                    /**
                                                     * The search query.
                                                     *
                                                     */
                                                    query: z
                                                        .string()
                                                        .describe("The search query.\n"),
                                                    /**
                                                     * The sources used in the search.
                                                     *
                                                     */
                                                    sources: z
                                                        .array(
                                                            z
                                                                .object({
                                                                    /**
                                                                     * The type of source. Always `url`.
                                                                     *
                                                                     */
                                                                    type: z
                                                                        .literal("url")
                                                                        .describe(
                                                                            "The type of source. Always `url`.\n",
                                                                        ),
                                                                    /**
                                                                     * The URL of the source.
                                                                     *
                                                                     */
                                                                    url: z
                                                                        .string()
                                                                        .describe(
                                                                            "The URL of the source.\n",
                                                                        ),
                                                                })
                                                                .describe(
                                                                    "A source used in the search.\n",
                                                                ),
                                                        )
                                                        .describe(
                                                            "The sources used in the search.\n",
                                                        )
                                                        .optional(),
                                                })
                                                .describe(
                                                    'Action type "search" - Performs a web search query.\n',
                                                ),
                                            z
                                                .object({
                                                    /**
                                                     * The action type.
                                                     *
                                                     */
                                                    type: z
                                                        .literal("open_page")
                                                        .describe("The action type.\n"),
                                                    /**
                                                     * The URL opened by the model.
                                                     *
                                                     */
                                                    url: z
                                                        .string()
                                                        .url()
                                                        .describe("The URL opened by the model.\n"),
                                                })
                                                .describe(
                                                    'Action type "open_page" - Opens a specific URL from search results.\n',
                                                ),
                                            z
                                                .object({
                                                    /**
                                                     * The action type.
                                                     *
                                                     */
                                                    type: z
                                                        .literal("find")
                                                        .describe("The action type.\n"),
                                                    /**
                                                     * The URL of the page searched for the pattern.
                                                     *
                                                     */
                                                    url: z
                                                        .string()
                                                        .url()
                                                        .describe(
                                                            "The URL of the page searched for the pattern.\n",
                                                        ),
                                                    /**
                                                     * The pattern or text to search for within the page.
                                                     *
                                                     */
                                                    pattern: z
                                                        .string()
                                                        .describe(
                                                            "The pattern or text to search for within the page.\n",
                                                        ),
                                                })
                                                .describe(
                                                    'Action type "find": Searches for a pattern within a loaded page.\n',
                                                ),
                                        ]),
                                    )
                                    .describe(
                                        "An object describing the specific action taken in this web search call.\nIncludes details on how the model used the web (search, open_page, find).\n",
                                    ),
                            })
                            .describe(
                                "The results of a web search tool call. See the\n[web search guide](https://platform.openai.com/docs/guides/tools-web-search) for more information.\n",
                            ),
                        z
                            .object({
                                /**The type of the computer call. Always `computer_call`.*/
                                type: z
                                    .literal("computer_call")
                                    .describe(
                                        "The type of the computer call. Always `computer_call`.",
                                    )
                                    .default("computer_call"),
                                /**The unique ID of the computer call.*/
                                id: z.string().describe("The unique ID of the computer call."),
                                /**
                                 * An identifier used when responding to the tool call with output.
                                 *
                                 */
                                call_id: z
                                    .string()
                                    .describe(
                                        "An identifier used when responding to the tool call with output.\n",
                                    ),
                                action: z.union([
                                    z
                                        .object({
                                            /**Specifies the event type. For a click action, this property is always `click`.*/
                                            type: z
                                                .literal("click")
                                                .describe(
                                                    "Specifies the event type. For a click action, this property is always `click`.",
                                                )
                                                .default("click"),
                                            /**Indicates which mouse button was pressed during the click. One of `left`, `right`, `wheel`, `back`, or `forward`.*/
                                            button: z
                                                .enum(["left", "right", "wheel", "back", "forward"])
                                                .describe(
                                                    "Indicates which mouse button was pressed during the click. One of `left`, `right`, `wheel`, `back`, or `forward`.",
                                                ),
                                            /**The x-coordinate where the click occurred.*/
                                            x: z
                                                .number()
                                                .int()
                                                .describe(
                                                    "The x-coordinate where the click occurred.",
                                                ),
                                            /**The y-coordinate where the click occurred.*/
                                            y: z
                                                .number()
                                                .int()
                                                .describe(
                                                    "The y-coordinate where the click occurred.",
                                                ),
                                        })
                                        .describe("A click action."),
                                    z
                                        .object({
                                            /**Specifies the event type. For a double click action, this property is always set to `double_click`.*/
                                            type: z
                                                .literal("double_click")
                                                .describe(
                                                    "Specifies the event type. For a double click action, this property is always set to `double_click`.",
                                                )
                                                .default("double_click"),
                                            /**The x-coordinate where the double click occurred.*/
                                            x: z
                                                .number()
                                                .int()
                                                .describe(
                                                    "The x-coordinate where the double click occurred.",
                                                ),
                                            /**The y-coordinate where the double click occurred.*/
                                            y: z
                                                .number()
                                                .int()
                                                .describe(
                                                    "The y-coordinate where the double click occurred.",
                                                ),
                                        })
                                        .describe("A double click action."),
                                    z
                                        .object({
                                            /**
                                             * Specifies the event type. For a drag action, this property is
                                             * always set to `drag`.
                                             *
                                             */
                                            type: z
                                                .literal("drag")
                                                .describe(
                                                    "Specifies the event type. For a drag action, this property is \nalways set to `drag`.\n",
                                                )
                                                .default("drag"),
                                            /**
                                             * An array of coordinates representing the path of the drag action. Coordinates will appear as an array
                                             * of objects, eg
                                             * ```
                                             * [
                                             *   { x: 100, y: 200 },
                                             *   { x: 200, y: 300 }
                                             * ]
                                             * ```
                                             *
                                             */
                                            path: z
                                                .array(
                                                    z
                                                        .object({
                                                            /**The x-coordinate.*/
                                                            x: z
                                                                .number()
                                                                .int()
                                                                .describe("The x-coordinate."),
                                                            /**The y-coordinate.*/
                                                            y: z
                                                                .number()
                                                                .int()
                                                                .describe("The y-coordinate."),
                                                        })
                                                        .describe(
                                                            "An x/y coordinate pair, e.g. `{ x: 100, y: 200 }`.",
                                                        ),
                                                )
                                                .describe(
                                                    "An array of coordinates representing the path of the drag action. Coordinates will appear as an array\nof objects, eg\n```\n[\n  { x: 100, y: 200 },\n  { x: 200, y: 300 }\n]\n```\n",
                                                ),
                                        })
                                        .describe("A drag action.\n"),
                                    z
                                        .object({
                                            /**Specifies the event type. For a keypress action, this property is always set to `keypress`.*/
                                            type: z
                                                .literal("keypress")
                                                .describe(
                                                    "Specifies the event type. For a keypress action, this property is always set to `keypress`.",
                                                )
                                                .default("keypress"),
                                            /**The combination of keys the model is requesting to be pressed. This is an array of strings, each representing a key.*/
                                            keys: z
                                                .array(
                                                    z
                                                        .string()
                                                        .describe(
                                                            "One of the keys the model is requesting to be pressed.",
                                                        ),
                                                )
                                                .describe(
                                                    "The combination of keys the model is requesting to be pressed. This is an array of strings, each representing a key.",
                                                ),
                                        })
                                        .describe(
                                            "A collection of keypresses the model would like to perform.",
                                        ),
                                    z
                                        .object({
                                            /**
                                             * Specifies the event type. For a move action, this property is
                                             * always set to `move`.
                                             *
                                             */
                                            type: z
                                                .literal("move")
                                                .describe(
                                                    "Specifies the event type. For a move action, this property is \nalways set to `move`.\n",
                                                )
                                                .default("move"),
                                            /**
                                             * The x-coordinate to move to.
                                             *
                                             */
                                            x: z
                                                .number()
                                                .int()
                                                .describe("The x-coordinate to move to.\n"),
                                            /**
                                             * The y-coordinate to move to.
                                             *
                                             */
                                            y: z
                                                .number()
                                                .int()
                                                .describe("The y-coordinate to move to.\n"),
                                        })
                                        .describe("A mouse move action.\n"),
                                    z
                                        .object({
                                            /**
                                             * Specifies the event type. For a screenshot action, this property is
                                             * always set to `screenshot`.
                                             *
                                             */
                                            type: z
                                                .literal("screenshot")
                                                .describe(
                                                    "Specifies the event type. For a screenshot action, this property is \nalways set to `screenshot`.\n",
                                                )
                                                .default("screenshot"),
                                        })
                                        .describe("A screenshot action.\n"),
                                    z
                                        .object({
                                            /**
                                             * Specifies the event type. For a scroll action, this property is
                                             * always set to `scroll`.
                                             *
                                             */
                                            type: z
                                                .literal("scroll")
                                                .describe(
                                                    "Specifies the event type. For a scroll action, this property is \nalways set to `scroll`.\n",
                                                )
                                                .default("scroll"),
                                            /**
                                             * The x-coordinate where the scroll occurred.
                                             *
                                             */
                                            x: z
                                                .number()
                                                .int()
                                                .describe(
                                                    "The x-coordinate where the scroll occurred.\n",
                                                ),
                                            /**
                                             * The y-coordinate where the scroll occurred.
                                             *
                                             */
                                            y: z
                                                .number()
                                                .int()
                                                .describe(
                                                    "The y-coordinate where the scroll occurred.\n",
                                                ),
                                            /**
                                             * The horizontal scroll distance.
                                             *
                                             */
                                            scroll_x: z
                                                .number()
                                                .int()
                                                .describe("The horizontal scroll distance.\n"),
                                            /**
                                             * The vertical scroll distance.
                                             *
                                             */
                                            scroll_y: z
                                                .number()
                                                .int()
                                                .describe("The vertical scroll distance.\n"),
                                        })
                                        .describe("A scroll action.\n"),
                                    z
                                        .object({
                                            /**
                                             * Specifies the event type. For a type action, this property is
                                             * always set to `type`.
                                             *
                                             */
                                            type: z
                                                .literal("type")
                                                .describe(
                                                    "Specifies the event type. For a type action, this property is \nalways set to `type`.\n",
                                                )
                                                .default("type"),
                                            /**
                                             * The text to type.
                                             *
                                             */
                                            text: z.string().describe("The text to type.\n"),
                                        })
                                        .describe("An action to type in text.\n"),
                                    z
                                        .object({
                                            /**
                                             * Specifies the event type. For a wait action, this property is
                                             * always set to `wait`.
                                             *
                                             */
                                            type: z
                                                .literal("wait")
                                                .describe(
                                                    "Specifies the event type. For a wait action, this property is \nalways set to `wait`.\n",
                                                )
                                                .default("wait"),
                                        })
                                        .describe("A wait action.\n"),
                                ]),
                                /**
                                 * The pending safety checks for the computer call.
                                 *
                                 */
                                pending_safety_checks: z
                                    .array(
                                        z
                                            .object({
                                                /**The ID of the pending safety check.*/
                                                id: z
                                                    .string()
                                                    .describe(
                                                        "The ID of the pending safety check.",
                                                    ),
                                                code: z
                                                    .union([
                                                        z
                                                            .string()
                                                            .describe(
                                                                "The type of the pending safety check.",
                                                            ),
                                                        z.null(),
                                                    ])
                                                    .optional(),
                                                message: z
                                                    .union([
                                                        z
                                                            .string()
                                                            .describe(
                                                                "Details about the pending safety check.",
                                                            ),
                                                        z.null(),
                                                    ])
                                                    .optional(),
                                            })
                                            .describe(
                                                "A pending safety check for the computer call.",
                                            ),
                                    )
                                    .describe("The pending safety checks for the computer call.\n"),
                                /**
                                 * The status of the item. One of `in_progress`, `completed`, or
                                 * `incomplete`. Populated when items are returned via API.
                                 *
                                 */
                                status: z
                                    .enum(["in_progress", "completed", "incomplete"])
                                    .describe(
                                        "The status of the item. One of `in_progress`, `completed`, or\n`incomplete`. Populated when items are returned via API.\n",
                                    ),
                            })
                            .describe(
                                "A tool call to a computer use tool. See the\n[computer use guide](https://platform.openai.com/docs/guides/tools-computer-use) for more information.\n",
                            ),
                        z
                            .object({
                                /**
                                 * The type of the object. Always `reasoning`.
                                 *
                                 */
                                type: z
                                    .literal("reasoning")
                                    .describe("The type of the object. Always `reasoning`.\n"),
                                /**
                                 * The unique identifier of the reasoning content.
                                 *
                                 */
                                id: z
                                    .string()
                                    .describe("The unique identifier of the reasoning content.\n"),
                                encrypted_content: z
                                    .union([
                                        z
                                            .string()
                                            .describe(
                                                "The encrypted content of the reasoning item - populated when a response is\ngenerated with `reasoning.encrypted_content` in the `include` parameter.\n",
                                            ),
                                        z.null(),
                                    ])
                                    .optional(),
                                /**
                                 * Reasoning summary content.
                                 *
                                 */
                                summary: z
                                    .array(
                                        z
                                            .object({
                                                /**The type of the object. Always `summary_text`.*/
                                                type: z
                                                    .literal("summary_text")
                                                    .describe(
                                                        "The type of the object. Always `summary_text`.",
                                                    )
                                                    .default("summary_text"),
                                                /**A summary of the reasoning output from the model so far.*/
                                                text: z
                                                    .string()
                                                    .describe(
                                                        "A summary of the reasoning output from the model so far.",
                                                    ),
                                            })
                                            .describe("A summary text from the model."),
                                    )
                                    .describe("Reasoning summary content.\n"),
                                /**
                                 * Reasoning text content.
                                 *
                                 */
                                content: z
                                    .array(
                                        z
                                            .object({
                                                /**The type of the reasoning text. Always `reasoning_text`.*/
                                                type: z
                                                    .literal("reasoning_text")
                                                    .describe(
                                                        "The type of the reasoning text. Always `reasoning_text`.",
                                                    )
                                                    .default("reasoning_text"),
                                                /**The reasoning text from the model.*/
                                                text: z
                                                    .string()
                                                    .describe("The reasoning text from the model."),
                                            })
                                            .describe("Reasoning text from the model."),
                                    )
                                    .describe("Reasoning text content.\n")
                                    .optional(),
                                /**
                                 * The status of the item. One of `in_progress`, `completed`, or
                                 * `incomplete`. Populated when items are returned via API.
                                 *
                                 */
                                status: z
                                    .enum(["in_progress", "completed", "incomplete"])
                                    .describe(
                                        "The status of the item. One of `in_progress`, `completed`, or\n`incomplete`. Populated when items are returned via API.\n",
                                    )
                                    .optional(),
                            })
                            .describe(
                                "A description of the chain of thought used by a reasoning model while generating\na response. Be sure to include these items in your `input` to the Responses API\nfor subsequent turns of a conversation if you are manually\n[managing context](https://platform.openai.com/docs/guides/conversation-state).\n",
                            ),
                        z
                            .object({
                                /**The type of the item. Always `compaction`.*/
                                type: z
                                    .literal("compaction")
                                    .describe("The type of the item. Always `compaction`.")
                                    .default("compaction"),
                                /**The unique ID of the compaction item.*/
                                id: z.string().describe("The unique ID of the compaction item."),
                                encrypted_content: z.string(),
                                created_by: z.string().optional(),
                            })
                            .describe(
                                "A compaction item generated by the [`v1/responses/compact` API](https://platform.openai.com/docs/api-reference/responses/compact).",
                            ),
                        z
                            .object({
                                /**
                                 * The type of the image generation call. Always `image_generation_call`.
                                 *
                                 */
                                type: z
                                    .literal("image_generation_call")
                                    .describe(
                                        "The type of the image generation call. Always `image_generation_call`.\n",
                                    ),
                                /**
                                 * The unique ID of the image generation call.
                                 *
                                 */
                                id: z
                                    .string()
                                    .describe("The unique ID of the image generation call.\n"),
                                /**
                                 * The status of the image generation call.
                                 *
                                 */
                                status: z
                                    .enum(["in_progress", "completed", "generating", "failed"])
                                    .describe("The status of the image generation call.\n"),
                                result: z.union([
                                    z.string().describe("The generated image encoded in base64.\n"),
                                    z.null(),
                                ]),
                            })
                            .describe("An image generation request made by the model.\n"),
                        z
                            .object({
                                /**
                                 * The type of the code interpreter tool call. Always `code_interpreter_call`.
                                 *
                                 */
                                type: z
                                    .literal("code_interpreter_call")
                                    .describe(
                                        "The type of the code interpreter tool call. Always `code_interpreter_call`.\n",
                                    )
                                    .default("code_interpreter_call"),
                                /**
                                 * The unique ID of the code interpreter tool call.
                                 *
                                 */
                                id: z
                                    .string()
                                    .describe("The unique ID of the code interpreter tool call.\n"),
                                /**
                                 * The status of the code interpreter tool call. Valid values are `in_progress`, `completed`, `incomplete`, `interpreting`, and `failed`.
                                 *
                                 */
                                status: z
                                    .enum([
                                        "in_progress",
                                        "completed",
                                        "incomplete",
                                        "interpreting",
                                        "failed",
                                    ])
                                    .describe(
                                        "The status of the code interpreter tool call. Valid values are `in_progress`, `completed`, `incomplete`, `interpreting`, and `failed`.\n",
                                    ),
                                /**
                                 * The ID of the container used to run the code.
                                 *
                                 */
                                container_id: z
                                    .string()
                                    .describe("The ID of the container used to run the code.\n"),
                                code: z.union([
                                    z
                                        .string()
                                        .describe("The code to run, or null if not available.\n"),
                                    z.null(),
                                ]),
                                outputs: z.union([
                                    z
                                        .array(
                                            z.union([
                                                z
                                                    .object({
                                                        /**The type of the output. Always `logs`.*/
                                                        type: z
                                                            .literal("logs")
                                                            .describe(
                                                                "The type of the output. Always `logs`.",
                                                            )
                                                            .default("logs"),
                                                        /**The logs output from the code interpreter.*/
                                                        logs: z
                                                            .string()
                                                            .describe(
                                                                "The logs output from the code interpreter.",
                                                            ),
                                                    })
                                                    .describe(
                                                        "The logs output from the code interpreter.",
                                                    ),
                                                z
                                                    .object({
                                                        /**The type of the output. Always `image`.*/
                                                        type: z
                                                            .literal("image")
                                                            .describe(
                                                                "The type of the output. Always `image`.",
                                                            )
                                                            .default("image"),
                                                        /**The URL of the image output from the code interpreter.*/
                                                        url: z
                                                            .string()
                                                            .describe(
                                                                "The URL of the image output from the code interpreter.",
                                                            ),
                                                    })
                                                    .describe(
                                                        "The image output from the code interpreter.",
                                                    ),
                                            ]),
                                        )
                                        .describe(
                                            "The outputs generated by the code interpreter, such as logs or images.\nCan be null if no outputs are available.\n",
                                        ),
                                    z.null(),
                                ]),
                            })
                            .describe("A tool call to run code.\n"),
                        z
                            .object({
                                /**
                                 * The type of the local shell call. Always `local_shell_call`.
                                 *
                                 */
                                type: z
                                    .literal("local_shell_call")
                                    .describe(
                                        "The type of the local shell call. Always `local_shell_call`.\n",
                                    ),
                                /**
                                 * The unique ID of the local shell call.
                                 *
                                 */
                                id: z.string().describe("The unique ID of the local shell call.\n"),
                                /**
                                 * The unique ID of the local shell tool call generated by the model.
                                 *
                                 */
                                call_id: z
                                    .string()
                                    .describe(
                                        "The unique ID of the local shell tool call generated by the model.\n",
                                    ),
                                /**Execute a shell command on the server.*/
                                action: z
                                    .object({
                                        /**The type of the local shell action. Always `exec`.*/
                                        type: z
                                            .literal("exec")
                                            .describe(
                                                "The type of the local shell action. Always `exec`.",
                                            )
                                            .default("exec"),
                                        /**The command to run.*/
                                        command: z
                                            .array(z.string())
                                            .describe("The command to run."),
                                        timeout_ms: z
                                            .union([
                                                z
                                                    .number()
                                                    .int()
                                                    .describe(
                                                        "Optional timeout in milliseconds for the command.",
                                                    ),
                                                z.null(),
                                            ])
                                            .optional(),
                                        working_directory: z
                                            .union([
                                                z
                                                    .string()
                                                    .describe(
                                                        "Optional working directory to run the command in.",
                                                    ),
                                                z.null(),
                                            ])
                                            .optional(),
                                        /**Environment variables to set for the command.*/
                                        env: z
                                            .record(z.string(), z.string())
                                            .describe(
                                                "Environment variables to set for the command.",
                                            ),
                                        user: z
                                            .union([
                                                z
                                                    .string()
                                                    .describe(
                                                        "Optional user to run the command as.",
                                                    ),
                                                z.null(),
                                            ])
                                            .optional(),
                                    })
                                    .describe("Execute a shell command on the server."),
                                /**
                                 * The status of the local shell call.
                                 *
                                 */
                                status: z
                                    .enum(["in_progress", "completed", "incomplete"])
                                    .describe("The status of the local shell call.\n"),
                            })
                            .describe("A tool call to run a command on the local shell.\n"),
                        z
                            .object({
                                /**The type of the item. Always `shell_call`.*/
                                type: z
                                    .literal("shell_call")
                                    .describe("The type of the item. Always `shell_call`.")
                                    .default("shell_call"),
                                /**The unique ID of the shell tool call. Populated when this item is returned via API.*/
                                id: z
                                    .string()
                                    .describe(
                                        "The unique ID of the shell tool call. Populated when this item is returned via API.",
                                    ),
                                /**The unique ID of the shell tool call generated by the model.*/
                                call_id: z
                                    .string()
                                    .describe(
                                        "The unique ID of the shell tool call generated by the model.",
                                    ),
                                /**The shell commands and limits that describe how to run the tool call.*/
                                action: z
                                    .object({
                                        commands: z.array(
                                            z.string().describe("A list of commands to run."),
                                        ),
                                        timeout_ms: z.union([
                                            z
                                                .number()
                                                .int()
                                                .describe(
                                                    "Optional timeout in milliseconds for the commands.",
                                                ),
                                            z.null(),
                                        ]),
                                        max_output_length: z.union([
                                            z
                                                .number()
                                                .int()
                                                .describe(
                                                    "Optional maximum number of characters to return from each command.",
                                                ),
                                            z.null(),
                                        ]),
                                    })
                                    .describe(
                                        "The shell commands and limits that describe how to run the tool call.",
                                    ),
                                /**The status of the shell call. One of `in_progress`, `completed`, or `incomplete`.*/
                                status: z
                                    .enum(["in_progress", "completed", "incomplete"])
                                    .describe(
                                        "The status of the shell call. One of `in_progress`, `completed`, or `incomplete`.",
                                    ),
                                /**The ID of the entity that created this tool call.*/
                                created_by: z
                                    .string()
                                    .describe("The ID of the entity that created this tool call.")
                                    .optional(),
                            })
                            .describe(
                                "A tool call that executes one or more shell commands in a managed environment.",
                            ),
                        z
                            .object({
                                /**The type of the shell call output. Always `shell_call_output`.*/
                                type: z
                                    .literal("shell_call_output")
                                    .describe(
                                        "The type of the shell call output. Always `shell_call_output`.",
                                    )
                                    .default("shell_call_output"),
                                /**The unique ID of the shell call output. Populated when this item is returned via API.*/
                                id: z
                                    .string()
                                    .describe(
                                        "The unique ID of the shell call output. Populated when this item is returned via API.",
                                    ),
                                /**The unique ID of the shell tool call generated by the model.*/
                                call_id: z
                                    .string()
                                    .describe(
                                        "The unique ID of the shell tool call generated by the model.",
                                    ),
                                /**An array of shell call output contents*/
                                output: z
                                    .array(
                                        z
                                            .object({
                                                stdout: z.string(),
                                                stderr: z.string(),
                                                /**Represents either an exit outcome (with an exit code) or a timeout outcome for a shell call output chunk.*/
                                                outcome: z
                                                    .union([
                                                        z
                                                            .object({
                                                                /**The outcome type. Always `timeout`.*/
                                                                type: z
                                                                    .literal("timeout")
                                                                    .describe(
                                                                        "The outcome type. Always `timeout`.",
                                                                    )
                                                                    .default("timeout"),
                                                            })
                                                            .describe(
                                                                "Indicates that the shell call exceeded its configured time limit.",
                                                            ),
                                                        z
                                                            .object({
                                                                /**The outcome type. Always `exit`.*/
                                                                type: z
                                                                    .literal("exit")
                                                                    .describe(
                                                                        "The outcome type. Always `exit`.",
                                                                    )
                                                                    .default("exit"),
                                                                /**Exit code from the shell process.*/
                                                                exit_code: z
                                                                    .number()
                                                                    .int()
                                                                    .describe(
                                                                        "Exit code from the shell process.",
                                                                    ),
                                                            })
                                                            .describe(
                                                                "Indicates that the shell commands finished and returned an exit code.",
                                                            ),
                                                    ])
                                                    .describe(
                                                        "Represents either an exit outcome (with an exit code) or a timeout outcome for a shell call output chunk.",
                                                    ),
                                                created_by: z.string().optional(),
                                            })
                                            .describe("The content of a shell call output."),
                                    )
                                    .describe("An array of shell call output contents"),
                                max_output_length: z.union([
                                    z
                                        .number()
                                        .int()
                                        .describe(
                                            "The maximum length of the shell command output. This is generated by the model and should be passed back with the raw output.",
                                        ),
                                    z.null(),
                                ]),
                                created_by: z.string().optional(),
                            })
                            .describe("The output of a shell tool call."),
                        z
                            .object({
                                /**The type of the item. Always `apply_patch_call`.*/
                                type: z
                                    .literal("apply_patch_call")
                                    .describe("The type of the item. Always `apply_patch_call`.")
                                    .default("apply_patch_call"),
                                /**The unique ID of the apply patch tool call. Populated when this item is returned via API.*/
                                id: z
                                    .string()
                                    .describe(
                                        "The unique ID of the apply patch tool call. Populated when this item is returned via API.",
                                    ),
                                /**The unique ID of the apply patch tool call generated by the model.*/
                                call_id: z
                                    .string()
                                    .describe(
                                        "The unique ID of the apply patch tool call generated by the model.",
                                    ),
                                /**The status of the apply patch tool call. One of `in_progress` or `completed`.*/
                                status: z
                                    .enum(["in_progress", "completed"])
                                    .describe(
                                        "The status of the apply patch tool call. One of `in_progress` or `completed`.",
                                    ),
                                /**One of the create_file, delete_file, or update_file operations applied via apply_patch.*/
                                operation: z
                                    .union([
                                        z
                                            .object({
                                                /**Create a new file with the provided diff.*/
                                                type: z
                                                    .literal("create_file")
                                                    .describe(
                                                        "Create a new file with the provided diff.",
                                                    )
                                                    .default("create_file"),
                                                /**Path of the file to create.*/
                                                path: z
                                                    .string()
                                                    .describe("Path of the file to create."),
                                                /**Diff to apply.*/
                                                diff: z.string().describe("Diff to apply."),
                                            })
                                            .describe(
                                                "Instruction describing how to create a file via the apply_patch tool.",
                                            ),
                                        z
                                            .object({
                                                /**Delete the specified file.*/
                                                type: z
                                                    .literal("delete_file")
                                                    .describe("Delete the specified file.")
                                                    .default("delete_file"),
                                                /**Path of the file to delete.*/
                                                path: z
                                                    .string()
                                                    .describe("Path of the file to delete."),
                                            })
                                            .describe(
                                                "Instruction describing how to delete a file via the apply_patch tool.",
                                            ),
                                        z
                                            .object({
                                                /**Update an existing file with the provided diff.*/
                                                type: z
                                                    .literal("update_file")
                                                    .describe(
                                                        "Update an existing file with the provided diff.",
                                                    )
                                                    .default("update_file"),
                                                /**Path of the file to update.*/
                                                path: z
                                                    .string()
                                                    .describe("Path of the file to update."),
                                                /**Diff to apply.*/
                                                diff: z.string().describe("Diff to apply."),
                                            })
                                            .describe(
                                                "Instruction describing how to update a file via the apply_patch tool.",
                                            ),
                                    ])
                                    .describe(
                                        "One of the create_file, delete_file, or update_file operations applied via apply_patch.",
                                    ),
                                /**The ID of the entity that created this tool call.*/
                                created_by: z
                                    .string()
                                    .describe("The ID of the entity that created this tool call.")
                                    .optional(),
                            })
                            .describe(
                                "A tool call that applies file diffs by creating, deleting, or updating files.",
                            ),
                        z
                            .object({
                                /**The type of the item. Always `apply_patch_call_output`.*/
                                type: z
                                    .literal("apply_patch_call_output")
                                    .describe(
                                        "The type of the item. Always `apply_patch_call_output`.",
                                    )
                                    .default("apply_patch_call_output"),
                                /**The unique ID of the apply patch tool call output. Populated when this item is returned via API.*/
                                id: z
                                    .string()
                                    .describe(
                                        "The unique ID of the apply patch tool call output. Populated when this item is returned via API.",
                                    ),
                                /**The unique ID of the apply patch tool call generated by the model.*/
                                call_id: z
                                    .string()
                                    .describe(
                                        "The unique ID of the apply patch tool call generated by the model.",
                                    ),
                                /**The status of the apply patch tool call output. One of `completed` or `failed`.*/
                                status: z
                                    .enum(["completed", "failed"])
                                    .describe(
                                        "The status of the apply patch tool call output. One of `completed` or `failed`.",
                                    ),
                                output: z
                                    .union([
                                        z
                                            .string()
                                            .describe(
                                                "Optional textual output returned by the apply patch tool.",
                                            ),
                                        z.null(),
                                    ])
                                    .optional(),
                                /**The ID of the entity that created this tool call output.*/
                                created_by: z
                                    .string()
                                    .describe(
                                        "The ID of the entity that created this tool call output.",
                                    )
                                    .optional(),
                            })
                            .describe("The output emitted by an apply patch tool call."),
                        z
                            .object({
                                /**
                                 * The type of the item. Always `mcp_call`.
                                 *
                                 */
                                type: z
                                    .literal("mcp_call")
                                    .describe("The type of the item. Always `mcp_call`.\n"),
                                /**
                                 * The unique ID of the tool call.
                                 *
                                 */
                                id: z.string().describe("The unique ID of the tool call.\n"),
                                /**
                                 * The label of the MCP server running the tool.
                                 *
                                 */
                                server_label: z
                                    .string()
                                    .describe("The label of the MCP server running the tool.\n"),
                                /**
                                 * The name of the tool that was run.
                                 *
                                 */
                                name: z.string().describe("The name of the tool that was run.\n"),
                                /**
                                 * A JSON string of the arguments passed to the tool.
                                 *
                                 */
                                arguments: z
                                    .string()
                                    .describe(
                                        "A JSON string of the arguments passed to the tool.\n",
                                    ),
                                output: z
                                    .union([
                                        z.string().describe("The output from the tool call.\n"),
                                        z.null(),
                                    ])
                                    .optional(),
                                error: z
                                    .union([
                                        z
                                            .string()
                                            .describe("The error from the tool call, if any.\n"),
                                        z.null(),
                                    ])
                                    .optional(),
                                /**
                                 * The status of the tool call. One of `in_progress`, `completed`, `incomplete`, `calling`, or `failed`.
                                 *
                                 */
                                status: z
                                    .enum([
                                        "in_progress",
                                        "completed",
                                        "incomplete",
                                        "calling",
                                        "failed",
                                    ])
                                    .describe(
                                        "The status of the tool call. One of `in_progress`, `completed`, `incomplete`, `calling`, or `failed`.\n",
                                    )
                                    .optional(),
                                approval_request_id: z
                                    .union([
                                        z
                                            .string()
                                            .describe(
                                                "Unique identifier for the MCP tool call approval request.\nInclude this value in a subsequent `mcp_approval_response` input to approve or reject the corresponding tool call.\n",
                                            ),
                                        z.null(),
                                    ])
                                    .optional(),
                            })
                            .describe("An invocation of a tool on an MCP server.\n"),
                        z
                            .object({
                                /**
                                 * The type of the item. Always `mcp_list_tools`.
                                 *
                                 */
                                type: z
                                    .literal("mcp_list_tools")
                                    .describe("The type of the item. Always `mcp_list_tools`.\n"),
                                /**
                                 * The unique ID of the list.
                                 *
                                 */
                                id: z.string().describe("The unique ID of the list.\n"),
                                /**
                                 * The label of the MCP server.
                                 *
                                 */
                                server_label: z.string().describe("The label of the MCP server.\n"),
                                /**
                                 * The tools available on the server.
                                 *
                                 */
                                tools: z
                                    .array(
                                        z
                                            .object({
                                                /**
                                                 * The name of the tool.
                                                 *
                                                 */
                                                name: z
                                                    .string()
                                                    .describe("The name of the tool.\n"),
                                                description: z
                                                    .union([
                                                        z
                                                            .string()
                                                            .describe(
                                                                "The description of the tool.\n",
                                                            ),
                                                        z.null(),
                                                    ])
                                                    .optional(),
                                                /**
                                                 * The JSON schema describing the tool's input.
                                                 *
                                                 */
                                                input_schema: z
                                                    .record(z.string(), z.unknown())
                                                    .describe(
                                                        "The JSON schema describing the tool's input.\n",
                                                    ),
                                                annotations: z
                                                    .union([
                                                        z
                                                            .record(z.string(), z.unknown())
                                                            .describe(
                                                                "Additional annotations about the tool.\n",
                                                            ),
                                                        z.null(),
                                                    ])
                                                    .optional(),
                                            })
                                            .describe("A tool available on an MCP server.\n"),
                                    )
                                    .describe("The tools available on the server.\n"),
                                error: z
                                    .union([
                                        z
                                            .string()
                                            .describe(
                                                "Error message if the server could not list tools.\n",
                                            ),
                                        z.null(),
                                    ])
                                    .optional(),
                            })
                            .describe("A list of tools available on an MCP server.\n"),
                        z
                            .object({
                                /**
                                 * The type of the item. Always `mcp_approval_request`.
                                 *
                                 */
                                type: z
                                    .literal("mcp_approval_request")
                                    .describe(
                                        "The type of the item. Always `mcp_approval_request`.\n",
                                    ),
                                /**
                                 * The unique ID of the approval request.
                                 *
                                 */
                                id: z.string().describe("The unique ID of the approval request.\n"),
                                /**
                                 * The label of the MCP server making the request.
                                 *
                                 */
                                server_label: z
                                    .string()
                                    .describe("The label of the MCP server making the request.\n"),
                                /**
                                 * The name of the tool to run.
                                 *
                                 */
                                name: z.string().describe("The name of the tool to run.\n"),
                                /**
                                 * A JSON string of arguments for the tool.
                                 *
                                 */
                                arguments: z
                                    .string()
                                    .describe("A JSON string of arguments for the tool.\n"),
                            })
                            .describe("A request for human approval of a tool invocation.\n"),
                        z
                            .object({
                                /**
                                 * The type of the custom tool call. Always `custom_tool_call`.
                                 *
                                 */
                                type: z
                                    .literal("custom_tool_call")
                                    .describe(
                                        "The type of the custom tool call. Always `custom_tool_call`.\n",
                                    ),
                                /**
                                 * The unique ID of the custom tool call in the OpenAI platform.
                                 *
                                 */
                                id: z
                                    .string()
                                    .describe(
                                        "The unique ID of the custom tool call in the OpenAI platform.\n",
                                    )
                                    .optional(),
                                /**
                                 * An identifier used to map this custom tool call to a tool call output.
                                 *
                                 */
                                call_id: z
                                    .string()
                                    .describe(
                                        "An identifier used to map this custom tool call to a tool call output.\n",
                                    ),
                                /**
                                 * The name of the custom tool being called.
                                 *
                                 */
                                name: z
                                    .string()
                                    .describe("The name of the custom tool being called.\n"),
                                /**
                                 * The input for the custom tool call generated by the model.
                                 *
                                 */
                                input: z
                                    .string()
                                    .describe(
                                        "The input for the custom tool call generated by the model.\n",
                                    ),
                            })
                            .describe("A call to a custom tool created by the model.\n"),
                    ]),
                )
                .describe(
                    "An array of content items generated by the model.\n\n- The length and order of items in the `output` array is dependent\n  on the model's response.\n- Rather than accessing the first item in the `output` array and\n  assuming it's an `assistant` message with the content generated by\n  the model, you might consider using the `output_text` property where\n  supported in SDKs.\n",
                ),
            instructions: z.union([
                z
                    .union([
                        z
                            .string()
                            .describe(
                                "A text input to the model, equivalent to a text input with the\n`developer` role.\n",
                            ),
                        z
                            .array(
                                z.union([
                                    z
                                        .object({
                                            /**
                                             * The role of the message input. One of `user`, `assistant`, `system`, or
                                             * `developer`.
                                             *
                                             */
                                            role: z
                                                .enum(["user", "assistant", "system", "developer"])
                                                .describe(
                                                    "The role of the message input. One of `user`, `assistant`, `system`, or\n`developer`.\n",
                                                ),
                                            /**
                                             * Text, image, or audio input to the model, used to generate a response.
                                             * Can also contain previous assistant responses.
                                             *
                                             */
                                            content: z
                                                .union([
                                                    z
                                                        .string()
                                                        .describe("A text input to the model.\n"),
                                                    z
                                                        .array(
                                                            z.union([
                                                                z
                                                                    .object({
                                                                        /**The type of the input item. Always `input_text`.*/
                                                                        type: z
                                                                            .literal("input_text")
                                                                            .describe(
                                                                                "The type of the input item. Always `input_text`.",
                                                                            )
                                                                            .default("input_text"),
                                                                        /**The text input to the model.*/
                                                                        text: z
                                                                            .string()
                                                                            .describe(
                                                                                "The text input to the model.",
                                                                            ),
                                                                    })
                                                                    .describe(
                                                                        "A text input to the model.",
                                                                    ),
                                                                z
                                                                    .object({
                                                                        /**The type of the input item. Always `input_image`.*/
                                                                        type: z
                                                                            .literal("input_image")
                                                                            .describe(
                                                                                "The type of the input item. Always `input_image`.",
                                                                            )
                                                                            .default("input_image"),
                                                                        image_url: z
                                                                            .union([
                                                                                z
                                                                                    .string()
                                                                                    .describe(
                                                                                        "The URL of the image to be sent to the model. A fully qualified URL or base64 encoded image in a data URL.",
                                                                                    ),
                                                                                z.null(),
                                                                            ])
                                                                            .optional(),
                                                                        file_id: z
                                                                            .union([
                                                                                z
                                                                                    .string()
                                                                                    .describe(
                                                                                        "The ID of the file to be sent to the model.",
                                                                                    ),
                                                                                z.null(),
                                                                            ])
                                                                            .optional(),
                                                                        /**The detail level of the image to be sent to the model. One of `high`, `low`, or `auto`. Defaults to `auto`.*/
                                                                        detail: z
                                                                            .enum([
                                                                                "low",
                                                                                "high",
                                                                                "auto",
                                                                            ])
                                                                            .describe(
                                                                                "The detail level of the image to be sent to the model. One of `high`, `low`, or `auto`. Defaults to `auto`.",
                                                                            ),
                                                                    })
                                                                    .describe(
                                                                        "An image input to the model. Learn about [image inputs](https://platform.openai.com/docs/guides/vision).",
                                                                    ),
                                                                z
                                                                    .object({
                                                                        /**The type of the input item. Always `input_file`.*/
                                                                        type: z
                                                                            .literal("input_file")
                                                                            .describe(
                                                                                "The type of the input item. Always `input_file`.",
                                                                            )
                                                                            .default("input_file"),
                                                                        file_id: z
                                                                            .union([
                                                                                z
                                                                                    .string()
                                                                                    .describe(
                                                                                        "The ID of the file to be sent to the model.",
                                                                                    ),
                                                                                z.null(),
                                                                            ])
                                                                            .optional(),
                                                                        /**The name of the file to be sent to the model.*/
                                                                        filename: z
                                                                            .string()
                                                                            .describe(
                                                                                "The name of the file to be sent to the model.",
                                                                            )
                                                                            .optional(),
                                                                        /**The URL of the file to be sent to the model.*/
                                                                        file_url: z
                                                                            .string()
                                                                            .describe(
                                                                                "The URL of the file to be sent to the model.",
                                                                            )
                                                                            .optional(),
                                                                        /**
                                                                         * The content of the file to be sent to the model.
                                                                         *
                                                                         */
                                                                        file_data: z
                                                                            .string()
                                                                            .describe(
                                                                                "The content of the file to be sent to the model.\n",
                                                                            )
                                                                            .optional(),
                                                                    })
                                                                    .describe(
                                                                        "A file input to the model.",
                                                                    ),
                                                            ]),
                                                        )
                                                        .describe(
                                                            "A list of one or many input items to the model, containing different content \ntypes.\n",
                                                        ),
                                                ])
                                                .describe(
                                                    "Text, image, or audio input to the model, used to generate a response.\nCan also contain previous assistant responses.\n",
                                                ),
                                            /**
                                             * The type of the message input. Always `message`.
                                             *
                                             */
                                            type: z
                                                .literal("message")
                                                .describe(
                                                    "The type of the message input. Always `message`.\n",
                                                )
                                                .optional(),
                                        })
                                        .describe(
                                            "A message input to the model with a role indicating instruction following\nhierarchy. Instructions given with the `developer` or `system` role take\nprecedence over instructions given with the `user` role. Messages with the\n`assistant` role are presumed to have been generated by the model in previous\ninteractions.\n",
                                        ),
                                    z
                                        .record(z.string(), z.unknown())
                                        .and(
                                            z.union([
                                                z
                                                    .object({
                                                        /**
                                                         * The type of the message input. Always set to `message`.
                                                         *
                                                         */
                                                        type: z
                                                            .literal("message")
                                                            .describe(
                                                                "The type of the message input. Always set to `message`.\n",
                                                            )
                                                            .optional(),
                                                        /**
                                                         * The role of the message input. One of `user`, `system`, or `developer`.
                                                         *
                                                         */
                                                        role: z
                                                            .enum(["user", "system", "developer"])
                                                            .describe(
                                                                "The role of the message input. One of `user`, `system`, or `developer`.\n",
                                                            ),
                                                        /**
                                                         * The status of item. One of `in_progress`, `completed`, or
                                                         * `incomplete`. Populated when items are returned via API.
                                                         *
                                                         */
                                                        status: z
                                                            .enum([
                                                                "in_progress",
                                                                "completed",
                                                                "incomplete",
                                                            ])
                                                            .describe(
                                                                "The status of item. One of `in_progress`, `completed`, or\n`incomplete`. Populated when items are returned via API.\n",
                                                            )
                                                            .optional(),
                                                        /**
                                                         * A list of one or many input items to the model, containing different content
                                                         * types.
                                                         *
                                                         */
                                                        content: z
                                                            .array(
                                                                z.union([
                                                                    z
                                                                        .object({
                                                                            /**The type of the input item. Always `input_text`.*/
                                                                            type: z
                                                                                .literal(
                                                                                    "input_text",
                                                                                )
                                                                                .describe(
                                                                                    "The type of the input item. Always `input_text`.",
                                                                                )
                                                                                .default(
                                                                                    "input_text",
                                                                                ),
                                                                            /**The text input to the model.*/
                                                                            text: z
                                                                                .string()
                                                                                .describe(
                                                                                    "The text input to the model.",
                                                                                ),
                                                                        })
                                                                        .describe(
                                                                            "A text input to the model.",
                                                                        ),
                                                                    z
                                                                        .object({
                                                                            /**The type of the input item. Always `input_image`.*/
                                                                            type: z
                                                                                .literal(
                                                                                    "input_image",
                                                                                )
                                                                                .describe(
                                                                                    "The type of the input item. Always `input_image`.",
                                                                                )
                                                                                .default(
                                                                                    "input_image",
                                                                                ),
                                                                            image_url: z
                                                                                .union([
                                                                                    z
                                                                                        .string()
                                                                                        .describe(
                                                                                            "The URL of the image to be sent to the model. A fully qualified URL or base64 encoded image in a data URL.",
                                                                                        ),
                                                                                    z.null(),
                                                                                ])
                                                                                .optional(),
                                                                            file_id: z
                                                                                .union([
                                                                                    z
                                                                                        .string()
                                                                                        .describe(
                                                                                            "The ID of the file to be sent to the model.",
                                                                                        ),
                                                                                    z.null(),
                                                                                ])
                                                                                .optional(),
                                                                            /**The detail level of the image to be sent to the model. One of `high`, `low`, or `auto`. Defaults to `auto`.*/
                                                                            detail: z
                                                                                .enum([
                                                                                    "low",
                                                                                    "high",
                                                                                    "auto",
                                                                                ])
                                                                                .describe(
                                                                                    "The detail level of the image to be sent to the model. One of `high`, `low`, or `auto`. Defaults to `auto`.",
                                                                                ),
                                                                        })
                                                                        .describe(
                                                                            "An image input to the model. Learn about [image inputs](https://platform.openai.com/docs/guides/vision).",
                                                                        ),
                                                                    z
                                                                        .object({
                                                                            /**The type of the input item. Always `input_file`.*/
                                                                            type: z
                                                                                .literal(
                                                                                    "input_file",
                                                                                )
                                                                                .describe(
                                                                                    "The type of the input item. Always `input_file`.",
                                                                                )
                                                                                .default(
                                                                                    "input_file",
                                                                                ),
                                                                            file_id: z
                                                                                .union([
                                                                                    z
                                                                                        .string()
                                                                                        .describe(
                                                                                            "The ID of the file to be sent to the model.",
                                                                                        ),
                                                                                    z.null(),
                                                                                ])
                                                                                .optional(),
                                                                            /**The name of the file to be sent to the model.*/
                                                                            filename: z
                                                                                .string()
                                                                                .describe(
                                                                                    "The name of the file to be sent to the model.",
                                                                                )
                                                                                .optional(),
                                                                            /**The URL of the file to be sent to the model.*/
                                                                            file_url: z
                                                                                .string()
                                                                                .describe(
                                                                                    "The URL of the file to be sent to the model.",
                                                                                )
                                                                                .optional(),
                                                                            /**
                                                                             * The content of the file to be sent to the model.
                                                                             *
                                                                             */
                                                                            file_data: z
                                                                                .string()
                                                                                .describe(
                                                                                    "The content of the file to be sent to the model.\n",
                                                                                )
                                                                                .optional(),
                                                                        })
                                                                        .describe(
                                                                            "A file input to the model.",
                                                                        ),
                                                                ]),
                                                            )
                                                            .describe(
                                                                "A list of one or many input items to the model, containing different content \ntypes.\n",
                                                            ),
                                                    })
                                                    .describe(
                                                        "A message input to the model with a role indicating instruction following\nhierarchy. Instructions given with the `developer` or `system` role take\nprecedence over instructions given with the `user` role.\n",
                                                    ),
                                                z
                                                    .object({
                                                        /**
                                                         * The unique ID of the output message.
                                                         *
                                                         */
                                                        id: z
                                                            .string()
                                                            .describe(
                                                                "The unique ID of the output message.\n",
                                                            ),
                                                        /**
                                                         * The type of the output message. Always `message`.
                                                         *
                                                         */
                                                        type: z
                                                            .literal("message")
                                                            .describe(
                                                                "The type of the output message. Always `message`.\n",
                                                            ),
                                                        /**
                                                         * The role of the output message. Always `assistant`.
                                                         *
                                                         */
                                                        role: z
                                                            .literal("assistant")
                                                            .describe(
                                                                "The role of the output message. Always `assistant`.\n",
                                                            ),
                                                        /**
                                                         * The content of the output message.
                                                         *
                                                         */
                                                        content: z
                                                            .array(
                                                                z.union([
                                                                    z
                                                                        .object({
                                                                            /**The type of the output text. Always `output_text`.*/
                                                                            type: z
                                                                                .literal(
                                                                                    "output_text",
                                                                                )
                                                                                .describe(
                                                                                    "The type of the output text. Always `output_text`.",
                                                                                )
                                                                                .default(
                                                                                    "output_text",
                                                                                ),
                                                                            /**The text output from the model.*/
                                                                            text: z
                                                                                .string()
                                                                                .describe(
                                                                                    "The text output from the model.",
                                                                                ),
                                                                            /**The annotations of the text output.*/
                                                                            annotations: z
                                                                                .array(
                                                                                    z.union([
                                                                                        z
                                                                                            .object(
                                                                                                {
                                                                                                    /**The type of the file citation. Always `file_citation`.*/
                                                                                                    type: z
                                                                                                        .literal(
                                                                                                            "file_citation",
                                                                                                        )
                                                                                                        .describe(
                                                                                                            "The type of the file citation. Always `file_citation`.",
                                                                                                        )
                                                                                                        .default(
                                                                                                            "file_citation",
                                                                                                        ),
                                                                                                    /**The ID of the file.*/
                                                                                                    file_id:
                                                                                                        z
                                                                                                            .string()
                                                                                                            .describe(
                                                                                                                "The ID of the file.",
                                                                                                            ),
                                                                                                    /**The index of the file in the list of files.*/
                                                                                                    index: z
                                                                                                        .number()
                                                                                                        .int()
                                                                                                        .describe(
                                                                                                            "The index of the file in the list of files.",
                                                                                                        ),
                                                                                                    /**The filename of the file cited.*/
                                                                                                    filename:
                                                                                                        z
                                                                                                            .string()
                                                                                                            .describe(
                                                                                                                "The filename of the file cited.",
                                                                                                            ),
                                                                                                },
                                                                                            )
                                                                                            .describe(
                                                                                                "A citation to a file.",
                                                                                            ),
                                                                                        z
                                                                                            .object(
                                                                                                {
                                                                                                    /**The type of the URL citation. Always `url_citation`.*/
                                                                                                    type: z
                                                                                                        .literal(
                                                                                                            "url_citation",
                                                                                                        )
                                                                                                        .describe(
                                                                                                            "The type of the URL citation. Always `url_citation`.",
                                                                                                        )
                                                                                                        .default(
                                                                                                            "url_citation",
                                                                                                        ),
                                                                                                    /**The URL of the web resource.*/
                                                                                                    url: z
                                                                                                        .string()
                                                                                                        .describe(
                                                                                                            "The URL of the web resource.",
                                                                                                        ),
                                                                                                    /**The index of the first character of the URL citation in the message.*/
                                                                                                    start_index:
                                                                                                        z
                                                                                                            .number()
                                                                                                            .int()
                                                                                                            .describe(
                                                                                                                "The index of the first character of the URL citation in the message.",
                                                                                                            ),
                                                                                                    /**The index of the last character of the URL citation in the message.*/
                                                                                                    end_index:
                                                                                                        z
                                                                                                            .number()
                                                                                                            .int()
                                                                                                            .describe(
                                                                                                                "The index of the last character of the URL citation in the message.",
                                                                                                            ),
                                                                                                    /**The title of the web resource.*/
                                                                                                    title: z
                                                                                                        .string()
                                                                                                        .describe(
                                                                                                            "The title of the web resource.",
                                                                                                        ),
                                                                                                },
                                                                                            )
                                                                                            .describe(
                                                                                                "A citation for a web resource used to generate a model response.",
                                                                                            ),
                                                                                        z
                                                                                            .object(
                                                                                                {
                                                                                                    /**The type of the container file citation. Always `container_file_citation`.*/
                                                                                                    type: z
                                                                                                        .literal(
                                                                                                            "container_file_citation",
                                                                                                        )
                                                                                                        .describe(
                                                                                                            "The type of the container file citation. Always `container_file_citation`.",
                                                                                                        )
                                                                                                        .default(
                                                                                                            "container_file_citation",
                                                                                                        ),
                                                                                                    /**The ID of the container file.*/
                                                                                                    container_id:
                                                                                                        z
                                                                                                            .string()
                                                                                                            .describe(
                                                                                                                "The ID of the container file.",
                                                                                                            ),
                                                                                                    /**The ID of the file.*/
                                                                                                    file_id:
                                                                                                        z
                                                                                                            .string()
                                                                                                            .describe(
                                                                                                                "The ID of the file.",
                                                                                                            ),
                                                                                                    /**The index of the first character of the container file citation in the message.*/
                                                                                                    start_index:
                                                                                                        z
                                                                                                            .number()
                                                                                                            .int()
                                                                                                            .describe(
                                                                                                                "The index of the first character of the container file citation in the message.",
                                                                                                            ),
                                                                                                    /**The index of the last character of the container file citation in the message.*/
                                                                                                    end_index:
                                                                                                        z
                                                                                                            .number()
                                                                                                            .int()
                                                                                                            .describe(
                                                                                                                "The index of the last character of the container file citation in the message.",
                                                                                                            ),
                                                                                                    /**The filename of the container file cited.*/
                                                                                                    filename:
                                                                                                        z
                                                                                                            .string()
                                                                                                            .describe(
                                                                                                                "The filename of the container file cited.",
                                                                                                            ),
                                                                                                },
                                                                                            )
                                                                                            .describe(
                                                                                                "A citation for a container file used to generate a model response.",
                                                                                            ),
                                                                                        z
                                                                                            .object(
                                                                                                {
                                                                                                    /**
                                                                                                     * The type of the file path. Always `file_path`.
                                                                                                     *
                                                                                                     */
                                                                                                    type: z
                                                                                                        .literal(
                                                                                                            "file_path",
                                                                                                        )
                                                                                                        .describe(
                                                                                                            "The type of the file path. Always `file_path`.\n",
                                                                                                        ),
                                                                                                    /**
                                                                                                     * The ID of the file.
                                                                                                     *
                                                                                                     */
                                                                                                    file_id:
                                                                                                        z
                                                                                                            .string()
                                                                                                            .describe(
                                                                                                                "The ID of the file.\n",
                                                                                                            ),
                                                                                                    /**
                                                                                                     * The index of the file in the list of files.
                                                                                                     *
                                                                                                     */
                                                                                                    index: z
                                                                                                        .number()
                                                                                                        .int()
                                                                                                        .describe(
                                                                                                            "The index of the file in the list of files.\n",
                                                                                                        ),
                                                                                                },
                                                                                            )
                                                                                            .describe(
                                                                                                "A path to a file.\n",
                                                                                            ),
                                                                                    ]),
                                                                                )
                                                                                .describe(
                                                                                    "The annotations of the text output.",
                                                                                ),
                                                                            logprobs: z
                                                                                .array(
                                                                                    z
                                                                                        .object({
                                                                                            token: z.string(),
                                                                                            logprob:
                                                                                                z.number(),
                                                                                            bytes: z.array(
                                                                                                z
                                                                                                    .number()
                                                                                                    .int(),
                                                                                            ),
                                                                                            top_logprobs:
                                                                                                z.array(
                                                                                                    z
                                                                                                        .object(
                                                                                                            {
                                                                                                                token: z.string(),
                                                                                                                logprob:
                                                                                                                    z.number(),
                                                                                                                bytes: z.array(
                                                                                                                    z
                                                                                                                        .number()
                                                                                                                        .int(),
                                                                                                                ),
                                                                                                            },
                                                                                                        )
                                                                                                        .describe(
                                                                                                            "The top log probability of a token.",
                                                                                                        ),
                                                                                                ),
                                                                                        })
                                                                                        .describe(
                                                                                            "The log probability of a token.",
                                                                                        ),
                                                                                )
                                                                                .optional(),
                                                                        })
                                                                        .describe(
                                                                            "A text output from the model.",
                                                                        ),
                                                                    z
                                                                        .object({
                                                                            /**The type of the refusal. Always `refusal`.*/
                                                                            type: z
                                                                                .literal("refusal")
                                                                                .describe(
                                                                                    "The type of the refusal. Always `refusal`.",
                                                                                )
                                                                                .default("refusal"),
                                                                            /**The refusal explanation from the model.*/
                                                                            refusal: z
                                                                                .string()
                                                                                .describe(
                                                                                    "The refusal explanation from the model.",
                                                                                ),
                                                                        })
                                                                        .describe(
                                                                            "A refusal from the model.",
                                                                        ),
                                                                ]),
                                                            )
                                                            .describe(
                                                                "The content of the output message.\n",
                                                            ),
                                                        /**
                                                         * The status of the message input. One of `in_progress`, `completed`, or
                                                         * `incomplete`. Populated when input items are returned via API.
                                                         *
                                                         */
                                                        status: z
                                                            .enum([
                                                                "in_progress",
                                                                "completed",
                                                                "incomplete",
                                                            ])
                                                            .describe(
                                                                "The status of the message input. One of `in_progress`, `completed`, or\n`incomplete`. Populated when input items are returned via API.\n",
                                                            ),
                                                    })
                                                    .describe(
                                                        "An output message from the model.\n",
                                                    ),
                                                z
                                                    .object({
                                                        /**
                                                         * The unique ID of the file search tool call.
                                                         *
                                                         */
                                                        id: z
                                                            .string()
                                                            .describe(
                                                                "The unique ID of the file search tool call.\n",
                                                            ),
                                                        /**
                                                         * The type of the file search tool call. Always `file_search_call`.
                                                         *
                                                         */
                                                        type: z
                                                            .literal("file_search_call")
                                                            .describe(
                                                                "The type of the file search tool call. Always `file_search_call`.\n",
                                                            ),
                                                        /**
                                                         * The status of the file search tool call. One of `in_progress`,
                                                         * `searching`, `incomplete` or `failed`,
                                                         *
                                                         */
                                                        status: z
                                                            .enum([
                                                                "in_progress",
                                                                "searching",
                                                                "completed",
                                                                "incomplete",
                                                                "failed",
                                                            ])
                                                            .describe(
                                                                "The status of the file search tool call. One of `in_progress`,\n`searching`, `incomplete` or `failed`,\n",
                                                            ),
                                                        /**
                                                         * The queries used to search for files.
                                                         *
                                                         */
                                                        queries: z
                                                            .array(z.string())
                                                            .describe(
                                                                "The queries used to search for files.\n",
                                                            ),
                                                        results: z
                                                            .union([
                                                                z
                                                                    .array(
                                                                        z.object({
                                                                            /**
                                                                             * The unique ID of the file.
                                                                             *
                                                                             */
                                                                            file_id: z
                                                                                .string()
                                                                                .describe(
                                                                                    "The unique ID of the file.\n",
                                                                                )
                                                                                .optional(),
                                                                            /**
                                                                             * The text that was retrieved from the file.
                                                                             *
                                                                             */
                                                                            text: z
                                                                                .string()
                                                                                .describe(
                                                                                    "The text that was retrieved from the file.\n",
                                                                                )
                                                                                .optional(),
                                                                            /**
                                                                             * The name of the file.
                                                                             *
                                                                             */
                                                                            filename: z
                                                                                .string()
                                                                                .describe(
                                                                                    "The name of the file.\n",
                                                                                )
                                                                                .optional(),
                                                                            attributes: z
                                                                                .union([
                                                                                    z
                                                                                        .record(
                                                                                            z.string(),
                                                                                            z.union(
                                                                                                [
                                                                                                    z
                                                                                                        .string()
                                                                                                        .max(
                                                                                                            512,
                                                                                                        ),
                                                                                                    z.number(),
                                                                                                    z.boolean(),
                                                                                                ],
                                                                                            ),
                                                                                        )
                                                                                        .describe(
                                                                                            "Set of 16 key-value pairs that can be attached to an object. This can be\nuseful for storing additional information about the object in a structured\nformat, and querying for objects via API or the dashboard. Keys are strings\nwith a maximum length of 64 characters. Values are strings with a maximum\nlength of 512 characters, booleans, or numbers.\n",
                                                                                        ),
                                                                                    z.null(),
                                                                                ])
                                                                                .optional(),
                                                                            /**
                                                                             * The relevance score of the file - a value between 0 and 1.
                                                                             *
                                                                             */
                                                                            score: z
                                                                                .number()
                                                                                .describe(
                                                                                    "The relevance score of the file - a value between 0 and 1.\n",
                                                                                )
                                                                                .optional(),
                                                                        }),
                                                                    )
                                                                    .describe(
                                                                        "The results of the file search tool call.\n",
                                                                    ),
                                                                z.null(),
                                                            ])
                                                            .optional(),
                                                    })
                                                    .describe(
                                                        "The results of a file search tool call. See the\n[file search guide](https://platform.openai.com/docs/guides/tools-file-search) for more information.\n",
                                                    ),
                                                z
                                                    .object({
                                                        /**The type of the computer call. Always `computer_call`.*/
                                                        type: z
                                                            .literal("computer_call")
                                                            .describe(
                                                                "The type of the computer call. Always `computer_call`.",
                                                            )
                                                            .default("computer_call"),
                                                        /**The unique ID of the computer call.*/
                                                        id: z
                                                            .string()
                                                            .describe(
                                                                "The unique ID of the computer call.",
                                                            ),
                                                        /**
                                                         * An identifier used when responding to the tool call with output.
                                                         *
                                                         */
                                                        call_id: z
                                                            .string()
                                                            .describe(
                                                                "An identifier used when responding to the tool call with output.\n",
                                                            ),
                                                        action: z.union([
                                                            z
                                                                .object({
                                                                    /**Specifies the event type. For a click action, this property is always `click`.*/
                                                                    type: z
                                                                        .literal("click")
                                                                        .describe(
                                                                            "Specifies the event type. For a click action, this property is always `click`.",
                                                                        )
                                                                        .default("click"),
                                                                    /**Indicates which mouse button was pressed during the click. One of `left`, `right`, `wheel`, `back`, or `forward`.*/
                                                                    button: z
                                                                        .enum([
                                                                            "left",
                                                                            "right",
                                                                            "wheel",
                                                                            "back",
                                                                            "forward",
                                                                        ])
                                                                        .describe(
                                                                            "Indicates which mouse button was pressed during the click. One of `left`, `right`, `wheel`, `back`, or `forward`.",
                                                                        ),
                                                                    /**The x-coordinate where the click occurred.*/
                                                                    x: z
                                                                        .number()
                                                                        .int()
                                                                        .describe(
                                                                            "The x-coordinate where the click occurred.",
                                                                        ),
                                                                    /**The y-coordinate where the click occurred.*/
                                                                    y: z
                                                                        .number()
                                                                        .int()
                                                                        .describe(
                                                                            "The y-coordinate where the click occurred.",
                                                                        ),
                                                                })
                                                                .describe("A click action."),
                                                            z
                                                                .object({
                                                                    /**Specifies the event type. For a double click action, this property is always set to `double_click`.*/
                                                                    type: z
                                                                        .literal("double_click")
                                                                        .describe(
                                                                            "Specifies the event type. For a double click action, this property is always set to `double_click`.",
                                                                        )
                                                                        .default("double_click"),
                                                                    /**The x-coordinate where the double click occurred.*/
                                                                    x: z
                                                                        .number()
                                                                        .int()
                                                                        .describe(
                                                                            "The x-coordinate where the double click occurred.",
                                                                        ),
                                                                    /**The y-coordinate where the double click occurred.*/
                                                                    y: z
                                                                        .number()
                                                                        .int()
                                                                        .describe(
                                                                            "The y-coordinate where the double click occurred.",
                                                                        ),
                                                                })
                                                                .describe("A double click action."),
                                                            z
                                                                .object({
                                                                    /**
                                                                     * Specifies the event type. For a drag action, this property is
                                                                     * always set to `drag`.
                                                                     *
                                                                     */
                                                                    type: z
                                                                        .literal("drag")
                                                                        .describe(
                                                                            "Specifies the event type. For a drag action, this property is \nalways set to `drag`.\n",
                                                                        )
                                                                        .default("drag"),
                                                                    /**
                                                                     * An array of coordinates representing the path of the drag action. Coordinates will appear as an array
                                                                     * of objects, eg
                                                                     * ```
                                                                     * [
                                                                     *   { x: 100, y: 200 },
                                                                     *   { x: 200, y: 300 }
                                                                     * ]
                                                                     * ```
                                                                     *
                                                                     */
                                                                    path: z
                                                                        .array(
                                                                            z
                                                                                .object({
                                                                                    /**The x-coordinate.*/
                                                                                    x: z
                                                                                        .number()
                                                                                        .int()
                                                                                        .describe(
                                                                                            "The x-coordinate.",
                                                                                        ),
                                                                                    /**The y-coordinate.*/
                                                                                    y: z
                                                                                        .number()
                                                                                        .int()
                                                                                        .describe(
                                                                                            "The y-coordinate.",
                                                                                        ),
                                                                                })
                                                                                .describe(
                                                                                    "An x/y coordinate pair, e.g. `{ x: 100, y: 200 }`.",
                                                                                ),
                                                                        )
                                                                        .describe(
                                                                            "An array of coordinates representing the path of the drag action. Coordinates will appear as an array\nof objects, eg\n```\n[\n  { x: 100, y: 200 },\n  { x: 200, y: 300 }\n]\n```\n",
                                                                        ),
                                                                })
                                                                .describe("A drag action.\n"),
                                                            z
                                                                .object({
                                                                    /**Specifies the event type. For a keypress action, this property is always set to `keypress`.*/
                                                                    type: z
                                                                        .literal("keypress")
                                                                        .describe(
                                                                            "Specifies the event type. For a keypress action, this property is always set to `keypress`.",
                                                                        )
                                                                        .default("keypress"),
                                                                    /**The combination of keys the model is requesting to be pressed. This is an array of strings, each representing a key.*/
                                                                    keys: z
                                                                        .array(
                                                                            z
                                                                                .string()
                                                                                .describe(
                                                                                    "One of the keys the model is requesting to be pressed.",
                                                                                ),
                                                                        )
                                                                        .describe(
                                                                            "The combination of keys the model is requesting to be pressed. This is an array of strings, each representing a key.",
                                                                        ),
                                                                })
                                                                .describe(
                                                                    "A collection of keypresses the model would like to perform.",
                                                                ),
                                                            z
                                                                .object({
                                                                    /**
                                                                     * Specifies the event type. For a move action, this property is
                                                                     * always set to `move`.
                                                                     *
                                                                     */
                                                                    type: z
                                                                        .literal("move")
                                                                        .describe(
                                                                            "Specifies the event type. For a move action, this property is \nalways set to `move`.\n",
                                                                        )
                                                                        .default("move"),
                                                                    /**
                                                                     * The x-coordinate to move to.
                                                                     *
                                                                     */
                                                                    x: z
                                                                        .number()
                                                                        .int()
                                                                        .describe(
                                                                            "The x-coordinate to move to.\n",
                                                                        ),
                                                                    /**
                                                                     * The y-coordinate to move to.
                                                                     *
                                                                     */
                                                                    y: z
                                                                        .number()
                                                                        .int()
                                                                        .describe(
                                                                            "The y-coordinate to move to.\n",
                                                                        ),
                                                                })
                                                                .describe("A mouse move action.\n"),
                                                            z
                                                                .object({
                                                                    /**
                                                                     * Specifies the event type. For a screenshot action, this property is
                                                                     * always set to `screenshot`.
                                                                     *
                                                                     */
                                                                    type: z
                                                                        .literal("screenshot")
                                                                        .describe(
                                                                            "Specifies the event type. For a screenshot action, this property is \nalways set to `screenshot`.\n",
                                                                        )
                                                                        .default("screenshot"),
                                                                })
                                                                .describe("A screenshot action.\n"),
                                                            z
                                                                .object({
                                                                    /**
                                                                     * Specifies the event type. For a scroll action, this property is
                                                                     * always set to `scroll`.
                                                                     *
                                                                     */
                                                                    type: z
                                                                        .literal("scroll")
                                                                        .describe(
                                                                            "Specifies the event type. For a scroll action, this property is \nalways set to `scroll`.\n",
                                                                        )
                                                                        .default("scroll"),
                                                                    /**
                                                                     * The x-coordinate where the scroll occurred.
                                                                     *
                                                                     */
                                                                    x: z
                                                                        .number()
                                                                        .int()
                                                                        .describe(
                                                                            "The x-coordinate where the scroll occurred.\n",
                                                                        ),
                                                                    /**
                                                                     * The y-coordinate where the scroll occurred.
                                                                     *
                                                                     */
                                                                    y: z
                                                                        .number()
                                                                        .int()
                                                                        .describe(
                                                                            "The y-coordinate where the scroll occurred.\n",
                                                                        ),
                                                                    /**
                                                                     * The horizontal scroll distance.
                                                                     *
                                                                     */
                                                                    scroll_x: z
                                                                        .number()
                                                                        .int()
                                                                        .describe(
                                                                            "The horizontal scroll distance.\n",
                                                                        ),
                                                                    /**
                                                                     * The vertical scroll distance.
                                                                     *
                                                                     */
                                                                    scroll_y: z
                                                                        .number()
                                                                        .int()
                                                                        .describe(
                                                                            "The vertical scroll distance.\n",
                                                                        ),
                                                                })
                                                                .describe("A scroll action.\n"),
                                                            z
                                                                .object({
                                                                    /**
                                                                     * Specifies the event type. For a type action, this property is
                                                                     * always set to `type`.
                                                                     *
                                                                     */
                                                                    type: z
                                                                        .literal("type")
                                                                        .describe(
                                                                            "Specifies the event type. For a type action, this property is \nalways set to `type`.\n",
                                                                        )
                                                                        .default("type"),
                                                                    /**
                                                                     * The text to type.
                                                                     *
                                                                     */
                                                                    text: z
                                                                        .string()
                                                                        .describe(
                                                                            "The text to type.\n",
                                                                        ),
                                                                })
                                                                .describe(
                                                                    "An action to type in text.\n",
                                                                ),
                                                            z
                                                                .object({
                                                                    /**
                                                                     * Specifies the event type. For a wait action, this property is
                                                                     * always set to `wait`.
                                                                     *
                                                                     */
                                                                    type: z
                                                                        .literal("wait")
                                                                        .describe(
                                                                            "Specifies the event type. For a wait action, this property is \nalways set to `wait`.\n",
                                                                        )
                                                                        .default("wait"),
                                                                })
                                                                .describe("A wait action.\n"),
                                                        ]),
                                                        /**
                                                         * The pending safety checks for the computer call.
                                                         *
                                                         */
                                                        pending_safety_checks: z
                                                            .array(
                                                                z
                                                                    .object({
                                                                        /**The ID of the pending safety check.*/
                                                                        id: z
                                                                            .string()
                                                                            .describe(
                                                                                "The ID of the pending safety check.",
                                                                            ),
                                                                        code: z
                                                                            .union([
                                                                                z
                                                                                    .string()
                                                                                    .describe(
                                                                                        "The type of the pending safety check.",
                                                                                    ),
                                                                                z.null(),
                                                                            ])
                                                                            .optional(),
                                                                        message: z
                                                                            .union([
                                                                                z
                                                                                    .string()
                                                                                    .describe(
                                                                                        "Details about the pending safety check.",
                                                                                    ),
                                                                                z.null(),
                                                                            ])
                                                                            .optional(),
                                                                    })
                                                                    .describe(
                                                                        "A pending safety check for the computer call.",
                                                                    ),
                                                            )
                                                            .describe(
                                                                "The pending safety checks for the computer call.\n",
                                                            ),
                                                        /**
                                                         * The status of the item. One of `in_progress`, `completed`, or
                                                         * `incomplete`. Populated when items are returned via API.
                                                         *
                                                         */
                                                        status: z
                                                            .enum([
                                                                "in_progress",
                                                                "completed",
                                                                "incomplete",
                                                            ])
                                                            .describe(
                                                                "The status of the item. One of `in_progress`, `completed`, or\n`incomplete`. Populated when items are returned via API.\n",
                                                            ),
                                                    })
                                                    .describe(
                                                        "A tool call to a computer use tool. See the\n[computer use guide](https://platform.openai.com/docs/guides/tools-computer-use) for more information.\n",
                                                    ),
                                                z
                                                    .object({
                                                        id: z
                                                            .union([
                                                                z
                                                                    .string()
                                                                    .describe(
                                                                        "The ID of the computer tool call output.",
                                                                    ),
                                                                z.null(),
                                                            ])
                                                            .optional(),
                                                        /**The ID of the computer tool call that produced the output.*/
                                                        call_id: z
                                                            .string()
                                                            .min(1)
                                                            .max(64)
                                                            .describe(
                                                                "The ID of the computer tool call that produced the output.",
                                                            ),
                                                        /**The type of the computer tool call output. Always `computer_call_output`.*/
                                                        type: z
                                                            .literal("computer_call_output")
                                                            .describe(
                                                                "The type of the computer tool call output. Always `computer_call_output`.",
                                                            )
                                                            .default("computer_call_output"),
                                                        /**
                                                         * A computer screenshot image used with the computer use tool.
                                                         *
                                                         */
                                                        output: z
                                                            .object({
                                                                /**
                                                                 * Specifies the event type. For a computer screenshot, this property is
                                                                 * always set to `computer_screenshot`.
                                                                 *
                                                                 */
                                                                type: z
                                                                    .literal("computer_screenshot")
                                                                    .describe(
                                                                        "Specifies the event type. For a computer screenshot, this property is \nalways set to `computer_screenshot`.\n",
                                                                    )
                                                                    .default("computer_screenshot"),
                                                                /**The URL of the screenshot image.*/
                                                                image_url: z
                                                                    .string()
                                                                    .describe(
                                                                        "The URL of the screenshot image.",
                                                                    )
                                                                    .optional(),
                                                                /**The identifier of an uploaded file that contains the screenshot.*/
                                                                file_id: z
                                                                    .string()
                                                                    .describe(
                                                                        "The identifier of an uploaded file that contains the screenshot.",
                                                                    )
                                                                    .optional(),
                                                            })
                                                            .describe(
                                                                "A computer screenshot image used with the computer use tool.\n",
                                                            ),
                                                        acknowledged_safety_checks: z
                                                            .union([
                                                                z
                                                                    .array(
                                                                        z
                                                                            .object({
                                                                                /**The ID of the pending safety check.*/
                                                                                id: z
                                                                                    .string()
                                                                                    .describe(
                                                                                        "The ID of the pending safety check.",
                                                                                    ),
                                                                                code: z
                                                                                    .union([
                                                                                        z
                                                                                            .string()
                                                                                            .describe(
                                                                                                "The type of the pending safety check.",
                                                                                            ),
                                                                                        z.null(),
                                                                                    ])
                                                                                    .optional(),
                                                                                message: z
                                                                                    .union([
                                                                                        z
                                                                                            .string()
                                                                                            .describe(
                                                                                                "Details about the pending safety check.",
                                                                                            ),
                                                                                        z.null(),
                                                                                    ])
                                                                                    .optional(),
                                                                            })
                                                                            .describe(
                                                                                "A pending safety check for the computer call.",
                                                                            ),
                                                                    )
                                                                    .describe(
                                                                        "The safety checks reported by the API that have been acknowledged by the developer.",
                                                                    ),
                                                                z.null(),
                                                            ])
                                                            .optional(),
                                                        status: z
                                                            .union([
                                                                z
                                                                    .enum([
                                                                        "in_progress",
                                                                        "completed",
                                                                        "incomplete",
                                                                    ])
                                                                    .describe(
                                                                        "The status of the message input. One of `in_progress`, `completed`, or `incomplete`. Populated when input items are returned via API.",
                                                                    ),
                                                                z.null(),
                                                            ])
                                                            .optional(),
                                                    })
                                                    .describe(
                                                        "The output of a computer tool call.",
                                                    ),
                                                z
                                                    .object({
                                                        /**
                                                         * The unique ID of the web search tool call.
                                                         *
                                                         */
                                                        id: z
                                                            .string()
                                                            .describe(
                                                                "The unique ID of the web search tool call.\n",
                                                            ),
                                                        /**
                                                         * The type of the web search tool call. Always `web_search_call`.
                                                         *
                                                         */
                                                        type: z
                                                            .literal("web_search_call")
                                                            .describe(
                                                                "The type of the web search tool call. Always `web_search_call`.\n",
                                                            ),
                                                        /**
                                                         * The status of the web search tool call.
                                                         *
                                                         */
                                                        status: z
                                                            .enum([
                                                                "in_progress",
                                                                "searching",
                                                                "completed",
                                                                "failed",
                                                            ])
                                                            .describe(
                                                                "The status of the web search tool call.\n",
                                                            ),
                                                        /**
                                                         * An object describing the specific action taken in this web search call.
                                                         * Includes details on how the model used the web (search, open_page, find).
                                                         *
                                                         */
                                                        action: z
                                                            .record(z.string(), z.unknown())
                                                            .and(
                                                                z.union([
                                                                    z
                                                                        .object({
                                                                            /**
                                                                             * The action type.
                                                                             *
                                                                             */
                                                                            type: z
                                                                                .literal("search")
                                                                                .describe(
                                                                                    "The action type.\n",
                                                                                ),
                                                                            /**
                                                                             * The search query.
                                                                             *
                                                                             */
                                                                            query: z
                                                                                .string()
                                                                                .describe(
                                                                                    "The search query.\n",
                                                                                ),
                                                                            /**
                                                                             * The sources used in the search.
                                                                             *
                                                                             */
                                                                            sources: z
                                                                                .array(
                                                                                    z
                                                                                        .object({
                                                                                            /**
                                                                                             * The type of source. Always `url`.
                                                                                             *
                                                                                             */
                                                                                            type: z
                                                                                                .literal(
                                                                                                    "url",
                                                                                                )
                                                                                                .describe(
                                                                                                    "The type of source. Always `url`.\n",
                                                                                                ),
                                                                                            /**
                                                                                             * The URL of the source.
                                                                                             *
                                                                                             */
                                                                                            url: z
                                                                                                .string()
                                                                                                .describe(
                                                                                                    "The URL of the source.\n",
                                                                                                ),
                                                                                        })
                                                                                        .describe(
                                                                                            "A source used in the search.\n",
                                                                                        ),
                                                                                )
                                                                                .describe(
                                                                                    "The sources used in the search.\n",
                                                                                )
                                                                                .optional(),
                                                                        })
                                                                        .describe(
                                                                            'Action type "search" - Performs a web search query.\n',
                                                                        ),
                                                                    z
                                                                        .object({
                                                                            /**
                                                                             * The action type.
                                                                             *
                                                                             */
                                                                            type: z
                                                                                .literal(
                                                                                    "open_page",
                                                                                )
                                                                                .describe(
                                                                                    "The action type.\n",
                                                                                ),
                                                                            /**
                                                                             * The URL opened by the model.
                                                                             *
                                                                             */
                                                                            url: z
                                                                                .string()
                                                                                .url()
                                                                                .describe(
                                                                                    "The URL opened by the model.\n",
                                                                                ),
                                                                        })
                                                                        .describe(
                                                                            'Action type "open_page" - Opens a specific URL from search results.\n',
                                                                        ),
                                                                    z
                                                                        .object({
                                                                            /**
                                                                             * The action type.
                                                                             *
                                                                             */
                                                                            type: z
                                                                                .literal("find")
                                                                                .describe(
                                                                                    "The action type.\n",
                                                                                ),
                                                                            /**
                                                                             * The URL of the page searched for the pattern.
                                                                             *
                                                                             */
                                                                            url: z
                                                                                .string()
                                                                                .url()
                                                                                .describe(
                                                                                    "The URL of the page searched for the pattern.\n",
                                                                                ),
                                                                            /**
                                                                             * The pattern or text to search for within the page.
                                                                             *
                                                                             */
                                                                            pattern: z
                                                                                .string()
                                                                                .describe(
                                                                                    "The pattern or text to search for within the page.\n",
                                                                                ),
                                                                        })
                                                                        .describe(
                                                                            'Action type "find": Searches for a pattern within a loaded page.\n',
                                                                        ),
                                                                ]),
                                                            )
                                                            .describe(
                                                                "An object describing the specific action taken in this web search call.\nIncludes details on how the model used the web (search, open_page, find).\n",
                                                            ),
                                                    })
                                                    .describe(
                                                        "The results of a web search tool call. See the\n[web search guide](https://platform.openai.com/docs/guides/tools-web-search) for more information.\n",
                                                    ),
                                                z
                                                    .object({
                                                        /**
                                                         * The unique ID of the function tool call.
                                                         *
                                                         */
                                                        id: z
                                                            .string()
                                                            .describe(
                                                                "The unique ID of the function tool call.\n",
                                                            )
                                                            .optional(),
                                                        /**
                                                         * The type of the function tool call. Always `function_call`.
                                                         *
                                                         */
                                                        type: z
                                                            .literal("function_call")
                                                            .describe(
                                                                "The type of the function tool call. Always `function_call`.\n",
                                                            ),
                                                        /**
                                                         * The unique ID of the function tool call generated by the model.
                                                         *
                                                         */
                                                        call_id: z
                                                            .string()
                                                            .describe(
                                                                "The unique ID of the function tool call generated by the model.\n",
                                                            ),
                                                        /**
                                                         * The name of the function to run.
                                                         *
                                                         */
                                                        name: z
                                                            .string()
                                                            .describe(
                                                                "The name of the function to run.\n",
                                                            ),
                                                        /**
                                                         * A JSON string of the arguments to pass to the function.
                                                         *
                                                         */
                                                        arguments: z
                                                            .string()
                                                            .describe(
                                                                "A JSON string of the arguments to pass to the function.\n",
                                                            ),
                                                        /**
                                                         * The status of the item. One of `in_progress`, `completed`, or
                                                         * `incomplete`. Populated when items are returned via API.
                                                         *
                                                         */
                                                        status: z
                                                            .enum([
                                                                "in_progress",
                                                                "completed",
                                                                "incomplete",
                                                            ])
                                                            .describe(
                                                                "The status of the item. One of `in_progress`, `completed`, or\n`incomplete`. Populated when items are returned via API.\n",
                                                            )
                                                            .optional(),
                                                    })
                                                    .describe(
                                                        "A tool call to run a function. See the \n[function calling guide](https://platform.openai.com/docs/guides/function-calling) for more information.\n",
                                                    ),
                                                z
                                                    .object({
                                                        id: z
                                                            .union([
                                                                z
                                                                    .string()
                                                                    .describe(
                                                                        "The unique ID of the function tool call output. Populated when this item is returned via API.",
                                                                    ),
                                                                z.null(),
                                                            ])
                                                            .optional(),
                                                        /**The unique ID of the function tool call generated by the model.*/
                                                        call_id: z
                                                            .string()
                                                            .min(1)
                                                            .max(64)
                                                            .describe(
                                                                "The unique ID of the function tool call generated by the model.",
                                                            ),
                                                        /**The type of the function tool call output. Always `function_call_output`.*/
                                                        type: z
                                                            .literal("function_call_output")
                                                            .describe(
                                                                "The type of the function tool call output. Always `function_call_output`.",
                                                            )
                                                            .default("function_call_output"),
                                                        /**Text, image, or file output of the function tool call.*/
                                                        output: z
                                                            .union([
                                                                z
                                                                    .string()
                                                                    .max(10485760)
                                                                    .describe(
                                                                        "A JSON string of the output of the function tool call.",
                                                                    ),
                                                                z.array(
                                                                    z.union([
                                                                        z
                                                                            .object({
                                                                                /**The type of the input item. Always `input_text`.*/
                                                                                type: z
                                                                                    .literal(
                                                                                        "input_text",
                                                                                    )
                                                                                    .describe(
                                                                                        "The type of the input item. Always `input_text`.",
                                                                                    )
                                                                                    .default(
                                                                                        "input_text",
                                                                                    ),
                                                                                /**The text input to the model.*/
                                                                                text: z
                                                                                    .string()
                                                                                    .max(10485760)
                                                                                    .describe(
                                                                                        "The text input to the model.",
                                                                                    ),
                                                                            })
                                                                            .describe(
                                                                                "A text input to the model.",
                                                                            ),
                                                                        z
                                                                            .object({
                                                                                /**The type of the input item. Always `input_image`.*/
                                                                                type: z
                                                                                    .literal(
                                                                                        "input_image",
                                                                                    )
                                                                                    .describe(
                                                                                        "The type of the input item. Always `input_image`.",
                                                                                    )
                                                                                    .default(
                                                                                        "input_image",
                                                                                    ),
                                                                                image_url: z
                                                                                    .union([
                                                                                        z
                                                                                            .string()
                                                                                            .max(
                                                                                                20971520,
                                                                                            )
                                                                                            .describe(
                                                                                                "The URL of the image to be sent to the model. A fully qualified URL or base64 encoded image in a data URL.",
                                                                                            ),
                                                                                        z.null(),
                                                                                    ])
                                                                                    .optional(),
                                                                                file_id: z
                                                                                    .union([
                                                                                        z
                                                                                            .string()
                                                                                            .describe(
                                                                                                "The ID of the file to be sent to the model.",
                                                                                            ),
                                                                                        z.null(),
                                                                                    ])
                                                                                    .optional(),
                                                                                detail: z
                                                                                    .union([
                                                                                        z
                                                                                            .enum([
                                                                                                "low",
                                                                                                "high",
                                                                                                "auto",
                                                                                            ])
                                                                                            .describe(
                                                                                                "The detail level of the image to be sent to the model. One of `high`, `low`, or `auto`. Defaults to `auto`.",
                                                                                            ),
                                                                                        z.null(),
                                                                                    ])
                                                                                    .optional(),
                                                                            })
                                                                            .describe(
                                                                                "An image input to the model. Learn about [image inputs](https://platform.openai.com/docs/guides/vision)",
                                                                            ),
                                                                        z
                                                                            .object({
                                                                                /**The type of the input item. Always `input_file`.*/
                                                                                type: z
                                                                                    .literal(
                                                                                        "input_file",
                                                                                    )
                                                                                    .describe(
                                                                                        "The type of the input item. Always `input_file`.",
                                                                                    )
                                                                                    .default(
                                                                                        "input_file",
                                                                                    ),
                                                                                file_id: z
                                                                                    .union([
                                                                                        z
                                                                                            .string()
                                                                                            .describe(
                                                                                                "The ID of the file to be sent to the model.",
                                                                                            ),
                                                                                        z.null(),
                                                                                    ])
                                                                                    .optional(),
                                                                                filename: z
                                                                                    .union([
                                                                                        z
                                                                                            .string()
                                                                                            .describe(
                                                                                                "The name of the file to be sent to the model.",
                                                                                            ),
                                                                                        z.null(),
                                                                                    ])
                                                                                    .optional(),
                                                                                file_data: z
                                                                                    .union([
                                                                                        z
                                                                                            .string()
                                                                                            .max(
                                                                                                33554432,
                                                                                            )
                                                                                            .describe(
                                                                                                "The base64-encoded data of the file to be sent to the model.",
                                                                                            ),
                                                                                        z.null(),
                                                                                    ])
                                                                                    .optional(),
                                                                                file_url: z
                                                                                    .union([
                                                                                        z
                                                                                            .string()
                                                                                            .describe(
                                                                                                "The URL of the file to be sent to the model.",
                                                                                            ),
                                                                                        z.null(),
                                                                                    ])
                                                                                    .optional(),
                                                                            })
                                                                            .describe(
                                                                                "A file input to the model.",
                                                                            ),
                                                                    ]),
                                                                ),
                                                            ])
                                                            .describe(
                                                                "Text, image, or file output of the function tool call.",
                                                            ),
                                                        status: z
                                                            .union([
                                                                z
                                                                    .enum([
                                                                        "in_progress",
                                                                        "completed",
                                                                        "incomplete",
                                                                    ])
                                                                    .describe(
                                                                        "The status of the item. One of `in_progress`, `completed`, or `incomplete`. Populated when items are returned via API.",
                                                                    ),
                                                                z.null(),
                                                            ])
                                                            .optional(),
                                                    })
                                                    .describe(
                                                        "The output of a function tool call.",
                                                    ),
                                                z
                                                    .object({
                                                        /**
                                                         * The type of the object. Always `reasoning`.
                                                         *
                                                         */
                                                        type: z
                                                            .literal("reasoning")
                                                            .describe(
                                                                "The type of the object. Always `reasoning`.\n",
                                                            ),
                                                        /**
                                                         * The unique identifier of the reasoning content.
                                                         *
                                                         */
                                                        id: z
                                                            .string()
                                                            .describe(
                                                                "The unique identifier of the reasoning content.\n",
                                                            ),
                                                        encrypted_content: z
                                                            .union([
                                                                z
                                                                    .string()
                                                                    .describe(
                                                                        "The encrypted content of the reasoning item - populated when a response is\ngenerated with `reasoning.encrypted_content` in the `include` parameter.\n",
                                                                    ),
                                                                z.null(),
                                                            ])
                                                            .optional(),
                                                        /**
                                                         * Reasoning summary content.
                                                         *
                                                         */
                                                        summary: z
                                                            .array(
                                                                z
                                                                    .object({
                                                                        /**The type of the object. Always `summary_text`.*/
                                                                        type: z
                                                                            .literal("summary_text")
                                                                            .describe(
                                                                                "The type of the object. Always `summary_text`.",
                                                                            )
                                                                            .default(
                                                                                "summary_text",
                                                                            ),
                                                                        /**A summary of the reasoning output from the model so far.*/
                                                                        text: z
                                                                            .string()
                                                                            .describe(
                                                                                "A summary of the reasoning output from the model so far.",
                                                                            ),
                                                                    })
                                                                    .describe(
                                                                        "A summary text from the model.",
                                                                    ),
                                                            )
                                                            .describe(
                                                                "Reasoning summary content.\n",
                                                            ),
                                                        /**
                                                         * Reasoning text content.
                                                         *
                                                         */
                                                        content: z
                                                            .array(
                                                                z
                                                                    .object({
                                                                        /**The type of the reasoning text. Always `reasoning_text`.*/
                                                                        type: z
                                                                            .literal(
                                                                                "reasoning_text",
                                                                            )
                                                                            .describe(
                                                                                "The type of the reasoning text. Always `reasoning_text`.",
                                                                            )
                                                                            .default(
                                                                                "reasoning_text",
                                                                            ),
                                                                        /**The reasoning text from the model.*/
                                                                        text: z
                                                                            .string()
                                                                            .describe(
                                                                                "The reasoning text from the model.",
                                                                            ),
                                                                    })
                                                                    .describe(
                                                                        "Reasoning text from the model.",
                                                                    ),
                                                            )
                                                            .describe("Reasoning text content.\n")
                                                            .optional(),
                                                        /**
                                                         * The status of the item. One of `in_progress`, `completed`, or
                                                         * `incomplete`. Populated when items are returned via API.
                                                         *
                                                         */
                                                        status: z
                                                            .enum([
                                                                "in_progress",
                                                                "completed",
                                                                "incomplete",
                                                            ])
                                                            .describe(
                                                                "The status of the item. One of `in_progress`, `completed`, or\n`incomplete`. Populated when items are returned via API.\n",
                                                            )
                                                            .optional(),
                                                    })
                                                    .describe(
                                                        "A description of the chain of thought used by a reasoning model while generating\na response. Be sure to include these items in your `input` to the Responses API\nfor subsequent turns of a conversation if you are manually\n[managing context](https://platform.openai.com/docs/guides/conversation-state).\n",
                                                    ),
                                                z
                                                    .object({
                                                        id: z
                                                            .union([
                                                                z
                                                                    .string()
                                                                    .describe(
                                                                        "The ID of the compaction item.",
                                                                    ),
                                                                z.null(),
                                                            ])
                                                            .optional(),
                                                        /**The type of the item. Always `compaction`.*/
                                                        type: z
                                                            .literal("compaction")
                                                            .describe(
                                                                "The type of the item. Always `compaction`.",
                                                            )
                                                            .default("compaction"),
                                                        encrypted_content: z.string().max(10485760),
                                                    })
                                                    .describe(
                                                        "A compaction item generated by the [`v1/responses/compact` API](https://platform.openai.com/docs/api-reference/responses/compact).",
                                                    ),
                                                z
                                                    .object({
                                                        /**
                                                         * The type of the image generation call. Always `image_generation_call`.
                                                         *
                                                         */
                                                        type: z
                                                            .literal("image_generation_call")
                                                            .describe(
                                                                "The type of the image generation call. Always `image_generation_call`.\n",
                                                            ),
                                                        /**
                                                         * The unique ID of the image generation call.
                                                         *
                                                         */
                                                        id: z
                                                            .string()
                                                            .describe(
                                                                "The unique ID of the image generation call.\n",
                                                            ),
                                                        /**
                                                         * The status of the image generation call.
                                                         *
                                                         */
                                                        status: z
                                                            .enum([
                                                                "in_progress",
                                                                "completed",
                                                                "generating",
                                                                "failed",
                                                            ])
                                                            .describe(
                                                                "The status of the image generation call.\n",
                                                            ),
                                                        result: z.union([
                                                            z
                                                                .string()
                                                                .describe(
                                                                    "The generated image encoded in base64.\n",
                                                                ),
                                                            z.null(),
                                                        ]),
                                                    })
                                                    .describe(
                                                        "An image generation request made by the model.\n",
                                                    ),
                                                z
                                                    .object({
                                                        /**
                                                         * The type of the code interpreter tool call. Always `code_interpreter_call`.
                                                         *
                                                         */
                                                        type: z
                                                            .literal("code_interpreter_call")
                                                            .describe(
                                                                "The type of the code interpreter tool call. Always `code_interpreter_call`.\n",
                                                            )
                                                            .default("code_interpreter_call"),
                                                        /**
                                                         * The unique ID of the code interpreter tool call.
                                                         *
                                                         */
                                                        id: z
                                                            .string()
                                                            .describe(
                                                                "The unique ID of the code interpreter tool call.\n",
                                                            ),
                                                        /**
                                                         * The status of the code interpreter tool call. Valid values are `in_progress`, `completed`, `incomplete`, `interpreting`, and `failed`.
                                                         *
                                                         */
                                                        status: z
                                                            .enum([
                                                                "in_progress",
                                                                "completed",
                                                                "incomplete",
                                                                "interpreting",
                                                                "failed",
                                                            ])
                                                            .describe(
                                                                "The status of the code interpreter tool call. Valid values are `in_progress`, `completed`, `incomplete`, `interpreting`, and `failed`.\n",
                                                            ),
                                                        /**
                                                         * The ID of the container used to run the code.
                                                         *
                                                         */
                                                        container_id: z
                                                            .string()
                                                            .describe(
                                                                "The ID of the container used to run the code.\n",
                                                            ),
                                                        code: z.union([
                                                            z
                                                                .string()
                                                                .describe(
                                                                    "The code to run, or null if not available.\n",
                                                                ),
                                                            z.null(),
                                                        ]),
                                                        outputs: z.union([
                                                            z
                                                                .array(
                                                                    z.union([
                                                                        z
                                                                            .object({
                                                                                /**The type of the output. Always `logs`.*/
                                                                                type: z
                                                                                    .literal("logs")
                                                                                    .describe(
                                                                                        "The type of the output. Always `logs`.",
                                                                                    )
                                                                                    .default(
                                                                                        "logs",
                                                                                    ),
                                                                                /**The logs output from the code interpreter.*/
                                                                                logs: z
                                                                                    .string()
                                                                                    .describe(
                                                                                        "The logs output from the code interpreter.",
                                                                                    ),
                                                                            })
                                                                            .describe(
                                                                                "The logs output from the code interpreter.",
                                                                            ),
                                                                        z
                                                                            .object({
                                                                                /**The type of the output. Always `image`.*/
                                                                                type: z
                                                                                    .literal(
                                                                                        "image",
                                                                                    )
                                                                                    .describe(
                                                                                        "The type of the output. Always `image`.",
                                                                                    )
                                                                                    .default(
                                                                                        "image",
                                                                                    ),
                                                                                /**The URL of the image output from the code interpreter.*/
                                                                                url: z
                                                                                    .string()
                                                                                    .describe(
                                                                                        "The URL of the image output from the code interpreter.",
                                                                                    ),
                                                                            })
                                                                            .describe(
                                                                                "The image output from the code interpreter.",
                                                                            ),
                                                                    ]),
                                                                )
                                                                .describe(
                                                                    "The outputs generated by the code interpreter, such as logs or images.\nCan be null if no outputs are available.\n",
                                                                ),
                                                            z.null(),
                                                        ]),
                                                    })
                                                    .describe("A tool call to run code.\n"),
                                                z
                                                    .object({
                                                        /**
                                                         * The type of the local shell call. Always `local_shell_call`.
                                                         *
                                                         */
                                                        type: z
                                                            .literal("local_shell_call")
                                                            .describe(
                                                                "The type of the local shell call. Always `local_shell_call`.\n",
                                                            ),
                                                        /**
                                                         * The unique ID of the local shell call.
                                                         *
                                                         */
                                                        id: z
                                                            .string()
                                                            .describe(
                                                                "The unique ID of the local shell call.\n",
                                                            ),
                                                        /**
                                                         * The unique ID of the local shell tool call generated by the model.
                                                         *
                                                         */
                                                        call_id: z
                                                            .string()
                                                            .describe(
                                                                "The unique ID of the local shell tool call generated by the model.\n",
                                                            ),
                                                        /**Execute a shell command on the server.*/
                                                        action: z
                                                            .object({
                                                                /**The type of the local shell action. Always `exec`.*/
                                                                type: z
                                                                    .literal("exec")
                                                                    .describe(
                                                                        "The type of the local shell action. Always `exec`.",
                                                                    )
                                                                    .default("exec"),
                                                                /**The command to run.*/
                                                                command: z
                                                                    .array(z.string())
                                                                    .describe(
                                                                        "The command to run.",
                                                                    ),
                                                                timeout_ms: z
                                                                    .union([
                                                                        z
                                                                            .number()
                                                                            .int()
                                                                            .describe(
                                                                                "Optional timeout in milliseconds for the command.",
                                                                            ),
                                                                        z.null(),
                                                                    ])
                                                                    .optional(),
                                                                working_directory: z
                                                                    .union([
                                                                        z
                                                                            .string()
                                                                            .describe(
                                                                                "Optional working directory to run the command in.",
                                                                            ),
                                                                        z.null(),
                                                                    ])
                                                                    .optional(),
                                                                /**Environment variables to set for the command.*/
                                                                env: z
                                                                    .record(z.string(), z.string())
                                                                    .describe(
                                                                        "Environment variables to set for the command.",
                                                                    ),
                                                                user: z
                                                                    .union([
                                                                        z
                                                                            .string()
                                                                            .describe(
                                                                                "Optional user to run the command as.",
                                                                            ),
                                                                        z.null(),
                                                                    ])
                                                                    .optional(),
                                                            })
                                                            .describe(
                                                                "Execute a shell command on the server.",
                                                            ),
                                                        /**
                                                         * The status of the local shell call.
                                                         *
                                                         */
                                                        status: z
                                                            .enum([
                                                                "in_progress",
                                                                "completed",
                                                                "incomplete",
                                                            ])
                                                            .describe(
                                                                "The status of the local shell call.\n",
                                                            ),
                                                    })
                                                    .describe(
                                                        "A tool call to run a command on the local shell.\n",
                                                    ),
                                                z
                                                    .object({
                                                        /**
                                                         * The type of the local shell tool call output. Always `local_shell_call_output`.
                                                         *
                                                         */
                                                        type: z
                                                            .literal("local_shell_call_output")
                                                            .describe(
                                                                "The type of the local shell tool call output. Always `local_shell_call_output`.\n",
                                                            ),
                                                        /**
                                                         * The unique ID of the local shell tool call generated by the model.
                                                         *
                                                         */
                                                        id: z
                                                            .string()
                                                            .describe(
                                                                "The unique ID of the local shell tool call generated by the model.\n",
                                                            ),
                                                        /**
                                                         * A JSON string of the output of the local shell tool call.
                                                         *
                                                         */
                                                        output: z
                                                            .string()
                                                            .describe(
                                                                "A JSON string of the output of the local shell tool call.\n",
                                                            ),
                                                        status: z
                                                            .union([
                                                                z
                                                                    .enum([
                                                                        "in_progress",
                                                                        "completed",
                                                                        "incomplete",
                                                                    ])
                                                                    .describe(
                                                                        "The status of the item. One of `in_progress`, `completed`, or `incomplete`.\n",
                                                                    ),
                                                                z.null(),
                                                            ])
                                                            .optional(),
                                                    })
                                                    .describe(
                                                        "The output of a local shell tool call.\n",
                                                    ),
                                                z
                                                    .object({
                                                        id: z
                                                            .union([
                                                                z
                                                                    .string()
                                                                    .describe(
                                                                        "The unique ID of the shell tool call. Populated when this item is returned via API.",
                                                                    ),
                                                                z.null(),
                                                            ])
                                                            .optional(),
                                                        /**The unique ID of the shell tool call generated by the model.*/
                                                        call_id: z
                                                            .string()
                                                            .min(1)
                                                            .max(64)
                                                            .describe(
                                                                "The unique ID of the shell tool call generated by the model.",
                                                            ),
                                                        /**The type of the item. Always `shell_call`.*/
                                                        type: z
                                                            .literal("shell_call")
                                                            .describe(
                                                                "The type of the item. Always `shell_call`.",
                                                            )
                                                            .default("shell_call"),
                                                        /**The shell commands and limits that describe how to run the tool call.*/
                                                        action: z
                                                            .object({
                                                                /**Ordered shell commands for the execution environment to run.*/
                                                                commands: z
                                                                    .array(z.string())
                                                                    .describe(
                                                                        "Ordered shell commands for the execution environment to run.",
                                                                    ),
                                                                timeout_ms: z
                                                                    .union([
                                                                        z
                                                                            .number()
                                                                            .int()
                                                                            .describe(
                                                                                "Maximum wall-clock time in milliseconds to allow the shell commands to run.",
                                                                            ),
                                                                        z.null(),
                                                                    ])
                                                                    .optional(),
                                                                max_output_length: z
                                                                    .union([
                                                                        z
                                                                            .number()
                                                                            .int()
                                                                            .describe(
                                                                                "Maximum number of UTF-8 characters to capture from combined stdout and stderr output.",
                                                                            ),
                                                                        z.null(),
                                                                    ])
                                                                    .optional(),
                                                            })
                                                            .describe(
                                                                "The shell commands and limits that describe how to run the tool call.",
                                                            ),
                                                        status: z
                                                            .union([
                                                                z
                                                                    .enum([
                                                                        "in_progress",
                                                                        "completed",
                                                                        "incomplete",
                                                                    ])
                                                                    .describe(
                                                                        "The status of the shell call. One of `in_progress`, `completed`, or `incomplete`.",
                                                                    ),
                                                                z.null(),
                                                            ])
                                                            .optional(),
                                                    })
                                                    .describe(
                                                        "A tool representing a request to execute one or more shell commands.",
                                                    ),
                                                z
                                                    .object({
                                                        id: z
                                                            .union([
                                                                z
                                                                    .string()
                                                                    .describe(
                                                                        "The unique ID of the shell tool call output. Populated when this item is returned via API.",
                                                                    ),
                                                                z.null(),
                                                            ])
                                                            .optional(),
                                                        /**The unique ID of the shell tool call generated by the model.*/
                                                        call_id: z
                                                            .string()
                                                            .min(1)
                                                            .max(64)
                                                            .describe(
                                                                "The unique ID of the shell tool call generated by the model.",
                                                            ),
                                                        /**The type of the item. Always `shell_call_output`.*/
                                                        type: z
                                                            .literal("shell_call_output")
                                                            .describe(
                                                                "The type of the item. Always `shell_call_output`.",
                                                            )
                                                            .default("shell_call_output"),
                                                        /**Captured chunks of stdout and stderr output, along with their associated outcomes.*/
                                                        output: z
                                                            .array(
                                                                z
                                                                    .object({
                                                                        /**Captured stdout output for the shell call.*/
                                                                        stdout: z
                                                                            .string()
                                                                            .max(10485760)
                                                                            .describe(
                                                                                "Captured stdout output for the shell call.",
                                                                            ),
                                                                        /**Captured stderr output for the shell call.*/
                                                                        stderr: z
                                                                            .string()
                                                                            .max(10485760)
                                                                            .describe(
                                                                                "Captured stderr output for the shell call.",
                                                                            ),
                                                                        /**The exit or timeout outcome associated with this shell call.*/
                                                                        outcome: z
                                                                            .union([
                                                                                z
                                                                                    .object({
                                                                                        /**The outcome type. Always `timeout`.*/
                                                                                        type: z
                                                                                            .literal(
                                                                                                "timeout",
                                                                                            )
                                                                                            .describe(
                                                                                                "The outcome type. Always `timeout`.",
                                                                                            )
                                                                                            .default(
                                                                                                "timeout",
                                                                                            ),
                                                                                    })
                                                                                    .describe(
                                                                                        "Indicates that the shell call exceeded its configured time limit.",
                                                                                    ),
                                                                                z
                                                                                    .object({
                                                                                        /**The outcome type. Always `exit`.*/
                                                                                        type: z
                                                                                            .literal(
                                                                                                "exit",
                                                                                            )
                                                                                            .describe(
                                                                                                "The outcome type. Always `exit`.",
                                                                                            )
                                                                                            .default(
                                                                                                "exit",
                                                                                            ),
                                                                                        /**The exit code returned by the shell process.*/
                                                                                        exit_code: z
                                                                                            .number()
                                                                                            .int()
                                                                                            .describe(
                                                                                                "The exit code returned by the shell process.",
                                                                                            ),
                                                                                    })
                                                                                    .describe(
                                                                                        "Indicates that the shell commands finished and returned an exit code.",
                                                                                    ),
                                                                            ])
                                                                            .describe(
                                                                                "The exit or timeout outcome associated with this shell call.",
                                                                            ),
                                                                    })
                                                                    .describe(
                                                                        "Captured stdout and stderr for a portion of a shell tool call output.",
                                                                    ),
                                                            )
                                                            .describe(
                                                                "Captured chunks of stdout and stderr output, along with their associated outcomes.",
                                                            ),
                                                        max_output_length: z
                                                            .union([
                                                                z
                                                                    .number()
                                                                    .int()
                                                                    .describe(
                                                                        "The maximum number of UTF-8 characters captured for this shell call's combined output.",
                                                                    ),
                                                                z.null(),
                                                            ])
                                                            .optional(),
                                                    })
                                                    .describe(
                                                        "The streamed output items emitted by a shell tool call.",
                                                    ),
                                                z
                                                    .object({
                                                        /**The type of the item. Always `apply_patch_call`.*/
                                                        type: z
                                                            .literal("apply_patch_call")
                                                            .describe(
                                                                "The type of the item. Always `apply_patch_call`.",
                                                            )
                                                            .default("apply_patch_call"),
                                                        id: z
                                                            .union([
                                                                z
                                                                    .string()
                                                                    .describe(
                                                                        "The unique ID of the apply patch tool call. Populated when this item is returned via API.",
                                                                    ),
                                                                z.null(),
                                                            ])
                                                            .optional(),
                                                        /**The unique ID of the apply patch tool call generated by the model.*/
                                                        call_id: z
                                                            .string()
                                                            .min(1)
                                                            .max(64)
                                                            .describe(
                                                                "The unique ID of the apply patch tool call generated by the model.",
                                                            ),
                                                        /**The status of the apply patch tool call. One of `in_progress` or `completed`.*/
                                                        status: z
                                                            .enum(["in_progress", "completed"])
                                                            .describe(
                                                                "The status of the apply patch tool call. One of `in_progress` or `completed`.",
                                                            ),
                                                        /**The specific create, delete, or update instruction for the apply_patch tool call.*/
                                                        operation: z
                                                            .union([
                                                                z
                                                                    .object({
                                                                        /**The operation type. Always `create_file`.*/
                                                                        type: z
                                                                            .literal("create_file")
                                                                            .describe(
                                                                                "The operation type. Always `create_file`.",
                                                                            )
                                                                            .default("create_file"),
                                                                        /**Path of the file to create relative to the workspace root.*/
                                                                        path: z
                                                                            .string()
                                                                            .min(1)
                                                                            .describe(
                                                                                "Path of the file to create relative to the workspace root.",
                                                                            ),
                                                                        /**Unified diff content to apply when creating the file.*/
                                                                        diff: z
                                                                            .string()
                                                                            .max(10485760)
                                                                            .describe(
                                                                                "Unified diff content to apply when creating the file.",
                                                                            ),
                                                                    })
                                                                    .describe(
                                                                        "Instruction for creating a new file via the apply_patch tool.",
                                                                    ),
                                                                z
                                                                    .object({
                                                                        /**The operation type. Always `delete_file`.*/
                                                                        type: z
                                                                            .literal("delete_file")
                                                                            .describe(
                                                                                "The operation type. Always `delete_file`.",
                                                                            )
                                                                            .default("delete_file"),
                                                                        /**Path of the file to delete relative to the workspace root.*/
                                                                        path: z
                                                                            .string()
                                                                            .min(1)
                                                                            .describe(
                                                                                "Path of the file to delete relative to the workspace root.",
                                                                            ),
                                                                    })
                                                                    .describe(
                                                                        "Instruction for deleting an existing file via the apply_patch tool.",
                                                                    ),
                                                                z
                                                                    .object({
                                                                        /**The operation type. Always `update_file`.*/
                                                                        type: z
                                                                            .literal("update_file")
                                                                            .describe(
                                                                                "The operation type. Always `update_file`.",
                                                                            )
                                                                            .default("update_file"),
                                                                        /**Path of the file to update relative to the workspace root.*/
                                                                        path: z
                                                                            .string()
                                                                            .min(1)
                                                                            .describe(
                                                                                "Path of the file to update relative to the workspace root.",
                                                                            ),
                                                                        /**Unified diff content to apply to the existing file.*/
                                                                        diff: z
                                                                            .string()
                                                                            .max(10485760)
                                                                            .describe(
                                                                                "Unified diff content to apply to the existing file.",
                                                                            ),
                                                                    })
                                                                    .describe(
                                                                        "Instruction for updating an existing file via the apply_patch tool.",
                                                                    ),
                                                            ])
                                                            .describe(
                                                                "The specific create, delete, or update instruction for the apply_patch tool call.",
                                                            ),
                                                    })
                                                    .describe(
                                                        "A tool call representing a request to create, delete, or update files using diff patches.",
                                                    ),
                                                z
                                                    .object({
                                                        /**The type of the item. Always `apply_patch_call_output`.*/
                                                        type: z
                                                            .literal("apply_patch_call_output")
                                                            .describe(
                                                                "The type of the item. Always `apply_patch_call_output`.",
                                                            )
                                                            .default("apply_patch_call_output"),
                                                        id: z
                                                            .union([
                                                                z
                                                                    .string()
                                                                    .describe(
                                                                        "The unique ID of the apply patch tool call output. Populated when this item is returned via API.",
                                                                    ),
                                                                z.null(),
                                                            ])
                                                            .optional(),
                                                        /**The unique ID of the apply patch tool call generated by the model.*/
                                                        call_id: z
                                                            .string()
                                                            .min(1)
                                                            .max(64)
                                                            .describe(
                                                                "The unique ID of the apply patch tool call generated by the model.",
                                                            ),
                                                        /**The status of the apply patch tool call output. One of `completed` or `failed`.*/
                                                        status: z
                                                            .enum(["completed", "failed"])
                                                            .describe(
                                                                "The status of the apply patch tool call output. One of `completed` or `failed`.",
                                                            ),
                                                        output: z
                                                            .union([
                                                                z
                                                                    .string()
                                                                    .max(10485760)
                                                                    .describe(
                                                                        "Optional human-readable log text from the apply patch tool (e.g., patch results or errors).",
                                                                    ),
                                                                z.null(),
                                                            ])
                                                            .optional(),
                                                    })
                                                    .describe(
                                                        "The streamed output emitted by an apply patch tool call.",
                                                    ),
                                                z
                                                    .object({
                                                        /**
                                                         * The type of the item. Always `mcp_list_tools`.
                                                         *
                                                         */
                                                        type: z
                                                            .literal("mcp_list_tools")
                                                            .describe(
                                                                "The type of the item. Always `mcp_list_tools`.\n",
                                                            ),
                                                        /**
                                                         * The unique ID of the list.
                                                         *
                                                         */
                                                        id: z
                                                            .string()
                                                            .describe(
                                                                "The unique ID of the list.\n",
                                                            ),
                                                        /**
                                                         * The label of the MCP server.
                                                         *
                                                         */
                                                        server_label: z
                                                            .string()
                                                            .describe(
                                                                "The label of the MCP server.\n",
                                                            ),
                                                        /**
                                                         * The tools available on the server.
                                                         *
                                                         */
                                                        tools: z
                                                            .array(
                                                                z
                                                                    .object({
                                                                        /**
                                                                         * The name of the tool.
                                                                         *
                                                                         */
                                                                        name: z
                                                                            .string()
                                                                            .describe(
                                                                                "The name of the tool.\n",
                                                                            ),
                                                                        description: z
                                                                            .union([
                                                                                z
                                                                                    .string()
                                                                                    .describe(
                                                                                        "The description of the tool.\n",
                                                                                    ),
                                                                                z.null(),
                                                                            ])
                                                                            .optional(),
                                                                        /**
                                                                         * The JSON schema describing the tool's input.
                                                                         *
                                                                         */
                                                                        input_schema: z
                                                                            .record(
                                                                                z.string(),
                                                                                z.unknown(),
                                                                            )
                                                                            .describe(
                                                                                "The JSON schema describing the tool's input.\n",
                                                                            ),
                                                                        annotations: z
                                                                            .union([
                                                                                z
                                                                                    .record(
                                                                                        z.string(),
                                                                                        z.unknown(),
                                                                                    )
                                                                                    .describe(
                                                                                        "Additional annotations about the tool.\n",
                                                                                    ),
                                                                                z.null(),
                                                                            ])
                                                                            .optional(),
                                                                    })
                                                                    .describe(
                                                                        "A tool available on an MCP server.\n",
                                                                    ),
                                                            )
                                                            .describe(
                                                                "The tools available on the server.\n",
                                                            ),
                                                        error: z
                                                            .union([
                                                                z
                                                                    .string()
                                                                    .describe(
                                                                        "Error message if the server could not list tools.\n",
                                                                    ),
                                                                z.null(),
                                                            ])
                                                            .optional(),
                                                    })
                                                    .describe(
                                                        "A list of tools available on an MCP server.\n",
                                                    ),
                                                z
                                                    .object({
                                                        /**
                                                         * The type of the item. Always `mcp_approval_request`.
                                                         *
                                                         */
                                                        type: z
                                                            .literal("mcp_approval_request")
                                                            .describe(
                                                                "The type of the item. Always `mcp_approval_request`.\n",
                                                            ),
                                                        /**
                                                         * The unique ID of the approval request.
                                                         *
                                                         */
                                                        id: z
                                                            .string()
                                                            .describe(
                                                                "The unique ID of the approval request.\n",
                                                            ),
                                                        /**
                                                         * The label of the MCP server making the request.
                                                         *
                                                         */
                                                        server_label: z
                                                            .string()
                                                            .describe(
                                                                "The label of the MCP server making the request.\n",
                                                            ),
                                                        /**
                                                         * The name of the tool to run.
                                                         *
                                                         */
                                                        name: z
                                                            .string()
                                                            .describe(
                                                                "The name of the tool to run.\n",
                                                            ),
                                                        /**
                                                         * A JSON string of arguments for the tool.
                                                         *
                                                         */
                                                        arguments: z
                                                            .string()
                                                            .describe(
                                                                "A JSON string of arguments for the tool.\n",
                                                            ),
                                                    })
                                                    .describe(
                                                        "A request for human approval of a tool invocation.\n",
                                                    ),
                                                z
                                                    .object({
                                                        /**
                                                         * The type of the item. Always `mcp_approval_response`.
                                                         *
                                                         */
                                                        type: z
                                                            .literal("mcp_approval_response")
                                                            .describe(
                                                                "The type of the item. Always `mcp_approval_response`.\n",
                                                            ),
                                                        id: z
                                                            .union([
                                                                z
                                                                    .string()
                                                                    .describe(
                                                                        "The unique ID of the approval response\n",
                                                                    ),
                                                                z.null(),
                                                            ])
                                                            .optional(),
                                                        /**
                                                         * The ID of the approval request being answered.
                                                         *
                                                         */
                                                        approval_request_id: z
                                                            .string()
                                                            .describe(
                                                                "The ID of the approval request being answered.\n",
                                                            ),
                                                        /**
                                                         * Whether the request was approved.
                                                         *
                                                         */
                                                        approve: z
                                                            .boolean()
                                                            .describe(
                                                                "Whether the request was approved.\n",
                                                            ),
                                                        reason: z
                                                            .union([
                                                                z
                                                                    .string()
                                                                    .describe(
                                                                        "Optional reason for the decision.\n",
                                                                    ),
                                                                z.null(),
                                                            ])
                                                            .optional(),
                                                    })
                                                    .describe(
                                                        "A response to an MCP approval request.\n",
                                                    ),
                                                z
                                                    .object({
                                                        /**
                                                         * The type of the item. Always `mcp_call`.
                                                         *
                                                         */
                                                        type: z
                                                            .literal("mcp_call")
                                                            .describe(
                                                                "The type of the item. Always `mcp_call`.\n",
                                                            ),
                                                        /**
                                                         * The unique ID of the tool call.
                                                         *
                                                         */
                                                        id: z
                                                            .string()
                                                            .describe(
                                                                "The unique ID of the tool call.\n",
                                                            ),
                                                        /**
                                                         * The label of the MCP server running the tool.
                                                         *
                                                         */
                                                        server_label: z
                                                            .string()
                                                            .describe(
                                                                "The label of the MCP server running the tool.\n",
                                                            ),
                                                        /**
                                                         * The name of the tool that was run.
                                                         *
                                                         */
                                                        name: z
                                                            .string()
                                                            .describe(
                                                                "The name of the tool that was run.\n",
                                                            ),
                                                        /**
                                                         * A JSON string of the arguments passed to the tool.
                                                         *
                                                         */
                                                        arguments: z
                                                            .string()
                                                            .describe(
                                                                "A JSON string of the arguments passed to the tool.\n",
                                                            ),
                                                        output: z
                                                            .union([
                                                                z
                                                                    .string()
                                                                    .describe(
                                                                        "The output from the tool call.\n",
                                                                    ),
                                                                z.null(),
                                                            ])
                                                            .optional(),
                                                        error: z
                                                            .union([
                                                                z
                                                                    .string()
                                                                    .describe(
                                                                        "The error from the tool call, if any.\n",
                                                                    ),
                                                                z.null(),
                                                            ])
                                                            .optional(),
                                                        /**
                                                         * The status of the tool call. One of `in_progress`, `completed`, `incomplete`, `calling`, or `failed`.
                                                         *
                                                         */
                                                        status: z
                                                            .enum([
                                                                "in_progress",
                                                                "completed",
                                                                "incomplete",
                                                                "calling",
                                                                "failed",
                                                            ])
                                                            .describe(
                                                                "The status of the tool call. One of `in_progress`, `completed`, `incomplete`, `calling`, or `failed`.\n",
                                                            )
                                                            .optional(),
                                                        approval_request_id: z
                                                            .union([
                                                                z
                                                                    .string()
                                                                    .describe(
                                                                        "Unique identifier for the MCP tool call approval request.\nInclude this value in a subsequent `mcp_approval_response` input to approve or reject the corresponding tool call.\n",
                                                                    ),
                                                                z.null(),
                                                            ])
                                                            .optional(),
                                                    })
                                                    .describe(
                                                        "An invocation of a tool on an MCP server.\n",
                                                    ),
                                                z
                                                    .object({
                                                        /**
                                                         * The type of the custom tool call output. Always `custom_tool_call_output`.
                                                         *
                                                         */
                                                        type: z
                                                            .literal("custom_tool_call_output")
                                                            .describe(
                                                                "The type of the custom tool call output. Always `custom_tool_call_output`.\n",
                                                            ),
                                                        /**
                                                         * The unique ID of the custom tool call output in the OpenAI platform.
                                                         *
                                                         */
                                                        id: z
                                                            .string()
                                                            .describe(
                                                                "The unique ID of the custom tool call output in the OpenAI platform.\n",
                                                            )
                                                            .optional(),
                                                        /**
                                                         * The call ID, used to map this custom tool call output to a custom tool call.
                                                         *
                                                         */
                                                        call_id: z
                                                            .string()
                                                            .describe(
                                                                "The call ID, used to map this custom tool call output to a custom tool call.\n",
                                                            ),
                                                        /**
                                                         * The output from the custom tool call generated by your code.
                                                         * Can be a string or an list of output content.
                                                         *
                                                         */
                                                        output: z
                                                            .union([
                                                                z
                                                                    .string()
                                                                    .describe(
                                                                        "A string of the output of the custom tool call.\n",
                                                                    ),
                                                                z
                                                                    .array(
                                                                        z.union([
                                                                            z
                                                                                .object({
                                                                                    /**The type of the input item. Always `input_text`.*/
                                                                                    type: z
                                                                                        .literal(
                                                                                            "input_text",
                                                                                        )
                                                                                        .describe(
                                                                                            "The type of the input item. Always `input_text`.",
                                                                                        )
                                                                                        .default(
                                                                                            "input_text",
                                                                                        ),
                                                                                    /**The text input to the model.*/
                                                                                    text: z
                                                                                        .string()
                                                                                        .describe(
                                                                                            "The text input to the model.",
                                                                                        ),
                                                                                })
                                                                                .describe(
                                                                                    "A text input to the model.",
                                                                                ),
                                                                            z
                                                                                .object({
                                                                                    /**The type of the input item. Always `input_image`.*/
                                                                                    type: z
                                                                                        .literal(
                                                                                            "input_image",
                                                                                        )
                                                                                        .describe(
                                                                                            "The type of the input item. Always `input_image`.",
                                                                                        )
                                                                                        .default(
                                                                                            "input_image",
                                                                                        ),
                                                                                    image_url: z
                                                                                        .union([
                                                                                            z
                                                                                                .string()
                                                                                                .describe(
                                                                                                    "The URL of the image to be sent to the model. A fully qualified URL or base64 encoded image in a data URL.",
                                                                                                ),
                                                                                            z.null(),
                                                                                        ])
                                                                                        .optional(),
                                                                                    file_id: z
                                                                                        .union([
                                                                                            z
                                                                                                .string()
                                                                                                .describe(
                                                                                                    "The ID of the file to be sent to the model.",
                                                                                                ),
                                                                                            z.null(),
                                                                                        ])
                                                                                        .optional(),
                                                                                    /**The detail level of the image to be sent to the model. One of `high`, `low`, or `auto`. Defaults to `auto`.*/
                                                                                    detail: z
                                                                                        .enum([
                                                                                            "low",
                                                                                            "high",
                                                                                            "auto",
                                                                                        ])
                                                                                        .describe(
                                                                                            "The detail level of the image to be sent to the model. One of `high`, `low`, or `auto`. Defaults to `auto`.",
                                                                                        ),
                                                                                })
                                                                                .describe(
                                                                                    "An image input to the model. Learn about [image inputs](https://platform.openai.com/docs/guides/vision).",
                                                                                ),
                                                                            z
                                                                                .object({
                                                                                    /**The type of the input item. Always `input_file`.*/
                                                                                    type: z
                                                                                        .literal(
                                                                                            "input_file",
                                                                                        )
                                                                                        .describe(
                                                                                            "The type of the input item. Always `input_file`.",
                                                                                        )
                                                                                        .default(
                                                                                            "input_file",
                                                                                        ),
                                                                                    file_id: z
                                                                                        .union([
                                                                                            z
                                                                                                .string()
                                                                                                .describe(
                                                                                                    "The ID of the file to be sent to the model.",
                                                                                                ),
                                                                                            z.null(),
                                                                                        ])
                                                                                        .optional(),
                                                                                    /**The name of the file to be sent to the model.*/
                                                                                    filename: z
                                                                                        .string()
                                                                                        .describe(
                                                                                            "The name of the file to be sent to the model.",
                                                                                        )
                                                                                        .optional(),
                                                                                    /**The URL of the file to be sent to the model.*/
                                                                                    file_url: z
                                                                                        .string()
                                                                                        .describe(
                                                                                            "The URL of the file to be sent to the model.",
                                                                                        )
                                                                                        .optional(),
                                                                                    /**
                                                                                     * The content of the file to be sent to the model.
                                                                                     *
                                                                                     */
                                                                                    file_data: z
                                                                                        .string()
                                                                                        .describe(
                                                                                            "The content of the file to be sent to the model.\n",
                                                                                        )
                                                                                        .optional(),
                                                                                })
                                                                                .describe(
                                                                                    "A file input to the model.",
                                                                                ),
                                                                        ]),
                                                                    )
                                                                    .describe(
                                                                        "Text, image, or file output of the custom tool call.\n",
                                                                    ),
                                                            ])
                                                            .describe(
                                                                "The output from the custom tool call generated by your code.\nCan be a string or an list of output content.\n",
                                                            ),
                                                    })
                                                    .describe(
                                                        "The output of a custom tool call from your code, being sent back to the model.\n",
                                                    ),
                                                z
                                                    .object({
                                                        /**
                                                         * The type of the custom tool call. Always `custom_tool_call`.
                                                         *
                                                         */
                                                        type: z
                                                            .literal("custom_tool_call")
                                                            .describe(
                                                                "The type of the custom tool call. Always `custom_tool_call`.\n",
                                                            ),
                                                        /**
                                                         * The unique ID of the custom tool call in the OpenAI platform.
                                                         *
                                                         */
                                                        id: z
                                                            .string()
                                                            .describe(
                                                                "The unique ID of the custom tool call in the OpenAI platform.\n",
                                                            )
                                                            .optional(),
                                                        /**
                                                         * An identifier used to map this custom tool call to a tool call output.
                                                         *
                                                         */
                                                        call_id: z
                                                            .string()
                                                            .describe(
                                                                "An identifier used to map this custom tool call to a tool call output.\n",
                                                            ),
                                                        /**
                                                         * The name of the custom tool being called.
                                                         *
                                                         */
                                                        name: z
                                                            .string()
                                                            .describe(
                                                                "The name of the custom tool being called.\n",
                                                            ),
                                                        /**
                                                         * The input for the custom tool call generated by the model.
                                                         *
                                                         */
                                                        input: z
                                                            .string()
                                                            .describe(
                                                                "The input for the custom tool call generated by the model.\n",
                                                            ),
                                                    })
                                                    .describe(
                                                        "A call to a custom tool created by the model.\n",
                                                    ),
                                            ]),
                                        )
                                        .describe(
                                            "An item representing part of the context for the response to be\ngenerated by the model. Can contain text, images, and audio inputs,\nas well as previous assistant responses and tool call outputs.\n",
                                        ),
                                    z
                                        .object({
                                            type: z
                                                .union([
                                                    z
                                                        .literal("item_reference")
                                                        .describe(
                                                            "The type of item to reference. Always `item_reference`.",
                                                        )
                                                        .default("item_reference"),
                                                    z.null(),
                                                ])
                                                .optional(),
                                            /**The ID of the item to reference.*/
                                            id: z
                                                .string()
                                                .describe("The ID of the item to reference."),
                                        })
                                        .describe(
                                            "An internal identifier for an item to reference.",
                                        ),
                                ]),
                            )
                            .describe(
                                "A list of one or many input items to the model, containing\ndifferent content types.\n",
                            ),
                    ])
                    .describe(
                        "A system (or developer) message inserted into the model's context.\n\nWhen using along with `previous_response_id`, the instructions from a previous\nresponse will not be carried over to the next response. This makes it simple\nto swap out system (or developer) messages in new responses.\n",
                    ),
                z.null(),
            ]),
            output_text: z
                .union([
                    z
                        .string()
                        .describe(
                            "SDK-only convenience property that contains the aggregated text output\nfrom all `output_text` items in the `output` array, if any are present.\nSupported in the Python and JavaScript SDKs.\n",
                        ),
                    z.null(),
                ])
                .optional(),
            /**
             * Represents token usage details including input tokens, output tokens,
             * a breakdown of output tokens, and the total tokens used.
             *
             */
            usage: z
                .object({
                    /**The number of input tokens.*/
                    input_tokens: z.number().int().describe("The number of input tokens."),
                    /**A detailed breakdown of the input tokens.*/
                    input_tokens_details: z
                        .object({
                            /**
                             * The number of tokens that were retrieved from the cache.
                             * [More on prompt caching](https://platform.openai.com/docs/guides/prompt-caching).
                             *
                             */
                            cached_tokens: z
                                .number()
                                .int()
                                .describe(
                                    "The number of tokens that were retrieved from the cache. \n[More on prompt caching](https://platform.openai.com/docs/guides/prompt-caching).\n",
                                ),
                        })
                        .describe("A detailed breakdown of the input tokens."),
                    /**The number of output tokens.*/
                    output_tokens: z.number().int().describe("The number of output tokens."),
                    /**A detailed breakdown of the output tokens.*/
                    output_tokens_details: z
                        .object({
                            /**The number of reasoning tokens.*/
                            reasoning_tokens: z
                                .number()
                                .int()
                                .describe("The number of reasoning tokens."),
                        })
                        .describe("A detailed breakdown of the output tokens."),
                    /**The total number of tokens used.*/
                    total_tokens: z.number().int().describe("The total number of tokens used."),
                })
                .describe(
                    "Represents token usage details including input tokens, output tokens,\na breakdown of output tokens, and the total tokens used.\n",
                )
                .optional(),
            /**
             * Whether to allow the model to run tool calls in parallel.
             *
             */
            parallel_tool_calls: z
                .boolean()
                .describe("Whether to allow the model to run tool calls in parallel.\n")
                .default(true),
            conversation: z
                .union([
                    z
                        .object({
                            /**The unique ID of the conversation.*/
                            id: z.string().describe("The unique ID of the conversation."),
                        })
                        .describe(
                            "The conversation that this response belongs to. Input items and output items from this response are automatically added to this conversation.",
                        ),
                    z.null(),
                ])
                .optional(),
        }),
    ),
);

export const OpenAIResponseStreamEvent = z
    .object({
        type: z.enum([
            "error",
            "response.audio.delta",
            "response.audio.done",
            "response.audio.transcript.delta",
            "response.audio.transcript.done",
            "response.code_interpreter_call.completed",
            "response.code_interpreter_call.in_progress",
            "response.code_interpreter_call.interpreting",
            "response.code_interpreter_call_code.delta",
            "response.code_interpreter_call_code.done",
            "response.completed",
            "response.computer_call.completed",
            "response.computer_call.failed",
            "response.computer_call.in_progress",
            "response.content_part.added",
            "response.content_part.done",
            "response.created",
            "response.custom_tool_call_input.delta",
            "response.custom_tool_call_input.done",
            "response.failed",
            "response.file_search_call.completed",
            "response.file_search_call.in_progress",
            "response.file_search_call.searching",
            "response.function_call_arguments.delta",
            "response.function_call_arguments.done",
            "response.image_generation_call.completed",
            "response.image_generation_call.generating",
            "response.image_generation_call.in_progress",
            "response.image_generation_call.partial_image",
            "response.in_progress",
            "response.incomplete",
            "response.mcp_call.completed",
            "response.mcp_call.failed",
            "response.mcp_call.in_progress",
            "response.mcp_call_arguments.delta",
            "response.mcp_call_arguments.done",
            "response.mcp_list_tools.completed",
            "response.mcp_list_tools.failed",
            "response.mcp_list_tools.in_progress",
            "response.output_item.added",
            "response.output_item.done",
            "response.output_text.annotation.added",
            "response.output_text.delta",
            "response.output_text.done",
            "response.queued",
            "response.reasoning_summary_part.added",
            "response.reasoning_summary_part.done",
            "response.reasoning_summary_text.delta",
            "response.reasoning_summary_text.done",
            "response.reasoning_text.delta",
            "response.reasoning_text.done",
            "response.refusal.delta",
            "response.refusal.done",
            "response.web_search_call.completed",
            "response.web_search_call.in_progress",
            "response.web_search_call.searching",
        ]),
    })
    .catchall(z.any());
