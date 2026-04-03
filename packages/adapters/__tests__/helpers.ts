import { afterEach } from "bun:test";
import { createServer } from "node:net";
import type { AddressInfo } from "node:net";
import {
    type BetterAgentApp,
    type GenerativeModel,
    betterAgent,
    defineAgent,
} from "@better-agent/core";
import type { GenerativeModelResponse } from "@better-agent/core/providers";
import { ok } from "neverthrow";

const closers: Array<() => Promise<void>> = [];

const createTextResponse = (text: string): GenerativeModelResponse => ({
    output: [
        {
            type: "message",
            role: "assistant",
            content: text,
        },
    ],
    finishReason: "stop",
    usage: {},
});

const createTextModel = (): GenerativeModel => ({
    providerId: "test",
    modelId: "text",
    caps: {
        inputShape: "chat",
        inputModalities: { text: true, image: false, audio: false, video: false, file: false },
        outputModalities: { text: true },
    },
    async doGenerate() {
        return ok({
            response: createTextResponse("hello"),
        });
    },
});

const createStreamModel = (): GenerativeModel => ({
    providerId: "test",
    modelId: "stream",
    caps: {
        inputShape: "chat",
        inputModalities: { text: true, image: false, audio: false, video: false, file: false },
        outputModalities: { text: true },
    },
    async doGenerateStream() {
        return ok({
            events: (async function* () {
                yield ok({
                    type: "TEXT_MESSAGE_START" as const,
                    messageId: "msg_1",
                    role: "assistant" as const,
                    timestamp: Date.now(),
                });
                yield ok({
                    type: "TEXT_MESSAGE_CONTENT" as const,
                    messageId: "msg_1",
                    delta: "hello",
                    timestamp: Date.now(),
                });
                yield ok({
                    type: "TEXT_MESSAGE_END" as const,
                    messageId: "msg_1",
                    timestamp: Date.now(),
                });
            })(),
            final: Promise.resolve(createTextResponse("hello")),
        });
    },
});

afterEach(async () => {
    while (closers.length > 0) {
        const close = closers.pop();
        if (close) {
            await close();
        }
    }
});

export const createTestApp = (): BetterAgentApp =>
    betterAgent({
        agents: [
            defineAgent({
                name: "assistant",
                model: createTextModel(),
            }),
            defineAgent({
                name: "streamer",
                model: createStreamModel(),
            }),
        ] as const,
        baseURL: "/api",
        secret: "test-secret",
    });

export const registerCloser = (close: () => Promise<void>) => {
    closers.push(close);
};

export const getBaseURLFromAddress = (address: string | AddressInfo | null): string => {
    if (!address || typeof address === "string") {
        throw new Error("Server did not expose an AddressInfo.");
    }

    return `http://127.0.0.1:${address.port}`;
};

export const getFreePort = async (): Promise<number> => {
    const server = createServer();

    const port = await new Promise<number>((resolve, reject) => {
        server.once("error", reject);
        server.listen(0, "127.0.0.1", () => {
            const address = server.address();
            if (!address || typeof address === "string") {
                reject(new Error("Probe server did not expose an AddressInfo."));
                return;
            }

            resolve(address.port);
        });
    });

    await new Promise<void>((resolve, reject) => {
        server.close((error) => {
            if (error) {
                reject(error);
                return;
            }

            resolve();
        });
    });

    return port;
};
