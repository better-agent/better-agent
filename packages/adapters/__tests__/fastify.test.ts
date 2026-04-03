import { describe, expect, test } from "bun:test";
import Fastify from "fastify";
import { toFastifyHandler } from "../src/fastify";
import { createTestApp, getFreePort, registerCloser } from "./helpers";

const createFastifyServer = async () => {
    const agentApp = createTestApp();
    const app = Fastify();
    const port = await getFreePort();

    app.all("/api/*", toFastifyHandler(agentApp));

    await app.listen({ port, host: "127.0.0.1" });
    registerCloser(() => app.close());

    const addresses = app.addresses();
    const address = addresses.find((candidate) => candidate.family === "IPv4");
    if (!address) {
        throw new Error("Fastify server did not expose an IPv4 address.");
    }

    return { baseURL: `http://127.0.0.1:${address.port}` };
};

describe("toFastifyHandler", () => {
    test("handles JSON run requests through Fastify", async () => {
        const { baseURL } = await createFastifyServer();

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

    test("preserves SSE streaming through Fastify", async () => {
        const { baseURL } = await createFastifyServer();

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
});
