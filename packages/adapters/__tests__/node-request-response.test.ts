import { describe, expect, test } from "bun:test";
import { sendNodeResponse } from "../src/shared/from-node-response";
import { createNodeRequest } from "../src/shared/to-node-request";
import { MockRequest, MockResponse } from "./helpers";

describe("node request and response conversion", () => {
    test("creates absolute web requests from node requests", async () => {
        const request = new MockRequest();
        request.method = "POST";
        request.url = "/agent/run";
        request.headers = {
            host: "example.com",
            "x-forwarded-proto": "https",
            "x-custom": ["a", "b"],
        };

        const webRequest = createNodeRequest(request.asNodeRequest(), undefined, {
            body: JSON.stringify({ input: "hello" }),
        });

        expect(webRequest.url).toBe("https://example.com/agent/run");
        expect(webRequest.method).toBe("POST");
        expect(webRequest.headers.get("x-custom")).toBe("a, b");
        await expect(webRequest.json()).resolves.toEqual({ input: "hello" });
    });

    test("uses explicit origin and URL overrides", () => {
        const request = new MockRequest();
        request.method = "GET";
        request.url = "/ignored";

        const webRequest = createNodeRequest(request.asNodeRequest(), undefined, {
            origin: "https://api.example.com",
            url: "/override",
        });

        expect(webRequest.url).toBe("https://api.example.com/override");
    });

    test("sends status, headers, and response body to node responses", async () => {
        const response = new MockResponse();

        await sendNodeResponse(
            response.asNodeResponse(),
            new Response("hello", {
                status: 201,
                headers: {
                    "content-type": "text/plain",
                    "x-custom": "value",
                },
            }),
        );

        expect(response.statusCode).toBe(201);
        expect(response.getHeader("content-type")).toBe("text/plain");
        expect(response.getHeader("x-custom")).toBe("value");
        expect(response.bodyText()).toBe("hello");
        expect(response.writableEnded).toBe(true);
    });

    test("ends node responses without a body", async () => {
        const response = new MockResponse();

        await sendNodeResponse(response.asNodeResponse(), new Response(null, { status: 204 }));

        expect(response.statusCode).toBe(204);
        expect(response.bodyText()).toBe("");
        expect(response.writableEnded).toBe(true);
    });
});
