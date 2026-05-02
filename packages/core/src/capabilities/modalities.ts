import { BetterAgentError } from "@better-agent/shared/errors";
import type { AgentMessage } from "../ag-ui/messages";
import { supportsInputModality as supportsMultimodalInput } from "./guards";
import type { AgentCapabilities } from "./types";

export function prepareMessagesForCapabilities(input: {
    messages: AgentMessage[];
    capabilities: AgentCapabilities;
}): AgentMessage[] {
    return input.messages.map((message) => {
        if (
            (message.role !== "user" && message.role !== "assistant") ||
            !Array.isArray(message.content)
        ) {
            return message;
        }

        const content = message.content.filter((part) => {
            if (typeof part !== "object" || part === null || !("type" in part)) {
                return true;
            }

            const typedPart = part as { type?: unknown; source?: { mimeType?: unknown } };

            let modality: "image" | "audio" | "video" | "pdf" | "file" | undefined;

            switch (typedPart.type) {
                case "text":
                    return true;
                case "image":
                case "audio":
                case "video":
                    modality = typedPart.type;
                    break;
                case "document":
                    modality = typedPart.source?.mimeType === "application/pdf" ? "pdf" : "file";
                    break;
                default:
                    return true;
            }

            if (supportsMultimodalInput(input.capabilities, modality)) {
                return true;
            }

            throw BetterAgentError.fromCode(
                "VALIDATION_FAILED",
                `Model does not support '${modality}' input.`,
                {
                    context: {
                        modality,
                        messageId: message.id,
                    },
                },
            );
        });
        return { ...message, content };
    });
}
