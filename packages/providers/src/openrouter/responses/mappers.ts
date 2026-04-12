import { TOOL_JSON_SCHEMA, isCallableToolDefinition } from "@better-agent/core";
import type {
    GenerativeModelCallOptions,
    GenerativeModelFinishReason,
    GenerativeModelInputItem,
    GenerativeModelInputMessagePart,
    GenerativeModelOutputItem,
    GenerativeModelOutputMessage,
    GenerativeModelResponse,
    GenerativeModelUsage,
    ModalitiesParam,
} from "@better-agent/core/providers";
import { BetterAgentError } from "@better-agent/shared/errors";
import type { Result } from "@better-agent/shared/neverthrow";
import { err, ok } from "@better-agent/shared/neverthrow";
import { extractPassthroughOptions, omitNullish } from "../../utils/object-utils";
import { isOpenRouterNativeToolDefinition } from "../tools";
import type { OpenRouterResponseModelId } from "../types";
import type {
    OpenRouterChatCompletionChunk,
    OpenRouterChatCompletionResponse,
    OpenRouterChatCompletionsRequestSchema,
} from "./schemas";
import type { OpenRouterResponseCaps, OpenRouterResponseEndpointOptions } from "./types";

const OPENROUTER_RESPONSE_KNOWN_KEYS: ReadonlySet<string> = new Set([
    "input",
    "tools",
    "toolChoice",
    "modalities",
    "structured_output",
    "max_tokens",
    "temperature",
    "top_p",
    "frequency_penalty",
    "presence_penalty",
    "seed",
    "user",
    "reasoning",
    "include_reasoning",
    "prediction",
    "transforms",
    "route",
    "provider",
    "plugins",
    "audio",
]);

type OpenRouterInputItem = GenerativeModelInputItem<OpenRouterResponseCaps>;
type OpenRouterMessagePart = GenerativeModelInputMessagePart<OpenRouterResponseCaps>;
type OpenRouterRequestMessage = OpenRouterChatCompletionsRequestSchema["messages"][number];
type OpenRouterRequestContent = Exclude<OpenRouterRequestMessage["content"], string | null | undefined>;
type OpenRouterRequestContentPart = OpenRouterRequestContent[number];

type OpenRouterStreamState = {
    text: string;
    transcript: string;
    audioChunks: string[];
    audioFormat?: string;
    toolCalls: Array<{
        id: string;
        name: string;
        arguments: string;
    }>;
    finishReason?: GenerativeModelFinishReason;
};

const extractOpenRouterImageUrl = (image: unknown): string | undefined => {
    if (typeof image === "string") {
        return image;
    }

    if (!image || typeof image !== "object") {
        return undefined;
    }

    const candidate = image as {
        image_url?: string | { url?: string };
        url?: string;
    };

    if (typeof candidate.image_url === "string") {
        return candidate.image_url;
    }

    if (candidate.image_url && typeof candidate.image_url === "object") {
        return candidate.image_url.url;
    }

    return candidate.url;
};

const toDataUrl = (mimeType: string, data: string) => `data:${mimeType};base64,${data}`;

const mimeTypeToAudioFormat = (mimeType: string): string => {
    const normalized = mimeType.toLowerCase();
    switch (normalized) {
        case "audio/wav":
        case "audio/x-wav":
            return "wav";
        case "audio/mpeg":
        case "audio/mp3":
            return "mp3";
        case "audio/aiff":
        case "audio/x-aiff":
            return "aiff";
        case "audio/aac":
            return "aac";
        case "audio/ogg":
        case "audio/vorbis":
            return "ogg";
        case "audio/flac":
        case "audio/x-flac":
            return "flac";
        case "audio/mp4":
        case "audio/x-m4a":
        case "audio/m4a":
            return "m4a";
        case "audio/pcm":
        case "audio/l16":
            return "pcm16";
        case "audio/l24":
            return "pcm24";
        default:
            throw BetterAgentError.fromCode(
                "VALIDATION_FAILED",
                `Unsupported OpenRouter audio mime type: ${mimeType}`,
                { context: { provider: "openrouter", mimeType } },
            ).at({ at: "openrouter.responses.map.audioMimeType" });
    }
};

export const audioFormatToMimeType = (format: string): string => {
    switch (format.toLowerCase()) {
        case "wav":
            return "audio/wav";
        case "mp3":
            return "audio/mpeg";
        case "aiff":
            return "audio/aiff";
        case "aac":
            return "audio/aac";
        case "ogg":
            return "audio/ogg";
        case "flac":
            return "audio/flac";
        case "m4a":
            return "audio/m4a";
        case "pcm16":
            return "audio/pcm";
        case "pcm24":
            return "audio/l24";
        default:
            return "audio/wav";
    }
};

const mapUsage = (usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
} | null): GenerativeModelUsage =>
    omitNullish({
        inputTokens: usage?.prompt_tokens,
        outputTokens: usage?.completion_tokens,
        totalTokens: usage?.total_tokens,
    });

const mapFinishReason = (finishReason?: string | null): GenerativeModelFinishReason => {
    switch (finishReason) {
        case "tool_calls":
            return "tool-calls";
        case "length":
            return "length";
        case "content_filter":
            return "content-filter";
        case "stop":
        default:
            return "stop";
    }
};

const mapMessagePart = (
    modelId: string,
    part: OpenRouterMessagePart,
    role: string,
): OpenRouterRequestContentPart => {
    if (part.type === "text") {
        return { type: "text", text: part.text };
    }

    if (part.type === "image") {
        const url =
            part.source.kind === "url"
                ? part.source.url
                : toDataUrl(part.source.mimeType, part.source.data);
        return {
            type: "image_url",
            image_url: { url },
        };
    }

    if (part.type === "file") {
        if (part.source.kind === "provider-file") {
            throw BetterAgentError.fromCode(
                "VALIDATION_FAILED",
                "OpenRouter file inputs do not support provider-file references",
                { context: { provider: "openrouter", model: modelId } },
            ).at({ at: "openrouter.responses.map.providerFile" });
        }

        const file_data =
            part.source.kind === "url"
                ? part.source.url
                : toDataUrl(part.source.mimeType, part.source.data);

        return {
            type: "file",
            file: {
                file_data,
                ...(part.source.filename != null ? { filename: part.source.filename } : {}),
            },
        };
    }

    if (part.type === "audio") {
        if (part.source.kind === "url") {
            throw BetterAgentError.fromCode(
                "VALIDATION_FAILED",
                "OpenRouter audio inputs require base64-encoded content, not remote URLs",
                { context: { provider: "openrouter", model: modelId } },
            ).at({ at: "openrouter.responses.map.audioUrl" });
        }

        return {
            type: "input_audio",
            inputAudio: {
                data: part.source.data,
                format: mimeTypeToAudioFormat(part.source.mimeType),
            },
        };
    }

    throw BetterAgentError.fromCode(
        "VALIDATION_FAILED",
        `Unsupported OpenRouter message part for role=${role}: ${part.type}`,
        { context: { provider: "openrouter", model: modelId, role, partType: part.type } },
    ).at({ at: "openrouter.responses.map.unsupportedPart" });
};

const mapInputToMessages = (
    modelId: OpenRouterResponseModelId,
    input: GenerativeModelCallOptions<OpenRouterResponseCaps, OpenRouterResponseEndpointOptions>["input"],
): OpenRouterChatCompletionsRequestSchema["messages"] => {
    if (typeof input === "string") {
        return [{ role: "user", content: input }];
    }

    const messages: OpenRouterChatCompletionsRequestSchema["messages"] = [];

    for (const item of input) {
        if (typeof item === "string") {
            messages.push({ role: "user", content: item });
            continue;
        }

        if (item.type === "message") {
            const role = typeof item.role === "string" ? item.role : "user";

            if (typeof item.content === "string") {
                messages.push({ role, content: item.content });
                continue;
            }

            if (role === "assistant") {
                const textContent = item.content
                    .filter(
                        (part): part is Extract<OpenRouterMessagePart, { type: "text" }> =>
                            part.type === "text",
                    )
                    .map((part) => part.text)
                    .join("\n");

                messages.push({ role, content: textContent });
                continue;
            }

            const contentParts: OpenRouterRequestContentPart[] = item.content.map((part) =>
                mapMessagePart(modelId, part, role),
            );
            messages.push({ role, content: contentParts });
            continue;
        }

        const argumentsText =
            item.type === "tool-call" && "arguments" in item && typeof item.arguments === "string"
                ? item.arguments
                : "{}";
        const toolCallId = item.callId;
        const assistantCall = {
            role: "assistant",
            content: null,
            tool_calls: [
                {
                    id: toolCallId,
                    type: "function" as const,
                    function: {
                        name: item.name,
                        arguments: argumentsText,
                    },
                },
            ],
        };

        messages.push(assistantCall);
        if ("result" in item && item.result != null) {
            messages.push({
                role: "tool",
                tool_call_id: toolCallId,
                content:
                    typeof item.result === "string" ? item.result : JSON.stringify(item.result),
            });
        }
    }

    return messages;
};

export function mapToOpenRouterChatCompletionsRequest<
    M extends OpenRouterResponseModelId,
    TModalities extends ModalitiesParam<OpenRouterResponseCaps> = undefined,
>(args: {
    modelId: M;
    options: GenerativeModelCallOptions<OpenRouterResponseCaps, OpenRouterResponseEndpointOptions, TModalities>;
}): Result<OpenRouterChatCompletionsRequestSchema, BetterAgentError> {
    try {
        const o = args.options;
        const request: OpenRouterChatCompletionsRequestSchema = {
            ...extractPassthroughOptions(o as Record<string, unknown>, OPENROUTER_RESPONSE_KNOWN_KEYS),
            model: args.modelId,
            messages: mapInputToMessages(args.modelId, o.input),
            ...omitNullish({
                modalities: o.modalities as OpenRouterChatCompletionsRequestSchema["modalities"],
                max_tokens: o.max_tokens,
                temperature: o.temperature,
                top_p: o.top_p,
                frequency_penalty: o.frequency_penalty,
                presence_penalty: o.presence_penalty,
                seed: o.seed,
                user: o.user,
                reasoning: o.reasoning,
                include_reasoning: o.include_reasoning,
                prediction: o.prediction,
                transforms: o.transforms,
                route: o.route,
                provider: o.provider,
                plugins: o.plugins,
                audio: o.audio,
            }),
        };

        const tools = o.tools ?? [];
        const mappedTools: NonNullable<OpenRouterChatCompletionsRequestSchema["tools"]> = [];
        const plugins: NonNullable<OpenRouterChatCompletionsRequestSchema["plugins"]> = [
            ...(request.plugins ?? []),
        ];

        for (const tool of tools) {
            if (isOpenRouterNativeToolDefinition(tool)) {
                if (tool.type === "web_search") {
                    mappedTools.push({
                        type: "web_search",
                        ...tool.config,
                    });
                }
                continue;
            }

            if (!isCallableToolDefinition(tool as never)) continue;
            const schema = (tool as { [TOOL_JSON_SCHEMA]?: unknown })[TOOL_JSON_SCHEMA];
            if ((schema as { type?: unknown })?.type !== "object") {
                return err(
                    BetterAgentError.fromCode(
                        "VALIDATION_FAILED",
                        "Tool parameters schema must be an object",
                        { context: { provider: "openrouter", model: args.modelId } },
                    ).at({ at: "openrouter.responses.map.tools" }),
                );
            }

            mappedTools.push({
                type: "function",
                function: {
                    name: String(tool.name),
                    description: tool.description,
                    parameters: schema as Record<string, unknown>,
                    ...(typeof (tool as { strict?: unknown }).strict === "boolean"
                        ? { strict: (tool as { strict: boolean }).strict }
                        : {}),
                },
            });
        }

        if (mappedTools.length) request.tools = mappedTools;
        if (plugins.length) request.plugins = plugins;

        if (o.toolChoice) {
            switch (o.toolChoice.type) {
                case "auto":
                    request.tool_choice = "auto";
                    break;
                case "none":
                    request.tool_choice = "none";
                    break;
                case "required":
                    request.tool_choice = "required";
                    break;
                case "tool":
                    request.tool_choice = {
                        type: "function",
                        function: {
                            name: o.toolChoice.name,
                        },
                    };
                    break;
            }
        }

        if (o.structured_output) {
            request.response_format = {
                type: "json_schema",
                json_schema: {
                    name: o.structured_output.name,
                    schema: o.structured_output.schema,
                    ...(o.structured_output.strict !== undefined
                        ? { strict: o.structured_output.strict }
                        : {}),
                },
            };
        }

        return ok(request);
    } catch (e) {
        return err(
            BetterAgentError.wrap({
                err: e,
                message: "Failed to map OpenRouter chat request",
                opts: { code: "INTERNAL", context: { provider: "openrouter", model: args.modelId } },
            }).at({ at: "openrouter.responses.mapToRequest" }),
        );
    }
}

const buildOutputMessages = (
    message: NonNullable<OpenRouterChatCompletionResponse["choices"][number]>["message"],
) => {
    const output: GenerativeModelOutputItem<OpenRouterResponseCaps>[] = [];
    const contentParts: Array<
        | {
              type: "text";
              text: string;
          }
        | {
              type: "image";
              source: {
                  kind: "url";
                  url: string;
              };
          }
        | {
              type: "audio";
              source: {
                  kind: "base64";
                  data: string;
                  mimeType: string;
              };
          }
        | {
              type: "transcript";
              text: string;
          }
    > = [];

    if (typeof message.content === "string" && message.content.length > 0) {
        contentParts.push({ type: "text", text: message.content });
    } else if (Array.isArray(message.content)) {
        for (const part of message.content) {
            if (part.type === "text") {
                contentParts.push({ type: "text", text: part.text });
            }
        }
    }

    for (const imageUrl of (message.images ?? []).map(extractOpenRouterImageUrl)) {
        if (!imageUrl) continue;
        contentParts.push({
            type: "image",
            source: {
                kind: "url",
                url: imageUrl,
            },
        });
    }

    if (typeof message.audio?.data === "string" && message.audio.data.length > 0) {
        contentParts.push({
            type: "audio",
            source: {
                kind: "base64",
                data: message.audio.data,
                mimeType: "audio/wav",
            },
        });
    }

    if (typeof message.audio?.transcript === "string" && message.audio.transcript.length > 0) {
        contentParts.push({
            type: "transcript",
            text: message.audio.transcript,
        });
    }

    if (contentParts.length > 0) {
        output.push({
            type: "message",
            role: "assistant",
            content: contentParts,
        });
    }

    for (const toolCall of message.tool_calls ?? []) {
        output.push({
            type: "tool-call",
            callId: toolCall.id ?? "",
            name: toolCall.function.name ?? "",
            arguments: toolCall.function.arguments ?? "{}",
        });
    }

    return output;
};

export function mapFromOpenRouterChatCompletion(
    raw: OpenRouterChatCompletionResponse,
): GenerativeModelResponse<OpenRouterResponseCaps> {
    const firstChoice = raw.choices[0];
    const output = firstChoice ? buildOutputMessages(firstChoice.message) : [];

    return {
        output,
        finishReason: mapFinishReason(firstChoice?.finish_reason),
        usage: mapUsage(raw.usage),
        response: {
            body: raw,
        },
    };
}

export function createOpenRouterStreamState(): OpenRouterStreamState {
    return {
        text: "",
        transcript: "",
        audioChunks: [],
        toolCalls: [],
    };
}

export function mapFromOpenRouterChatCompletionChunk(
    chunk: OpenRouterChatCompletionChunk,
    state: OpenRouterStreamState,
): Result<
    | {
          kind: "text-delta";
          delta: string;
      }
    | {
          kind: "audio-delta";
          data: string;
      }
    | {
          kind: "transcript-delta";
          delta: string;
      }
    | {
          kind: "final";
          response: GenerativeModelResponse<OpenRouterResponseCaps>;
      }
    | null,
    BetterAgentError
> {
    const choice = chunk.choices[0];
    if (!choice) return ok(null);

    if (choice.delta?.tool_calls?.length) {
        const toolCall = choice.delta.tool_calls[0];
        if (!toolCall) return ok(null);
        const index = toolCall.index ?? 0;
        if (!state.toolCalls[index]) {
            state.toolCalls[index] = {
                id: toolCall.id ?? `tool_${index}`,
                name: toolCall.function?.name ?? "",
                arguments: toolCall.function?.arguments ?? "",
            };
            return ok(null);
        }

        const currentToolCall = state.toolCalls[index];
        if (!currentToolCall) return ok(null);

        if (toolCall.function?.name) currentToolCall.name = toolCall.function.name;
        if (toolCall.function?.arguments) {
            currentToolCall.arguments += toolCall.function.arguments;
            return ok(null);
        }
    }

    if (choice.delta?.content) {
        state.text += choice.delta.content;
        return ok({
            kind: "text-delta",
            delta: choice.delta.content,
        });
    }

    if (typeof choice.delta?.audio?.data === "string" && choice.delta.audio.data.length > 0) {
        state.audioChunks.push(choice.delta.audio.data);
        return ok({
            kind: "audio-delta",
            data: choice.delta.audio.data,
        });
    }

    if (
        typeof choice.delta?.audio?.transcript === "string" &&
        choice.delta.audio.transcript.length > 0
    ) {
        state.transcript += choice.delta.audio.transcript;
        return ok({
            kind: "transcript-delta",
            delta: choice.delta.audio.transcript,
        });
    }

    if (choice.finish_reason) {
        state.finishReason = mapFinishReason(choice.finish_reason);
        const output: GenerativeModelOutputItem<OpenRouterResponseCaps>[] = [];
        if (
            state.text.length > 0 ||
            state.audioChunks.length > 0 ||
            state.transcript.length > 0
        ) {
            output.push({
                type: "message",
                role: "assistant",
                content: [
                    ...(state.text.length > 0 ? [{ type: "text" as const, text: state.text }] : []),
                    ...(state.audioChunks.length > 0
                        ? [
                              {
                                  type: "audio" as const,
                                  source: {
                                      kind: "base64" as const,
                                      data: state.audioChunks.join(""),
                                      mimeType: audioFormatToMimeType(state.audioFormat ?? "wav"),
                                  },
                              },
                          ]
                        : []),
                    ...(state.transcript.length > 0
                        ? [{ type: "transcript" as const, text: state.transcript }]
                        : []),
                ],
            });
        }
        for (const toolCall of state.toolCalls) {
            if (!toolCall) continue;
            output.push({
                type: "tool-call",
                callId: toolCall.id,
                name: toolCall.name,
                arguments: toolCall.arguments,
            });
        }
        return ok({
            kind: "final",
            response: {
                output,
                finishReason: state.finishReason ?? "stop",
                usage: {},
                response: {
                    body: chunk,
                },
            },
        });
    }

    return ok(null);
}
