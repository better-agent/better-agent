import { describe, expect, test } from "bun:test";
import { toExpressHandler } from "../src/express";
import { toFastifyHandler } from "../src/fastify";
import {
    MockRequest,
    MockResponse,
    createApp,
    createFastifyReply,
    createFastifyRequest,
} from "./helpers";

describe("framework handlers", () => {
    test("express handler serializes parsed body and sends app response", async () => {
        let captured: unknown;
        const app = createApp(async (input) => {
            captured = input;
            return {
                outcome: "success",
                runId: "run_1",
                messages: [],
                structured: { ok: true },
            };
        });
        const request = new MockRequest() as MockRequest & { body?: unknown };
        request.method = "POST";
        request.url = "/assistant/run";
        request.headers = { host: "example.com", "content-type": "application/json" };
        request.body = { input: "hello" };
        const response = new MockResponse();

        await toExpressHandler(app)(request.asNodeRequest(), response.asNodeResponse());

        expect(captured).toMatchObject({ input: "hello" });
        expect(response.statusCode).toBe(200);
        expect(JSON.parse(response.bodyText())).toMatchObject({
            outcome: "success",
            runId: "run_1",
            structured: { ok: true },
        });
    });

    test("express handler forwards adapter errors to next when provided", async () => {
        const app = createApp(async () => ({
            outcome: "success",
            runId: "run_1",
            messages: [],
        }));
        const request = new MockRequest();
        request.headers = { host: "example.com" };
        const response = new MockResponse();
        let forwarded: unknown;

        await toExpressHandler(app, { origin: "://bad-origin" })(
            request.asNodeRequest(),
            response.asNodeResponse(),
            (nextError) => {
                forwarded = nextError;
            },
        );

        expect(forwarded).toBeInstanceOf(TypeError);
    });

    test("fastify handler hijacks reply, serializes body, and sends app response", async () => {
        let captured: unknown;
        const app = createApp(async (input) => {
            captured = input;
            return {
                outcome: "success",
                runId: "run_1",
                messages: [],
                structured: { ok: true },
            };
        });
        const request = new MockRequest();
        request.method = "POST";
        request.url = "/assistant/run";
        request.protocol = "https";
        request.headers = { host: "example.com", "content-type": "application/json" };
        const response = new MockResponse();
        const reply = createFastifyReply(response);

        await toFastifyHandler(app)(createFastifyRequest(request, { input: "hello" }), reply);

        expect(reply.hijacked).toBe(true);
        expect(captured).toMatchObject({ input: "hello" });
        expect(response.statusCode).toBe(200);
        expect(JSON.parse(response.bodyText())).toMatchObject({
            outcome: "success",
            runId: "run_1",
            structured: { ok: true },
        });
    });

    test("fastify handler honors explicit body override", async () => {
        let captured: unknown;
        const app = createApp(async (input) => {
            captured = input;
            return {
                outcome: "success",
                runId: "run_1",
                messages: [],
            };
        });
        const request = new MockRequest();
        request.method = "POST";
        request.url = "/assistant/run";
        request.headers = { host: "example.com", "content-type": "application/json" };
        const response = new MockResponse();

        await toFastifyHandler(app, { body: JSON.stringify({ input: "override" }) })(
            createFastifyRequest(request, { input: "request" }),
            createFastifyReply(response),
        );

        expect(captured).toMatchObject({ input: "override" });
    });
});
