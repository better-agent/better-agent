import { afterEach, describe, expect, test } from "bun:test";
import { createXAI } from "../../src/xai";
import { createXAIClient } from "../../src/xai/client";

const originalFetch = globalThis.fetch;

afterEach(() => {
    globalThis.fetch = originalFetch;
});

describe("xai client", () => {
    test("image edit sends requests to /v1/images/edits", async () => {
        const requests: Array<{ method: string; path: string; body: unknown }> = [];

        const mockFetchImpl = async (input: RequestInfo | URL, init?: RequestInit) => {
            const request = input instanceof Request ? input : new Request(input, init);
            requests.push({
                method: request.method,
                path: new URL(request.url).pathname,
                body: JSON.parse(await request.text()),
            });

            return Response.json({
                data: [{ b64_json: "AQID" }],
            });
        };

        globalThis.fetch = Object.assign(mockFetchImpl, {
            preconnect() {
                return undefined;
            },
        }) as typeof fetch;

        const client = createXAIClient({ apiKey: "test-key" });
        const result = await client.images.edit({
            model: "grok-imagine-image",
            prompt: "Remove the background",
            image: {
                type: "image_url",
                image_url: "https://example.com/source.png",
            },
        });

        expect(result.isOk()).toBe(true);
        expect(requests).toEqual([
            {
                method: "POST",
                path: "/v1/images/edits",
                body: {
                    model: "grok-imagine-image",
                    prompt: "Remove the background",
                    image: {
                        type: "image_url",
                        image_url: "https://example.com/source.png",
                    },
                },
            },
        ]);
    });

    test("stream requests set stream=true on responses endpoint", async () => {
        let requestBody: unknown;

        const mockFetchImpl = async (_input: RequestInfo | URL, init?: RequestInit) => {
            requestBody = init?.body ? JSON.parse(String(init.body)) : undefined;

            const encoder = new TextEncoder();
            return new Response(
                new ReadableStream({
                    start(controller) {
                        controller.enqueue(
                            encoder.encode(
                                'data: {"type":"response.completed","response":{"id":"resp_1","object":"response","created_at":1,"model":"grok-4","output":[],"parallel_tool_calls":true,"status":"completed","store":true,"temperature":1,"text":{},"tool_choice":"auto","tools":[],"top_p":1,"metadata":null,"background":false,"usage":{"input_tokens":1,"output_tokens":1}}}\n\n',
                            ),
                        );
                        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                        controller.close();
                    },
                }),
                {
                    status: 200,
                    headers: {
                        "content-type": "text/event-stream",
                    },
                },
            );
        };

        globalThis.fetch = Object.assign(mockFetchImpl, {
            preconnect() {
                return undefined;
            },
        }) as typeof fetch;

        const client = createXAIClient({ apiKey: "test-key" });
        const result = await client.responses.stream({
            model: "grok-4",
            input: "hello",
            background: false,
            logprobs: false,
            parallel_tool_calls: true,
            store: true,
            temperature: 1,
            top_p: 1,
            stream: false,
        });

        expect(result.isOk()).toBe(true);
        expect((requestBody as { stream?: unknown })?.stream).toBe(true);
    });

    test("file upload sends multipart form data", async () => {
        let capturedAuthHeader: string | undefined;
        let capturedContentType: string | undefined;
        let capturedRawBody = "";

        const mockFetchImpl = async (input: RequestInfo | URL, init?: RequestInit) => {
            const request = input instanceof Request ? input : new Request(input, init);
            const headers = new Headers(request.headers);
            capturedAuthHeader = headers.get("authorization") ?? undefined;
            capturedContentType = headers.get("content-type") ?? undefined;
            capturedRawBody = await request.text();

            return Response.json({
                id: "file_123",
                object: "file",
                filename: "report.pdf",
                purpose: "assistants",
                bytes: 4,
            });
        };

        globalThis.fetch = Object.assign(mockFetchImpl, {
            preconnect() {
                return undefined;
            },
        }) as typeof fetch;

        const client = createXAIClient({ apiKey: "test-key" });
        const result = await client.files.upload({
            file: new Blob(["test"], { type: "application/pdf" }),
            filename: "report.pdf",
        });

        expect(result.isOk()).toBe(true);
        expect(capturedAuthHeader).toBe("Bearer test-key");
        expect(capturedContentType).toContain("multipart/form-data");
        expect(capturedRawBody).toContain('name="purpose"');
        expect(capturedRawBody).toContain("assistants");
        expect(capturedRawBody).toContain('filename="report.pdf"');
    });

    test("files list/retrieve/delete/content map through the client", async () => {
        const requests: Array<{ method: string; path: string }> = [];

        const mockFetchImpl = async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = String(input);
            const path = new URL(url).pathname;
            requests.push({ method: init?.method ?? "GET", path });

            if (path === "/v1/files" && (init?.method ?? "GET") === "GET") {
                return Response.json({
                    object: "list",
                    data: [{ id: "file_123", object: "file", filename: "report.pdf" }],
                    has_more: false,
                });
            }

            if (path === "/v1/files/file_123" && (init?.method ?? "GET") === "GET") {
                return Response.json({
                    id: "file_123",
                    object: "file",
                    filename: "report.pdf",
                    purpose: "assistants",
                });
            }

            if (path === "/v1/files/file_123" && init?.method === "DELETE") {
                return Response.json({
                    id: "file_123",
                    object: "file.deleted",
                    deleted: true,
                });
            }

            if (path === "/v1/files/file_123/content" && (init?.method ?? "GET") === "GET") {
                return new Response(new Uint8Array([1, 2, 3]));
            }

            return new Response("not found", { status: 404 });
        };

        globalThis.fetch = Object.assign(mockFetchImpl, {
            preconnect() {
                return undefined;
            },
        }) as typeof fetch;

        const client = createXAIClient({ apiKey: "test-key" });

        const list = await client.files.list();
        const retrieve = await client.files.retrieve("file_123");
        const deleted = await client.files.delete("file_123");
        const content = await client.files.content("file_123");

        expect(list.isOk()).toBe(true);
        if (list.isErr()) throw list.error;
        expect(list.value.data[0]?.id).toBe("file_123");
        expect(retrieve.isOk()).toBe(true);
        if (retrieve.isErr()) throw retrieve.error;
        expect(retrieve.value.filename).toBe("report.pdf");
        expect(deleted.isOk()).toBe(true);
        if (deleted.isErr()) throw deleted.error;
        expect(deleted.value.deleted).toBe(true);
        expect(content.isOk()).toBe(true);
        if (content.isErr()) throw content.error;
        expect(Array.from(content.value)).toEqual([1, 2, 3]);
        expect(requests).toEqual([
            { method: "GET", path: "/v1/files" },
            { method: "GET", path: "/v1/files/file_123" },
            { method: "DELETE", path: "/v1/files/file_123" },
            { method: "GET", path: "/v1/files/file_123/content" },
        ]);
    });

    test("createXAI exposes files helper", () => {
        const xai = createXAI({});

        expect(typeof xai.files.upload).toBe("function");
        expect(typeof xai.files.list).toBe("function");
        expect(typeof xai.files.retrieve).toBe("function");
        expect(typeof xai.files.delete).toBe("function");
        expect(typeof xai.files.content).toBe("function");
    });
});
