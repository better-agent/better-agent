import { describe, expect, test } from "bun:test";
import { BetterAgentError } from "@better-agent/shared/errors";
import type { AnyAgentDefinition } from "../../src";
import { type BetterAgentRuntime, createRuntime } from "../../src/run";
import { createServer } from "../../src/server";
import { defineTool } from "../../src/tools";
import {
    createScriptedModel,
    createTextAgent,
    createToolCallResponse,
} from "../helpers/mock-model";

const createRuntimeStub = (): BetterAgentRuntime =>
    ({
        async run() {
            return { response: { output: [], finishReason: "stop", usage: {} } };
        },
        stream() {
            return {
                runId: "run_1",
                events: (async function* () {})(),
                result: Promise.resolve({
                    response: { output: [], finishReason: "stop", usage: {} },
                }),
            };
        },
        async resumeStream() {
            return null;
        },
        async resumeConversation() {
            return null;
        },
        async abortRun() {
            return true;
        },
        async loadConversation() {
            return null;
        },
        async submitToolResult() {
            return false;
        },
        async submitToolApproval() {
            return false;
        },
    }) as unknown as BetterAgentRuntime;

describe("createServer", () => {
    test("rejects protected routes without bearer auth", async () => {
        const server = createServer({
            runtime: createRuntimeStub(),
            pluginRuntime: null,
            secret: "top-secret",
        });

        const response = await server.handle(
            new Request("https://example.com/test/stream-events/resume?streamId=s1"),
        );

        expect(response.status).toBe(401);
        expect(response.headers.get("www-authenticate")).toBe("Bearer");
    });

    test("returns 405 when path exists for a different method", async () => {
        const server = createServer({
            runtime: createRuntimeStub(),
            pluginRuntime: null,
        });

        const response = await server.handle(
            new Request("https://example.com/test/stream-events/resume?streamId=s1", {
                method: "POST",
            }),
        );

        expect(response.status).toBe(405);
        expect(response.headers.get("allow")).toContain("GET");
    });

    test("does not match partial basePath prefixes", async () => {
        const server = createServer({
            runtime: createRuntimeStub(),
            pluginRuntime: null,
            basePath: "/api",
        });

        const response = await server.handle(
            new Request("https://example.com/api-v2/test/stream-events/resume?streamId=s1"),
        );

        expect(response.status).toBe(404);
    });

    test("accepts relative request urls when host headers are present", async () => {
        const server = createServer({
            runtime: createRuntimeStub(),
            pluginRuntime: null,
            secret: "top-secret",
        });

        const request = new Request("https://placeholder.local/test/conversations/conv_1", {
            headers: {
                authorization: "Bearer top-secret",
                host: "localhost:3000",
                "x-forwarded-proto": "http",
            },
        });
        Object.defineProperty(request, "url", {
            value: "/test/conversations/conv_1",
            configurable: true,
        });

        const response = await server.handle(request);

        expect(response.status).toBe(204);
    });

    test("accepts request-like objects with plain header records", async () => {
        const server = createServer({
            runtime: createRuntimeStub(),
            pluginRuntime: null,
            secret: "top-secret",
        });

        const request = {
            url: "/test/conversations/conv_1",
            method: "GET",
            headers: {
                authorization: "Bearer top-secret",
                host: "localhost:3000",
                "x-forwarded-proto": "http",
            },
            signal: new AbortController().signal,
        } as unknown as Request;

        const response = await server.handle(request);

        expect(response.status).toBe(204);
    });

    test("loads persisted conversations through the server route", async () => {
        const runtime = {
            ...createRuntimeStub(),
            async loadConversation() {
                return {
                    items: [{ type: "message", role: "user", content: "hello" }],
                };
            },
        } as unknown as BetterAgentRuntime;
        const server = createServer({
            runtime,
            pluginRuntime: null,
            secret: "top-secret",
        });

        const response = await server.handle(
            new Request("https://example.com/test/conversations/conv_1", {
                headers: { authorization: "Bearer top-secret" },
            }),
        );

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({
            items: [{ type: "message", role: "user", content: "hello" }],
        });
    });

    test("returns 204 when a conversation is missing", async () => {
        const server = createServer({
            runtime: createRuntimeStub(),
            pluginRuntime: null,
            secret: "top-secret",
        });

        const response = await server.handle(
            new Request("https://example.com/test/conversations/conv_missing", {
                headers: { authorization: "Bearer top-secret" },
            }),
        );

        expect(response.status).toBe(204);
    });

    test("rejects blank conversation ids for the load route", async () => {
        const server = createServer({
            runtime: createRuntimeStub(),
            pluginRuntime: null,
            secret: "top-secret",
        });

        const response = await server.handle(
            new Request("https://example.com/test/conversations/%20", {
                headers: { authorization: "Bearer top-secret" },
            }),
        );

        expect(response.status).toBe(422);
    });

    test("returns 501 when the runtime does not implement loadConversation", async () => {
        const { loadConversation: _loadConversation, ...runtime } =
            createRuntimeStub() as BetterAgentRuntime & {
                loadConversation?: BetterAgentRuntime["loadConversation"];
            };
        const server = createServer({
            runtime: runtime as BetterAgentRuntime,
            pluginRuntime: null,
            secret: "top-secret",
        });

        const response = await server.handle(
            new Request("https://example.com/test/conversations/conv_1", {
                headers: { authorization: "Bearer top-secret" },
            }),
        );

        expect(response.status).toBe(501);
    });

    test("accepts valid run bodies through the run route", async () => {
        const server = createServer({
            runtime: createRuntimeStub(),
            pluginRuntime: null,
            secret: "top-secret",
        });

        const response = await server.handle(
            new Request("https://example.com/test/run", {
                method: "POST",
                headers: {
                    authorization: "Bearer top-secret",
                    "content-type": "application/json",
                },
                body: JSON.stringify({
                    input: "hello",
                    replaceHistory: true,
                    modalities: ["text"],
                    advanced: {
                        clientToolResultTimeoutMs: 1_000,
                        toolApprovalTimeoutMs: 2_000,
                    },
                }),
            }),
        );

        expect(response.status).toBe(200);
    });

    test("preserves JSON bodies when normalizing relative request urls", async () => {
        const server = createServer({
            runtime: createRuntimeStub(),
            pluginRuntime: null,
            secret: "top-secret",
        });

        const request = new Request("https://placeholder.local/test/run", {
            method: "POST",
            headers: {
                authorization: "Bearer top-secret",
                "content-type": "application/json",
                host: "localhost:3000",
                "x-forwarded-proto": "http",
            },
            body: JSON.stringify({
                input: "hello",
            }),
        });
        Object.defineProperty(request, "url", {
            value: "/test/run",
            configurable: true,
        });

        const response = await server.handle(request);

        expect(response.status).toBe(200);
    });

    test("aborts request-bound stream runs when the SSE reader disconnects", async () => {
        const abortedRunIds: string[] = [];
        const runtime = {
            ...createRuntimeStub(),
            stream() {
                return {
                    runId: "run_disconnect",
                    events: (async function* () {
                        yield {
                            type: "RUN_STARTED",
                            runId: "run_disconnect",
                            agentName: "test",
                            runInput: { input: "hello" },
                            timestamp: Date.now(),
                        };
                        await new Promise(() => {});
                    })(),
                    result: new Promise(() => {}),
                };
            },
            async abortRun(runId: string) {
                abortedRunIds.push(runId);
                return true;
            },
        } as unknown as BetterAgentRuntime;
        const server = createServer({
            runtime,
            pluginRuntime: null,
            secret: "top-secret",
        });

        const response = await server.handle(
            new Request("https://example.com/test/run", {
                method: "POST",
                headers: {
                    authorization: "Bearer top-secret",
                    "content-type": "application/json",
                    accept: "text/event-stream",
                },
                body: JSON.stringify({ input: "hello" }),
            }),
        );

        expect(response.status).toBe(200);
        await response.body?.cancel();
        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(abortedRunIds).toEqual(["run_disconnect"]);
    });

    test("does not abort detached stream runs when the SSE reader disconnects", async () => {
        const abortedRunIds: string[] = [];
        const runtime = {
            ...createRuntimeStub(),
            streamLifecycle: "detached" as const,
            stream() {
                return {
                    runId: "run_continue",
                    events: (async function* () {
                        yield {
                            type: "RUN_STARTED",
                            runId: "run_continue",
                            agentName: "test",
                            runInput: { input: "hello" },
                            timestamp: Date.now(),
                        };
                        await new Promise(() => {});
                    })(),
                    result: new Promise(() => {}),
                };
            },
            async abortRun(runId: string) {
                abortedRunIds.push(runId);
                return true;
            },
        } as unknown as BetterAgentRuntime;
        const server = createServer({
            runtime,
            pluginRuntime: null,
            secret: "top-secret",
            advanced: {
                onRequestDisconnect: "continue",
            },
        });

        const response = await server.handle(
            new Request("https://example.com/test/run", {
                method: "POST",
                headers: {
                    authorization: "Bearer top-secret",
                    "content-type": "application/json",
                    accept: "text/event-stream",
                },
                body: JSON.stringify({ input: "hello" }),
            }),
        );

        expect(response.status).toBe(200);
        await response.body?.cancel();
        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(abortedRunIds).toEqual([]);
    });

    test("infers continue disconnect behavior from a detached runtime", async () => {
        const abortedRunIds: string[] = [];
        const runtime = {
            ...createRuntimeStub(),
            streamLifecycle: "detached" as const,
            stream() {
                return {
                    runId: "run_inferred_continue",
                    events: (async function* () {
                        yield {
                            type: "RUN_STARTED",
                            runId: "run_inferred_continue",
                            agentName: "test",
                            runInput: { input: "hello" },
                            timestamp: Date.now(),
                        };
                        await new Promise(() => {});
                    })(),
                    result: new Promise(() => {}),
                };
            },
            async abortRun(runId: string) {
                abortedRunIds.push(runId);
                return true;
            },
        } as unknown as BetterAgentRuntime;
        const server = createServer({
            runtime,
            pluginRuntime: null,
            secret: "top-secret",
        });

        const response = await server.handle(
            new Request("https://example.com/test/run", {
                method: "POST",
                headers: {
                    authorization: "Bearer top-secret",
                    "content-type": "application/json",
                    accept: "text/event-stream",
                },
                body: JSON.stringify({ input: "hello" }),
            }),
        );

        expect(response.status).toBe(200);
        await response.body?.cancel();
        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(abortedRunIds).toEqual([]);
    });

    test("accepts conversationReplay.prepareInput null through the run route", async () => {
        let received: unknown;
        const runtime = {
            ...createRuntimeStub(),
            async run(_agentName: string, options: unknown) {
                received = options;
                return { response: { output: [], finishReason: "stop", usage: {} } };
            },
        } as unknown as BetterAgentRuntime;
        const server = createServer({
            runtime,
            pluginRuntime: null,
            secret: "top-secret",
        });

        const response = await server.handle(
            new Request("https://example.com/test/run", {
                method: "POST",
                headers: {
                    authorization: "Bearer top-secret",
                    "content-type": "application/json",
                },
                body: JSON.stringify({
                    input: "hello",
                    conversationId: "conv_1",
                    conversationReplay: {
                        omitUnsupportedParts: true,
                        prepareInput: null,
                    },
                }),
            }),
        );

        expect(response.status).toBe(200);
        expect(received).toMatchObject({
            input: "hello",
            conversationId: "conv_1",
            conversationReplay: {
                omitUnsupportedParts: true,
                prepareInput: null,
            },
        });
    });

    test("rejects invalid run bodies at the transport boundary", async () => {
        const server = createServer({
            runtime: createRuntimeStub(),
            pluginRuntime: null,
            secret: "top-secret",
        });

        const response = await server.handle(
            new Request("https://example.com/test/run", {
                method: "POST",
                headers: {
                    authorization: "Bearer top-secret",
                    "content-type": "application/json",
                },
                body: JSON.stringify({
                    input: 42,
                    replaceHistory: "yes",
                    modalities: ["banana"],
                    advanced: {
                        clientToolResultTimeoutMs: 0,
                        toolApprovalTimeoutMs: -1,
                    },
                }),
            }),
        );

        expect(response.status).toBe(422);
    });

    test("rejects non-json run requests", async () => {
        const server = createServer({
            runtime: createRuntimeStub(),
            pluginRuntime: null,
            secret: "top-secret",
        });

        const response = await server.handle(
            new Request("https://example.com/test/run", {
                method: "POST",
                headers: {
                    authorization: "Bearer top-secret",
                    "content-type": "text/plain",
                },
                body: JSON.stringify({ input: "hello" }),
            }),
        );

        expect(response.status).toBe(415);
    });

    test("rejects non-stream run requests for agents with client tools", async () => {
        const agent = createTextAgent({
            name: "support",
            model: createScriptedModel([
                createToolCallResponse([
                    { callId: "call_1", name: "confirm", arguments: '{"ok":true}' },
                ]),
            ]),
            tools: [
                defineTool({
                    name: "confirm",
                    schema: {
                        type: "object",
                        properties: { ok: { type: "boolean" } },
                        required: ["ok"],
                        additionalProperties: false,
                    } as const,
                }).client() as never,
            ] as never,
        }) as unknown as AnyAgentDefinition;
        const runtime = createRuntime({
            agents: [agent] as const,
        }) as unknown as BetterAgentRuntime;
        const server = createServer({
            runtime,
            pluginRuntime: null,
            secret: "top-secret",
        });

        const response = await server.handle(
            new Request("https://example.com/support/run", {
                method: "POST",
                headers: {
                    authorization: "Bearer top-secret",
                    "content-type": "application/json",
                },
                body: JSON.stringify({ input: "go" }),
            }),
        );

        expect(response.status).toBe(400);
        await expect(response.json()).resolves.toMatchObject({
            code: "BAD_REQUEST",
            status: 400,
            message:
                "Run failed: Non-stream runs do not support interactive tools. Use stream() for client tool 'confirm'.",
        });
    });

    test("serializes rich typed error metadata in server responses", async () => {
        const runtime = {
            ...createRuntimeStub(),
            async run() {
                throw BetterAgentError.fromCode("RATE_LIMITED", "Slow down", {
                    traceId: "trace_1",
                    context: { provider: "openai" },
                    trace: [{ at: "core.test.rateLimit" }],
                });
            },
        } as unknown as BetterAgentRuntime;
        const server = createServer({
            runtime,
            pluginRuntime: null,
            secret: "top-secret",
        });

        const response = await server.handle(
            new Request("https://example.com/test/run", {
                method: "POST",
                headers: {
                    authorization: "Bearer top-secret",
                    "content-type": "application/json",
                },
                body: JSON.stringify({ input: "hello" }),
            }),
        );

        expect(response.status).toBe(429);
        expect(response.json()).resolves.toEqual({
            code: "RATE_LIMITED",
            message: "Slow down",
            status: 429,
            retryable: true,
            traceId: "trace_1",
            context: { provider: "openai" },
            trace: [{ at: "core.test.rateLimit" }],
        });
    });

    test("masks internal server messages without leaking context or trace", async () => {
        const runtime = {
            ...createRuntimeStub(),
            async run() {
                throw BetterAgentError.fromCode("INTERNAL", "Database connection exploded.", {
                    traceId: "trace_internal",
                    context: { subsystem: "db" },
                    trace: [{ at: "core.test.internal" }],
                });
            },
        } as unknown as BetterAgentRuntime;
        const server = createServer({
            runtime,
            pluginRuntime: null,
            secret: "top-secret",
        });

        const response = await server.handle(
            new Request("https://example.com/test/run", {
                method: "POST",
                headers: {
                    authorization: "Bearer top-secret",
                    "content-type": "application/json",
                },
                body: JSON.stringify({ input: "hello" }),
            }),
        );

        expect(response.status).toBe(500);
        expect(response.json()).resolves.toEqual({
            code: "INTERNAL",
            message: "Server request failed.",
            status: 500,
            retryable: false,
            traceId: "trace_internal",
        });
    });

    test("returns canonical NOT_FOUND payload when a pending tool result is missing", async () => {
        const server = createServer({
            runtime: createRuntimeStub(),
            pluginRuntime: null,
            secret: "top-secret",
        });

        const response = await server.handle(
            new Request("https://example.com/test/run/tool-result", {
                method: "POST",
                headers: {
                    authorization: "Bearer top-secret",
                    "content-type": "application/json",
                },
                body: JSON.stringify({
                    runId: "run_1",
                    toolCallId: "call_1",
                    status: "success",
                    result: { ok: true },
                }),
            }),
        );

        expect(response.status).toBe(404);
        expect(response.json()).resolves.toEqual({
            code: "NOT_FOUND",
            message: "No pending client tool call found for runId/toolCallId.",
            status: 404,
        });
    });

    test("rejects malformed tool result payloads before runtime submission", async () => {
        const server = createServer({
            runtime: createRuntimeStub(),
            pluginRuntime: null,
            secret: "top-secret",
        });

        const response = await server.handle(
            new Request("https://example.com/test/run/tool-result", {
                method: "POST",
                headers: {
                    authorization: "Bearer top-secret",
                    "content-type": "application/json",
                },
                body: JSON.stringify({
                    runId: " ",
                    toolCallId: "",
                    status: "success",
                    result: { ok: true },
                }),
            }),
        );

        expect(response.status).toBe(422);
    });

    test("returns canonical NOT_FOUND payload when a pending tool approval is missing", async () => {
        const server = createServer({
            runtime: createRuntimeStub(),
            pluginRuntime: null,
            secret: "top-secret",
        });

        const response = await server.handle(
            new Request("https://example.com/test/run/tool-approval", {
                method: "POST",
                headers: {
                    authorization: "Bearer top-secret",
                    "content-type": "application/json",
                },
                body: JSON.stringify({
                    runId: "run_1",
                    toolCallId: "call_1",
                    decision: "approved",
                }),
            }),
        );

        expect(response.status).toBe(404);
        expect(response.json()).resolves.toEqual({
            code: "NOT_FOUND",
            message: "No pending tool approval found for runId/toolCallId.",
            status: 404,
        });
    });
});
