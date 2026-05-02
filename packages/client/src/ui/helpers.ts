import type { AgentMessageContent, AgentMessageRole } from "@better-agent/core";
import type { UIMessagePart } from "../types";
import type { UIMessageRole } from "../types/ui";

export const toMessageRole = (role: AgentMessageRole): UIMessageRole => {
    switch (role) {
        case "user":
            return "user";
        case "system":
            return "system";
        case "developer":
            return "system";
        default:
            return "assistant";
    }
};

const sourceToUrl = (source: { type: string; value: string; mimeType?: string }) => {
    if (source.type === "data") {
        return `data:${source.mimeType ?? "application/octet-stream"};base64,${source.value}`;
    }
    return source.value;
};

const urlToSource = (
    url: string,
    mimeType?: string,
): Extract<Extract<AgentMessageContent, unknown[]>[number], { source: unknown }>["source"] => {
    const match = /^data:([^;,]+)?;base64,(.*)$/.exec(url);

    if (match) {
        return {
            type: "data",
            value: match[2] ?? "",
            mimeType: mimeType ?? match[1] ?? "application/octet-stream",
        };
    }

    return {
        type: "url",
        value: url,
        ...(mimeType ? { mimeType } : {}),
    };
};

export const contentToParts = (content: AgentMessageContent | undefined): UIMessagePart[] => {
    if (typeof content === "string") {
        return [{ type: "text", text: content }];
    }

    if (!Array.isArray(content)) {
        return [];
    }

    return content.flatMap((part): UIMessagePart[] => {
        if (part.type === "text") {
            return [{ type: "text", text: part.text }];
        }

        if (part.type === "image" || part.type === "audio" || part.type === "video") {
            return [
                {
                    type: part.type,
                    url: sourceToUrl(part.source),
                    mimeType: part.source.mimeType,
                },
            ];
        }

        return [];
    });
};

export const partsToContent = (parts: UIMessagePart[]): AgentMessageContent => {
    const content: Extract<AgentMessageContent, unknown[]>[number][] = [];

    for (const part of parts) {
        if (part.type === "text") {
            if (part.text) {
                content.push({ type: "text", text: part.text });
            }
            continue;
        }

        if (part.type === "image" || part.type === "audio" || part.type === "video") {
            content.push({
                type: part.type,
                source: urlToSource(part.url, part.mimeType),
            });
            continue;
        }

        if (part.type === "file") {
            content.push({
                type: "document",
                source: urlToSource(part.url, part.mimeType),
            });
        }
    }

    if (content.length === 1 && content[0]?.type === "text") {
        return content[0].text;
    }

    return content;
};

export const contentToText = (content: AgentMessageContent): string => {
    if (typeof content === "string") {
        return content;
    }

    return content
        .filter((part) => part.type === "text")
        .map((part) => part.text)
        .join("");
};
