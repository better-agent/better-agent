import type { AgentMessage, AgentMessageContent } from "@better-agent/core";
import type { ModelMessage } from "ai";

type AiSdkSystemMessage = Extract<ModelMessage, { role: "system" }>;

export function textFromContent(content: AgentMessageContent | undefined): string {
    if (typeof content === "string") {
        return content;
    }

    if (!Array.isArray(content)) {
        return "";
    }

    return content
        .map((part) => {
            if (part.type === "text") {
                return part.text;
            }

            return "";
        })
        .filter(Boolean)
        .join("");
}

function sourceValue(source: { type: string; value: string; mimeType?: string }): string {
    if (source.type === "data") {
        return `data:${source.mimeType ?? "application/octet-stream"};base64,${source.value}`;
    }

    return source.value;
}

type AiSdkUserMessageContent = Extract<ModelMessage, { role: "user" }>["content"];
type AiSdkUserContentPart = Exclude<AiSdkUserMessageContent, string>[number];

export function toAiSdkUserContent(
    content: AgentMessageContent | undefined,
): AiSdkUserMessageContent {
    if (typeof content === "string") {
        return content;
    }

    if (!Array.isArray(content)) {
        return "";
    }

    const parts: AiSdkUserContentPart[] = [];

    for (const part of content) {
        if (part.type === "text") {
            parts.push({ type: "text" as const, text: part.text });
            continue;
        }

        if (part.type === "image") {
            parts.push({
                type: "image" as const,
                image: sourceValue(part.source),
                ...(part.source.mimeType ? { mediaType: part.source.mimeType } : {}),
            });
            continue;
        }

        if (part.type === "audio" || part.type === "video" || part.type === "document") {
            parts.push({
                type: "file" as const,
                data: sourceValue(part.source),
                mediaType: part.source.mimeType ?? "application/octet-stream",
            });
        }
    }

    return parts;
}

function jsonToolOutput(content: unknown) {
    if (typeof content === "string") {
        return {
            type: "text" as const,
            value: content,
        };
    }

    return {
        type: "json" as const,
        value: content as never,
    };
}

function parseToolInput(argumentsText: string): unknown {
    try {
        return JSON.parse(argumentsText);
    } catch {
        return argumentsText;
    }
}

function sourcesToText(message: Extract<AgentMessage, { role: "assistant" }>): string {
    if (!message.sources || message.sources.length === 0) {
        return "";
    }

    const lines = message.sources.map((source) => {
        const label = source.title?.trim() || source.url;
        return `- ${label}: ${source.url}`;
    });

    return `\n\nSources:\n${lines.join("\n")}`;
}

export function toAiSdkMessages(messages: readonly AgentMessage[]): ModelMessage[] {
    const toolNamesByCallId = new Map<string, string>();
    const modelMessages: ModelMessage[] = [];

    for (const message of messages) {
        if (message.role === "assistant" && Array.isArray(message.toolCalls)) {
            for (const toolCall of message.toolCalls) {
                toolNamesByCallId.set(toolCall.id, toolCall.function.name);
            }
        }

        switch (message.role) {
            case "system":
            case "developer":
                modelMessages.push({
                    role: "system",
                    content: textFromContent(message.content),
                });
                break;

            case "user":
                modelMessages.push({
                    role: "user",
                    content: toAiSdkUserContent(message.content),
                });
                break;

            case "assistant": {
                const text = `${textFromContent(message.content)}${sourcesToText(message)}`;
                const content = [
                    ...(text ? [{ type: "text" as const, text }] : []),
                    ...(message.toolCalls?.map((toolCall) => ({
                        type: "tool-call" as const,
                        toolCallId: toolCall.id,
                        toolName: toolCall.function.name,
                        input: parseToolInput(toolCall.function.arguments),
                    })) ?? []),
                ];

                modelMessages.push({
                    role: "assistant",
                    content: content.length > 0 ? content : "",
                });
                break;
            }

            case "tool":
                modelMessages.push({
                    role: "tool",
                    content: [
                        {
                            type: "tool-result",
                            toolCallId: message.toolCallId,
                            toolName: toolNamesByCallId.get(message.toolCallId) ?? "unknown",
                            output: jsonToolOutput(message.content),
                        },
                    ],
                });
                break;

            default:
                break;
        }
    }

    return modelMessages;
}

export function toAiSdkPrompt(messages: readonly AgentMessage[]): {
    system?: AiSdkSystemMessage[];
    messages: ModelMessage[];
} {
    const modelMessages = toAiSdkMessages(messages);
    const system = modelMessages.filter(
        (message): message is AiSdkSystemMessage => message.role === "system",
    );
    const nonSystemMessages = modelMessages.filter((message) => message.role !== "system");

    return {
        ...(system.length > 0 ? { system } : {}),
        messages: nonSystemMessages,
    };
}
