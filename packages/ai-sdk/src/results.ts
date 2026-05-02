import type {
    AgentAssistantMessage,
    AgentMessageContent,
    AgentModelGenerateResult,
    AgentReasoningMessage,
    AgentRunContext,
    AgentSource,
    AgentToolMessage,
} from "@better-agent/core";
import type { FinishReason, generateText } from "ai";
import { filesToContentParts } from "./files";

type AiSdkGenerateTextResult = Awaited<ReturnType<typeof generateText>>;

export const toBetterAgentFinishReason = (
    finishReason: FinishReason | undefined,
): AgentModelGenerateResult["finishReason"] => {
    switch (finishReason) {
        case "stop":
        case "length":
        case "content-filter":
        case "tool-calls":
            return finishReason;
        case "error":
            return "other";
        default:
            return "other";
    }
};

export const toBetterAgentUsage = (
    usage: AiSdkGenerateTextResult["usage"] | undefined,
): AgentModelGenerateResult["usage"] => {
    if (!usage) {
        return undefined;
    }

    return {
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        totalTokens: usage.totalTokens,
        reasoningTokens: usage.outputTokenDetails.reasoningTokens,
        cachedInputTokens: usage.inputTokenDetails.cacheReadTokens,
    };
};

function isProviderExecutedToolCall(toolCall: object): toolCall is { providerExecuted: true } {
    return "providerExecuted" in toolCall && toolCall.providerExecuted === true;
}

const toolCallsFromResult = (result: AiSdkGenerateTextResult) => {
    return result.toolCalls?.map((toolCall) => ({
        id: toolCall.toolCallId,
        type: "function" as const,
        function: {
            name: toolCall.toolName,
            arguments: JSON.stringify(toolCall.input ?? {}),
        },
        ...(isProviderExecutedToolCall(toolCall) ? { providerExecuted: true } : {}),
    }));
};

const toolMessagesFromResult = (
    result: AiSdkGenerateTextResult,
    context?: Pick<AgentRunContext, "generateId">,
): AgentToolMessage[] | undefined => {
    const toolMessages = result.toolResults?.flatMap((toolResult) => {
        if (!isProviderExecutedToolCall(toolResult)) {
            return [];
        }

        const content =
            typeof toolResult.output === "string"
                ? toolResult.output
                : JSON.stringify(toolResult.output ?? null);

        return [
            {
                id:
                    context?.generateId("toolResult", {
                        toolCallId: toolResult.toolCallId,
                        role: "tool",
                    }) ?? `tool_${toolResult.toolCallId}`,
                role: "tool" as const,
                toolCallId: toolResult.toolCallId,
                content,
                status: "success" as const,
            },
        ];
    });

    return toolMessages && toolMessages.length > 0 ? toolMessages : undefined;
};

const sourcesFromResult = (result: AiSdkGenerateTextResult): AgentSource[] | undefined => {
    const sources = result.sources?.flatMap((source) => {
        if (source.sourceType !== "url") {
            return [];
        }

        return [
            {
                id: source.id,
                sourceType: "url" as const,
                url: source.url,
                ...(source.title ? { title: source.title } : {}),
                ...(source.providerMetadata !== undefined
                    ? { providerMetadata: source.providerMetadata }
                    : {}),
            },
        ];
    });

    return sources && sources.length > 0 ? sources : undefined;
};

function messageContentFromResult(result: AiSdkGenerateTextResult): AgentMessageContent {
    const fileParts = filesToContentParts(result.files);
    const text =
        "output" in result && result.output !== undefined
            ? JSON.stringify(result.output)
            : result.text;

    if (fileParts.length === 0) {
        return text;
    }

    return [...(text ? [{ type: "text" as const, text }] : []), ...fileParts];
}

function reasoningMessageFromResult(
    result: AiSdkGenerateTextResult,
    messageId: string,
    context?: Pick<AgentRunContext, "generateId">,
): AgentReasoningMessage | undefined {
    if (!result.reasoningText) {
        return undefined;
    }

    return {
        id:
            context?.generateId("message", {
                role: "reasoning",
                parentMessageId: messageId,
            }) ?? `${messageId}_reasoning`,
        role: "reasoning",
        content: result.reasoningText,
    };
}

export const toBetterAgentGenerateResult = (
    result: AiSdkGenerateTextResult,
    messageId: string,
    context?: Pick<AgentRunContext, "generateId">,
): AgentModelGenerateResult => {
    const sources = sourcesFromResult(result);
    const message: AgentAssistantMessage = {
        id: messageId,
        role: "assistant",
        content: messageContentFromResult(result),
        ...(toolCallsFromResult(result)?.length ? { toolCalls: toolCallsFromResult(result) } : {}),
        ...(sources?.length ? { sources } : {}),
    };
    const reasoningMessage = reasoningMessageFromResult(result, messageId, context);
    const toolMessages = toolMessagesFromResult(result, context);

    return {
        messages: [
            ...(reasoningMessage ? [reasoningMessage] : []),
            message,
            ...(toolMessages ?? []),
        ],
        structured: "output" in result ? result.output : undefined,
        finishReason: toBetterAgentFinishReason(result.finishReason),
        usage: toBetterAgentUsage(result.usage),
    };
};
