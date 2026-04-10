import "./setup";
import { describe, test } from "bun:test";
import assert from "node:assert/strict";
import { pruneInputByCapabilities } from "../src";
import { createClient } from "../src/core/client";
import { createAgentChatController } from "../src/core/controller";
import { toAgentClientError } from "../src/core/error";
import { applyEvent, createMessageState } from "../src/core/reducer";
import { getMessagesFromResponse } from "../src/core/response";
import { fromConversationItems, fromModelMessages, toModelMessages } from "../src/core/utils";

const jsonResponse = (body: unknown, init?: ResponseInit) =>
    new Response(JSON.stringify(body), {
        ...init,
        headers: {
            "content-type": "application/json",
            ...(init?.headers ?? {}),
        },
    });

const sseResponse = (chunks: string[], init?: ResponseInit) =>
    new Response(
        new ReadableStream<Uint8Array>({
            start(controller) {
                const encoder = new TextEncoder();
                for (const chunk of chunks) {
                    controller.enqueue(encoder.encode(chunk));
                }
                controller.close();
            },
        }),
        {
            ...init,
            headers: {
                "content-type": "text/event-stream",
                ...(init?.headers ?? {}),
            },
        },
    );

const createFetchMock = (
    handler: (...args: Parameters<typeof fetch>) => ReturnType<typeof fetch>,
): typeof fetch =>
    Object.assign(handler, {
        preconnect: (() => {}) as typeof fetch.preconnect,
    });

describe("client transport", () => {
    test("client entrypoint re-exports pruneInputByCapabilities", () => {
        assert.equal(typeof pruneInputByCapabilities, "function");
    });

    test("toAgentClientError strips runtime wrapper prefixes from Error instances", () => {
        const error = new Error("Run failed: Tool name must be a non-empty string.");
        const normalized = toAgentClientError(error);

        assert.equal(normalized.message, "Tool name must be a non-empty string.");
    });

    test("toAgentClientError strips runtime wrapper prefixes from structured payloads", () => {
        const normalized = toAgentClientError({
            message: "Run failed: Hosted tool was invalid.",
            detail: "Run failed: Hosted tool was invalid.",
        });

        assert.equal(normalized.message, "Hosted tool was invalid.");
        assert.equal(normalized.detail, "Hosted tool was invalid.");
    });

    test("toModelMessages preserves assistant image parts by default", () => {
        const modelMessages = toModelMessages([
            {
                localId: "u_1",
                role: "user",
                parts: [
                    { type: "text", text: "show me" },
                    {
                        type: "image",
                        source: { kind: "url", url: "https://example.com/user.png" },
                    },
                ],
            },
            {
                localId: "a_1",
                role: "assistant",
                parts: [
                    { type: "text", text: "here you go" },
                    {
                        type: "image",
                        source: { kind: "url", url: "https://example.com/assistant.png" },
                    },
                ],
            },
        ]);

        assert.deepEqual(modelMessages, [
            {
                type: "message",
                role: "user",
                content: [
                    { type: "text", text: "show me" },
                    {
                        type: "image",
                        source: { kind: "url", url: "https://example.com/user.png" },
                    },
                ],
            },
            {
                type: "message",
                role: "assistant",
                content: [
                    { type: "text", text: "here you go" },
                    {
                        type: "image",
                        source: { kind: "url", url: "https://example.com/assistant.png" },
                    },
                ],
            },
        ]);
    });

    test("toModelMessages replays hosted tool results by default", () => {
        const modelMessages = toModelMessages([
            {
                localId: "a_1",
                role: "assistant",
                parts: [
                    {
                        type: "tool-call",
                        callId: "call_1",
                        name: "image_generation",
                        status: "success",
                        toolTarget: "hosted",
                    },
                    {
                        type: "tool-result",
                        callId: "call_1",
                        status: "success",
                        result: { url: "https://example.com/image.png" },
                    },
                ],
            },
        ]);

        assert.deepEqual(modelMessages, [
            {
                type: "tool-call",
                callId: "call_1",
                name: "image_generation",
                result: { url: "https://example.com/image.png" },
            },
        ]);
    });

    test("toModelMessages preserves transcript and reasoning parts in model input", () => {
        const modelMessages = toModelMessages([
            {
                localId: "u_1",
                role: "user",
                parts: [
                    { type: "text", text: "hello" },
                    { type: "reasoning", text: "hidden", visibility: "summary" },
                    { type: "transcript", text: "hello world" },
                ],
            },
        ]);

        assert.deepEqual(modelMessages, [
            {
                type: "message",
                role: "user",
                content: [
                    { type: "text", text: "hello" },
                    { type: "reasoning", text: "hidden", visibility: "summary" },
                    { type: "transcript", text: "hello world" },
                ],
            },
        ]);
    });

    test("toModelMessages preserves providerMetadata on replayed parts", () => {
        const modelMessages = toModelMessages([
            {
                localId: "u_1",
                role: "user",
                parts: [
                    {
                        type: "text",
                        text: "Grounded answer",
                        providerMetadata: {
                            anthropic: {
                                citations: [{ start: 0, end: 8, document_id: "doc_1" }],
                            },
                        },
                    },
                    {
                        type: "file",
                        source: {
                            kind: "url",
                            url: "https://example.com/report.pdf",
                            mimeType: "application/pdf",
                            filename: "report.pdf",
                        },
                        providerMetadata: {
                            anthropic: {
                                context: "Use the report as the source of truth.",
                                citations: { enabled: true },
                            },
                        },
                    },
                ],
            },
        ]);

        assert.deepEqual(modelMessages, [
            {
                type: "message",
                role: "user",
                content: [
                    {
                        type: "text",
                        text: "Grounded answer",
                        providerMetadata: {
                            anthropic: {
                                citations: [{ start: 0, end: 8, document_id: "doc_1" }],
                            },
                        },
                    },
                    {
                        type: "file",
                        source: {
                            kind: "url",
                            url: "https://example.com/report.pdf",
                            mimeType: "application/pdf",
                            filename: "report.pdf",
                        },
                        providerMetadata: {
                            anthropic: {
                                context: "Use the report as the source of truth.",
                                citations: { enabled: true },
                            },
                        },
                    },
                ],
            },
        ]);
    });

    test("toModelMessages preserves multiple text parts as structured content", () => {
        const modelMessages = toModelMessages([
            {
                localId: "u_1",
                role: "user",
                parts: [
                    { type: "text", text: "Hello" },
                    { type: "text", text: " world" },
                ],
            },
        ]);

        assert.deepEqual(modelMessages, [
            {
                type: "message",
                role: "user",
                content: [
                    { type: "text", text: "Hello" },
                    { type: "text", text: " world" },
                ],
            },
        ]);
    });

    test("fromModelMessages round-trips tool results through toModelMessages", () => {
        const hydrated = fromModelMessages([
            {
                type: "tool-call",
                callId: "call_1",
                name: "searchWeb",
                result: { answer: 42 },
            },
        ]);

        assert.equal(hydrated.length, 1);
        assert.deepEqual(toModelMessages(hydrated), [
            {
                type: "tool-call",
                callId: "call_1",
                name: "searchWeb",
                result: { answer: 42 },
            },
        ]);
    });

    test("fromModelMessages keeps tool results grouped with the preceding assistant message", () => {
        const hydrated = fromModelMessages([
            {
                type: "message",
                role: "assistant",
                content: [{ type: "text", text: "Let me check." }],
            },
            {
                type: "tool-call",
                callId: "call_1",
                name: "searchWeb",
                result: { answer: 42 },
            },
        ]);

        assert.equal(hydrated.length, 1);
        assert.deepEqual(hydrated[0]?.parts, [
            { type: "text", text: "Let me check.", state: "complete" },
            {
                type: "tool-call",
                callId: "call_1",
                name: "searchWeb",
                status: "success",
                state: "completed",
            },
            {
                type: "tool-result",
                callId: "call_1",
                result: { answer: 42 },
                status: "success",
            },
        ]);
        assert.deepEqual(toModelMessages(hydrated), [
            {
                type: "message",
                role: "assistant",
                content: "Let me check.",
            },
            {
                type: "tool-call",
                callId: "call_1",
                name: "searchWeb",
                result: { answer: 42 },
            },
        ]);
    });

    test("fromModelMessages handles prompt-style messages and multimodal content", () => {
        const hydrated = fromModelMessages([
            {
                type: "message",
                content: [
                    { type: "text", text: "hello" },
                    {
                        type: "image",
                        source: { kind: "url", url: "https://example.com/image.png" },
                    },
                ],
            } as Parameters<typeof fromModelMessages>[0][number],
        ]);

        assert.equal(hydrated.length, 1);
        assert.equal(hydrated[0]?.role, "user");
        assert.equal(hydrated[0]?.parts[0]?.type, "text");
        assert.equal(hydrated[0]?.parts[1]?.type, "image");
    });

    test("fromModelMessages returns an empty array for empty input", () => {
        assert.deepEqual(fromModelMessages([]), []);
    });

    test("fromConversationItems hydrates durable media, embeddings, transcripts, reasoning, and tool history", () => {
        const hydrated = fromConversationItems([
            {
                type: "message",
                role: "user",
                content: [
                    { type: "text", text: "Look at this" },
                    {
                        type: "file",
                        source: {
                            kind: "url",
                            url: "https://example.com/file.pdf",
                            mimeType: "application/pdf",
                            filename: "file.pdf",
                        },
                    },
                ],
            },
            {
                type: "message",
                role: "assistant",
                content: [
                    { type: "text", text: "Found one match." },
                    { type: "embedding", embedding: [0.1, 0.2, 0.3] },
                    { type: "transcript", text: "hello world" },
                    { type: "reasoning", text: "summary", visibility: "summary" },
                ],
            },
            {
                type: "tool-call",
                callId: "call_1",
                name: "searchDocs",
                arguments: '{"query":"history"}',
            },
            {
                type: "tool-call",
                callId: "call_1",
                name: "searchDocs",
                result: { count: 1 },
            },
        ]);

        assert.equal(hydrated.length, 2);
        assert.equal(hydrated[0]?.parts[1]?.type, "file");
        assert.equal(hydrated[1]?.parts[1]?.type, "embedding");
        assert.equal(hydrated[1]?.parts[2]?.type, "transcript");
        assert.equal(hydrated[1]?.parts[3]?.type, "reasoning");
        assert.deepEqual(hydrated[1]?.parts.slice(4), [
            {
                type: "tool-call",
                callId: "call_1",
                name: "searchDocs",
                args: '{"query":"history"}',
                status: "success",
                state: "completed",
            },
            {
                type: "tool-result",
                callId: "call_1",
                result: { count: 1 },
                status: "success",
            },
        ]);
    });

    test("fromConversationItems groups tool history the same way as the live reducer", () => {
        const conversationItems = [
            {
                type: "message",
                role: "assistant",
                content: "Checking...",
            },
            {
                type: "tool-call",
                callId: "call_1",
                name: "searchWeb",
                arguments: '{"query":"weather"}',
            },
            {
                type: "tool-call",
                callId: "call_1",
                name: "searchWeb",
                result: { answer: 42 },
            },
        ] satisfies Parameters<typeof fromConversationItems>[0];

        const hydrated = fromConversationItems(conversationItems, {
            generateId: (() => {
                let id = 0;
                return () => `msg_${id++}`;
            })(),
        });
        const live = [
            {
                localId: "msg_0",
                role: "assistant" as const,
                parts: [{ type: "text" as const, text: "Checking...", state: "complete" as const }],
            },
        ];
        const liveState = [
            {
                type: "TOOL_CALL_START" as const,
                timestamp: 1,
                runId: "run_1",
                agentName: "support",
                parentMessageId: "msg_0",
                toolCallId: "call_1",
                toolCallName: "searchWeb",
                toolTarget: "server" as const,
            },
            {
                type: "TOOL_CALL_ARGS" as const,
                timestamp: 2,
                runId: "run_1",
                agentName: "support",
                parentMessageId: "msg_0",
                toolCallId: "call_1",
                toolCallName: "searchWeb",
                toolTarget: "server" as const,
                delta: '{"query":"weather"}',
            },
            {
                type: "TOOL_CALL_END" as const,
                timestamp: 3,
                runId: "run_1",
                agentName: "support",
                parentMessageId: "msg_0",
                toolCallId: "call_1",
                toolCallName: "searchWeb",
                toolTarget: "server" as const,
            },
            {
                type: "TOOL_CALL_RESULT" as const,
                timestamp: 4,
                runId: "run_1",
                agentName: "support",
                parentMessageId: "msg_0",
                toolCallId: "call_1",
                toolCallName: "searchWeb",
                toolTarget: "server" as const,
                result: { answer: 42 },
            },
        ].reduce((state, event) => applyEvent(state, event), createMessageState(live));

        // Strip toolTarget from live-reduced messages since conversation items
        // don't carry toolTarget (it's a runtime-only SSE concept).
        const stripToolTarget = (messages: typeof hydrated) =>
            messages.map((msg) => ({
                ...msg,
                parts: msg.parts.map((part) => {
                    if (part.type === "tool-call" && "toolTarget" in part) {
                        const { toolTarget: _, ...rest } = part;
                        return rest;
                    }
                    return part;
                }),
            }));

        assert.deepEqual(hydrated, stripToolTarget(liveState.messages));
    });

    test("fromConversationItems treats tool-call results with optional arguments as results", () => {
        const hydrated = fromConversationItems([
            {
                type: "message",
                role: "assistant",
                content: "Checking weather...",
            },
            {
                type: "tool-call",
                callId: "call_1",
                name: "get_weather",
                arguments: '{"location":"Addis Ababa","unit":"Celsius"}',
            },
            {
                type: "tool-call",
                callId: "call_1",
                name: "get_weather",
                arguments: '{"location":"Addis Ababa","unit":"Celsius"}',
                result: {
                    type: "tool_error",
                    message: "fetch failed",
                },
                isError: true,
            },
        ]);

        assert.deepEqual(hydrated, [
            {
                localId: hydrated[0]?.localId,
                role: "assistant",
                parts: [
                    {
                        type: "text",
                        text: "Checking weather...",
                        state: "complete",
                    },
                    {
                        type: "tool-call",
                        callId: "call_1",
                        name: "get_weather",
                        args: '{"location":"Addis Ababa","unit":"Celsius"}',
                        status: "error",
                        state: "completed",
                    },
                    {
                        type: "tool-result",
                        callId: "call_1",
                        result: {
                            type: "tool_error",
                            message: "fetch failed",
                        },
                        status: "error",
                    },
                ],
            },
        ]);
    });

    test("getMessagesFromResponse synthesizes completed tool calls for standalone provider tool results", () => {
        const messages = getMessagesFromResponse({
            output: [
                {
                    type: "provider-tool-result",
                    callId: "call_1",
                    name: "searchWeb",
                    result: { answer: 42 },
                },
            ],
        } as Parameters<typeof getMessagesFromResponse>[0]);

        assert.deepEqual(messages, [
            {
                localId: "response_tool_result_0",
                role: "assistant",
                parts: [
                    {
                        type: "tool-call",
                        callId: "call_1",
                        name: "searchWeb",
                        status: "success",
                        state: "completed",
                    },
                    {
                        type: "tool-result",
                        callId: "call_1",
                        result: { answer: 42 },
                        status: "success",
                    },
                ],
            },
        ]);
    });

    test("getMessagesFromResponse pairs provider tool results with earlier matching assistant tool calls", () => {
        const messages = getMessagesFromResponse({
            output: [
                {
                    type: "tool-call",
                    callId: "call_1",
                    name: "searchWeb",
                    arguments: '{"query":"weather"}',
                },
                {
                    type: "message",
                    role: "assistant",
                    content: "Checking...",
                },
                {
                    type: "provider-tool-result",
                    callId: "call_1",
                    name: "searchWeb",
                    result: { answer: 42 },
                },
            ],
        } as Parameters<typeof getMessagesFromResponse>[0]);

        assert.deepEqual(messages, [
            {
                localId: "response_tool_call_0",
                role: "assistant",
                parts: [
                    {
                        type: "tool-call",
                        callId: "call_1",
                        name: "searchWeb",
                        args: '{"query":"weather"}',
                        status: "success",
                        state: "completed",
                    },
                    {
                        type: "tool-result",
                        callId: "call_1",
                        result: { answer: 42 },
                        status: "success",
                    },
                ],
            },
            {
                localId: "response_message_1",
                role: "assistant",
                parts: [{ type: "text", text: "Checking...", state: "complete" }],
            },
        ]);
    });

    test("getMessagesFromResponse skips response messages whose parts cannot be mapped", () => {
        const messages = getMessagesFromResponse({
            output: [
                {
                    type: "message",
                    role: "assistant",
                    content: [{ type: "unknown-part" }],
                },
            ],
            finishReason: "stop",
            usage: {},
        } as unknown as Parameters<typeof getMessagesFromResponse>[0]);

        assert.deepEqual(messages, []);
    });

    test("applyEvent preserves streamed text part boundaries after a completed text part", () => {
        let state = createMessageState();

        state = applyEvent(state, {
            type: "TEXT_MESSAGE_START",
            timestamp: 1,
            messageId: "m_1",
            role: "assistant",
        } as Parameters<typeof applyEvent>[1]);
        state = applyEvent(state, {
            type: "TEXT_MESSAGE_CONTENT",
            timestamp: 2,
            messageId: "m_1",
            delta: "Hello",
        } as Parameters<typeof applyEvent>[1]);
        state = applyEvent(state, {
            type: "TEXT_MESSAGE_END",
            timestamp: 3,
            messageId: "m_1",
        } as Parameters<typeof applyEvent>[1]);
        state = applyEvent(state, {
            type: "TEXT_MESSAGE_START",
            timestamp: 4,
            messageId: "m_1",
            role: "assistant",
        } as Parameters<typeof applyEvent>[1]);
        state = applyEvent(state, {
            type: "TEXT_MESSAGE_CONTENT",
            timestamp: 5,
            messageId: "m_1",
            delta: " world",
        } as Parameters<typeof applyEvent>[1]);
        state = applyEvent(state, {
            type: "TEXT_MESSAGE_END",
            timestamp: 6,
            messageId: "m_1",
        } as Parameters<typeof applyEvent>[1]);

        assert.deepEqual(state.messages[0]?.parts, [
            { type: "text", text: "Hello", state: "complete" },
            { type: "text", text: " world", state: "complete" },
        ]);
    });

    test("applyEvent does not synthesize a duplicate replay user message for the same run", () => {
        const state = createMessageState([
            {
                localId: "user_run:run_1",
                id: "user_run:run_1",
                role: "user",
                parts: [{ type: "text", text: "Hello", state: "complete" }],
                status: "sent",
            },
            {
                localId: "a_1",
                role: "assistant",
                parts: [{ type: "text", text: "Hi", state: "complete" }],
            },
        ]);

        const next = applyEvent(
            state,
            {
                type: "RUN_STARTED",
                timestamp: 1,
                runId: "run_1",
                agentName: "assistant",
                runInput: {
                    input: "Hello",
                },
            } as Parameters<typeof applyEvent>[1],
            {
                synthesizeReplayUserMessage: true,
            },
        );

        assert.equal(next.messages.length, 2);
        assert.deepEqual(next.messages[0], state.messages[0]);
        assert.deepEqual(next.messages[1], state.messages[1]);
    });

    test("applyEvent replays repeated user text for a different run", () => {
        const state = createMessageState([
            {
                localId: "u_1",
                role: "user",
                parts: [{ type: "text", text: "Hello", state: "complete" }],
                status: "sent",
            },
            {
                localId: "a_1",
                role: "assistant",
                parts: [{ type: "text", text: "Hi", state: "complete" }],
            },
        ]);

        const next = applyEvent(
            state,
            {
                type: "RUN_STARTED",
                timestamp: 1,
                runId: "run_2",
                agentName: "assistant",
                runInput: {
                    input: "Hello",
                },
            } as Parameters<typeof applyEvent>[1],
            {
                synthesizeReplayUserMessage: true,
            },
        );

        assert.equal(next.messages.length, 3);
        assert.equal(next.messages[2]?.role, "user");
        assert.equal(next.messages[2]?.parts[0]?.type, "text");
    });

    test("applyEvent keeps denied approvals terminal when later tool-call events arrive", () => {
        let state = createMessageState([
            {
                localId: "a_1",
                role: "assistant",
                parts: [
                    {
                        type: "tool-call",
                        callId: "call_1",
                        name: "searchWeb",
                        status: "error",
                        state: "approval-denied",
                    },
                ],
            },
        ]);

        state = applyEvent(state, {
            type: "TOOL_CALL_START",
            timestamp: 1,
            runId: "run_1",
            agentName: "assistant",
            parentMessageId: "a_1",
            toolCallId: "call_1",
            toolCallName: "searchWeb",
            toolTarget: "client",
        } as Parameters<typeof applyEvent>[1]);

        assert.deepEqual(state.messages[0]?.parts, [
            {
                type: "tool-call",
                callId: "call_1",
                name: "searchWeb",
                status: "error",
                state: "approval-denied",
            },
        ]);
    });

    test("controller restores optimistic local state when a send is aborted", async () => {
        const client = {
            run: async (_agent: string, _payload: unknown, options?: { signal?: AbortSignal }) => {
                const error = new Error("aborted");
                error.name = options?.signal?.aborted ? "AbortError" : "Error";
                throw error;
            },
        };
        const controller = createAgentChatController(client as never, {
            agent: "assistant" as never,
            delivery: "final",
            optimisticUserMessage: true,
        });

        const abortController = new AbortController();
        abortController.abort();

        await controller.sendMessage({ input: "Hello" }, { signal: abortController.signal });

        assert.equal(controller.getStatus(), "ready");
        assert.deepEqual(controller.getMessages(), []);
    });

    test("controller restores retry-truncated transcript when a retry is aborted", async () => {
        const client = {
            run: (_agent: string, _payload: unknown, options?: { signal?: AbortSignal }) =>
                new Promise((_, reject) => {
                    options?.signal?.addEventListener(
                        "abort",
                        () => {
                            const error = new Error("aborted");
                            error.name = "AbortError";
                            reject(error);
                        },
                        { once: true },
                    );
                }),
        };
        const controller = createAgentChatController(client as never, {
            agent: "assistant" as never,
            delivery: "final",
            initialMessages: [
                {
                    localId: "u_1",
                    role: "user",
                    parts: [{ type: "text", text: "Hello", state: "complete" }],
                    status: "sent",
                },
                {
                    localId: "a_1",
                    role: "assistant",
                    parts: [{ type: "text", text: "Hi", state: "complete" }],
                },
            ],
        });

        const originalMessages = controller.getMessages();
        const pending = controller.retryMessage("u_1");
        controller.stop();
        await pending;

        assert.deepEqual(controller.getMessages(), originalMessages);
    });

    test("run includes modelOptions in the JSON request body", async () => {
        let requestBody: Record<string, unknown> | undefined;
        const client = createClient({
            baseURL: "https://example.com/api",
            secret: "secret",
            fetch: createFetchMock(async (_url, init) => {
                requestBody = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
                return jsonResponse({
                    response: {
                        output: [],
                        finishReason: "stop",
                        usage: {},
                    },
                });
            }),
        });

        await client.run("support", {
            input: "hello",
            modelOptions: {
                reasoningEffort: "high",
                reasoningSummary: "auto",
            },
        });

        assert.deepEqual(requestBody?.modelOptions, {
            reasoningEffort: "high",
            reasoningSummary: "auto",
        });
    });

    test("run extracts structured error details from JSON responses", async () => {
        const client = createClient({
            baseURL: "https://example.com/api",
            secret: "secret",
            fetch: createFetchMock(async () =>
                jsonResponse(
                    {
                        code: "RATE_LIMITED",
                        message: "Slow down",
                        status: 429,
                        retryable: true,
                        traceId: "trace_1",
                        issues: [{ message: "Too many requests", path: "/" }],
                        context: { provider: "openai" },
                        trace: [{ at: "core.test.rateLimit" }],
                    },
                    { status: 429 },
                ),
            ),
        });

        await assert.rejects(
            () => client.run("support", { input: "hello" }),
            (error: unknown) => {
                assert.equal(error instanceof Error, true);
                assert.equal((error as Error).message.includes("Slow down"), true);
                assert.equal((error as { code?: string }).code, "RATE_LIMITED");
                assert.equal((error as { status?: number }).status, 429);
                assert.equal((error as { retryable?: boolean }).retryable, true);
                assert.equal((error as { traceId?: string }).traceId, "trace_1");
                assert.deepEqual((error as { context?: Record<string, unknown> }).context, {
                    agentName: "support",
                    provider: "openai",
                    operation: "run",
                    status: 429,
                    error: "RATE_LIMITED",
                    issues: [{ message: "Too many requests", path: "/" }],
                });
                assert.deepEqual((error as { issues?: unknown[] }).issues, [
                    { message: "Too many requests", path: "/" },
                ]);
                assert.deepEqual((error as { trace?: unknown[] }).trace, [
                    { at: "core.test.rateLimit" },
                    { at: "client.core.run" },
                ]);
                return true;
            },
        );
    });

    test("run preserves HTTP status for error codes outside shared metadata", async () => {
        const client = createClient({
            baseURL: "https://example.com/api",
            secret: "secret",
            fetch: createFetchMock(async () =>
                jsonResponse(
                    {
                        code: "UNAUTHORIZED",
                        message: "Missing or invalid bearer token.",
                        status: 401,
                    },
                    { status: 401 },
                ),
            ),
        });

        await assert.rejects(
            () => client.run("support", { input: "hello" }),
            (error: unknown) => {
                assert.equal((error as { code?: string }).code, "UNAUTHORIZED");
                assert.equal((error as { status?: number }).status, 401);
                assert.equal((error as Error).message, "Missing or invalid bearer token.");
                return true;
            },
        );
    });

    test("run omits authorization when the client has no secret", async () => {
        let authorization: string | null = "unexpected";
        const client = createClient({
            baseURL: "https://example.com/api",
            fetch: createFetchMock(async (_url, init) => {
                authorization = new Headers(init?.headers).get("authorization");
                return jsonResponse({
                    response: {
                        output: [],
                        finishReason: "stop",
                        usage: {},
                    },
                });
            }),
        });

        await client.run("support", { input: "hello" });

        assert.equal(authorization, null);
    });

    test("loadConversation handles 200 and prepareRequest", async () => {
        let seenOperation: string | undefined;
        let seenUrl: string | undefined;
        const client = createClient({
            baseURL: "https://example.com/api",
            secret: "secret",
            advanced: {
                prepareRequest: (context) => {
                    seenOperation = context.operation;
                    seenUrl = context.url;
                    return undefined;
                },
            },
            fetch: createFetchMock(async () =>
                jsonResponse({
                    items: [{ type: "message", role: "user", content: "hello" }],
                }),
            ),
        });

        const result = await client.loadConversation?.("support", "conv_1");

        assert.equal(seenOperation, "load-conversation");
        assert.equal(seenUrl, "https://example.com/api/support/conversations/conv_1");
        assert.deepEqual(result, {
            items: [{ type: "message", role: "user", content: "hello" }],
        });
    });

    test("run forwards modalities", async () => {
        let requestBody: Record<string, unknown> | undefined;
        const client = createClient({
            baseURL: "https://example.com/api",
            secret: "secret",
            fetch: createFetchMock(async (_url, init) => {
                requestBody = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
                return jsonResponse({
                    response: { output: [], finishReason: "stop", usage: {} },
                });
            }),
        });

        await client.run("support", {
            input: "draw a chart",
            modalities: ["image"],
        });

        assert.deepEqual(requestBody?.modalities, ["image"]);
    });

    test("loadConversation returns null on 204", async () => {
        const client = createClient({
            baseURL: "https://example.com/api",
            secret: "secret",
            fetch: createFetchMock(async () => new Response(null, { status: 204 })),
        });

        const result = await client.loadConversation?.("support", "conv_1");
        assert.equal(result, null);
    });

    test("loadConversation surfaces request errors", async () => {
        const client = createClient({
            baseURL: "https://example.com/api",
            secret: "secret",
            fetch: createFetchMock(async () =>
                jsonResponse(
                    { code: "BAD_REQUEST", message: "Nope", status: 400 },
                    { status: 400 },
                ),
            ),
        });

        await assert.rejects(
            async () => {
                await (client.loadConversation?.("support", "conv_1") ?? Promise.resolve(null));
            },
            (error) => {
                assert.equal((error as Error).message, "Nope");
                assert.equal((error as { code?: string }).code, "BAD_REQUEST");
                return true;
            },
        );
    });

    test("run does not surface raw HTML error pages as the user-facing message", async () => {
        const client = createClient({
            baseURL: "https://example.com/api",
            secret: "secret",
            fetch: createFetchMock(
                async () =>
                    new Response("<!DOCTYPE html><html><body><h1>500</h1></body></html>", {
                        status: 500,
                        headers: {
                            "content-type": "text/html; charset=utf-8",
                        },
                    }),
            ),
        });

        await assert.rejects(
            () => client.run("support", { input: "hello" }),
            (error: unknown) => {
                assert.equal(error instanceof Error, true);
                assert.equal(
                    (error as Error).message,
                    "Server returned an HTML error page. This usually means a framework or dev-server failure before the API handler ran.",
                );
                assert.equal((error as { code?: string }).code, "UPSTREAM_FAILED");
                assert.equal(
                    (error as { context?: Record<string, unknown> }).context?.responseContentType,
                    "text/html; charset=utf-8",
                );
                assert.equal(
                    typeof (error as { context?: Record<string, unknown> }).context
                        ?.responseBodySnippet,
                    "string",
                );
                return true;
            },
        );
    });

    test("resumeStream parses SSE events and forwards last-event-id", async () => {
        const seenHeaders: string[] = [];
        const client = createClient({
            baseURL: "https://example.com/api",
            secret: "secret",
            fetch: createFetchMock(async (_url, init) => {
                seenHeaders.push(String(new Headers(init?.headers).get("last-event-id")));
                return sseResponse([
                    "id: 4\n",
                    'data: {"type":"RUN_FINISHED","timestamp":1,"runId":"run_1","agentName":"support","result":{"response":{"output":[],"finishReason":"stop","usage":{}}}}\n\n',
                ]);
            }),
        });

        const events = [];
        for await (const event of client.resumeStream("support", {
            streamId: "stream_1",
            afterSeq: 3,
        })) {
            events.push(event);
        }

        assert.equal(seenHeaders[0], "3");
        assert.equal(events.length, 1);
        assert.equal(events[0]?.seq, 4);
        assert.equal(events[0]?.type, "RUN_FINISHED");
    });

    test("stream surfaces transport-level SSE error frames", async () => {
        const client = createClient({
            baseURL: "https://example.com/api",
            secret: "secret",
            fetch: createFetchMock(async () =>
                sseResponse([
                    'event: error\ndata: {"type":"error","message":"Upstream stream failed"}\n\n',
                ]),
            ),
        });

        await assert.rejects(
            async () => {
                for await (const _event of client.stream("support", { input: "hello" })) {
                    // consume
                }
            },
            (error) => {
                assert.equal((error as Error).message, "Upstream stream failed");
                return true;
            },
        );
    });

    test("stream intercepts client tool calls and submits tool results", async () => {
        const requests: Array<{ url: string; method: string; body?: string }> = [];
        const client = createClient({
            baseURL: "https://example.com/api",
            secret: "secret",
            fetch: createFetchMock(async (url, init) => {
                const method = String(init?.method ?? "GET");
                const body = typeof init?.body === "string" ? init.body : undefined;
                requests.push({
                    url: String(url),
                    method,
                    ...(body !== undefined ? { body } : {}),
                });

                if (String(url).endsWith("/run")) {
                    return sseResponse([
                        'data: {"type":"TOOL_CALL_START","timestamp":1,"runId":"run_1","agentName":"support","parentMessageId":"msg_1","toolCallId":"call_1","toolCallName":"getTime","toolTarget":"client"}\n\n',
                        'data: {"type":"TOOL_CALL_ARGS","timestamp":2,"runId":"run_1","agentName":"support","parentMessageId":"msg_1","toolCallId":"call_1","toolCallName":"getTime","toolTarget":"client","delta":"{\\"zone\\":\\"UTC\\"}"}\n\n',
                        'data: {"type":"TOOL_CALL_END","timestamp":3,"runId":"run_1","agentName":"support","parentMessageId":"msg_1","toolCallId":"call_1","toolCallName":"getTime","toolTarget":"client"}\n\n',
                        'data: {"type":"RUN_FINISHED","timestamp":4,"runId":"run_1","agentName":"support","result":{"response":{"output":[],"finishReason":"stop","usage":{}}}}\n\n',
                    ]);
                }

                if (String(url).endsWith("/run/tool-result")) {
                    return new Response(null, { status: 204 });
                }

                return jsonResponse({}, { status: 200 });
            }),
        });

        const events = [];
        for await (const event of client.stream(
            "support",
            { input: "hello" },
            {
                toolHandlers: {
                    getTime: (input) => ({ ok: true, zone: (input as { zone: string }).zone }),
                },
            },
        )) {
            events.push(event);
        }

        const toolResultRequest = requests.find((entry) => entry.url.endsWith("/run/tool-result"));
        assert.ok(toolResultRequest);
        assert.equal(toolResultRequest?.method, "POST");
        assert.equal(
            events.some((event) => event.type === "RUN_FINISHED"),
            true,
        );
        assert.equal(toolResultRequest?.body?.includes('"toolCallId":"call_1"'), true);
        assert.equal(toolResultRequest?.body?.includes('"zone":"UTC"'), true);
    });

    test("stream waits for approval before submitting client tool results", async () => {
        const requests: Array<{ url: string; method: string; body?: string }> = [];
        const client = createClient({
            baseURL: "https://example.com/api",
            secret: "secret",
            fetch: createFetchMock(async (url, init) => {
                const method = String(init?.method ?? "GET");
                const body = typeof init?.body === "string" ? init.body : undefined;
                requests.push({
                    url: String(url),
                    method,
                    ...(body !== undefined ? { body } : {}),
                });

                if (String(url).endsWith("/run")) {
                    return sseResponse([
                        'data: {"type":"TOOL_CALL_START","timestamp":1,"runId":"run_1","agentName":"support","parentMessageId":"msg_1","toolCallId":"call_1","toolCallName":"getTime","toolTarget":"client"}\n\n',
                        'data: {"type":"TOOL_CALL_ARGS","timestamp":2,"runId":"run_1","agentName":"support","parentMessageId":"msg_1","toolCallId":"call_1","toolCallName":"getTime","toolTarget":"client","delta":"{\\"zone\\":\\"UTC\\"}"}\n\n',
                        'data: {"type":"TOOL_APPROVAL_REQUIRED","timestamp":3,"runId":"run_1","agentName":"support","parentMessageId":"msg_1","toolCallId":"call_1","toolCallName":"getTime","toolTarget":"client","state":"requested","toolInput":{"zone":"UTC"}}\n\n',
                        'data: {"type":"TOOL_APPROVAL_UPDATED","timestamp":4,"runId":"run_1","agentName":"support","parentMessageId":"msg_1","toolCallId":"call_1","toolCallName":"getTime","toolTarget":"client","state":"requested","toolInput":{"zone":"UTC"}}\n\n',
                        'data: {"type":"TOOL_CALL_END","timestamp":5,"runId":"run_1","agentName":"support","parentMessageId":"msg_1","toolCallId":"call_1","toolCallName":"getTime","toolTarget":"client"}\n\n',
                        'data: {"type":"TOOL_APPROVAL_UPDATED","timestamp":6,"runId":"run_1","agentName":"support","parentMessageId":"msg_1","toolCallId":"call_1","toolCallName":"getTime","toolTarget":"client","state":"approved","toolInput":{"zone":"UTC"}}\n\n',
                        'data: {"type":"RUN_FINISHED","timestamp":7,"runId":"run_1","agentName":"support","result":{"response":{"output":[],"finishReason":"stop","usage":{}}}}\n\n',
                    ]);
                }

                if (String(url).endsWith("/run/tool-result")) {
                    return new Response(null, { status: 204 });
                }

                return jsonResponse({}, { status: 200 });
            }),
        });

        for await (const _event of client.stream(
            "support",
            { input: "hello" },
            {
                toolHandlers: {
                    getTime: (input) => ({ ok: true, zone: (input as { zone: string }).zone }),
                },
            },
        )) {
            // consume
        }

        const toolResultRequests = requests.filter((entry) =>
            entry.url.endsWith("/run/tool-result"),
        );
        assert.equal(toolResultRequests.length, 1);
        assert.equal(toolResultRequests[0]?.body?.includes('"zone":"UTC"'), true);
    });

    test("stream submits client tool results when fetch is receiver-sensitive", async () => {
        const originalFetch = globalThis.fetch;
        const nativeLikeFetch = Object.assign(
            async function (
                this: { baseURL?: string } | undefined,
                url: URL | RequestInfo,
                _init?: RequestInit,
            ) {
                assert.notEqual(this?.baseURL, "https://example.com/api");

                if (String(url).endsWith("/run")) {
                    return sseResponse([
                        'data: {"type":"TOOL_CALL_START","timestamp":1,"runId":"run_1","agentName":"support","parentMessageId":"msg_1","toolCallId":"call_1","toolCallName":"getTime","toolTarget":"client"}\n\n',
                        'data: {"type":"TOOL_CALL_ARGS","timestamp":2,"runId":"run_1","agentName":"support","parentMessageId":"msg_1","toolCallId":"call_1","toolCallName":"getTime","toolTarget":"client","delta":"{\\"zone\\":\\"UTC\\"}"}\n\n',
                        'data: {"type":"TOOL_CALL_END","timestamp":3,"runId":"run_1","agentName":"support","parentMessageId":"msg_1","toolCallId":"call_1","toolCallName":"getTime","toolTarget":"client"}\n\n',
                        'data: {"type":"RUN_FINISHED","timestamp":4,"runId":"run_1","agentName":"support","result":{"response":{"output":[],"finishReason":"stop","usage":{}}}}\n\n',
                    ]);
                }

                if (String(url).endsWith("/run/tool-result")) {
                    return new Response(null, { status: 204 });
                }

                return jsonResponse({}, { status: 200 });
            },
            {
                preconnect: (() => {}) as typeof fetch.preconnect,
            },
        ) as typeof fetch;

        globalThis.fetch = nativeLikeFetch;

        try {
            const client = createClient({
                baseURL: "https://example.com/api",
                secret: "secret",
            });

            for await (const _event of client.stream(
                "support",
                { input: "hello" },
                {
                    toolHandlers: {
                        getTime: (input) => ({ ok: true, zone: (input as { zone: string }).zone }),
                    },
                },
            )) {
                // consume
            }
        } finally {
            globalThis.fetch = originalFetch;
        }
    });

    test("submitToolResult retries transient pending-call 404 responses", async () => {
        let attempts = 0;
        const client = createClient({
            baseURL: "https://example.com/api",
            secret: "secret",
            advanced: {
                toolSubmissionMaxAttempts: 2,
            },
            fetch: createFetchMock(async (url) => {
                attempts += 1;
                if (String(url).endsWith("/run/tool-result") && attempts === 1) {
                    return jsonResponse(
                        {
                            error: "NOT_FOUND",
                            message: "No pending tool call found for runId/toolCallId.",
                        },
                        { status: 404 },
                    );
                }
                return new Response(null, { status: 204 });
            }),
        });

        await client.submitToolResult({
            agent: "support",
            runId: "run_1",
            toolCallId: "call_1",
            status: "success",
            result: { ok: true },
        });

        assert.equal(attempts, 2);
    });
});
