import { describe, expect, test } from "bun:test";
import express from "express";
import { toExpressHandler } from "../src/express";
import { createTestApp, getBaseURLFromAddress, registerCloser } from "./helpers";

const createExpressServer = async () => {
    const app = createTestApp();
    const server = express();
    server.use("/api", toExpressHandler(app));

    const listener = await new Promise<ReturnType<typeof server.listen>>((resolve) => {
        const instance = server.listen(0, "127.0.0.1", () => resolve(instance));
    });

    registerCloser(
        () =>
            new Promise<void>((resolve, reject) => {
                listener.close((error) => {
                    if (error) {
                        reject(error);
                        return;
                    }
                    resolve();
                });
            }),
    );

    return { baseURL: getBaseURLFromAddress(listener.address()) };
};

const createExpressServerWithJsonParser = async () => {
    const app = createTestApp();
    const server = express();
    server.use(express.json());
    server.use("/api", toExpressHandler(app));

    const listener = await new Promise<ReturnType<typeof server.listen>>((resolve) => {
        const instance = server.listen(0, "127.0.0.1", () => resolve(instance));
    });

    registerCloser(
        () =>
            new Promise<void>((resolve, reject) => {
                listener.close((error) => {
                    if (error) {
                        reject(error);
                        return;
                    }
                    resolve();
                });
            }),
    );

    return { baseURL: getBaseURLFromAddress(listener.address()) };
};

describe("toExpressHandler", () => {
    test("handles JSON run requests through Express", async () => {
        const { baseURL } = await createExpressServer();

        const response = await fetch(`${baseURL}/api/assistant/run`, {
            method: "POST",
            headers: {
                authorization: "Bearer test-secret",
                "content-type": "application/json",
            },
            body: JSON.stringify({ input: "hello" }),
        });

        expect(response.status).toBe(200);
        expect(await response.json()).toMatchObject({
            response: {
                finishReason: "stop",
            },
        });
    });

    test("preserves SSE streaming through Express", async () => {
        const { baseURL } = await createExpressServer();

        const response = await fetch(`${baseURL}/api/streamer/run`, {
            method: "POST",
            headers: {
                authorization: "Bearer test-secret",
                "content-type": "application/json",
                accept: "text/event-stream",
            },
            body: JSON.stringify({ input: "hello" }),
        });

        expect(response.status).toBe(200);
        expect(response.headers.get("content-type")).toContain("text/event-stream");

        const text = await response.text();
        expect(text).toContain("RUN_STARTED");
        expect(text).toContain("TEXT_MESSAGE_CONTENT");
    });

    test("handles JSON run requests after express.json parses the body", async () => {
        const { baseURL } = await createExpressServerWithJsonParser();

        const response = await fetch(`${baseURL}/api/assistant/run`, {
            method: "POST",
            headers: {
                authorization: "Bearer test-secret",
                "content-type": "application/json",
            },
            body: JSON.stringify({ input: "hello" }),
        });

        expect(response.status).toBe(200);
        expect(await response.json()).toMatchObject({
            response: {
                finishReason: "stop",
            },
        });
    });
});
