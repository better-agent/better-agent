import { EventEmitter } from "node:events";
import { Readable } from "node:stream";
import type { AppRunInput, BetterAgentApp } from "@better-agent/core";
import type {
    FastifyLikeReply,
    FastifyLikeRequest,
    NodeRequestLike,
    NodeResponseLike,
} from "../src/shared/types";

export class MockRequest extends Readable {
    method = "GET";
    url = "/";
    originalUrl?: string;
    protocol?: string;
    headers: Record<string, string | string[] | undefined> = {};
    aborted = false;

    constructor(body = "") {
        super();
        if (body) {
            this.push(body);
        }
        this.push(null);
    }

    _read() {}

    asNodeRequest(): NodeRequestLike {
        return this as unknown as NodeRequestLike;
    }
}

export class MockResponse extends EventEmitter {
    statusCode = 200;
    writableEnded = false;
    destroyed = false;
    chunks: Uint8Array[] = [];
    headers = new Map<string, string | string[] | number>();

    setHeader(name: string, value: string | string[] | number) {
        this.headers.set(name.toLowerCase(), value);
        return this;
    }

    getHeader(name: string) {
        return this.headers.get(name.toLowerCase());
    }

    hasHeader(name: string) {
        return this.headers.has(name.toLowerCase());
    }

    write(chunk: string | Uint8Array) {
        this.chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
        return true;
    }

    end(chunk?: string | Uint8Array) {
        if (chunk) {
            this.write(chunk);
        }
        this.writableEnded = true;
        this.emit("finish");
        return this;
    }

    bodyText() {
        return Buffer.concat(this.chunks).toString("utf8");
    }

    asNodeResponse(): NodeResponseLike {
        return this as unknown as NodeResponseLike;
    }
}

export const createApp = (
    run: (input: AppRunInput) => unknown | Promise<unknown>,
): BetterAgentApp =>
    ({
        config: {
            agents: [{ name: "assistant" }],
        },
        async handler(request: Request) {
            const url = new URL(request.url);
            if (request.method !== "POST" || url.pathname !== "/assistant/run") {
                return new Response(null, { status: 404 });
            }

            const input =
                request.headers.get("content-type")?.includes("application/json") === true
                    ? await request.json()
                    : undefined;

            return Response.json(await run(input as AppRunInput));
        },
        agent(name: string) {
            if (name !== "assistant") {
                throw new Error(`Unknown agent: ${name}`);
            }

            return {
                name,
                definition: { name },
                run,
                stream() {
                    throw new Error("Streaming is not implemented by this test app.");
                },
            };
        },
        runs: {
            abort() {
                return Promise.resolve();
            },
            async *resumeStream() {},
        },
    }) as unknown as BetterAgentApp;

export const createFastifyRequest = (request: MockRequest, body?: unknown): FastifyLikeRequest => ({
    raw: request.asNodeRequest(),
    body,
    protocol: request.protocol,
});

export const createFastifyReply = (
    response: MockResponse,
): FastifyLikeReply & { hijacked: boolean } => ({
    raw: response.asNodeResponse(),
    hijacked: false,
    hijack() {
        this.hijacked = true;
    },
});
