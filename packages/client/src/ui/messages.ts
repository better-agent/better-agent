import type { UIMessage } from "../types";

const createMessageId = (): string => {
    const webCrypto = globalThis.crypto;

    if (typeof webCrypto?.randomUUID === "function") {
        return `msg_${webCrypto.randomUUID()}`;
    }

    if (typeof webCrypto?.getRandomValues === "function") {
        const bytes = webCrypto.getRandomValues(new Uint8Array(16));
        return `msg_${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
    }

    return `msg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
};

export const createUserUIMessage = (content: string): UIMessage => ({
    id: createMessageId(),
    role: "user",
    parts: [{ type: "text", text: content }],
});
