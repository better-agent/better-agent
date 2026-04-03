import { Events } from "@better-agent/core/events";
import type { ClientEvent } from "../types/client";

const isEventType = (value: string): value is ClientEvent["type"] =>
    Object.values(Events).includes(value as ClientEvent["type"]);

type PendingSseFrame = {
    data: string;
    eventName?: string;
    id?: number;
};

const resetFrame = (): PendingSseFrame => ({ data: "" });

// Throw SSE `event: error` frames instead of yielding them.
const getSseErrorMessage = (data: string): string => {
    try {
        const parsed = JSON.parse(data) as { message?: unknown };
        if (typeof parsed.message === "string" && parsed.message.trim().length > 0) {
            return parsed.message;
        }
    } catch {}

    return data.trim().length > 0 ? data.trim() : "Stream failed";
};

const parseFrame = (
    frame: PendingSseFrame,
    options: { onId?: (id: number) => void },
): ClientEvent | null => {
    if (!frame.data) {
        return null;
    }

    const data = frame.data.replace(/\n$/, "");
    if (frame.eventName === "error") {
        throw new Error(getSseErrorMessage(data));
    }

    try {
        const parsed = JSON.parse(data) as ClientEvent;
        if (!(parsed && typeof parsed === "object" && typeof parsed.type === "string")) {
            return null;
        }
        if (!isEventType(parsed.type)) {
            return null;
        }
        if (typeof frame.id === "number") {
            parsed.seq = frame.id;
            options.onId?.(frame.id);
        }
        return parsed;
    } catch {
        return null;
    }
};

export async function* parseSse(
    body: ReadableStream<Uint8Array>,
    options: { onId?: (id: number) => void } = {},
): AsyncIterable<ClientEvent> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let frame = resetFrame();

    while (true) {
        const chunk = await reader.read();
        const { done, value } = chunk;
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        for (;;) {
            const nl = buffer.indexOf("\n");
            if (nl < 0) break;

            const line = buffer.slice(0, nl).replace(/\r$/, "");
            buffer = buffer.slice(nl + 1);

            // Blank line ends the frame.
            if (line === "") {
                const event = parseFrame(frame, options);
                frame = resetFrame();
                if (event) {
                    yield event;
                }
                continue;
            }

            if (line.startsWith("event:")) {
                frame.eventName = line.slice(6).trim();
                continue;
            }
            if (line.startsWith("id:")) {
                const idValue = Number(line.slice(3).trim());
                frame.id = Number.isFinite(idValue) ? idValue : undefined;
                continue;
            }
            if (line.startsWith("data:")) {
                frame.data += `${line.slice(5).trim()}\n`;
            }
        }
    }

    const finalEvent = parseFrame(frame, options);
    if (finalEvent) {
        yield finalEvent;
    }
}
