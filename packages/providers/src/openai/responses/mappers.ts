import { TOOL_JSON_SCHEMA, isCallableToolDefinition } from "@better-agent/core";
import { Events } from "@better-agent/core/events";
import type { Event } from "@better-agent/core/events";
import type {
    Capabilities,
    GenerativeModelCallOptions,
    GenerativeModelFinishReason,
    GenerativeModelInputItem,
    GenerativeModelInputMessagePart,
    GenerativeModelOutputItem,
    GenerativeModelOutputMessage,
    GenerativeModelProviderToolResult,
    GenerativeModelResponse,
    GenerativeModelUsage,
    ModalitiesParam,
} from "@better-agent/core/providers";
import { BetterAgentError } from "@better-agent/shared/errors";
import type { Result } from "@better-agent/shared/neverthrow";
import { err, ok } from "@better-agent/shared/neverthrow";
import { extractPassthroughOptions, omitNullish } from "../../utils/object-utils";
import { isOpenAINativeToolDefinition, mapOpenAINativeToolToRequest } from "../tools";
import type { OpenAICapsFor, OpenAIOptionsFor } from "../types";
import type {
    OpenAICreateResponse,
    OpenAICreateResponseSchema,
    OpenAIFunctionItem,
    OpenAIInputItem,
    OpenAIResponseModels,
    OpenAIResponseStreamEvent,
} from "./schemas";
import type { OpenAIResponseCaps, OpenAIResponseEndpointOptions } from "./types";

/**
 * Keys explicitly handled by the OpenAI responses mapper.
 */
const OPENAI_RESPONSE_KNOWN_KEYS: ReadonlySet<string> = new Set([
    // Framework-managed (set by the runtime, not the user)
    "input",
    "tools",
    "toolChoice",
    "modalities",
    "structured_output",
    // Explicitly mapped to the request body
    "conversation",
    "include",
    "instructions",
    "logprobs",
    "max_output_tokens",
    "max_tool_calls",
    "maxToolCalls",
    "metadata",
    "parallel_tool_calls",
    "previous_response_id",
    "prompt_cache_key",
    "prompt_cache_retention",
    "reasoning",
    "reasoningEffort",
    "reasoningSummary",
    "safety_identifier",
    "service_tier",
    "store",
    "temperature",
    "text",
    "textVerbosity",
    "top_logprobs",
    "top_p",
    "truncation",
]);

const IMAGE_EXTENSIONS = new Set([
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".webp",
    ".bmp",
    ".svg",
    ".avif",
    ".heic",
    ".heif",
]);

const hasExtension = (value: string | undefined, extensions: Set<string>): boolean => {
    if (!value) return false;
    const lower = value.toLowerCase();
    for (const ext of extensions) {
        if (lower.endsWith(ext)) return true;
    }
    return false;
};

const isImageMimeType = (mimeType: string | undefined): boolean =>
    typeof mimeType === "string" && mimeType.toLowerCase().startsWith("image/");

const isPdfMimeType = (mimeType: string | undefined): boolean =>
    typeof mimeType === "string" && mimeType.toLowerCase() === "application/pdf";

const getFileSourceMimeType = (source: {
    mimeType?: string;
    filename?: string;
    url?: string;
}) =>
    source.mimeType ?? (source.url?.toLowerCase().endsWith(".pdf") ? "application/pdf" : undefined);

const isFileLikeImage = (source: {
    mimeType?: string;
    filename?: string;
    url?: string;
}) =>
    isImageMimeType(source.mimeType) ||
    hasExtension(source.filename, IMAGE_EXTENSIONS) ||
    hasExtension(source.url, IMAGE_EXTENSIONS);

const isFileLikePdf = (source: {
    mimeType?: string;
    filename?: string;
    url?: string;
}) =>
    isPdfMimeType(getFileSourceMimeType(source)) ||
    hasExtension(source.filename, new Set([".pdf"])) ||
    hasExtension(source.url, new Set([".pdf"]));

const toImageOutputMessage = (
    source:
        | {
              kind: "url";
              url: string;
          }
        | {
              kind: "base64";
              data: string;
              mimeType: string;
          },
): GenerativeModelOutputMessage => ({
    type: "message",
    role: "assistant",
    content: [
        {
            type: "image",
            source,
        },
    ],
});

const extractNativeToolOutputMessages = (
    item: Record<string, unknown> & { type: string },
): GenerativeModelOutputMessage[] => {
    if (item.type === "image_generation_call" && typeof item.result === "string") {
        return [
            toImageOutputMessage({
                kind: "base64",
                data: item.result,
                mimeType: "image/png",
            }),
        ];
    }

    return [];
};

export function mapToOpenAIResponsesRequest<
    M extends OpenAIResponseModels,
    TModalities extends ModalitiesParam<OpenAICapsFor<M>> = undefined,
>(args: {
    modelId: M;
    options: GenerativeModelCallOptions<OpenAICapsFor<M>, OpenAIOptionsFor<M>, TModalities>;
}): Result<OpenAICreateResponseSchema, BetterAgentError> {
    try {
        const o = args.options;
        const raw = o as unknown as OpenAIResponseEndpointOptions;
        type InputItem = GenerativeModelInputItem<OpenAIResponseCaps>;
        type MessagePart = GenerativeModelInputMessagePart<OpenAIResponseCaps>;
        const inputItems =
            typeof o.input === "string" ? undefined : (o.input as readonly InputItem[]);

        const input: OpenAICreateResponseSchema["input"] =
            typeof o.input === "string"
                ? [
                      {
                          role: "user",
                          content: [
                              {
                                  type: "input_text",
                                  text: o.input,
                              },
                          ],
                      },
                  ]
                : (inputItems ?? []).flatMap<OpenAIInputItem>((item) => {
                      if (typeof item === "string")
                          return [
                              {
                                  role: "user",
                                  content: [
                                      {
                                          type: "input_text",
                                          text: item,
                                      },
                                  ],
                              },
                          ];

                      if (item.type === "message") {
                          const role =
                              typeof item.role === "string" &&
                              (item.role === "system" ||
                                  item.role === "user" ||
                                  item.role === "assistant" ||
                                  item.role === "developer")
                                  ? (item.role as "system" | "user" | "assistant" | "developer")
                                  : "user";

                          const isAssistant = role === "assistant";
                          if (isAssistant) {
                              const content =
                                  typeof item.content === "string"
                                      ? [
                                            {
                                                type: "output_text" as const,
                                                text: item.content,
                                            },
                                        ]
                                      : item.content.flatMap((part: MessagePart) =>
                                            part.type === "text"
                                                ? [
                                                      {
                                                          type: "output_text" as const,
                                                          text: part.text,
                                                      },
                                                  ]
                                                : [],
                                        );

                              return [{ role, content } as OpenAIInputItem];
                          }

                          const content: Array<Record<string, unknown>> =
                              typeof item.content === "string"
                                  ? [
                                        {
                                            type: "input_text" as const,
                                            text: item.content,
                                        },
                                    ]
                                  : [];

                          if (Array.isArray(item.content)) {
                              for (const part of item.content as MessagePart[]) {
                                  if (part.type === "text") {
                                      content.push({
                                          type: "input_text" as const,
                                          text: part.text,
                                      });
                                      continue;
                                  }

                                  if (part.type === "file") {
                                      const source = part.source;
                                      const filename = source.filename;

                                      if (source.kind === "provider-file") {
                                          const providerSource = source as {
                                              kind: "provider-file";
                                              ref: { provider: string; id: string };
                                              filename?: string;
                                          };
                                          if (source.ref.provider !== "openai") {
                                              throw BetterAgentError.fromCode(
                                                  "VALIDATION_FAILED",
                                                  "OpenAI file inputs require a provider-file reference for provider=openai",
                                                  {
                                                      context: {
                                                          provider: "openai",
                                                          model: args.modelId,
                                                          sourceProvider: source.ref.provider,
                                                      },
                                                  },
                                              ).at({
                                                  at: "openai.responses.map.input.fileProvider",
                                              });
                                          }

                                          if (isFileLikeImage(providerSource)) {
                                              content.push({
                                                  type: "input_image" as const,
                                                  detail: "auto" as const,
                                                  file_id: providerSource.ref.id,
                                                  ...(filename != null ? { filename } : {}),
                                              });
                                              continue;
                                          }

                                          content.push({
                                              type: "input_file" as const,
                                              file_id: providerSource.ref.id,
                                              ...(filename != null ? { filename } : {}),
                                          });
                                          continue;
                                      }

                                      if (source.kind === "url") {
                                          const urlSource = source as {
                                              kind: "url";
                                              url: string;
                                              filename?: string;
                                              mimeType?: string;
                                          };
                                          if (isFileLikePdf(urlSource)) {
                                              content.push({
                                                  type: "input_file" as const,
                                                  file_url: urlSource.url,
                                                  ...(filename != null ? { filename } : {}),
                                              });
                                              continue;
                                          }

                                          content.push({
                                              type: "input_image" as const,
                                              detail: "auto" as const,
                                              image_url: urlSource.url,
                                          });
                                          continue;
                                      }

                                      const base64Source = source as {
                                          kind: "base64";
                                          data: string;
                                          mimeType: string;
                                          filename?: string;
                                      };
                                      const dataUrl = `data:${base64Source.mimeType};base64,${base64Source.data}`;
                                      if (isFileLikePdf(base64Source)) {
                                          content.push({
                                              type: "input_file" as const,
                                              file_data: dataUrl,
                                              ...(filename != null ? { filename } : {}),
                                          });
                                          continue;
                                      }

                                      content.push({
                                          type: "input_image" as const,
                                          detail: "auto" as const,
                                          image_url: dataUrl,
                                      });
                                      continue;
                                  }

                                  if (part.type !== "image") {
                                      throw BetterAgentError.fromCode(
                                          "VALIDATION_FAILED",
                                          `Unsupported message part for OpenAI Responses: ${part.type}`,
                                          {
                                              context: {
                                                  provider: "openai",
                                                  model: args.modelId,
                                                  partType: part.type,
                                              },
                                          },
                                      ).at({
                                          at: "openai.responses.map.input.unsupportedPart",
                                      });
                                  }

                                  const source = part.source;
                                  const imageUrl =
                                      source.kind === "url"
                                          ? source.url
                                          : `data:${source.mimeType};base64,${source.data}`;
                                  content.push({
                                      type: "input_image" as const,
                                      detail: "auto" as const,
                                      image_url: imageUrl,
                                  });
                              }
                          }

                          return [{ role, content: content as never } as OpenAIInputItem];
                      }

                      const callArguments =
                          "arguments" in item && typeof item.arguments === "string"
                              ? item.arguments
                              : "{}";

                      const call: OpenAIFunctionItem = {
                          type: "function_call",
                          call_id: item.callId,
                          name: item.name,
                          arguments: callArguments,
                      };

                      if (item.result == null) return [call];

                      const out: OpenAIFunctionItem = {
                          type: "function_call_output",
                          call_id: item.callId,
                          output:
                              typeof item.result === "string"
                                  ? item.result
                                  : JSON.stringify(item.result),
                          status: item.isError === true ? "incomplete" : "completed",
                      };

                      return [call, out];
                  });

        let text: OpenAICreateResponseSchema["text"] | undefined;
        if ("structured_output" in o && o.structured_output) {
            const out = o.structured_output;
            const { name, strict = true } = out;
            if ((out.schema as { type?: unknown }).type !== "object") {
                return err(
                    BetterAgentError.fromCode(
                        "VALIDATION_FAILED",
                        "Structured output schema must be an object",
                        { context: { provider: "openai", model: args.modelId } },
                    ).at({
                        at: "openai.responses.map.structuredOutput",
                    }),
                );
            }

            text = {
                format: {
                    type: "json_schema" as const,
                    name,
                    strict,
                    schema: out.schema,
                },
            };
        }

        type OpenAITool = NonNullable<OpenAICreateResponseSchema["tools"]>[number];
        const openAiTools: OpenAITool[] = [];

        const tools = ("tools" in o ? o.tools : []) ?? [];

        if (tools.length) {
            for (const tool of tools) {
                if (isOpenAINativeToolDefinition(tool)) {
                    openAiTools.push(mapOpenAINativeToolToRequest(tool));
                    continue;
                }

                const callableTool = tool as
                    | ({ [TOOL_JSON_SCHEMA]?: unknown } & Record<string, unknown>)
                    | undefined;
                if (!callableTool || !isCallableToolDefinition(callableTool as never)) continue;

                const parameters = callableTool[TOOL_JSON_SCHEMA];

                if (
                    (
                        parameters as {
                            type?: unknown;
                        }
                    ).type !== "object"
                ) {
                    return err(
                        BetterAgentError.fromCode(
                            "VALIDATION_FAILED",
                            "Tool parameters schema must be an object",
                            { context: { provider: "openai", model: args.modelId } },
                        ).at({
                            at: "openai.responses.map.tools",
                        }),
                    );
                }

                openAiTools.push({
                    type: "function",
                    name: String(callableTool.name ?? ""),
                    description:
                        typeof callableTool.description === "string"
                            ? callableTool.description
                            : null,
                    parameters: parameters as Record<string, unknown>,
                    strict: typeof callableTool.strict === "boolean" ? callableTool.strict : null,
                });
            }
        }

        let openAiToolChoice: OpenAICreateResponse["tool_choice"] | undefined;
        if (
            "tools" in o &&
            o.tools &&
            "toolChoice" in o &&
            o.toolChoice &&
            o.toolChoice.type !== "auto"
        ) {
            const tc = o.toolChoice;

            if (tc.type === "none") {
                openAiToolChoice = "none";
            } else if (tc.type === "required") {
                openAiToolChoice = "required";
            } else if (tc.type === "tool") {
                if (!openAiTools.length) {
                    return err(
                        BetterAgentError.fromCode(
                            "VALIDATION_FAILED",
                            "toolChoice=tool requires tools[] to be provided",
                            {
                                context: {
                                    provider: "openai",
                                    model: args.modelId,
                                },
                            },
                        ).at({
                            at: "openai.responses.map.toolChoice",
                        }),
                    );
                }

                const exists = openAiTools.some(
                    (t) => t.type === "function" && "name" in t && t.name === tc.name,
                );

                if (!exists) {
                    return err(
                        BetterAgentError.fromCode(
                            "VALIDATION_FAILED",
                            `Requested tool not found: ${tc.name}`,
                            { context: { provider: "openai", model: args.modelId } },
                        ).at({
                            at: "openai.responses.map.toolChoice",
                        }),
                    );
                }

                openAiToolChoice = {
                    type: "function",
                    name: tc.name,
                };
            }
        }

        if (raw.text && typeof raw.text === "object") {
            text = { ...text, ...(raw.text as Record<string, unknown>) } as typeof text;
        }
        if (raw.textVerbosity != null) {
            text = { ...(text ?? {}), verbosity: raw.textVerbosity } as typeof text;
        }

        const request: Record<string, unknown> = {
            ...extractPassthroughOptions(o as Record<string, unknown>, OPENAI_RESPONSE_KNOWN_KEYS),
            model: args.modelId,
            input,
            ...omitNullish({
                text,
                tools: openAiTools.length ? openAiTools : undefined,
                tool_choice: openAiToolChoice,
                conversation: o.conversation,
                include: o.include,
                instructions: raw.instructions,
                metadata: o.metadata,
                parallel_tool_calls: o.parallel_tool_calls,
                previous_response_id: o.previous_response_id,
                prompt_cache_key: o.prompt_cache_key,
                prompt_cache_retention: o.prompt_cache_retention,
                reasoning: o.reasoning,
                safety_identifier: o.safety_identifier,
                service_tier: o.service_tier,
                store: o.store,
                truncation: o.truncation,
            }),
            ...(o.reasoningEffort != null || o.reasoningSummary != null
                ? {
                      reasoning: {
                          ...(o.reasoning && typeof o.reasoning === "object" ? o.reasoning : {}),
                          ...omitNullish({
                              effort: o.reasoningEffort,
                              summary: o.reasoningSummary,
                          }),
                      },
                  }
                : {}),
        };

        const responseOpts = o as {
            modalities?: readonly string[];
            max_output_tokens?: number;
            max_tool_calls?: number;
            temperature?: number;
            top_logprobs?: number;
            top_p?: number;
        };

        const requestedLogprobs =
            typeof o.logprobs === "number" ? o.logprobs : o.logprobs === true ? 20 : undefined;

        if (o.logprobs != null) {
            request.include = Array.isArray(request.include)
                ? Array.from(new Set([...request.include, "message.output_text.logprobs"]))
                : ["message.output_text.logprobs"];
            if (requestedLogprobs != null) {
                request.top_logprobs = requestedLogprobs;
            }
        }

        const maxToolCalls = o.max_tool_calls ?? o.maxToolCalls;
        if (maxToolCalls != null) {
            request.max_tool_calls = maxToolCalls;
        }

        if (responseOpts.modalities === undefined || responseOpts.modalities.includes("text")) {
            if (responseOpts.max_output_tokens != null) {
                request.max_output_tokens = responseOpts.max_output_tokens;
            }
            if (responseOpts.max_tool_calls != null) {
                request.max_tool_calls = responseOpts.max_tool_calls;
            }
            if (responseOpts.temperature != null) request.temperature = responseOpts.temperature;
            if (responseOpts.top_logprobs != null) request.top_logprobs = responseOpts.top_logprobs;
            if (responseOpts.top_p != null) request.top_p = responseOpts.top_p;
        }

        return ok(request as OpenAICreateResponseSchema);
    } catch (e) {
        return err(
            BetterAgentError.wrap({
                err: e,
                message: "Failed to map OpenAI Responses request",
                opts: { code: "INTERNAL", context: { provider: "openai", model: args.modelId } },
            }).at({
                at: "openai.responses.mapToRequest",
            }),
        );
    }
}

export function mapFromOpenAIResponsesResponse(
    response: OpenAICreateResponse,
): GenerativeModelResponse {
    const outputItems: Array<GenerativeModelOutputItem> = [];

    for (const item of response.output ?? []) {
        if (item.type === "message") {
            const parts =
                item.content
                    ?.filter((part) => part.type === "output_text")
                    .map((part) => ({
                        type: "text" as const,
                        text: part.text,
                    })) ?? [];

            if (parts.length > 0) {
                outputItems.push({
                    type: "message",
                    role: item.role as GenerativeModelOutputMessage["role"],
                    content: parts,
                });
            }
            continue;
        }

        if (item.type === "function_call") {
            outputItems.push({
                type: "tool-call",
                name: item.name,
                arguments: item.arguments,
                callId: item.call_id,
            });
            continue;
        }

        const itemType = String(item.type);
        if (itemType === "tool_search_output") {
            const toolSearchItem = item as unknown as {
                type: "tool_search_output";
                call_id?: string;
                id: string;
            };
            outputItems.push({
                type: "provider-tool-result",
                name: "tool_search",
                callId: toolSearchItem.call_id ?? toolSearchItem.id,
                result: toolSearchItem,
            });
            continue;
        }

        if (typeof item.type === "string" && item.type.endsWith("_call")) {
            if (!(typeof item.id === "string" && item.id.length > 0)) continue;
            const nativeToolName = item.type.slice(0, -"_call".length);
            const nativeToolResult: GenerativeModelProviderToolResult = {
                type: "provider-tool-result",
                name: nativeToolName,
                callId: item.id,
                result: item,
            };

            outputItems.push(nativeToolResult);
            outputItems.push(
                ...extractNativeToolOutputMessages(
                    item as Record<string, unknown> & { type: string },
                ),
            );
            continue;
        }

        if (typeof item.type === "string" && item.type.endsWith("_call_output")) {
            if (!("call_id" in item)) continue;
            const callId = item.call_id;
            if (!(typeof callId === "string" && callId.length > 0)) continue;
            const nativeToolName = item.type.slice(0, -"_call_output".length);
            const nativeToolResult: GenerativeModelProviderToolResult = {
                type: "provider-tool-result",
                name: nativeToolName,
                callId,
                result: item,
            };

            outputItems.push(nativeToolResult);
        }
    }

    const inputTokens = response.usage?.input_tokens;
    const outputTokens = response.usage?.output_tokens;
    const totalTokens =
        typeof inputTokens === "number" && typeof outputTokens === "number"
            ? inputTokens + outputTokens
            : undefined;

    const usage: GenerativeModelUsage = omitNullish({
        inputTokens,
        outputTokens,
        totalTokens,
        reasoningTokens: response.usage?.output_tokens_details?.reasoning_tokens,
        cachedInputTokens: response.usage?.input_tokens_details?.cached_tokens,
    });

    const hasToolCalls = outputItems.some(
        (item) => item.type === "tool-call" && "arguments" in item,
    );

    let finishReason: GenerativeModelFinishReason;

    const incompleteReason = response.incomplete_details?.reason;
    if (incompleteReason === "max_output_tokens") {
        finishReason = "length";
    } else if (incompleteReason === "content_filter") {
        finishReason = "content-filter";
    } else if (incompleteReason) {
        finishReason = "other";
    } else if (hasToolCalls) {
        finishReason = "tool-calls";
    } else {
        finishReason = "stop";
    }

    return {
        output: outputItems,
        finishReason,
        usage,
        response: {
            body: response,
        },
    };
}

export function mapFromOpenAIResponsesStreamEvent<TModelCaps extends Capabilities>(
    event: OpenAIResponseStreamEvent,
    messageId: string,
): Result<
    | {
          kind: "event";
          event: Event;
      }
    | {
          kind: "final";
          response: GenerativeModelResponse<TModelCaps>;
      }
    | null,
    BetterAgentError
> {
    if (event.type === "response.reasoning_summary_part.added") {
        return ok({
            kind: "event",
            event: {
                type: Events.REASONING_MESSAGE_START,
                messageId,
                role: "assistant",
                visibility: "summary",
                provider: "openai",
                timestamp: Date.now(),
            },
        });
    }

    if (event.type === "response.reasoning_summary_text.delta") {
        return ok({
            kind: "event",
            event: {
                type: Events.REASONING_MESSAGE_CONTENT,
                messageId,
                visibility: "summary",
                delta: (event as { delta?: string }).delta ?? "",
                provider: "openai",
                timestamp: Date.now(),
            },
        });
    }

    if (
        event.type === "response.reasoning_summary_part.done" ||
        event.type === "response.reasoning_summary_text.done"
    ) {
        return ok({
            kind: "event",
            event: {
                type: Events.REASONING_MESSAGE_END,
                messageId,
                visibility: "summary",
                provider: "openai",
                timestamp: Date.now(),
            },
        });
    }

    if (event.type === "response.reasoning_text.delta") {
        return ok({
            kind: "event",
            event: {
                type: Events.REASONING_MESSAGE_CONTENT,
                messageId,
                visibility: "full",
                delta: (event as { delta?: string }).delta ?? "",
                provider: "openai",
                timestamp: Date.now(),
            },
        });
    }

    if (event.type === "response.reasoning_text.done") {
        return ok({
            kind: "event",
            event: {
                type: Events.REASONING_MESSAGE_END,
                messageId,
                visibility: "full",
                provider: "openai",
                timestamp: Date.now(),
            },
        });
    }

    if (event.type === "response.output_item.added") {
        if (event?.item?.type === "message") {
            return ok({
                kind: "event",
                event: {
                    type: Events.TEXT_MESSAGE_START,
                    messageId,
                    role: "assistant",
                    timestamp: Date.now(),
                },
            });
        }
        if (event?.item?.type === "function_call") {
            const toolCallId =
                typeof event.item.call_id === "string" && event.item.call_id.length > 0
                    ? event.item.call_id
                    : event.item.id;
            return ok({
                kind: "event",
                event: {
                    type: Events.TOOL_CALL_START,
                    toolCallId,
                    toolCallName: event?.item?.name ?? "",
                    parentMessageId: messageId,
                    runId: "",
                    agentName: "",
                    toolTarget: "hosted",
                    timestamp: Date.now(),
                } as Event,
            });
        }

        if (
            event.item.type.endsWith("_call") &&
            event.item.type !== "function_call" &&
            typeof event.item.id === "string" &&
            event.item.id.length > 0
        ) {
            const nativeToolName = event.item.type.slice(0, -"_call".length);
            return ok({
                kind: "event",
                event: {
                    type: Events.TOOL_CALL_START,
                    toolCallId: event.item.id,
                    toolCallName: nativeToolName,
                    parentMessageId: messageId,
                    runId: "",
                    agentName: "",
                    toolTarget: "hosted",
                    timestamp: Date.now(),
                } as Event,
            });
        }
    }

    if (event.type === "response.output_text.delta") {
        return ok({
            kind: "event",
            event: {
                type: Events.TEXT_MESSAGE_CONTENT,
                messageId,
                delta: event.delta ?? "",
                timestamp: Date.now(),
            },
        });
    }

    if (event.type === "response.output_text.done") {
        return ok({
            kind: "event",
            event: {
                type: Events.TEXT_MESSAGE_END,
                messageId,
                timestamp: Date.now(),
            },
        });
    }

    if (event.type === "response.function_call_arguments.delta") {
        const toolCallId =
            typeof event.call_id === "string" && event.call_id.length > 0
                ? event.call_id
                : event.item_id;
        return ok({
            kind: "event",
            event: {
                type: Events.TOOL_CALL_ARGS,
                parentMessageId: messageId,
                toolCallId,
                toolCallName: "unknown",
                delta: event.delta ?? "",
                runId: "",
                agentName: "",
                toolTarget: "hosted",
                timestamp: Date.now(),
            } as Event,
        });
    }

    if (event.type === "response.function_call_arguments.done") {
        const toolCallId =
            typeof event.call_id === "string" && event.call_id.length > 0
                ? event.call_id
                : event.item_id;
        return ok({
            kind: "event",
            event: {
                type: Events.TOOL_CALL_END,
                parentMessageId: messageId,
                toolCallId,
                toolCallName: "unknown",
                runId: "",
                agentName: "",
                toolTarget: "hosted",
                timestamp: Date.now(),
            } as Event,
        });
    }

    if (event.type === "response.code_interpreter_call_code.delta") {
        return ok({
            kind: "event",
            event: {
                type: Events.TOOL_CALL_ARGS,
                parentMessageId: messageId,
                toolCallId: event.item_id,
                toolCallName: "code_interpreter",
                delta: event.delta ?? "",
                runId: "",
                agentName: "",
                toolTarget: "hosted",
                timestamp: Date.now(),
            } as Event,
        });
    }

    if (event.type === "response.mcp_call_arguments.delta") {
        return ok({
            kind: "event",
            event: {
                type: Events.TOOL_CALL_ARGS,
                parentMessageId: messageId,
                toolCallId: event.item_id,
                toolCallName: "mcp",
                delta: event.delta ?? "",
                runId: "",
                agentName: "",
                toolTarget: "hosted",
                timestamp: Date.now(),
            } as Event,
        });
    }

    if (event.type === "response.custom_tool_call_input.delta") {
        return ok({
            kind: "event",
            event: {
                type: Events.TOOL_CALL_ARGS,
                parentMessageId: messageId,
                toolCallId: event.item_id,
                toolCallName: "custom_tool",
                delta: event.delta ?? "",
                runId: "",
                agentName: "",
                toolTarget: "hosted",
                timestamp: Date.now(),
            } as Event,
        });
    }

    if (
        event.type === "response.code_interpreter_call_code.done" ||
        event.type === "response.mcp_call_arguments.done" ||
        event.type === "response.custom_tool_call_input.done"
    ) {
        return ok({
            kind: "event",
            event: {
                type: Events.TOOL_CALL_END,
                parentMessageId: messageId,
                toolCallId: event.item_id,
                toolCallName:
                    event.type === "response.code_interpreter_call_code.done"
                        ? "code_interpreter"
                        : event.type === "response.mcp_call_arguments.done"
                          ? "mcp"
                          : "custom_tool",
                runId: "",
                agentName: "",
                toolTarget: "hosted",
                timestamp: Date.now(),
            } as Event,
        });
    }

    if (
        event.type === "response.web_search_call.in_progress" ||
        event.type === "response.web_search_call.searching" ||
        event.type === "response.web_search_call.completed" ||
        event.type === "response.file_search_call.in_progress" ||
        event.type === "response.file_search_call.searching" ||
        event.type === "response.file_search_call.completed" ||
        event.type === "response.code_interpreter_call.in_progress" ||
        event.type === "response.code_interpreter_call.interpreting" ||
        event.type === "response.code_interpreter_call.completed" ||
        event.type === "response.image_generation_call.in_progress" ||
        event.type === "response.image_generation_call.generating" ||
        event.type === "response.image_generation_call.completed" ||
        event.type === "response.computer_call.in_progress" ||
        event.type === "response.computer_call.completed" ||
        event.type === "response.computer_call.failed" ||
        event.type === "response.mcp_call.in_progress" ||
        event.type === "response.mcp_call.completed" ||
        event.type === "response.mcp_call.failed" ||
        event.type === "response.mcp_list_tools.in_progress" ||
        event.type === "response.mcp_list_tools.completed" ||
        event.type === "response.mcp_list_tools.failed"
    ) {
        const fullType = event.type.slice("response.".length);
        const dotIndex = fullType.lastIndexOf(".");
        const toolSegment = dotIndex >= 0 ? fullType.slice(0, dotIndex) : fullType;
        const status = dotIndex >= 0 ? fullType.slice(dotIndex + 1) : "unknown";
        const tool = toolSegment.endsWith("_call")
            ? toolSegment.slice(0, -"_call".length)
            : toolSegment;

        return ok({
            kind: "event",
            event: {
                type: Events.DATA_PART,
                id: event.item_id,
                data: {
                    endpoint: "responses",
                    tool,
                    status,
                    raw: event,
                },
                timestamp: Date.now(),
            } as Event,
        });
    }

    if (event.type === "response.image_generation_call.partial_image") {
        const partialEvent = event as {
            item_id?: unknown;
            partial_image_b64?: unknown;
            b64_json?: unknown;
            output_format?: unknown;
        };
        const data =
            typeof partialEvent.partial_image_b64 === "string"
                ? partialEvent.partial_image_b64
                : typeof partialEvent.b64_json === "string"
                  ? partialEvent.b64_json
                  : null;
        if (!data) return ok(null);

        return ok({
            kind: "event",
            event: {
                type: Events.IMAGE_MESSAGE_CONTENT,
                messageId:
                    typeof partialEvent.item_id === "string" && partialEvent.item_id.length > 0
                        ? partialEvent.item_id
                        : messageId,
                delta: {
                    kind: "base64",
                    data,
                    mimeType:
                        typeof partialEvent.output_format === "string"
                            ? `image/${partialEvent.output_format}`
                            : "image/png",
                },
                timestamp: Date.now(),
            },
        });
    }

    if (event.type === "response.output_item.done") {
        const doneItem = event.item as unknown as { type: string; call_id?: string; id?: string };
        if (doneItem.type === "tool_search_output") {
            const callId =
                typeof doneItem.call_id === "string" && doneItem.call_id.length > 0
                    ? doneItem.call_id
                    : doneItem.id;
            if (!(typeof callId === "string" && callId.length > 0)) {
                return ok(null);
            }

            return ok({
                kind: "event",
                event: {
                    type: Events.TOOL_CALL_RESULT,
                    parentMessageId: messageId,
                    toolCallId: callId,
                    toolCallName: "tool_search",
                    result: doneItem,
                    runId: "",
                    agentName: "",
                    toolTarget: "hosted",
                    timestamp: Date.now(),
                } as Event,
            });
        }

        if (
            event.item.type.endsWith("_call") &&
            event.item.type !== "function_call" &&
            typeof event.item.id === "string" &&
            event.item.id.length > 0
        ) {
            return ok({
                kind: "event",
                event: {
                    type: Events.TOOL_CALL_RESULT,
                    parentMessageId: messageId,
                    toolCallId: event.item.id,
                    toolCallName: event.item.type.slice(0, -"_call".length),
                    result: event.item,
                    runId: "",
                    agentName: "",
                    toolTarget: "hosted",
                    timestamp: Date.now(),
                } as Event,
            });
        }

        if (
            event.item.type.endsWith("_call_output") &&
            "call_id" in event.item &&
            typeof event.item.call_id === "string" &&
            event.item.call_id.length > 0
        ) {
            return ok({
                kind: "event",
                event: {
                    type: Events.TOOL_CALL_RESULT,
                    parentMessageId: messageId,
                    toolCallId: event.item.call_id,
                    toolCallName: event.item.type.slice(0, -"_call_output".length),
                    result: event.item,
                    runId: "",
                    agentName: "",
                    toolTarget: "hosted",
                    timestamp: Date.now(),
                } as Event,
            });
        }
    }

    if (event.type === "response.completed") {
        return ok({
            kind: "final",
            response: mapFromOpenAIResponsesResponse(event.response),
        });
    }

    if (event.type === "error") {
        const errorRecord =
            typeof event.error === "object" && event.error !== null
                ? (event.error as Record<string, unknown>)
                : undefined;
        const upstreamCode =
            typeof errorRecord?.code === "string"
                ? errorRecord.code
                : typeof errorRecord?.type === "string"
                  ? errorRecord.type
                  : "STREAM_ERROR";
        const userMessage =
            upstreamCode === "context_length_exceeded"
                ? "This conversation exceeds the model context window. Start a new thread or remove large generated content."
                : typeof event.message === "string" && event.message.length > 0
                  ? event.message
                  : typeof errorRecord?.message === "string" && errorRecord.message.length > 0
                    ? errorRecord.message
                    : "OpenAI streaming error";

        return err(
            BetterAgentError.fromCode(
                upstreamCode === "context_length_exceeded"
                    ? "CONTEXT_LENGTH_EXCEEDED"
                    : "UPSTREAM_FAILED",
                userMessage,
                {
                    context: {
                        provider: "openai",
                        upstreamCode,
                        raw: event,
                    },
                },
            ).at({
                at: "openai.responses.stream.event",
            }),
        );
    }

    return ok(null);
}
