import { TOOL_JSON_SCHEMA, isCallableToolDefinition } from "@better-agent/core";
import { Events } from "@better-agent/core/events";
import type { Event } from "@better-agent/core/events";
import type {
    GenerativeModelCallOptions,
    GenerativeModelFinishReason,
    GenerativeModelOutputItem,
    GenerativeModelOutputMessage,
    GenerativeModelOutputMessagePart,
    GenerativeModelProviderToolResult,
    GenerativeModelResponse,
    GenerativeModelUsage,
    ModalitiesParam,
} from "@better-agent/core/providers";
import { BetterAgentError } from "@better-agent/shared/errors";
import type { Result } from "@better-agent/shared/neverthrow";
import { err, ok } from "@better-agent/shared/neverthrow";
import { extractPassthroughOptions, omitNullish } from "../../utils/object-utils";

import type { XAIResponseStreamEvent } from "../shared/schemas";
import { isXAINativeToolDefinition, mapXAINativeToolToRequest } from "../tools";
import type { XAICreateResponse, XAICreateResponseSchema } from "./schemas";
import type { XAIResponseCaps, XAIResponseEndpointOptions, XAIResponseModelId } from "./types";

/**
 * Keys explicitly handled by the xAI responses mapper.
 */
const XAI_RESPONSE_KNOWN_KEYS: ReadonlySet<string> = new Set([
    // Framework-managed
    "input",
    "tools",
    "toolChoice",
    "modalities",
    "structured_output",
    // Explicitly mapped
    "include",
    "instructions",
    "logprobs",
    "max_output_tokens",
    "metadata",
    "parallel_tool_calls",
    "previous_response_id",
    "reasoning",
    "search_parameters",
    "service_tier",
    "store",
    "temperature",
    "top_logprobs",
    "top_p",
    "user",
]);

export function mapToXAIResponsesRequest<
    M extends XAIResponseModelId,
    TModalities extends ModalitiesParam<XAIResponseCaps> = undefined,
>(args: {
    modelId: M;
    options: GenerativeModelCallOptions<XAIResponseCaps, XAIResponseEndpointOptions, TModalities>;
}): Result<XAICreateResponseSchema, BetterAgentError> {
    try {
        const o = args.options;
        const raw = o as unknown as XAIResponseEndpointOptions;
        type InputItem = Extract<typeof o.input, readonly unknown[]>[number];
        type MessagePart = Extract<InputItem, { type: "message" }> extends {
            content: infer TContent;
        }
            ? TContent extends readonly unknown[]
                ? TContent[number]
                : never
            : never;
        const input: unknown[] =
            typeof o.input === "string"
                ? [{ role: "user", content: [{ type: "input_text", text: o.input }] }]
                : o.input.flatMap<unknown>((item: InputItem) => {
                      if (typeof item === "string") {
                          return [{ role: "user", content: [{ type: "input_text", text: item }] }];
                      }
                      if (item.type === "message") {
                          const role =
                              typeof item.role === "string" &&
                              (item.role === "system" ||
                                  item.role === "user" ||
                                  item.role === "assistant" ||
                                  item.role === "developer")
                                  ? item.role
                                  : "user";
                          const isAssistant = role === "assistant";
                          const content =
                              typeof item.content === "string"
                                  ? [
                                        isAssistant
                                            ? { type: "output_text" as const, text: item.content }
                                            : { type: "input_text" as const, text: item.content },
                                    ]
                                  : item.content.map((part: MessagePart) => {
                                        if (part.type === "text") {
                                            return isAssistant
                                                ? { type: "output_text" as const, text: part.text }
                                                : { type: "input_text" as const, text: part.text };
                                        }
                                        if (isAssistant) {
                                            throw BetterAgentError.fromCode(
                                                "VALIDATION_FAILED",
                                                "Assistant messages do not support image or file inputs",
                                                {
                                                    context: {
                                                        provider: "xai",
                                                        model: args.modelId,
                                                    },
                                                },
                                            ).at({ at: "xai.responses.map.input.assistantImage" });
                                        }
                                        if (part.type === "file") {
                                            if (part.source.kind !== "provider-file") {
                                                throw BetterAgentError.fromCode(
                                                    "VALIDATION_FAILED",
                                                    "xAI file inputs currently require a provider-file source",
                                                    {
                                                        context: {
                                                            provider: "xai",
                                                            model: args.modelId,
                                                            sourceKind: part.source.kind,
                                                        },
                                                    },
                                                ).at({ at: "xai.responses.map.input.fileSource" });
                                            }
                                            if (part.source.ref.provider !== "xai") {
                                                throw BetterAgentError.fromCode(
                                                    "VALIDATION_FAILED",
                                                    "xAI file inputs require a provider-file reference for provider=xai",
                                                    {
                                                        context: {
                                                            provider: "xai",
                                                            model: args.modelId,
                                                            sourceProvider:
                                                                part.source.ref.provider,
                                                        },
                                                    },
                                                ).at({
                                                    at: "xai.responses.map.input.fileProvider",
                                                });
                                            }
                                            return {
                                                type: "input_file" as const,
                                                file_id: part.source.ref.id,
                                                ...(part.source.filename != null
                                                    ? { filename: part.source.filename }
                                                    : {}),
                                            };
                                        }
                                        if (part.type !== "image") {
                                            throw BetterAgentError.fromCode(
                                                "VALIDATION_FAILED",
                                                `Unsupported message part for xAI Responses: ${part.type}`,
                                                {
                                                    context: {
                                                        provider: "xai",
                                                        model: args.modelId,
                                                        partType: part.type,
                                                    },
                                                },
                                            ).at({
                                                at: "xai.responses.map.input.unsupportedPart",
                                            });
                                        }

                                        return {
                                            type: "input_image" as const,
                                            detail: "auto" as const,
                                            image_url:
                                                part.source.kind === "url"
                                                    ? part.source.url
                                                    : `data:${part.source.mimeType};base64,${part.source.data}`,
                                        };
                                    });
                          return [{ role, content }];
                      }
                      const callArguments =
                          "arguments" in item && typeof item.arguments === "string"
                              ? item.arguments
                              : "{}";
                      const call = {
                          type: "function_call" as const,
                          call_id: item.callId,
                          name: item.name,
                          arguments: callArguments,
                      };
                      if (item.result == null) return [call];
                      return [
                          call,
                          {
                              type: "function_call_output" as const,
                              call_id: item.callId,
                              output:
                                  typeof item.result === "string"
                                      ? item.result
                                      : JSON.stringify(item.result),
                              status: item.isError === true ? "incomplete" : "completed",
                          },
                      ];
                  });

        let text: XAICreateResponseSchema["text"] | undefined;
        if ("structured_output" in o && o.structured_output) {
            const out = o.structured_output;
            const { name, strict = true } = out;
            if ((out.schema as { type?: unknown }).type !== "object") {
                return err(
                    BetterAgentError.fromCode(
                        "VALIDATION_FAILED",
                        "Structured output schema must be an object",
                        { context: { provider: "xai", model: args.modelId } },
                    ).at({ at: "xai.responses.map.structuredOutput" }),
                );
            }
            text = { format: { type: "json_schema" as const, name, strict, schema: out.schema } };
        }

        const xaiTools: NonNullable<XAICreateResponseSchema["tools"]> = [];
        const tools = ("tools" in o ? o.tools : []) ?? [];
        if (tools.length) {
            for (const tool of tools) {
                if (isXAINativeToolDefinition(tool)) {
                    xaiTools.push(mapXAINativeToolToRequest(tool));
                    continue;
                }
                const callableTool = tool as
                    | ({ [TOOL_JSON_SCHEMA]?: unknown } & Record<string, unknown>)
                    | undefined;
                if (!callableTool || !isCallableToolDefinition(callableTool as never)) continue;
                const parameters = callableTool[TOOL_JSON_SCHEMA];
                if ((parameters as { type?: unknown }).type !== "object") {
                    return err(
                        BetterAgentError.fromCode(
                            "VALIDATION_FAILED",
                            "Tool parameters schema must be an object",
                            { context: { provider: "xai", model: args.modelId } },
                        ).at({ at: "xai.responses.map.tools" }),
                    );
                }
                xaiTools.push({
                    type: "function",
                    name: String(callableTool.name ?? ""),
                    description:
                        typeof callableTool.description === "string"
                            ? callableTool.description
                            : null,
                    parameters,
                    strict: typeof callableTool.strict === "boolean" ? callableTool.strict : null,
                });
            }
        }

        let xaiToolChoice: XAICreateResponse["tool_choice"] | undefined;
        if (
            "tools" in o &&
            o.tools &&
            "toolChoice" in o &&
            o.toolChoice &&
            o.toolChoice.type !== "auto"
        ) {
            const tc = o.toolChoice;
            if (tc.type === "none") {
                xaiToolChoice = "none";
            } else if (tc.type === "required") {
                xaiToolChoice = "required";
            } else if (tc.type === "tool") {
                if (!xaiTools.length) {
                    return err(
                        BetterAgentError.fromCode(
                            "VALIDATION_FAILED",
                            "toolChoice=tool requires tools[] to be provided",
                            { context: { provider: "xai", model: args.modelId } },
                        ).at({ at: "xai.responses.map.toolChoice" }),
                    );
                }
                const exists = xaiTools.some(
                    (t) =>
                        typeof t === "object" &&
                        t &&
                        "type" in t &&
                        t.type === "function" &&
                        "name" in t &&
                        t.name === tc.name,
                );
                if (!exists) {
                    return err(
                        BetterAgentError.fromCode(
                            "VALIDATION_FAILED",
                            `Requested tool not found: ${tc.name}`,
                            { context: { provider: "xai", model: args.modelId } },
                        ).at({ at: "xai.responses.map.toolChoice" }),
                    );
                }
                xaiToolChoice = { type: "function", name: tc.name };
            }
        }

        const request: XAICreateResponseSchema = {
            ...extractPassthroughOptions(o as Record<string, unknown>, XAI_RESPONSE_KNOWN_KEYS),
            model: args.modelId as XAICreateResponseSchema["model"],
            input,
            ...omitNullish({
                text,
                tools: xaiTools.length ? xaiTools : undefined,
                tool_choice: xaiToolChoice,
                include: o.include,
                instructions: raw.instructions,
                metadata: o.metadata,
                parallel_tool_calls: o.parallel_tool_calls,
                previous_response_id: o.previous_response_id,
                reasoning: o.reasoning,
                search_parameters: o.search_parameters,
                service_tier: o.service_tier,
                store: o.store,
                user: o.user,
            }),
        };

        const responseOpts = o as {
            modalities?: readonly string[];
            logprobs?: boolean;
            max_output_tokens?: number;
            temperature?: number;
            top_logprobs?: number;
            top_p?: number;
        };
        if (responseOpts.modalities === undefined || responseOpts.modalities.includes("text")) {
            if (responseOpts.max_output_tokens != null)
                request.max_output_tokens = responseOpts.max_output_tokens;
            if (responseOpts.logprobs != null) request.logprobs = responseOpts.logprobs;
            if (responseOpts.temperature != null) request.temperature = responseOpts.temperature;
            if (responseOpts.top_logprobs != null) request.top_logprobs = responseOpts.top_logprobs;
            if (responseOpts.top_p != null) request.top_p = responseOpts.top_p;
        }

        return ok(request);
    } catch (e) {
        return err(
            BetterAgentError.wrap({
                err: e,
                message: "Failed to map xAI Responses request",
                opts: { code: "INTERNAL", context: { provider: "xai", model: args.modelId } },
            }).at({ at: "xai.responses.mapToRequest" }),
        );
    }
}

export function mapFromXAIResponsesResponse(response: XAICreateResponse): GenerativeModelResponse {
    const outputItems: Array<GenerativeModelOutputItem> = [];
    for (const item of response.output ?? []) {
        if (!item || typeof item !== "object" || !("type" in item)) continue;
        if (item.type === "message") {
            const parts: Array<GenerativeModelOutputMessagePart> = Array.isArray(item.content)
                ? item.content.flatMap<GenerativeModelOutputMessagePart>((part: unknown) => {
                      if (!part || typeof part !== "object" || !("type" in part)) return [];
                      const candidate = part as { type?: unknown; text?: unknown };
                      if (candidate.type === "output_text" && typeof candidate.text === "string") {
                          return [{ type: "text" as const, text: candidate.text }];
                      }
                      return [];
                  })
                : [];
            if (parts.length > 0) {
                outputItems.push({
                    type: "message",
                    role: (item.role ?? "assistant") as GenerativeModelOutputMessage["role"],
                    content: parts,
                });
            }
            continue;
        }
        if (
            item.type === "function_call" &&
            typeof item.name === "string" &&
            typeof item.call_id === "string"
        ) {
            outputItems.push({
                type: "tool-call",
                name: item.name,
                arguments: typeof item.arguments === "string" ? item.arguments : "{}",
                callId: item.call_id,
            });
            continue;
        }
        if (typeof item.type === "string" && item.type.endsWith("_call")) {
            if (!("id" in item) || !(typeof item.id === "string" && item.id.length > 0)) continue;
            outputItems.push({
                type: "provider-tool-result",
                name: item.type.slice(0, -"_call".length),
                callId: item.id,
                result: item,
            } satisfies GenerativeModelProviderToolResult);
            continue;
        }
        if (typeof item.type === "string" && item.type.endsWith("_call_output")) {
            if (
                !("call_id" in item) ||
                typeof item.call_id !== "string" ||
                item.call_id.length === 0
            )
                continue;
            outputItems.push({
                type: "provider-tool-result",
                name: item.type.slice(0, -"_call_output".length),
                callId: item.call_id,
                result: item,
            } satisfies GenerativeModelProviderToolResult);
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
    if (incompleteReason === "max_output_tokens") finishReason = "length";
    else if (incompleteReason === "content_filter") finishReason = "content-filter";
    else if (incompleteReason) finishReason = "other";
    else if (hasToolCalls) finishReason = "tool-calls";
    else finishReason = "stop";

    return { output: outputItems, finishReason, usage, response: { body: response } };
}

export function mapFromXAIResponsesStreamEvent(
    event: XAIResponseStreamEvent,
    messageId: string,
): Result<
    { kind: "event"; event: Event } | { kind: "final"; response: GenerativeModelResponse } | null,
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
                provider: "xai",
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
                delta: event.delta ?? "",
                provider: "xai",
                timestamp: Date.now(),
            },
        });
    }
    if (event.type === "response.reasoning_summary_text.done") {
        return ok({
            kind: "event",
            event: {
                type: Events.REASONING_MESSAGE_END,
                messageId,
                visibility: "summary",
                provider: "xai",
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
                delta: event.delta ?? "",
                provider: "xai",
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
                provider: "xai",
                timestamp: Date.now(),
            },
        });
    }
    if (event.type === "response.output_item.added") {
        if (event.item?.type === "message") {
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
        if (event.item?.type === "function_call") {
            const toolCallId =
                typeof event.item.call_id === "string" && event.item.call_id.length > 0
                    ? event.item.call_id
                    : event.item.id;
            if (!(typeof toolCallId === "string" && toolCallId.length > 0)) return ok(null);
            return ok({
                kind: "event",
                event: {
                    type: Events.TOOL_CALL_START,
                    toolCallId,
                    toolCallName: event.item.name ?? "",
                    parentMessageId: messageId,
                    timestamp: Date.now(),
                } as Event,
            });
        }
        if (
            typeof event.item?.type === "string" &&
            event.item.type.endsWith("_call") &&
            event.item.type !== "function_call" &&
            typeof event.item.id === "string" &&
            event.item.id.length > 0
        ) {
            return ok({
                kind: "event",
                event: {
                    type: Events.TOOL_CALL_START,
                    toolCallId: event.item.id,
                    toolCallName: event.item.type.slice(0, -"_call".length),
                    parentMessageId: messageId,
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
            event: { type: Events.TEXT_MESSAGE_END, messageId, timestamp: Date.now() },
        });
    }
    if (event.type === "response.function_call_arguments.delta") {
        const toolCallId =
            typeof event.call_id === "string" && event.call_id.length > 0
                ? event.call_id
                : event.item_id;
        if (!(typeof toolCallId === "string" && toolCallId.length > 0)) return ok(null);
        return ok({
            kind: "event",
            event: {
                type: Events.TOOL_CALL_ARGS,
                parentMessageId: messageId,
                toolCallId,
                toolCallName: "unknown",
                delta: event.delta ?? "",
                timestamp: Date.now(),
            } as Event,
        });
    }
    if (event.type === "response.function_call_arguments.done") {
        const toolCallId =
            typeof event.call_id === "string" && event.call_id.length > 0
                ? event.call_id
                : event.item_id;
        if (!(typeof toolCallId === "string" && toolCallId.length > 0)) return ok(null);
        return ok({
            kind: "event",
            event: {
                type: Events.TOOL_CALL_END,
                parentMessageId: messageId,
                toolCallId,
                toolCallName: "unknown",
                timestamp: Date.now(),
            } as Event,
        });
    }
    if (
        event.type === "response.web_search_call.in_progress" ||
        event.type === "response.web_search_call.searching" ||
        event.type === "response.web_search_call.completed" ||
        event.type === "response.x_search_call.in_progress" ||
        event.type === "response.x_search_call.searching" ||
        event.type === "response.x_search_call.completed" ||
        event.type === "response.file_search_call.in_progress" ||
        event.type === "response.file_search_call.searching" ||
        event.type === "response.file_search_call.completed" ||
        event.type === "response.code_interpreter_call.in_progress" ||
        event.type === "response.code_interpreter_call.interpreting" ||
        event.type === "response.code_interpreter_call.completed" ||
        event.type === "response.code_execution_call.in_progress" ||
        event.type === "response.code_execution_call.interpreting" ||
        event.type === "response.code_execution_call.completed" ||
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
                ...(typeof event.item_id === "string" ? { id: event.item_id } : {}),
                data: { endpoint: "responses", tool, status, raw: event },
                timestamp: Date.now(),
            },
        });
    }
    if (event.type === "response.output_item.done") {
        if (
            typeof event.item?.type === "string" &&
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
                    timestamp: Date.now(),
                } as Event,
            });
        }
    }
    if (event.type === "response.completed") {
        return ok({
            kind: "final",
            response: mapFromXAIResponsesResponse(event.response as XAICreateResponse),
        });
    }
    if (event.type === "error") {
        return err(
            BetterAgentError.fromCode("UPSTREAM_FAILED", event.message ?? "xAI streaming error", {
                context: { provider: "xai", upstreamCode: "STREAM_ERROR", raw: event },
            }).at({ at: "xai.responses.stream.event" }),
        );
    }
    return ok(null);
}
