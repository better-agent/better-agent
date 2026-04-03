import { TOOL_JSON_SCHEMA, isCallableToolDefinition } from "@better-agent/core";
import { Events } from "@better-agent/core/events";
import type { Event } from "@better-agent/core/events";
import type {
    GenerativeModelCallOptions,
    GenerativeModelFinishReason,
    GenerativeModelOutputItem,
    GenerativeModelOutputMessagePart,
    GenerativeModelProviderToolResult,
    GenerativeModelResponse,
    GenerativeModelToolCallRequest,
    GenerativeModelUsage,
    ModalitiesParam,
} from "@better-agent/core/providers";
import { BetterAgentError } from "@better-agent/shared/errors";
import type { Result } from "@better-agent/shared/neverthrow";
import { err, ok } from "@better-agent/shared/neverthrow";
import { safeJsonParse } from "@better-agent/shared/utils";
import { extractPassthroughOptions, omitNullish } from "../../utils/object-utils";
import { isAnthropicNativeToolDefinition, mapAnthropicNativeToolToRequest } from "../tools";
import type {
    AnthropicMessagesRequestSchema,
    AnthropicMessagesResponse,
    AnthropicResponseStreamEvent,
} from "./schemas";
import type {
    AnthropicResponseCaps,
    AnthropicResponseEndpointOptions,
    AnthropicResponseModelId,
} from "./types";

/**
 * Keys explicitly handled by the Anthropic responses mapper.
 */
const ANTHROPIC_RESPONSE_KNOWN_KEYS: ReadonlySet<string> = new Set([
    // Framework-managed
    "input",
    "tools",
    "toolChoice",
    "modalities",
    "structured_output",
    // Explicitly mapped
    "anthropicBeta",
    "cacheControl",
    "container",
    "contextManagement",
    "disableParallelToolUse",
    "effort",
    "max_tokens",
    "mcpServers",
    "metadata",
    "speed",
    "stop_sequences",
    "structuredOutputMode",
    "temperature",
    "thinking",
    "toolStreaming",
    "top_k",
    "top_p",
]);

// TODO: Replace this fallback with model-aware Anthropic defaults.
const DEFAULT_MAX_TOKENS = 4096;
const PDF_INPUT_BETA = "pdfs-2024-09-25";
const FINE_GRAINED_TOOL_STREAMING_BETA = "fine-grained-tool-streaming-2025-05-14";

const normalizeProviderToolName = (name: string): string => {
    if (name === "bash_code_execution" || name === "text_editor_code_execution") {
        return "code_execution";
    }

    return name;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value);

const decodeBase64Text = (data: string): string => Buffer.from(data, "base64").toString("utf8");

const isUrlSource = (source: unknown): source is { kind: "url"; url: string } =>
    isRecord(source) && source.kind === "url" && typeof source.url === "string";

const isBase64Source = (
    source: unknown,
): source is { kind: "base64"; data: string; mimeType: string } =>
    isRecord(source) &&
    source.kind === "base64" &&
    typeof source.data === "string" &&
    typeof source.mimeType === "string";

const buildBinarySource = (source: unknown) => {
    if (isUrlSource(source)) {
        return {
            type: "url" as const,
            url: source.url,
        };
    }

    if (isBase64Source(source)) {
        return {
            type: "base64" as const,
            media_type: source.mimeType,
            data: source.data,
        };
    }

    return null;
};

const serializeToolResultContent = (result: unknown): string =>
    typeof result === "string" ? result : JSON.stringify(result);

const parseMaybeJson = (value: string): unknown => {
    if (!value.trim()) return {};
    const parsed = safeJsonParse(value);
    return parsed.isOk() ? parsed.value : value;
};

const getAnthropicModelCapabilities = (modelId: string) => {
    if (modelId.includes("claude-sonnet-4-6") || modelId.includes("claude-opus-4-6")) {
        return {
            supportsStructuredOutput: true,
        };
    }

    if (
        modelId.includes("claude-sonnet-4-5") ||
        modelId.includes("claude-opus-4-5") ||
        modelId.includes("claude-haiku-4-5")
    ) {
        return {
            supportsStructuredOutput: true,
        };
    }

    if (modelId.includes("claude-opus-4-1")) {
        return {
            supportsStructuredOutput: true,
        };
    }

    return {
        supportsStructuredOutput: false,
    };
};

type AnthropicPartProviderOptions = {
    cacheControl?: {
        type: "ephemeral";
        ttl?: "5m" | "1h";
    };
    citations?: {
        enabled: boolean;
    };
    context?: string;
    title?: string;
};

const getAnthropicPartProviderMetadata = (
    part: Record<string, unknown>,
): AnthropicPartProviderOptions | undefined => {
    const providerMetadata = part.providerMetadata;
    if (!isRecord(providerMetadata)) return undefined;
    const anthropic = providerMetadata.anthropic;
    if (!isRecord(anthropic)) return undefined;

    return {
        cacheControl:
            isRecord(anthropic.cacheControl) &&
            anthropic.cacheControl.type === "ephemeral" &&
            (anthropic.cacheControl.ttl == null ||
                anthropic.cacheControl.ttl === "5m" ||
                anthropic.cacheControl.ttl === "1h")
                ? {
                      type: "ephemeral",
                      ...(anthropic.cacheControl.ttl != null
                          ? { ttl: anthropic.cacheControl.ttl }
                          : {}),
                  }
                : undefined,
        citations:
            isRecord(anthropic.citations) && typeof anthropic.citations.enabled === "boolean"
                ? { enabled: anthropic.citations.enabled }
                : undefined,
        context: typeof anthropic.context === "string" ? anthropic.context : undefined,
        title: typeof anthropic.title === "string" ? anthropic.title : undefined,
    };
};

const getAnthropicTextProviderMetadata = (citations?: unknown[]) =>
    citations?.length
        ? ({
              anthropic: {
                  citations,
              },
          } satisfies Record<string, unknown>)
        : undefined;

const mapAnthropicStopReason = (
    stopReason: string | null | undefined,
    isJsonResponseFromTool: boolean,
): GenerativeModelFinishReason => {
    switch (stopReason) {
        case "pause_turn":
        case "end_turn":
        case "stop_sequence":
            return "stop";
        case "refusal":
            return "content-filter";
        case "tool_use":
            return isJsonResponseFromTool ? "stop" : "tool-calls";
        case "max_tokens":
        case "model_context_window_exceeded":
            return "length";
        case "compaction":
            return "other";
        default:
            return "other";
    }
};

const mapAnthropicUsage = (
    usage:
        | {
              input_tokens?: number;
              output_tokens?: number;
              cache_creation_input_tokens?: number;
              cache_read_input_tokens?: number;
              iterations?: Array<{
                  type: "compaction" | "message";
                  input_tokens: number;
                  output_tokens: number;
              }>;
          }
        | undefined,
): GenerativeModelUsage => {
    const cacheCreation = usage?.cache_creation_input_tokens ?? 0;
    const cacheRead = usage?.cache_read_input_tokens ?? 0;

    const iteratedInput =
        usage?.iterations?.reduce((sum, item) => sum + item.input_tokens, 0) ?? usage?.input_tokens;
    const iteratedOutput =
        usage?.iterations?.reduce((sum, item) => sum + item.output_tokens, 0) ??
        usage?.output_tokens;

    const inputTokens =
        typeof iteratedInput === "number" ? iteratedInput + cacheCreation + cacheRead : undefined;
    const outputTokens = typeof iteratedOutput === "number" ? iteratedOutput : undefined;
    const totalTokens =
        typeof inputTokens === "number" && typeof outputTokens === "number"
            ? inputTokens + outputTokens
            : undefined;

    return omitNullish({
        inputTokens,
        outputTokens,
        totalTokens,
        cachedInputTokens: cacheRead || undefined,
    });
};

const mapContextManagementEdit = (edit: unknown): unknown => {
    if (!isRecord(edit) || typeof edit.type !== "string") return edit;

    switch (edit.type) {
        case "clear_tool_uses_20250919":
            return omitNullish({
                type: edit.type,
                trigger: edit.trigger,
                keep: edit.keep,
                clear_at_least: edit.clearAtLeast,
                clear_tool_inputs: edit.clearToolInputs,
                exclude_tools: edit.excludeTools,
            });
        case "clear_thinking_20251015":
            return omitNullish({
                type: edit.type,
                keep: edit.keep,
            });
        case "compact_20260112":
            return omitNullish({
                type: edit.type,
                trigger: edit.trigger,
                pause_after_compaction: edit.pauseAfterCompaction,
                instructions: edit.instructions,
            });
        default:
            return edit;
    }
};

const mapHostedToolBeta = (type: string): string | null => {
    switch (type) {
        case "code_execution_20250522":
            return "code-execution-2025-05-22";
        case "code_execution_20250825":
            return "code-execution-2025-08-25";
        case "computer_20241022":
        case "text_editor_20241022":
        case "bash_20241022":
            return "computer-use-2024-10-22";
        case "computer_20250124":
        case "text_editor_20250124":
        case "text_editor_20250429":
        case "bash_20250124":
            return "computer-use-2025-01-24";
        case "computer_20251124":
            return "computer-use-2025-11-24";
        case "memory_20250818":
            return "context-management-2025-06-27";
        case "web_fetch_20250910":
            return "web-fetch-2025-09-10";
        case "web_fetch_20260209":
        case "web_search_20260209":
            return "code-execution-web-tools-2026-02-09";
        default:
            return null;
    }
};

const mapMessagePartsToAnthropicContent = (
    content: unknown,
    role: "system" | "developer" | "user" | "assistant",
    modelId: string,
    betas: Set<string>,
): Result<AnthropicMessagesRequestSchema["messages"][number]["content"], BetterAgentError> => {
    const toValidationError = (message: string, at: string, context?: Record<string, unknown>) =>
        BetterAgentError.fromCode("VALIDATION_FAILED", message, {
            context: {
                provider: "anthropic",
                model: modelId,
                role,
                ...(context ?? {}),
            },
        }).at({ at });

    const parts = typeof content === "string" ? [{ type: "text", text: content }] : content;
    if (!Array.isArray(parts)) {
        return err(
            toValidationError(
                "Message content must be a string or array.",
                "anthropic.map.input.content",
            ),
        );
    }

    const anthropicContent: AnthropicMessagesRequestSchema["messages"][number]["content"] = [];

    for (const part of parts) {
        if (!isRecord(part) || typeof part.type !== "string") {
            return err(
                toValidationError(
                    "Message part must be an object with a type.",
                    "anthropic.map.input.part",
                ),
            );
        }

        if (part.type === "text") {
            if (typeof part.text !== "string") {
                return err(
                    toValidationError(
                        "Text message parts require a text string.",
                        "anthropic.map.input.text",
                    ),
                );
            }

            const anthropicProviderOptions = getAnthropicPartProviderMetadata(part);
            anthropicContent.push({
                type: "text",
                text: part.text,
                ...(anthropicProviderOptions?.cacheControl != null
                    ? { cache_control: anthropicProviderOptions.cacheControl }
                    : {}),
            });
            continue;
        }

        if (role === "assistant" || role === "system" || role === "developer") {
            return err(
                toValidationError(
                    `Role '${role}' only supports text content for Anthropic.`,
                    "anthropic.map.input.roleContent",
                    {
                        partType: part.type,
                    },
                ),
            );
        }

        if (part.type === "image") {
            if (!isRecord(part.source) || typeof part.source.kind !== "string") {
                return err(
                    toValidationError(
                        "Image parts require a valid source.",
                        "anthropic.map.input.imageSource",
                    ),
                );
            }

            if (part.source.kind === "provider-file") {
                return err(
                    toValidationError(
                        "Anthropic Messages API does not support provider-file image inputs in this adapter.",
                        "anthropic.map.input.imageProviderFile",
                    ),
                );
            }

            const anthropicProviderOptions = getAnthropicPartProviderMetadata(part);
            const imageSource =
                isUrlSource(part.source) || isBase64Source(part.source)
                    ? buildBinarySource(part.source)
                    : null;
            if (imageSource == null) {
                return err(
                    toValidationError(
                        "Image parts require a URL or base64 source.",
                        "anthropic.map.input.imageSourceKind",
                    ),
                );
            }

            anthropicContent.push({
                type: "image",
                source: imageSource,
                ...(anthropicProviderOptions?.cacheControl != null
                    ? { cache_control: anthropicProviderOptions.cacheControl }
                    : {}),
            });
            continue;
        }

        if (part.type === "file") {
            if (!isRecord(part.source) || typeof part.source.kind !== "string") {
                return err(
                    toValidationError(
                        "File parts require a valid source.",
                        "anthropic.map.input.fileSource",
                    ),
                );
            }

            if (part.source.kind === "provider-file") {
                return err(
                    toValidationError(
                        "Anthropic Messages API does not support provider-file document inputs in this adapter.",
                        "anthropic.map.input.fileProviderFile",
                    ),
                );
            }

            const mimeType =
                typeof part.source.mimeType === "string" ? part.source.mimeType : undefined;
            const filename =
                typeof part.source.filename === "string" ? part.source.filename : undefined;
            const anthropicProviderOptions = getAnthropicPartProviderMetadata(part);
            const citationsEnabled = anthropicProviderOptions?.citations?.enabled;
            const documentContext = anthropicProviderOptions?.context;
            const documentTitle = anthropicProviderOptions?.title ?? filename;
            const cacheControl = anthropicProviderOptions?.cacheControl;

            if (typeof mimeType === "string" && mimeType.startsWith("image/")) {
                const imageSource = buildBinarySource(part.source);
                if (imageSource == null) {
                    return err(
                        toValidationError(
                            "Image file inputs require a URL or base64 source.",
                            "anthropic.map.input.fileImageSource",
                        ),
                    );
                }
                anthropicContent.push({
                    type: "image",
                    source: imageSource,
                    ...(cacheControl != null ? { cache_control: cacheControl } : {}),
                });
                continue;
            }

            if (mimeType === "application/pdf") {
                betas.add(PDF_INPUT_BETA);
                const documentSource = buildBinarySource(part.source);
                if (documentSource == null) {
                    return err(
                        toValidationError(
                            "PDF inputs require a URL or base64 source.",
                            "anthropic.map.input.filePdfSource",
                        ),
                    );
                }
                anthropicContent.push({
                    type: "document",
                    source: documentSource,
                    ...(documentTitle != null ? { title: documentTitle } : {}),
                    ...(documentContext != null ? { context: documentContext } : {}),
                    ...(citationsEnabled != null
                        ? { citations: { enabled: citationsEnabled } }
                        : {}),
                    ...(cacheControl != null ? { cache_control: cacheControl } : {}),
                });
                continue;
            }

            if (mimeType === "text/plain") {
                const documentSource = isUrlSource(part.source)
                    ? {
                          type: "url" as const,
                          url: part.source.url,
                      }
                    : isBase64Source(part.source)
                      ? {
                            type: "text" as const,
                            media_type: "text/plain" as const,
                            data: decodeBase64Text(part.source.data),
                        }
                      : null;
                if (documentSource == null) {
                    return err(
                        toValidationError(
                            "Text document inputs require a URL or base64 source.",
                            "anthropic.map.input.fileTextSource",
                        ),
                    );
                }
                anthropicContent.push({
                    type: "document",
                    source: documentSource,
                    ...(documentTitle != null ? { title: documentTitle } : {}),
                    ...(documentContext != null ? { context: documentContext } : {}),
                    ...(citationsEnabled != null
                        ? { citations: { enabled: citationsEnabled } }
                        : {}),
                    ...(cacheControl != null ? { cache_control: cacheControl } : {}),
                });
                continue;
            }

            return err(
                toValidationError(
                    "Anthropic file inputs currently support image/*, application/pdf, and text/plain only.",
                    "anthropic.map.input.fileUnsupported",
                    {
                        mimeType,
                    },
                ),
            );
        }

        return err(
            toValidationError(
                `Unsupported Anthropic input part type '${part.type}'.`,
                "anthropic.map.input.unsupportedPart",
            ),
        );
    }

    return ok(anthropicContent);
};

export function mapToAnthropicMessagesRequest<
    M extends AnthropicResponseModelId,
    TModalities extends ModalitiesParam<AnthropicResponseCaps> = undefined,
>(args: {
    modelId: M;
    options: GenerativeModelCallOptions<
        AnthropicResponseCaps,
        AnthropicResponseEndpointOptions,
        TModalities
    >;
    stream?: boolean;
}): Result<
    {
        request: AnthropicMessagesRequestSchema;
        betas: string[];
        usesJsonResponseTool: boolean;
    },
    BetterAgentError
> {
    try {
        const { modelId } = args;
        const o = args.options;
        const stream = args.stream === true;
        const betas = new Set<string>(o.anthropicBeta ?? []);
        const systemParts: Array<{ type: "text"; text: string }> = [];
        const messages: AnthropicMessagesRequestSchema["messages"] = [];

        const inputItems: readonly unknown[] =
            typeof o.input === "string"
                ? [{ type: "message", role: "user", content: o.input }]
                : (o.input as readonly unknown[]);

        if (Array.isArray(inputItems)) {
            for (const item of inputItems) {
                if (typeof item === "string") {
                    messages.push({
                        role: "user",
                        content: [{ type: "text", text: item }],
                    });
                    continue;
                }

                if (!isRecord(item) || typeof item.type !== "string") {
                    return err(
                        BetterAgentError.fromCode(
                            "VALIDATION_FAILED",
                            "Anthropic input items must be messages or tool-call results.",
                            {
                                context: {
                                    provider: "anthropic",
                                    model: modelId,
                                },
                            },
                        ).at({ at: "anthropic.map.input.item" }),
                    );
                }

                if (item.type === "message") {
                    const role = typeof item.role === "string" ? item.role : ("user" as const);

                    const content = mapMessagePartsToAnthropicContent(
                        item.content,
                        role as "system" | "developer" | "user" | "assistant",
                        String(modelId),
                        betas,
                    );
                    if (content.isErr()) return err(content.error);

                    if (role === "system" || role === "developer") {
                        for (const part of content.value) {
                            if (part.type === "text") {
                                systemParts.push({ type: "text", text: part.text });
                            }
                        }
                    } else if (role === "assistant" || role === "user") {
                        messages.push({
                            role,
                            content: content.value,
                        });
                    } else {
                        return err(
                            BetterAgentError.fromCode(
                                "VALIDATION_FAILED",
                                `Anthropic does not support role '${role}'.`,
                                {
                                    context: {
                                        provider: "anthropic",
                                        model: modelId,
                                        role,
                                    },
                                },
                            ).at({ at: "anthropic.map.input.role" }),
                        );
                    }

                    continue;
                }

                if (item.type === "tool-call" && "result" in item) {
                    const toolResult = item as {
                        type: "tool-call";
                        name: string;
                        callId: string;
                        arguments?: string;
                        result: unknown;
                        isError?: boolean;
                    };
                    messages.push({
                        role: "assistant",
                        content: [
                            {
                                type: "tool_use",
                                id: toolResult.callId,
                                name: toolResult.name,
                                input: parseMaybeJson(toolResult.arguments ?? "{}"),
                            },
                        ],
                    });
                    messages.push({
                        role: "user",
                        content: [
                            {
                                type: "tool_result",
                                tool_use_id: toolResult.callId,
                                content: serializeToolResultContent(toolResult.result),
                                is_error: toolResult.isError,
                            },
                        ],
                    });
                    continue;
                }

                return err(
                    BetterAgentError.fromCode(
                        "VALIDATION_FAILED",
                        "Anthropic input items must be messages or completed tool-call results.",
                        {
                            context: {
                                provider: "anthropic",
                                model: modelId,
                            },
                        },
                    ).at({ at: "anthropic.map.input.unsupportedItem" }),
                );
            }
        }

        const anthropicTools: NonNullable<AnthropicMessagesRequestSchema["tools"]> = [];
        const tools = ("tools" in o ? o.tools : []) ?? [];
        const modelSupportsStructuredOutput = getAnthropicModelCapabilities(
            String(modelId),
        ).supportsStructuredOutput;

        for (const tool of tools) {
            if (isAnthropicNativeToolDefinition(tool)) {
                anthropicTools.push(mapAnthropicNativeToolToRequest(tool));
                const beta = mapHostedToolBeta(tool.type);
                if (beta) betas.add(beta);
                continue;
            }

            const callableTool = tool as
                | ({ [TOOL_JSON_SCHEMA]?: unknown } & Record<string, unknown>)
                | undefined;

            if (!callableTool || !isCallableToolDefinition(callableTool as never)) continue;

            const inputSchema = callableTool[TOOL_JSON_SCHEMA];
            if (!isRecord(inputSchema) || inputSchema.type !== "object") {
                return err(
                    BetterAgentError.fromCode(
                        "VALIDATION_FAILED",
                        "Anthropic custom tools require an object JSON schema.",
                        {
                            context: {
                                provider: "anthropic",
                                model: modelId,
                                toolName: callableTool.name,
                            },
                        },
                    ).at({ at: "anthropic.map.tools.schema" }),
                );
            }

            anthropicTools.push(
                omitNullish({
                    name: String(callableTool.name ?? ""),
                    description:
                        typeof callableTool.description === "string"
                            ? callableTool.description
                            : undefined,
                    input_schema: inputSchema,
                    strict:
                        modelSupportsStructuredOutput && typeof callableTool.strict === "boolean"
                            ? callableTool.strict
                            : undefined,
                }) as NonNullable<AnthropicMessagesRequestSchema["tools"]>[number],
            );
            if (modelSupportsStructuredOutput) {
                betas.add("structured-outputs-2025-11-13");
            }
        }

        const structuredOutput = "structured_output" in o ? o.structured_output : undefined;
        const structuredOutputMode = o.structuredOutputMode ?? "auto";
        const useStructuredOutput =
            structuredOutputMode === "outputFormat" ||
            (structuredOutputMode === "auto" && modelSupportsStructuredOutput);
        let usesJsonResponseTool = false;
        let outputConfig: AnthropicMessagesRequestSchema["output_config"] | undefined =
            o.effort != null ? { effort: o.effort } : undefined;

        if (structuredOutput) {
            if (!isRecord(structuredOutput.schema) || structuredOutput.schema.type !== "object") {
                return err(
                    BetterAgentError.fromCode(
                        "VALIDATION_FAILED",
                        "Anthropic structured output schema must be a JSON object schema.",
                        {
                            context: {
                                provider: "anthropic",
                                model: modelId,
                            },
                        },
                    ).at({ at: "anthropic.map.structuredOutput.schema" }),
                );
            }

            if (!useStructuredOutput) {
                usesJsonResponseTool = true;
                anthropicTools.push({
                    name: "json",
                    description: "Respond with a JSON object.",
                    input_schema: structuredOutput.schema,
                });
            } else {
                outputConfig = {
                    ...(outputConfig ?? {}),
                    format: {
                        type: "json_schema",
                        schema: structuredOutput.schema,
                    },
                };
            }
        }

        let toolChoice: AnthropicMessagesRequestSchema["tool_choice"] | undefined;
        if (usesJsonResponseTool) {
            toolChoice = {
                type: "tool",
                name: "json",
                disable_parallel_tool_use: true,
            };
        } else if ("toolChoice" in o && o.toolChoice) {
            switch (o.toolChoice.type) {
                case "auto":
                    toolChoice = o.disableParallelToolUse
                        ? {
                              type: "auto",
                              disable_parallel_tool_use: true,
                          }
                        : { type: "auto" };
                    break;
                case "required":
                    toolChoice = {
                        type: "any",
                        ...(o.disableParallelToolUse ? { disable_parallel_tool_use: true } : {}),
                    };
                    break;
                case "tool":
                    toolChoice = {
                        type: "tool",
                        name: o.toolChoice.name,
                        ...(o.disableParallelToolUse ? { disable_parallel_tool_use: true } : {}),
                    };
                    break;
                case "none":
                    break;
            }
        } else if (o.disableParallelToolUse) {
            toolChoice = {
                type: "auto",
                disable_parallel_tool_use: true,
            };
        }

        if (o.mcpServers?.length) {
            betas.add("mcp-client-2025-04-04");
        }
        if (o.contextManagement) {
            betas.add("context-management-2025-06-27");
            if (
                o.contextManagement.edits.some(
                    (edit) => isRecord(edit) && edit.type === "compact_20260112",
                )
            ) {
                betas.add("compact-2026-01-12");
            }
        }
        if (o.container?.skills?.length) {
            betas.add("code-execution-2025-08-25");
            betas.add("skills-2025-10-02");
            betas.add("files-api-2025-04-14");
        }
        if (o.effort) {
            betas.add("effort-2025-11-24");
        }
        if (o.speed === "fast") {
            betas.add("fast-mode-2026-02-01");
        }
        if (stream && (o.toolStreaming ?? true)) {
            betas.add(FINE_GRAINED_TOOL_STREAMING_BETA);
        }

        const request: AnthropicMessagesRequestSchema = {
            ...extractPassthroughOptions(
                o as Record<string, unknown>,
                ANTHROPIC_RESPONSE_KNOWN_KEYS,
            ),
            model: modelId,
            max_tokens: o.max_tokens ?? DEFAULT_MAX_TOKENS,
            messages,
            ...omitNullish({
                system: systemParts.length ? systemParts : undefined,
                cache_control: o.cacheControl,
                metadata: o.metadata?.userId ? { user_id: o.metadata.userId } : undefined,
                output_config: outputConfig,
                stop_sequences: o.stop_sequences,
                temperature: o.temperature,
                stream: false,
                speed: o.speed,
                thinking:
                    o.thinking == null
                        ? undefined
                        : o.thinking.type === "enabled"
                          ? {
                                type: "enabled",
                                budget_tokens: o.thinking.budgetTokens,
                            }
                          : o.thinking,
                tool_choice:
                    o.toolChoice?.type === "none" && !usesJsonResponseTool ? undefined : toolChoice,
                tools:
                    o.toolChoice?.type === "none" && !usesJsonResponseTool
                        ? undefined
                        : anthropicTools.length
                          ? anthropicTools
                          : undefined,
                top_k: o.top_k,
                top_p: o.top_p,
                mcp_servers: o.mcpServers?.map((server) => ({
                    type: server.type,
                    name: server.name,
                    url: server.url,
                    authorization_token: server.authorizationToken,
                    tool_configuration: server.toolConfiguration
                        ? {
                              enabled: server.toolConfiguration.enabled,
                              allowed_tools: server.toolConfiguration.allowedTools,
                          }
                        : undefined,
                })),
                container: o.container
                    ? {
                          ...(o.container.id != null ? { id: o.container.id } : {}),
                          ...(o.container.skills?.length
                              ? {
                                    skills: o.container.skills.map((skill) => ({
                                        type: skill.type,
                                        skill_id: skill.skillId,
                                        ...(skill.version != null
                                            ? { version: skill.version }
                                            : {}),
                                    })),
                                }
                              : {}),
                      }
                    : undefined,
                context_management: o.contextManagement
                    ? {
                          edits: o.contextManagement.edits.map(mapContextManagementEdit),
                      }
                    : undefined,
            }),
        };

        return ok({
            request,
            betas: [...betas],
            usesJsonResponseTool,
        });
    } catch (e) {
        return err(
            BetterAgentError.wrap({
                err: e,
                message: "Failed to map Anthropic Messages request",
                opts: {
                    code: "INTERNAL",
                    context: {
                        provider: "anthropic",
                        model: args.modelId,
                    },
                },
            }).at({ at: "anthropic.messages.mapToRequest" }),
        );
    }
}

const mapProviderToolResultName = (
    part: {
        type: string;
        tool_use_id?: string;
        name?: string;
    },
    serverToolCalls: Record<string, string>,
    mcpToolCalls: Record<string, string>,
): string => {
    if (part.type === "server_tool_use" && typeof part.name === "string") {
        return normalizeProviderToolName(part.name);
    }

    if (part.type === "mcp_tool_use") {
        return typeof part.name === "string" ? part.name : "mcp";
    }

    if (part.type === "mcp_tool_result") {
        return mcpToolCalls[part.tool_use_id ?? ""] ?? "mcp";
    }

    const resolvedServerName = serverToolCalls[part.tool_use_id ?? ""];
    if (resolvedServerName) {
        return normalizeProviderToolName(resolvedServerName);
    }

    switch (part.type) {
        case "web_fetch_tool_result":
            return "web_fetch";
        case "web_search_tool_result":
            return "web_search";
        case "code_execution_tool_result":
        case "bash_code_execution_tool_result":
        case "text_editor_code_execution_tool_result":
            return "code_execution";
        case "tool_search_tool_result":
            return "tool_search_tool_regex";
        default:
            return part.type;
    }
};

export function mapFromAnthropicMessagesResponse(args: {
    response: AnthropicMessagesResponse;
    usesJsonResponseTool?: boolean;
}): GenerativeModelResponse {
    const assistantParts: GenerativeModelOutputMessagePart[] = [];
    const outputItems: Array<GenerativeModelOutputItem> = [];
    const serverToolCalls: Record<string, string> = {};
    const mcpToolCalls: Record<string, string> = {};
    let isJsonResponseFromTool = false;

    for (const part of args.response.content) {
        switch (part.type) {
            case "text":
                assistantParts.push({
                    type: "text",
                    text: part.text,
                    ...(part.citations?.length
                        ? {
                              providerMetadata: getAnthropicTextProviderMetadata(part.citations),
                          }
                        : {}),
                });
                break;
            case "compaction":
                assistantParts.push({ type: "text", text: part.content });
                break;
            case "tool_use":
                if (args.usesJsonResponseTool && part.name === "json") {
                    isJsonResponseFromTool = true;
                    assistantParts.push({
                        type: "text",
                        text: JSON.stringify(part.input),
                    });
                } else {
                    outputItems.push({
                        type: "tool-call",
                        name: part.name,
                        arguments: JSON.stringify(part.input ?? {}),
                        callId: part.id,
                    } satisfies GenerativeModelToolCallRequest);
                }
                break;
            case "server_tool_use":
                serverToolCalls[part.id] = part.name;
                outputItems.push({
                    type: "provider-tool-result",
                    name: normalizeProviderToolName(part.name),
                    callId: part.id,
                    result: part,
                } satisfies GenerativeModelProviderToolResult);
                break;
            case "mcp_tool_use":
                mcpToolCalls[part.id] = part.name;
                outputItems.push({
                    type: "provider-tool-result",
                    name: part.name,
                    callId: part.id,
                    result: part,
                } satisfies GenerativeModelProviderToolResult);
                break;
            case "mcp_tool_result":
            case "web_fetch_tool_result":
            case "web_search_tool_result":
            case "code_execution_tool_result":
            case "bash_code_execution_tool_result":
            case "text_editor_code_execution_tool_result":
            case "tool_search_tool_result":
                outputItems.push({
                    type: "provider-tool-result",
                    name: mapProviderToolResultName(part, serverToolCalls, mcpToolCalls),
                    callId: part.tool_use_id,
                    result: part,
                    isError:
                        "is_error" in part && typeof part.is_error === "boolean"
                            ? part.is_error
                            : undefined,
                } satisfies GenerativeModelProviderToolResult);
                break;
            case "thinking":
            case "redacted_thinking":
                break;
        }
    }

    if (assistantParts.length) {
        outputItems.unshift({
            type: "message",
            role: "assistant",
            content: assistantParts,
        });
    }

    return {
        output: outputItems,
        finishReason: mapAnthropicStopReason(args.response.stop_reason, isJsonResponseFromTool),
        usage: mapAnthropicUsage(args.response.usage),
        response: {
            body: args.response,
        },
    };
}

type AnthropicStreamUsage = {
    input_tokens?: number;
    output_tokens?: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
    iterations?: Array<{
        type: "compaction" | "message";
        input_tokens: number;
        output_tokens: number;
    }>;
};

type TextBlockState = {
    kind: "text";
    messageId: string;
    text: string;
    citations?: unknown[];
};

type ReasoningBlockState = {
    kind: "reasoning";
    messageId: string;
};

type ToolBlockState = {
    kind: "tool";
    callId: string;
    toolName: string;
    rawToolName: string;
    rawType: "tool_use" | "server_tool_use" | "mcp_tool_use";
    input: string;
    outputAsText: boolean;
    providerExecuted: boolean;
    extra?: Record<string, unknown>;
};

type AnthropicStreamBlockState = TextBlockState | ReasoningBlockState | ToolBlockState;

export type AnthropicStreamState = {
    messageId: string;
    outputItems: Array<GenerativeModelOutputItem>;
    assistantParts: GenerativeModelOutputMessagePart[];
    blocks: Record<number, AnthropicStreamBlockState>;
    serverToolCalls: Record<string, string>;
    mcpToolCalls: Record<string, string>;
    finishReasonRaw?: string | null;
    usage: AnthropicStreamUsage;
    usesJsonResponseTool: boolean;
};

export const createAnthropicStreamState = (
    messageId: string,
    usesJsonResponseTool = false,
): AnthropicStreamState => ({
    messageId,
    outputItems: [],
    assistantParts: [],
    blocks: {},
    serverToolCalls: {},
    mcpToolCalls: {},
    finishReasonRaw: undefined,
    usage: {},
    usesJsonResponseTool,
});

const createToolStartEvent = (
    parentMessageId: string,
    toolCallId: string,
    toolCallName: string,
): Event =>
    ({
        type: Events.TOOL_CALL_START,
        parentMessageId,
        toolCallId,
        toolCallName,
        timestamp: Date.now(),
    }) as Event;

const createToolArgsEvent = (
    parentMessageId: string,
    toolCallId: string,
    toolCallName: string,
    delta: string,
): Event =>
    ({
        type: Events.TOOL_CALL_ARGS,
        parentMessageId,
        toolCallId,
        toolCallName,
        delta,
        timestamp: Date.now(),
    }) as Event;

const createToolEndEvent = (
    parentMessageId: string,
    toolCallId: string,
    toolCallName: string,
): Event =>
    ({
        type: Events.TOOL_CALL_END,
        parentMessageId,
        toolCallId,
        toolCallName,
        timestamp: Date.now(),
    }) as Event;

const createToolResultEvent = (
    parentMessageId: string,
    toolCallId: string,
    toolCallName: string,
    result: unknown,
    isError?: boolean,
): Event =>
    ({
        type: Events.TOOL_CALL_RESULT,
        parentMessageId,
        toolCallId,
        toolCallName,
        result,
        isError,
        timestamp: Date.now(),
    }) as Event;

const finalizeStreamResponse = (state: AnthropicStreamState): GenerativeModelResponse => {
    const output = [...state.outputItems];

    if (state.assistantParts.length) {
        output.unshift({
            type: "message",
            role: "assistant",
            content: state.assistantParts,
        });
    }

    const hasToolCalls = output.some((item) => item.type === "tool-call" && "arguments" in item);

    return {
        output,
        finishReason:
            state.finishReasonRaw == null && hasToolCalls
                ? "tool-calls"
                : mapAnthropicStopReason(state.finishReasonRaw, state.usesJsonResponseTool),
        usage: mapAnthropicUsage(state.usage),
    };
};

export function mapFromAnthropicStreamEvent(
    event: AnthropicResponseStreamEvent,
    state: AnthropicStreamState,
): Result<
    { kind: "event"; event: Event } | { kind: "final"; response: GenerativeModelResponse } | null,
    BetterAgentError
> {
    switch (event.type) {
        case "ping":
            return ok(null);
        case "message_start":
            state.usage = {
                ...state.usage,
                ...event.message.usage,
            };
            state.finishReasonRaw = event.message.stop_reason;
            return ok(null);
        case "message_delta":
            if (event.delta.stop_reason != null) {
                state.finishReasonRaw = event.delta.stop_reason;
            }
            state.usage = {
                ...state.usage,
                ...(event.usage ?? {}),
            };
            return ok(null);
        case "content_block_start": {
            const { index, content_block: part } = event;
            switch (part.type) {
                case "text":
                case "compaction": {
                    const textMessageId = `${state.messageId}:text:${index}`;
                    state.blocks[index] = {
                        kind: "text",
                        messageId: textMessageId,
                        text: part.type === "compaction" ? part.content : "",
                        ...(part.type === "text" && part.citations?.length
                            ? { citations: [...part.citations] }
                            : {}),
                    };
                    return ok({
                        kind: "event",
                        event: {
                            type: Events.TEXT_MESSAGE_START,
                            messageId: textMessageId,
                            role: "assistant",
                            timestamp: Date.now(),
                        },
                    });
                }
                case "thinking":
                case "redacted_thinking": {
                    const reasoningMessageId = `${state.messageId}:reasoning:${index}`;
                    state.blocks[index] = {
                        kind: "reasoning",
                        messageId: reasoningMessageId,
                    };
                    return ok({
                        kind: "event",
                        event: {
                            type: Events.REASONING_MESSAGE_START,
                            messageId: reasoningMessageId,
                            role: "assistant",
                            visibility: "full",
                            timestamp: Date.now(),
                        },
                    });
                }
                case "tool_use": {
                    const outputAsText = state.usesJsonResponseTool && part.name === "json";
                    const initialInput = JSON.stringify(part.input ?? {});
                    state.blocks[index] = {
                        kind: "tool",
                        callId: part.id,
                        toolName: part.name,
                        rawToolName: part.name,
                        rawType: "tool_use",
                        input: initialInput === "{}" ? "" : initialInput,
                        outputAsText,
                        providerExecuted: false,
                    };

                    if (outputAsText) {
                        const textMessageId = `${state.messageId}:text:${index}`;
                        state.blocks[index] = {
                            ...(state.blocks[index] as ToolBlockState),
                            kind: "tool",
                        };
                        return ok({
                            kind: "event",
                            event: {
                                type: Events.TEXT_MESSAGE_START,
                                messageId: textMessageId,
                                role: "assistant",
                                timestamp: Date.now(),
                            },
                        });
                    }

                    return ok({
                        kind: "event",
                        event: createToolStartEvent(state.messageId, part.id, part.name),
                    });
                }
                case "server_tool_use": {
                    state.serverToolCalls[part.id] = part.name;
                    state.blocks[index] = {
                        kind: "tool",
                        callId: part.id,
                        toolName: normalizeProviderToolName(part.name),
                        rawToolName: part.name,
                        rawType: "server_tool_use",
                        input:
                            JSON.stringify(part.input ?? {}) === "{}"
                                ? ""
                                : JSON.stringify(part.input ?? {}),
                        outputAsText: false,
                        providerExecuted: true,
                    };

                    return ok({
                        kind: "event",
                        event: createToolStartEvent(
                            state.messageId,
                            part.id,
                            normalizeProviderToolName(part.name),
                        ),
                    });
                }
                case "mcp_tool_use": {
                    state.mcpToolCalls[part.id] = part.name;
                    state.blocks[index] = {
                        kind: "tool",
                        callId: part.id,
                        toolName: part.name,
                        rawToolName: part.name,
                        rawType: "mcp_tool_use",
                        input:
                            JSON.stringify(part.input ?? {}) === "{}"
                                ? ""
                                : JSON.stringify(part.input ?? {}),
                        outputAsText: false,
                        providerExecuted: true,
                        extra:
                            part.server_name != null
                                ? { server_name: part.server_name }
                                : undefined,
                    };

                    return ok({
                        kind: "event",
                        event: createToolStartEvent(state.messageId, part.id, part.name),
                    });
                }
                case "mcp_tool_result":
                case "web_fetch_tool_result":
                case "web_search_tool_result":
                case "code_execution_tool_result":
                case "bash_code_execution_tool_result":
                case "text_editor_code_execution_tool_result":
                case "tool_search_tool_result": {
                    const toolName = mapProviderToolResultName(
                        part,
                        state.serverToolCalls,
                        state.mcpToolCalls,
                    );
                    state.outputItems.push({
                        type: "provider-tool-result",
                        name: toolName,
                        callId: part.tool_use_id,
                        result: part,
                        isError:
                            "is_error" in part && typeof part.is_error === "boolean"
                                ? part.is_error
                                : undefined,
                    });
                    return ok({
                        kind: "event",
                        event: createToolResultEvent(
                            state.messageId,
                            part.tool_use_id,
                            toolName,
                            part,
                            "is_error" in part && typeof part.is_error === "boolean"
                                ? part.is_error
                                : undefined,
                        ),
                    });
                }
            }

            return ok(null);
        }
        case "content_block_delta": {
            const block = state.blocks[event.index];
            if (!block) return ok(null);

            switch (event.delta.type) {
                case "text_delta":
                    if (block.kind !== "text") return ok(null);
                    block.text += event.delta.text;
                    return ok({
                        kind: "event",
                        event: {
                            type: Events.TEXT_MESSAGE_CONTENT,
                            messageId: block.messageId,
                            delta: event.delta.text,
                            timestamp: Date.now(),
                        },
                    });
                case "compaction_delta":
                    if (block.kind !== "text") return ok(null);
                    if (event.delta.content) {
                        block.text += event.delta.content;
                        return ok({
                            kind: "event",
                            event: {
                                type: Events.TEXT_MESSAGE_CONTENT,
                                messageId: block.messageId,
                                delta: event.delta.content,
                                timestamp: Date.now(),
                            },
                        });
                    }
                    return ok(null);
                case "thinking_delta":
                    if (block.kind !== "reasoning") return ok(null);
                    return ok({
                        kind: "event",
                        event: {
                            type: Events.REASONING_MESSAGE_CONTENT,
                            messageId: block.messageId,
                            visibility: "full",
                            delta: event.delta.thinking,
                            timestamp: Date.now(),
                        },
                    });
                case "signature_delta":
                    return ok(null);
                case "input_json_delta":
                    if (block.kind !== "tool") return ok(null);
                    block.input += event.delta.partial_json;
                    if (block.outputAsText) {
                        return ok({
                            kind: "event",
                            event: {
                                type: Events.TEXT_MESSAGE_CONTENT,
                                messageId: `${state.messageId}:text:${event.index}`,
                                delta: event.delta.partial_json,
                                timestamp: Date.now(),
                            },
                        });
                    }
                    return ok({
                        kind: "event",
                        event: createToolArgsEvent(
                            state.messageId,
                            block.callId,
                            block.toolName,
                            event.delta.partial_json,
                        ),
                    });
                case "citations_delta":
                    if (block.kind !== "text") return ok(null);
                    block.citations = [...(block.citations ?? []), event.delta.citation];
                    return ok(null);
            }
            return ok(null);
        }
        case "content_block_stop": {
            const block = state.blocks[event.index];
            if (!block) return ok(null);
            delete state.blocks[event.index];

            if (block.kind === "text") {
                if (block.text.length > 0) {
                    state.assistantParts.push({
                        type: "text",
                        text: block.text,
                        ...(block.citations?.length
                            ? {
                                  providerMetadata: getAnthropicTextProviderMetadata(
                                      block.citations,
                                  ),
                              }
                            : {}),
                    });
                }
                return ok({
                    kind: "event",
                    event: {
                        type: Events.TEXT_MESSAGE_END,
                        messageId: block.messageId,
                        timestamp: Date.now(),
                    },
                });
            }

            if (block.kind === "reasoning") {
                return ok({
                    kind: "event",
                    event: {
                        type: Events.REASONING_MESSAGE_END,
                        messageId: block.messageId,
                        visibility: "full",
                        timestamp: Date.now(),
                    },
                });
            }

            if (block.outputAsText) {
                const finalText = block.input.trim() ? block.input : "{}";
                state.assistantParts.push({
                    type: "text",
                    text: finalText,
                });
                state.usesJsonResponseTool = true;
                return ok({
                    kind: "event",
                    event: {
                        type: Events.TEXT_MESSAGE_END,
                        messageId: `${state.messageId}:text:${event.index}`,
                        timestamp: Date.now(),
                    },
                });
            }

            if (block.rawType === "tool_use") {
                state.outputItems.push({
                    type: "tool-call",
                    name: block.toolName,
                    arguments: block.input.trim() ? block.input : "{}",
                    callId: block.callId,
                });
            } else {
                state.outputItems.push({
                    type: "provider-tool-result",
                    name: block.toolName,
                    callId: block.callId,
                    result: omitNullish({
                        type: block.rawType,
                        id: block.callId,
                        name: block.rawToolName,
                        input: parseMaybeJson(block.input),
                        ...(block.extra ?? {}),
                    }),
                });
            }

            return ok({
                kind: "event",
                event: createToolEndEvent(state.messageId, block.callId, block.toolName),
            });
        }
        case "message_stop":
            return ok({
                kind: "final",
                response: finalizeStreamResponse(state),
            });
        case "error":
            return err(
                BetterAgentError.fromCode(
                    "UPSTREAM_FAILED",
                    event.error.message ?? "Anthropic streaming error",
                    {
                        context: {
                            provider: "anthropic",
                            upstreamCode: event.error.type ?? "STREAM_ERROR",
                            raw: event,
                        },
                    },
                ).at({ at: "anthropic.messages.stream.event" }),
            );
    }
}
