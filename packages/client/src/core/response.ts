import type {
    GenerativeModelOutputItem,
    GenerativeModelResponse,
} from "@better-agent/core/providers";
import type { UIMessage, UIMessagePart } from "../types/ui";
import { contentPartToUIPart } from "./utils";

/** Builds a deterministic local id for messages synthesized from model output. */
const makeResponseLocalId = (prefix: string, index: number) => `${prefix}_${index.toString(36)}`;

/** Converts one model output item into a UI message. */
const createMessageFromOutputItem = (
    item: GenerativeModelOutputItem,
    index: number,
): UIMessage | null => {
    if (item.type === "message") {
        const parts =
            typeof item.content === "string"
                ? [{ type: "text", text: item.content, state: "complete" } satisfies UIMessagePart]
                : item.content
                      .map((part) => contentPartToUIPart(part))
                      .filter((part: UIMessagePart | null): part is UIMessagePart => part !== null);

        if (parts.length === 0) {
            return null;
        }

        return {
            localId: makeResponseLocalId("response_message", index),
            role: item.role,
            parts,
        };
    }

    if (item.type === "tool-call") {
        return {
            localId: makeResponseLocalId("response_tool_call", index),
            role: "assistant",
            parts: [
                {
                    type: "tool-call",
                    callId: item.callId,
                    name: item.name,
                    args: item.arguments,
                    status: "pending",
                    state: "input-complete",
                },
            ],
        };
    }

    if (item.type !== "provider-tool-result") {
        return null;
    }

    const status = item.isError ? "error" : "success";
    return {
        localId: makeResponseLocalId("response_tool_result", index),
        role: "assistant",
        parts: [
            {
                type: "tool-call",
                callId: item.callId,
                name: item.name,
                status,
                state: "completed",
            },
            {
                type: "tool-result",
                callId: item.callId,
                result: item.result,
                status,
            },
        ],
    };
};

/** Attaches a provider tool result to the latest matching assistant message. */
const attachToolResultToMatchingMessage = (
    messages: UIMessage[],
    item: Extract<GenerativeModelOutputItem, { type: "provider-tool-result" }>,
): boolean => {
    let messageIndex = -1;
    for (let index = messages.length - 1; index >= 0; index -= 1) {
        const message = messages[index];
        if (!message || message.role !== "assistant") {
            continue;
        }

        const hasMatchingToolCall = message.parts.some(
            (part) => part.type === "tool-call" && part.callId === item.callId,
        );
        if (hasMatchingToolCall) {
            messageIndex = index;
            break;
        }
    }

    if (messageIndex < 0) {
        return false;
    }

    const message = messages[messageIndex];
    if (!message || message.role !== "assistant") {
        return false;
    }

    const nextMessages = messages.slice();
    const status = item.isError ? "error" : "success";
    nextMessages[messageIndex] = {
        ...message,
        parts: message.parts.flatMap((part) =>
            part.type === "tool-call" && part.callId === item.callId
                ? [
                      {
                          ...part,
                          status,
                          state: "completed",
                      },
                      {
                          type: "tool-result" as const,
                          callId: item.callId,
                          result: item.result,
                          status,
                      },
                  ]
                : [part],
        ),
    };
    messages.splice(0, messages.length, ...nextMessages);
    return true;
};

/**
 * Converts model response output into UI messages.
 */
export const getMessagesFromResponse = (response?: GenerativeModelResponse): UIMessage[] => {
    const messages: UIMessage[] = [];

    for (const [index, item] of (response?.output ?? []).entries()) {
        // Prefer attaching tool results to an existing tool call.
        if (
            item.type === "provider-tool-result" &&
            attachToolResultToMatchingMessage(messages, item)
        ) {
            continue;
        }

        const message = createMessageFromOutputItem(item, index);
        if (message) {
            messages.push(message);
        }
    }

    return messages;
};
