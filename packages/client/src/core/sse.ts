import type { AgentEvent } from "@better-agent/core";
import { BetterAgentClientError } from "./errors";

interface SseFrame {
    data: string;
    event?: string;
    id?: number;
}

const createFrame = (): SseFrame => ({ data: "" });

const getErrorPayload = (
    data: string,
): {
    message: string;
    code?: string;
    status?: number;
    details?: unknown;
} => {
    const fallbackMessage = data.trim().length > 0 ? data.trim() : "Stream failed.";

    try {
        const parsed = JSON.parse(data) as unknown;
        if (!parsed || typeof parsed !== "object") {
            return { message: fallbackMessage, details: parsed };
        }

        const messageField =
            "message" in parsed &&
            typeof parsed.message === "string" &&
            parsed.message.trim().length > 0
                ? parsed.message
                : undefined;
        const detailField =
            "detail" in parsed &&
            typeof parsed.detail === "string" &&
            parsed.detail.trim().length > 0
                ? parsed.detail
                : undefined;
        const codeField =
            "code" in parsed && typeof parsed.code === "string" ? parsed.code : undefined;
        const statusField =
            "status" in parsed &&
            typeof parsed.status === "number" &&
            Number.isFinite(parsed.status)
                ? parsed.status
                : undefined;

        return {
            message: messageField ?? detailField ?? fallbackMessage,
            code: codeField,
            status: statusField,
            details: parsed,
        };
    } catch {
        return { message: fallbackMessage };
    }
};

const toSseError = (data: string): BetterAgentClientError => {
    const payload = getErrorPayload(data);

    return new BetterAgentClientError(payload.message, {
        code: payload.code,
        status: payload.status,
        details: payload.details,
    });
};

const parseFrame = (frame: SseFrame): AgentEvent | null => {
    if (frame.data.length === 0) {
        return null;
    }

    const data = frame.data.replace(/\n$/, "");
    if (frame.event === "error") {
        throw toSseError(data);
    }

    const parsed = JSON.parse(data) as AgentEvent;
    if (frame.id !== undefined && parsed && typeof parsed === "object") {
        return { ...parsed, seq: frame.id } as AgentEvent;
    }

    return parsed;
};

export async function* parseSse(body: ReadableStream<Uint8Array>): AsyncIterable<AgentEvent> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let frame = createFrame();

    for (;;) {
        const { done, value } = await reader.read();
        if (done) {
            break;
        }

        buffer += decoder.decode(value, { stream: true });

        for (;;) {
            const newlineIndex = buffer.indexOf("\n");
            if (newlineIndex < 0) {
                break;
            }

            const line = buffer.slice(0, newlineIndex).replace(/\r$/, "");
            buffer = buffer.slice(newlineIndex + 1);

            if (line === "") {
                const event = parseFrame(frame);
                frame = createFrame();
                if (event) {
                    yield event;
                }
                continue;
            }

            if (line.startsWith("event:")) {
                frame.event = line.slice("event:".length).trim();
                continue;
            }

            if (line.startsWith("id:")) {
                const id = Number(line.slice("id:".length).trim());
                frame.id = Number.isFinite(id) ? id : undefined;
                continue;
            }

            if (line.startsWith("data:")) {
                frame.data += `${line.slice("data:".length).trim()}\n`;
            }
        }
    }

    const event = parseFrame(frame);
    if (event) {
        yield event;
    }
}
