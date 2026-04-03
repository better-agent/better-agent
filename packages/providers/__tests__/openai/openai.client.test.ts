import { afterEach, describe, expect, test } from "bun:test";
import { createOpenAI } from "../../src/openai";
import { createOpenAIClient } from "../../src/openai/client";

const originalFetch = globalThis.fetch;

afterEach(() => {
    globalThis.fetch = originalFetch;
});

describe("openai client", () => {
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
                created: 1,
                data: [{ b64_json: "AQID" }],
            });
        };

        globalThis.fetch = Object.assign(mockFetchImpl, {
            preconnect() {
                return undefined;
            },
        }) as typeof fetch;

        const client = createOpenAIClient({ apiKey: "test-key" });
        const result = await client.images.edit({
            model: "gpt-image-1",
            prompt: "Remove the background",
            images: [{ image_url: "https://example.com/source.png" }],
        });

        expect(result.isOk()).toBe(true);
        expect(requests).toEqual([
            {
                method: "POST",
                path: "/v1/images/edits",
                body: {
                    model: "gpt-image-1",
                    prompt: "Remove the background",
                    images: [{ image_url: "https://example.com/source.png" }],
                },
            },
        ]);
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

        const client = createOpenAIClient({ apiKey: "test-key" });
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
            const request = input instanceof Request ? input : new Request(input, init);
            const path = new URL(request.url).pathname;
            requests.push({ method: request.method, path });

            if (path === "/v1/files" && request.method === "GET") {
                return Response.json({
                    object: "list",
                    data: [{ id: "file_123", object: "file", filename: "report.pdf" }],
                    has_more: false,
                });
            }

            if (path === "/v1/files/file_123" && request.method === "GET") {
                return Response.json({
                    id: "file_123",
                    object: "file",
                    filename: "report.pdf",
                    purpose: "assistants",
                });
            }

            if (path === "/v1/files/file_123" && request.method === "DELETE") {
                return Response.json({
                    id: "file_123",
                    object: "file.deleted",
                    deleted: true,
                });
            }

            if (path === "/v1/files/file_123/content" && request.method === "GET") {
                return new Response(new Uint8Array([1, 2, 3]), {
                    headers: { "content-type": "application/pdf" },
                });
            }

            return new Response("not found", { status: 404 });
        };

        globalThis.fetch = Object.assign(mockFetchImpl, {
            preconnect() {
                return undefined;
            },
        }) as typeof fetch;

        const client = createOpenAIClient({ apiKey: "test-key" });

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
        expect(content.value.mimeType).toBe("application/pdf");
        expect(Array.from(new Uint8Array(content.value.data))).toEqual([1, 2, 3]);
        expect(requests).toEqual([
            { method: "GET", path: "/v1/files" },
            { method: "GET", path: "/v1/files/file_123" },
            { method: "DELETE", path: "/v1/files/file_123" },
            { method: "GET", path: "/v1/files/file_123/content" },
        ]);
    });

    test("createOpenAI exposes files helper", () => {
        const openai = createOpenAI({});

        expect(typeof openai.files.upload).toBe("function");
        expect(typeof openai.files.list).toBe("function");
        expect(typeof openai.files.retrieve).toBe("function");
        expect(typeof openai.files.delete).toBe("function");
        expect(typeof openai.files.content).toBe("function");
        expect(typeof openai.transcription).toBe("function");
    });

    test("client falls back to env api key and base url", async () => {
        const previousApiKey = process.env.OPENAI_API_KEY;
        const previousBaseUrl = process.env.OPENAI_BASE_URL;
        process.env.OPENAI_API_KEY = "env-key";
        process.env.OPENAI_BASE_URL = "https://example.com/custom/";

        try {
            let capturedAuthHeader: string | undefined;
            let capturedUrl: string | undefined;
            const mockFetchImpl = async (input: RequestInfo | URL, init?: RequestInit) => {
                const request = input instanceof Request ? input : new Request(input, init);
                capturedUrl = request.url;
                capturedAuthHeader = request.headers.get("authorization") ?? undefined;
                return Response.json({ object: "list", data: [], has_more: false });
            };

            globalThis.fetch = Object.assign(mockFetchImpl, {
                preconnect() {
                    return undefined;
                },
            }) as typeof fetch;

            const client = createOpenAIClient({});
            const result = await client.files.list();

            expect(result.isOk()).toBe(true);
            expect(capturedAuthHeader).toBe("Bearer env-key");
            expect(capturedUrl).toBe("https://example.com/custom/v1/files");
        } finally {
            if (previousApiKey === undefined) {
                process.env.OPENAI_API_KEY = undefined;
            } else {
                process.env.OPENAI_API_KEY = previousApiKey;
            }

            if (previousBaseUrl === undefined) {
                process.env.OPENAI_BASE_URL = undefined;
            } else {
                process.env.OPENAI_BASE_URL = previousBaseUrl;
            }
        }
    });
});
