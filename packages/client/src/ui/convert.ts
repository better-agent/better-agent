import type { AgentMessage, AgentMessageContent } from "@better-agent/core";
import type { ReasoningUIPart, ToolCallUIPart, ToolResultUIPart, UIMessage } from "../types";
import { contentToParts, contentToText, partsToContent, toMessageRole } from "./helpers";

const isAgentMessageContent = (content: unknown): content is AgentMessageContent | undefined => {
    return content === undefined || typeof content === "string" || Array.isArray(content);
};

export const fromAgentMessages = (messages: AgentMessage[]): UIMessage[] => {
    const parseToolInput = (input: string): unknown => {
        try {
            return JSON.parse(input);
        } catch {
            return undefined;
        }
    };

    const parseToolContent = (content: string): unknown => {
        try {
            return JSON.parse(content);
        } catch {
            return content;
        }
    };

    const toolResults = new Map<
        string,
        {
            content: string;
            error?: string;
            status?: "success" | "error" | "denied";
            approval?: {
                approved?: boolean;
                metadata?: Record<string, unknown>;
            };
        }
    >();

    for (const message of messages) {
        if (message.role === "tool") {
            toolResults.set(message.toolCallId, {
                content: message.content,
                error: message.error,
                status: message.status,
                approval: message.approval,
            });
        }
    }

    const uiMessages: UIMessage[] = [];
    let pendingReasoning: Array<{ id: string; part: ReasoningUIPart }> = [];

    for (const message of messages) {
        const parts = isAgentMessageContent(message.content) ? contentToParts(message.content) : [];

        if (message.role === "reasoning") {
            if (typeof message.content === "string") {
                pendingReasoning = [
                    ...pendingReasoning,
                    {
                        id: message.id,
                        part: { type: "reasoning", text: message.content },
                    },
                ];
            }
            continue;
        }

        if (message.role === "assistant") {
            const assistantParts: UIMessage["parts"] = [
                ...pendingReasoning.map((reasoning) => reasoning.part),
                ...parts,
            ];
            pendingReasoning = [];

            if (Array.isArray(message.toolCalls)) {
                for (const toolCall of message.toolCalls) {
                    const result = toolResults.get(toolCall.id);

                    const toolPart: ToolCallUIPart = {
                        inputText: toolCall.function.arguments,
                        input: parseToolInput(toolCall.function.arguments),
                        toolCallId: toolCall.id,
                        toolName: toolCall.function.name,
                        type: "tool-call",
                        ...(toolCall.providerExecuted ? { providerExecuted: true } : {}),
                        state: "input-available",
                        ...(result?.approval
                            ? {
                                  approval: {
                                      interruptId: `${toolCall.id}:approval`,
                                      needsApproval: true,
                                      approved: result.approval.approved,
                                      ...(result.approval.metadata
                                          ? { metadata: result.approval.metadata }
                                          : {}),
                                  },
                                  state: "approval-responded" as const,
                              }
                            : {}),
                    };

                    assistantParts.push(toolPart);

                    if (result) {
                        const deniedResult =
                            result.content.length > 0
                                ? (() => {
                                      const parsed = parseToolContent(result.content);
                                      return typeof parsed === "string" ? parsed : undefined;
                                  })()
                                : undefined;
                        const resultPart: ToolResultUIPart =
                            result.status === "denied"
                                ? {
                                      type: "tool-result",
                                      toolCallId: toolCall.id,
                                      state: "output-denied",
                                      result: deniedResult,
                                  }
                                : result.status === "error" || result.error
                                  ? {
                                        type: "tool-result",
                                        toolCallId: toolCall.id,
                                        state: "output-error",
                                        error: result.error ?? result.content,
                                    }
                                  : {
                                        type: "tool-result",
                                        toolCallId: toolCall.id,
                                        state: "output-available",
                                        result: parseToolContent(result.content),
                                    };

                        assistantParts.push(resultPart);
                    }
                }
            }

            for (const source of message.sources ?? []) {
                assistantParts.push({
                    type: "source",
                    sourceId: source.id,
                    sourceType: "url",
                    url: source.url,
                    ...(source.title ? { title: source.title } : {}),
                });
            }

            uiMessages.push({
                id: message.id,
                role: message.role,
                parts: assistantParts,
            });
            continue;
        }

        if (message.role === "user" || message.role === "system" || message.role === "developer") {
            uiMessages.push({
                id: message.id,
                role: toMessageRole(message.role),
                parts,
            });
        }
    }

    if (pendingReasoning.length > 0) {
        for (const reasoning of pendingReasoning) {
            uiMessages.push({
                id: reasoning.id,
                role: "assistant",
                parts: [reasoning.part],
            });
        }
    }

    return uiMessages;
};

export const toAgentMessages = (messages: UIMessage[]): AgentMessage[] => {
    return messages.map((message) => {
        const content = partsToContent(message.parts);

        if (message.role === "assistant") {
            const toolCalls = message.parts
                .filter((part): part is ToolCallUIPart => part.type === "tool-call")
                .map((part) => ({
                    id: part.toolCallId,
                    type: "function" as const,
                    function: {
                        name: part.toolName,
                        arguments: part.inputText,
                    },
                    ...(part.providerExecuted ? { providerExecuted: true } : {}),
                }));

            return {
                id: message.id,
                role: "assistant",
                content,
                ...(toolCalls.length > 0 ? { toolCalls } : {}),
            };
        }

        if (message.role === "system") {
            return {
                id: message.id,
                role: "system",
                content: contentToText(content),
            };
        }

        return {
            id: message.id,
            role: "user",
            content,
        };
    });
};
