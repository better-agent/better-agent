import "./setup";
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { RunResult } from "@better-agent/core";
import { createAgentChatController } from "../src/core/controller";
import type {
    BetterAgentClient,
    ClientEvent,
    RequestOptions,
    StreamRequestOptions,
} from "../src/types/client";

type Deferred<T> = {
    promise: Promise<T>;
    resolve(value: T): void;
    reject(error: unknown): void;
};

const deferred = <T>(): Deferred<T> => {
    let resolve!: (value: T) => void;
    let reject!: (error: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
};

const abortError = (message = "Aborted") => {
    const error = new Error(message);
    error.name = "AbortError";
    return error;
};

async function* toAsyncIterable<T>(values: readonly T[]): AsyncIterable<T> {
    for (const value of values) {
        yield value;
    }
}

const createRunResult = (overrides?: Record<string, unknown>): RunResult =>
    ({
        response: {
            output: [],
            finishReason: "stop",
            usage: {},
        },
        ...(overrides ?? {}),
    }) as RunResult;

const createMockClient = () => {
    const runCalls: Array<{
        agent: string;
        input: Record<string, unknown>;
        options?: RequestOptions;
    }> = [];
    const streamCalls: Array<{
        agent: string;
        input: Record<string, unknown>;
        options?: StreamRequestOptions;
    }> = [];
    const resumeStreamCalls: Array<{
        agent: string;
        input: { streamId: string; afterSeq?: number };
        options?: RequestOptions;
    }> = [];
    const resumeConversationCalls: Array<{
        agent: string;
        input: { conversationId: string; afterSeq?: number };
        options?: RequestOptions;
    }> = [];
    const loadConversationCalls: Array<{
        agent: string;
        conversationId: string;
        options?: RequestOptions;
    }> = [];
    const toolApprovalCalls: unknown[] = [];

    let runImpl: (
        agent: string,
        input: Record<string, unknown>,
        options?: RequestOptions,
    ) => Promise<RunResult> = async () => createRunResult();

    let streamImpl: (
        agent: string,
        input: Record<string, unknown>,
        options?: StreamRequestOptions,
    ) => AsyncIterable<ClientEvent> = () => toAsyncIterable([]);

    let resumeStreamImpl: (
        agent: string,
        input: { streamId: string; afterSeq?: number },
        options?: RequestOptions,
    ) => AsyncIterable<ClientEvent> = () => toAsyncIterable([]);

    let resumeConversationImpl: (
        agent: string,
        input: { conversationId: string; afterSeq?: number },
        options?: RequestOptions,
    ) => AsyncIterable<ClientEvent> = () => toAsyncIterable([]);

    let loadConversationImpl: (
        agent: string,
        conversationId: string,
        options?: RequestOptions,
    ) => Promise<{ items: Array<Record<string, unknown>> } | null> = async () => null;

    const client: BetterAgentClient = {
        run(agent, input, options) {
            runCalls.push({
                agent: String(agent),
                input: input as Record<string, unknown>,
                ...(options !== undefined ? { options } : {}),
            });
            return runImpl(String(agent), input as Record<string, unknown>, options);
        },
        stream(agent, input, options) {
            streamCalls.push({
                agent: String(agent),
                input: input as Record<string, unknown>,
                ...(options !== undefined ? { options } : {}),
            });
            return streamImpl(String(agent), input as Record<string, unknown>, options);
        },
        resumeStream(agent, input, options) {
            resumeStreamCalls.push({
                agent: String(agent),
                input,
                ...(options !== undefined ? { options } : {}),
            });
            return resumeStreamImpl(String(agent), input, options);
        },
        resumeConversation(agent, input, options) {
            resumeConversationCalls.push({
                agent: String(agent),
                input,
                ...(options !== undefined ? { options } : {}),
            });
            return resumeConversationImpl(String(agent), input, options);
        },
        async loadConversation(agent, conversationId, options) {
            loadConversationCalls.push({
                agent: String(agent),
                conversationId,
                ...(options !== undefined ? { options } : {}),
            });
            return loadConversationImpl(String(agent), conversationId, options);
        },
        async submitToolResult() {},
        async submitToolApproval(req) {
            toolApprovalCalls.push(req);
        },
        async abortRun() {
            return;
        },
    } as BetterAgentClient;

    return {
        client,
        runCalls,
        streamCalls,
        resumeStreamCalls,
        resumeConversationCalls,
        loadConversationCalls,
        toolApprovalCalls,
        setRunImpl(
            impl: (
                agent: string,
                input: Record<string, unknown>,
                options?: RequestOptions,
            ) => Promise<RunResult>,
        ) {
            runImpl = impl;
        },
        setStreamImpl(
            impl: (
                agent: string,
                input: Record<string, unknown>,
                options?: StreamRequestOptions,
            ) => AsyncIterable<ClientEvent>,
        ) {
            streamImpl = impl;
        },
        setResumeStreamImpl(
            impl: (
                agent: string,
                input: { streamId: string; afterSeq?: number },
                options?: RequestOptions,
            ) => AsyncIterable<ClientEvent>,
        ) {
            resumeStreamImpl = impl;
        },
        setResumeConversationImpl(
            impl: (
                agent: string,
                input: { conversationId: string; afterSeq?: number },
                options?: RequestOptions,
            ) => AsyncIterable<ClientEvent>,
        ) {
            resumeConversationImpl = impl;
        },
        setLoadConversationImpl(
            impl: (
                agent: string,
                conversationId: string,
                options?: RequestOptions,
            ) => Promise<{ items: Array<Record<string, unknown>> } | null>,
        ) {
            loadConversationImpl = impl;
        },
    };
};

describe("AgentChatController", () => {
    test("merges controller modelOptions with per-message modelOptions", async () => {
        const mock = createMockClient();
        let seenInput: Record<string, unknown> | undefined;

        mock.setRunImpl(async (_agent, input) => {
            seenInput = input;
            return createRunResult();
        });

        const controller = createAgentChatController(mock.client, {
            agent: "support",
            delivery: "final",
            modelOptions: {
                reasoningEffort: "low",
                reasoningSummary: "auto",
                textVerbosity: "low",
            },
        });

        await controller.sendMessage({
            input: "Hi",
            modelOptions: {
                reasoningEffort: "high",
            },
        });

        assert.deepEqual(seenInput?.modelOptions, {
            reasoningEffort: "high",
            reasoningSummary: "auto",
            textVerbosity: "low",
        });
    });

    test("transitions ready -> submitted -> streaming -> ready for stream delivery", async () => {
        const mock = createMockClient();
        const statuses: string[] = [];
        const finishCalls: Array<{
            runId?: string;
            streamId?: string;
            finishReason?: string;
            usage?: RunResult["response"]["usage"];
        }> = [];

        mock.setStreamImpl((_agent, _input, options) => {
            options?.onResponse?.(
                new Response(null, {
                    status: 200,
                    headers: {
                        "x-run-id": "run_1",
                        "x-stream-id": "stream_1",
                    },
                }),
            );
            return toAsyncIterable([
                {
                    type: "TEXT_MESSAGE_START",
                    timestamp: 1,
                    messageId: "msg_1",
                    role: "assistant",
                },
                {
                    type: "TEXT_MESSAGE_CONTENT",
                    timestamp: 2,
                    messageId: "msg_1",
                    delta: "Hello",
                },
                {
                    type: "TEXT_MESSAGE_END",
                    timestamp: 3,
                    messageId: "msg_1",
                },
                {
                    type: "RUN_FINISHED",
                    timestamp: 4,
                    runId: "run_1",
                    agentName: "support",
                    result: createRunResult(),
                } as unknown as ClientEvent,
            ]);
        });

        const controller = createAgentChatController(mock.client, {
            agent: "support",
            delivery: "stream",
            onFinish: (params) => {
                finishCalls.push({
                    runId: params.runId,
                    streamId: params.streamId,
                    finishReason: params.finishReason,
                    usage: params.usage,
                });
            },
        });

        controller.subscribe(() => {
            statuses.push(controller.getStatus());
        });

        await controller.sendMessage({ input: "Hi" });

        assert.equal(controller.getStatus(), "ready");
        assert.equal(statuses[0], "submitted");
        assert.ok(statuses.includes("streaming"));
        assert.equal(statuses[statuses.length - 1], "ready");
        assert.equal(controller.getMessages()[0]?.parts[0]?.type, "text");
        assert.equal(controller.getStreamId(), "stream_1");
        assert.equal(finishCalls[0]?.runId, "run_1");
        assert.equal(finishCalls[0]?.streamId, "stream_1");
        assert.equal(finishCalls[0]?.finishReason, "stop");
        assert.deepEqual(finishCalls[0]?.usage, {});
    });

    test("onFinish receives structured output from final run delivery", async () => {
        const mock = createMockClient();
        let finishStructured: unknown;

        mock.setRunImpl(async () => createRunResult({ structured: { ok: true } }));

        const controller = createAgentChatController(mock.client, {
            agent: "support",
            delivery: "final",
            onFinish: (params) => {
                finishStructured = (params as { structured?: unknown }).structured;
            },
        });

        await controller.sendMessage({ input: "Hi" });

        assert.deepEqual(finishStructured, { ok: true });
    });

    test("onFinish receives structured output from streamed RUN_FINISHED events", async () => {
        const mock = createMockClient();
        let finishStructured: unknown;

        mock.setStreamImpl(() =>
            toAsyncIterable([
                {
                    type: "RUN_STARTED",
                    timestamp: 1,
                    runId: "run_1",
                    agentName: "support",
                    runInput: { input: "Hi" },
                    streamId: "stream_1",
                } as unknown as ClientEvent,
                {
                    type: "RUN_FINISHED",
                    timestamp: 2,
                    runId: "run_1",
                    agentName: "support",
                    streamId: "stream_1",
                    result: createRunResult({ structured: { ok: true } }),
                } as unknown as ClientEvent,
            ]),
        );

        const controller = createAgentChatController(mock.client, {
            agent: "support",
            delivery: "stream",
            onFinish: (params) => {
                finishStructured = (params as { structured?: unknown }).structured;
            },
        });

        await controller.sendMessage({ input: "Hi" });

        assert.deepEqual(finishStructured, { ok: true });
    });

    test("approveToolCall forwards the latest run id and optional approval fields", async () => {
        const mock = createMockClient();
        mock.setRunImpl(async () => createRunResult({ runId: "run_1" }));

        const controller = createAgentChatController(mock.client, {
            agent: "support",
            delivery: "final",
        });

        await controller.sendMessage({ input: "Hi" });
        await controller.approveToolCall({
            toolCallId: "call_1",
            decision: "approved",
            note: "looks good",
            actorId: "user_1",
        });

        assert.deepEqual(mock.toolApprovalCalls, [
            {
                agent: "support",
                runId: "run_1",
                toolCallId: "call_1",
                decision: "approved",
                note: "looks good",
                actorId: "user_1",
            },
        ]);
    });

    test("approveToolCall throws when no run id is available", async () => {
        const mock = createMockClient();
        const controller = createAgentChatController(mock.client, {
            agent: "support",
        });

        await assert.rejects(
            () =>
                controller.approveToolCall({
                    toolCallId: "call_1",
                    decision: "denied",
                }),
            /without a runId/,
        );
    });

    test("getPendingToolApprovals and snapshot pendingToolApprovals expose deduped approval requests", () => {
        const mock = createMockClient();
        const controller = createAgentChatController(mock.client, {
            agent: "support",
        });

        controller.setMessages([
            {
                localId: "a_1",
                role: "assistant",
                parts: [
                    {
                        type: "tool-call",
                        callId: "call_1",
                        name: "lookup",
                        args: '{"query":"weather"}',
                        toolTarget: "server",
                        approval: {
                            input: { city: "Addis Ababa" },
                            meta: { source: "ui" },
                            note: "Need approval",
                            actorId: "reviewer_1",
                        },
                        status: "pending",
                        state: "approval-requested",
                    },
                    {
                        type: "tool-call",
                        callId: "call_1",
                        name: "lookup",
                        status: "pending",
                        state: "approval-requested",
                    },
                    {
                        type: "tool-call",
                        callId: "call_2",
                        name: "ignored",
                        status: "pending",
                        state: "approval-approved",
                    },
                ],
            },
        ]);

        const expected = [
            {
                toolCallId: "call_1",
                toolName: "lookup",
                args: '{"query":"weather"}',
                toolTarget: "server",
                input: { city: "Addis Ababa" },
                meta: { source: "ui" },
                note: "Need approval",
                actorId: "reviewer_1",
            },
        ];

        assert.deepEqual(controller.getPendingToolApprovals(), expected);
        assert.deepEqual(controller.getSnapshot().pendingToolApprovals, expected);
    });

    test("marks optimistic messages failed on stream error", async () => {
        const mock = createMockClient();
        mock.setStreamImpl(() =>
            toAsyncIterable([
                {
                    type: "RUN_ERROR",
                    timestamp: 1,
                    runId: "run_1",
                    agentName: "support",
                    error: { message: "Boom" },
                } as unknown as ClientEvent,
            ]),
        );

        const controller = createAgentChatController(mock.client, {
            agent: "support",
            delivery: "stream",
            optimisticUserMessage: { enabled: true, onError: "fail" },
        });

        await controller.sendMessage({ input: "Hi" });

        assert.equal(controller.getStatus(), "error");
        assert.equal(controller.getMessages()[0]?.status, "failed");
        assert.equal(controller.getMessages()[0]?.error, "Boom");
    });

    test("removes optimistic messages when configured to remove on error", async () => {
        const mock = createMockClient();
        mock.setStreamImpl(() =>
            toAsyncIterable([
                {
                    type: "RUN_ERROR",
                    timestamp: 1,
                    runId: "run_1",
                    agentName: "support",
                    error: { message: "Boom" },
                } as unknown as ClientEvent,
            ]),
        );

        const controller = createAgentChatController(mock.client, {
            agent: "support",
            delivery: "stream",
            optimisticUserMessage: { enabled: true, onError: "remove" },
        });

        await controller.sendMessage({ input: "Hi" });

        assert.equal(controller.getMessages().length, 0);
    });

    test("optimistic insertion preserves structured single-message user input", async () => {
        const mock = createMockClient();
        const release = deferred<void>();

        mock.setRunImpl(
            () =>
                new Promise((resolve) => {
                    void release.promise.then(() => resolve(createRunResult()));
                }),
        );

        const controller = createAgentChatController(mock.client, {
            agent: "support",
            delivery: "final",
            optimisticUserMessage: true,
        });

        const pending = controller.sendMessage({
            input: {
                type: "message",
                role: "user",
                content: [
                    { type: "text", text: "Look at this" },
                    {
                        type: "image",
                        source: { kind: "url", url: "https://example.com/image.png" },
                    },
                ],
            },
        });

        assert.deepEqual(controller.getMessages()[0], {
            localId: controller.getMessages()[0]?.localId,
            role: "user",
            parts: [
                { type: "text", text: "Look at this", state: "complete" },
                {
                    type: "image",
                    source: { kind: "url", url: "https://example.com/image.png" },
                    state: "complete",
                },
            ],
            status: "pending",
        });

        release.resolve();
        await pending;

        assert.equal(controller.getMessages()[0]?.status, "sent");
    });

    test("optimistic insertion preserves a single-item user message array input", async () => {
        const mock = createMockClient();
        const release = deferred<void>();

        mock.setRunImpl(
            () =>
                new Promise((resolve) => {
                    void release.promise.then(() => resolve(createRunResult()));
                }),
        );

        const controller = createAgentChatController(mock.client, {
            agent: "support",
            delivery: "final",
            optimisticUserMessage: true,
        });

        const pending = controller.sendMessage({
            input: [
                {
                    type: "message",
                    role: "user",
                    content: [{ type: "text", text: "Latest user turn" }],
                },
            ],
        });

        assert.equal(controller.getMessages()[0]?.role, "user");
        assert.deepEqual(controller.getMessages()[0]?.parts, [
            { type: "text", text: "Latest user turn", state: "complete" },
        ]);
        assert.equal(controller.getMessages()[0]?.status, "pending");

        release.resolve();
        await pending;
    });

    test("optimistic insertion skips multi-item array input when sendClientHistory is false", async () => {
        const mock = createMockClient();
        const release = deferred<void>();

        mock.setRunImpl(
            () =>
                new Promise((resolve) => {
                    void release.promise.then(() => resolve(createRunResult()));
                }),
        );

        const controller = createAgentChatController(mock.client, {
            agent: "support",
            delivery: "final",
            optimisticUserMessage: true,
        });

        const pending = controller.sendMessage({
            input: [
                {
                    type: "message",
                    role: "assistant",
                    content: "Context from caller",
                },
                {
                    type: "message",
                    role: "user",
                    content: [{ type: "text", text: "Latest user turn" }],
                },
            ],
        });

        assert.deepEqual(controller.getMessages(), []);

        release.resolve();
        await pending;
    });

    test("sendClientHistory preserves prompt-style single-message input when optimistic insertion is enabled", async () => {
        const mock = createMockClient();

        mock.setRunImpl(async () => createRunResult());

        const controller = createAgentChatController(mock.client, {
            agent: "support",
            delivery: "final",
            optimisticUserMessage: true,
            initialMessages: [{ role: "user", parts: [{ type: "text", text: "Earlier" }] }],
        });

        await controller.sendMessage({
            input: {
                type: "message",
                content: [{ type: "text", text: "Prompt hello" }],
            },
            sendClientHistory: true,
        });

        assert.deepEqual(mock.runCalls[0]?.input.input, [
            { type: "message", role: "user", content: "Earlier" },
            {
                type: "message",
                content: [{ type: "text", text: "Prompt hello" }],
            },
        ]);
    });

    test("sendClientHistory serializes a single structured user message without duplicating the optimistic turn", async () => {
        const mock = createMockClient();

        mock.setRunImpl(async (_agent, input) => {
            return createRunResult({ seenInput: input });
        });

        const controller = createAgentChatController(mock.client, {
            agent: "support",
            delivery: "final",
            optimisticUserMessage: true,
            initialMessages: [{ role: "user", parts: [{ type: "text", text: "Earlier" }] }],
        });

        await controller.sendMessage({
            input: {
                type: "message",
                role: "user",
                content: [{ type: "text", text: "Structured hello" }],
            },
            sendClientHistory: true,
        });

        assert.deepEqual(mock.runCalls[0]?.input.input, [
            { type: "message", role: "user", content: "Earlier" },
            {
                type: "message",
                role: "user",
                content: "Structured hello",
            },
        ]);
    });

    test("sendClientHistory skips optimistic insertion for multi-item array input", async () => {
        const mock = createMockClient();
        const release = deferred<void>();

        mock.setRunImpl(
            () =>
                new Promise((resolve) => {
                    void release.promise.then(() => resolve(createRunResult()));
                }),
        );

        const controller = createAgentChatController(mock.client, {
            agent: "support",
            delivery: "final",
            optimisticUserMessage: true,
            initialMessages: [{ role: "user", parts: [{ type: "text", text: "Earlier" }] }],
        });

        const pending = controller.sendMessage({
            input: [
                {
                    type: "message",
                    role: "assistant",
                    content: "Caller context",
                },
                {
                    type: "message",
                    role: "user",
                    content: [{ type: "text", text: "Latest user turn" }],
                },
            ],
            sendClientHistory: true,
        });

        assert.deepEqual(
            controller.getMessages().map((message) => message.parts),
            [[{ type: "text", text: "Earlier" }]],
        );

        release.resolve();
        await pending;

        assert.deepEqual(mock.runCalls[0]?.input.input, [
            { type: "message", role: "user", content: "Earlier" },
            {
                type: "message",
                role: "assistant",
                content: "Caller context",
            },
            {
                type: "message",
                role: "user",
                content: [{ type: "text", text: "Latest user turn" }],
            },
        ]);
    });

    test("onOptimisticUserMessageError reports optimistic submission failures", async () => {
        const mock = createMockClient();
        let seen:
            | {
                  messageStatus?: string;
                  messageError?: string;
                  errorMessage?: string;
              }
            | undefined;

        mock.setStreamImpl(() =>
            toAsyncIterable([
                {
                    type: "RUN_ERROR",
                    timestamp: 1,
                    runId: "run_1",
                    agentName: "support",
                    error: { message: "Boom" },
                } as unknown as ClientEvent,
            ]),
        );

        const controller = createAgentChatController(mock.client, {
            agent: "support",
            delivery: "stream",
            optimisticUserMessage: { enabled: true, onError: "fail" },
            onOptimisticUserMessageError: ({ message, error }) => {
                seen = {
                    messageStatus: message.status,
                    messageError: message.error,
                    errorMessage: error.message,
                };
            },
        });

        await controller.sendMessage({ input: "Hi" });

        assert.deepEqual(seen, {
            messageStatus: "failed",
            messageError: "Boom",
            errorMessage: "Boom",
        });
    });

    test("stop aborts in-flight stream consumption without destroying the controller", async () => {
        const mock = createMockClient();
        const started = deferred<void>();
        const release = deferred<void>();
        let aborted = false;
        let attempts = 0;

        mock.setStreamImpl((_agent, _input, options) => {
            attempts += 1;
            return (async function* () {
                options?.onResponse?.(new Response(null, { status: 200 }));
                options?.signal?.addEventListener("abort", () => {
                    aborted = true;
                });

                if (attempts === 1) {
                    started.resolve();
                    await release.promise;
                    if (options?.signal?.aborted) {
                        throw abortError();
                    }
                    return;
                }

                yield {
                    type: "RUN_FINISHED",
                    timestamp: 2,
                    runId: "run_1",
                    agentName: "support",
                    result: createRunResult(),
                } as unknown as ClientEvent;
            })();
        });

        const controller = createAgentChatController(mock.client, {
            agent: "support",
            delivery: "stream",
        });

        const pending = controller.sendMessage({ input: "Hi" });
        await started.promise;
        controller.stop();
        release.resolve();
        await pending;

        assert.equal(aborted, true);
        assert.equal(controller.getStatus(), "ready");
        assert.equal(controller.getMessages().length, 1);
        assert.equal(controller.getMessages()[0]?.status, "sent");

        await controller.sendMessage({ input: "Hello again" });
        assert.equal(controller.getStatus(), "ready");
        assert.equal(attempts, 2);
    });

    test("stream callbacks forward events and data parts", async () => {
        const mock = createMockClient();
        const seenEvents: string[] = [];
        const seenData: Array<{ id?: string; data: unknown }> = [];

        mock.setStreamImpl(() =>
            toAsyncIterable([
                {
                    type: "DATA_PART",
                    timestamp: 1,
                    id: "data_1",
                    data: { progress: 0.5 },
                    runId: "run_1",
                    streamId: "stream_1",
                } as unknown as ClientEvent,
                {
                    type: "RUN_FINISHED",
                    timestamp: 2,
                    runId: "run_1",
                    streamId: "stream_1",
                    agentName: "support",
                    result: createRunResult(),
                } as unknown as ClientEvent,
            ]),
        );

        const controller = createAgentChatController(mock.client, {
            agent: "support",
            delivery: "stream",
            onEvent: (event) => {
                seenEvents.push(event.type);
            },
            onData: (part) => {
                seenData.push(part);
            },
        });

        await controller.sendMessage({ input: "Hi" });

        assert.deepEqual(seenEvents, ["DATA_PART", "RUN_FINISHED"]);
        assert.deepEqual(seenData, [{ id: "data_1", data: { progress: 0.5 } }]);
    });

    test("onDisconnect fires when a stream ends before a terminal event", async () => {
        const mock = createMockClient();
        const disconnects: Array<{ error: Error; runId?: string; streamId?: string }> = [];
        const errors: string[] = [];
        let finishCalls = 0;

        mock.setStreamImpl(() =>
            toAsyncIterable([
                {
                    type: "RUN_STARTED",
                    timestamp: 1,
                    runId: "run_1",
                    streamId: "stream_1",
                    agentName: "support",
                    runInput: { input: "Hi" },
                } as unknown as ClientEvent,
            ]),
        );

        const controller = createAgentChatController(mock.client, {
            agent: "support",
            delivery: "stream",
            onDisconnect: (info) => {
                disconnects.push(info);
            },
            onError: (error) => {
                errors.push(error.message);
            },
            onFinish: () => {
                finishCalls += 1;
            },
        });

        await controller.sendMessage({ input: "Hi" });

        assert.equal(controller.getStatus(), "error");
        assert.equal(finishCalls, 0);
        assert.deepEqual(errors, ["Stream ended before terminal run event."]);
        assert.equal(disconnects.length, 1);
        assert.equal(disconnects[0]?.runId, "run_1");
        assert.equal(disconnects[0]?.streamId, "stream_1");
        assert.equal(disconnects[0]?.error.message, "Stream ended before terminal run event.");
    });

    test("onDisconnect does not fire for streamed RUN_ERROR events", async () => {
        const mock = createMockClient();
        const disconnects: string[] = [];
        const errors: string[] = [];

        mock.setStreamImpl(() =>
            toAsyncIterable([
                {
                    type: "RUN_ERROR",
                    timestamp: 1,
                    runId: "run_1",
                    streamId: "stream_1",
                    agentName: "support",
                    error: { message: "Boom" },
                } as unknown as ClientEvent,
            ]),
        );

        const controller = createAgentChatController(mock.client, {
            agent: "support",
            delivery: "stream",
            onDisconnect: (info) => {
                disconnects.push(info.error.message);
            },
            onError: (error) => {
                errors.push(error.message);
            },
        });

        await controller.sendMessage({ input: "Hi" });

        assert.equal(controller.getStatus(), "error");
        assert.deepEqual(disconnects, []);
        assert.deepEqual(errors, ["Boom"]);
    });

    test("optimisticUserMessage false disables local user insertion", async () => {
        const mock = createMockClient();

        mock.setStreamImpl(() =>
            toAsyncIterable([
                {
                    type: "RUN_ERROR",
                    timestamp: 1,
                    runId: "run_1",
                    agentName: "support",
                    error: { message: "Boom" },
                } as unknown as ClientEvent,
            ]),
        );

        const controller = createAgentChatController(mock.client, {
            agent: "support",
            delivery: "stream",
            optimisticUserMessage: false,
        });

        await controller.sendMessage({ input: "Hi" });

        assert.equal(controller.getStatus(), "error");
        assert.equal(controller.getMessages().length, 0);
    });

    test("seeds initial messages and exposes stable chat identity", () => {
        const mock = createMockClient();
        const controller = createAgentChatController(mock.client, {
            agent: "support",
            id: "chat_1",
            conversationId: "conversation_1",
            initialMessages: [{ role: "system", parts: [{ type: "text", text: "Be brief" }] }],
        });

        const snapshot = controller.getSnapshot();

        assert.equal(snapshot.id, "chat_1");
        assert.equal(snapshot.conversationId, "conversation_1");
        assert.equal(snapshot.messages.length, 1);
        assert.equal(snapshot.messages[0]?.role, "system");
    });

    test("destroy prevents future notifications and rejects new work", async () => {
        const mock = createMockClient();
        const controller = createAgentChatController(mock.client, {
            agent: "support",
        });
        let notifications = 0;

        controller.subscribe(() => {
            notifications += 1;
        });

        controller.destroy();
        controller.setMessages([{ role: "assistant", parts: [{ type: "text", text: "Ignored" }] }]);

        assert.equal(notifications, 0);
        await assert.rejects(() => controller.sendMessage({ input: "Hi" }), /been destroyed/);
    });

    test("run-mode tool call results stay replayable in later client-history sends", async () => {
        const mock = createMockClient();
        const seenInputs: Array<Record<string, unknown>> = [];

        mock.setRunImpl(async (_agent, input) => {
            seenInputs.push(input);

            if (seenInputs.length === 1) {
                return createRunResult({
                    response: {
                        output: [
                            {
                                type: "tool-call",
                                callId: "call_1",
                                name: "searchWeb",
                                arguments: { query: "weather" },
                            },
                            {
                                type: "provider-tool-result",
                                callId: "call_1",
                                result: { answer: 42 },
                            },
                        ],
                        finishReason: "stop",
                        usage: {},
                    },
                });
            }

            return createRunResult();
        });

        const controller = createAgentChatController(mock.client, {
            agent: "support",
            delivery: "final",
        });

        await controller.sendMessage({ input: "Hi" });
        await controller.sendMessage({ input: "Again", sendClientHistory: true });

        assert.equal(controller.getMessages()[1]?.role, "assistant");
        assert.deepEqual(controller.getMessages()[1]?.parts, [
            {
                type: "tool-call",
                callId: "call_1",
                name: "searchWeb",
                args: { query: "weather" },
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
        assert.deepEqual(seenInputs[1]?.input, [
            { type: "message", role: "user", content: "Hi" },
            {
                type: "tool-call",
                callId: "call_1",
                name: "searchWeb",
                result: { answer: 42 },
            },
            { type: "message", role: "user", content: "Again" },
        ]);
    });

    test("sendClientHistory with multimodal input serializes prior history and the new turn", async () => {
        const mock = createMockClient();

        mock.setRunImpl(async () => createRunResult());

        const controller = createAgentChatController(mock.client, {
            agent: "support",
            delivery: "final",
            conversationId: "conv_1",
            initialMessages: [{ role: "user", parts: [{ type: "text", text: "Earlier" }] }],
        });

        await controller.sendMessage({
            input: [
                {
                    type: "message",
                    role: "user",
                    content: [
                        {
                            type: "image",
                            source: { kind: "url", url: "https://example.com/new.png" },
                        },
                    ],
                },
            ],
            sendClientHistory: true,
        });

        assert.deepEqual(mock.runCalls[0]?.input.input, [
            { type: "message", role: "user", content: "Earlier" },
            {
                type: "message",
                role: "user",
                content: [
                    {
                        type: "image",
                        source: { kind: "url", url: "https://example.com/new.png" },
                    },
                ],
            },
        ]);
        assert.equal(mock.runCalls[0]?.input.replaceHistory, true);
    });

    test("updateClient swaps the transport client used for future requests", async () => {
        const first = createMockClient();
        const second = createMockClient();
        const controller = createAgentChatController(first.client, {
            agent: "support",
            delivery: "final",
        });

        controller.updateClient(second.client);
        await controller.sendMessage({ input: "Hi" });

        assert.equal(first.runCalls.length, 0);
        assert.equal(second.runCalls.length, 1);
    });

    test("resume calls resumeConversation on init when conversationId is set", async () => {
        const mock = createMockClient();
        mock.setResumeConversationImpl(() =>
            toAsyncIterable([
                {
                    type: "RUN_FINISHED",
                    timestamp: 1,
                    runId: "run_1",
                    agentName: "support",
                    result: {
                        response: {
                            output: [{ type: "message", role: "assistant", content: "Recovered" }],
                            finishReason: "stop",
                            usage: {},
                        },
                    },
                } as unknown as ClientEvent,
            ]),
        );

        const controller = createAgentChatController(mock.client, {
            agent: "support",
            conversationId: "conv_1",
            resume: true,
        });

        controller.init();
        await new Promise((resolve) => setTimeout(resolve, 0));

        assert.equal(controller.getStatus(), "ready");
        assert.equal(controller.getRunId(), "run_1");
        assert.equal(mock.resumeConversationCalls.length, 1);
    });

    test("hydrateFromServer still resumes the conversation after loading history", async () => {
        const mock = createMockClient();

        mock.setLoadConversationImpl(async () => ({
            items: [
                {
                    type: "message",
                    role: "user",
                    content: "Saved",
                },
            ],
        }));
        mock.setResumeConversationImpl((_agent, input) => {
            assert.equal(input.afterSeq, undefined);
            return toAsyncIterable([
                {
                    type: "RUN_FINISHED",
                    timestamp: 1,
                    runId: "run_1",
                    agentName: "support",
                    result: {
                        response: {
                            output: [{ type: "message", role: "assistant", content: "Recovered" }],
                            finishReason: "stop",
                            usage: {},
                        },
                    },
                } as unknown as ClientEvent,
            ]);
        });

        const controller = createAgentChatController(mock.client, {
            agent: "support",
            conversationId: "conv_1",
            hydrateFromServer: true,
            resume: true,
        });

        controller.init();
        await new Promise((resolve) => setTimeout(resolve, 0));

        assert.equal(mock.loadConversationCalls.length, 1);
        assert.equal(mock.resumeConversationCalls.length, 1);
        assert.equal(controller.getStatus(), "ready");
        assert.equal(controller.getRunId(), "run_1");
    });

    test("resume with explicit streamId still starts when initial messages exist", async () => {
        const mock = createMockClient();
        mock.setResumeStreamImpl(() =>
            toAsyncIterable([
                {
                    type: "RUN_FINISHED",
                    timestamp: 1,
                    runId: "run_1",
                    streamId: "stream_1",
                    agentName: "support",
                    result: {
                        response: {
                            output: [{ type: "message", role: "assistant", content: "Recovered" }],
                            finishReason: "stop",
                            usage: {},
                        },
                    },
                } as unknown as ClientEvent,
            ]),
        );

        const controller = createAgentChatController(mock.client, {
            agent: "support",
            initialMessages: [{ role: "system", parts: [{ type: "text", text: "Seed" }] }],
            resume: { streamId: "stream_1" },
        });

        controller.init();
        await new Promise((resolve) => setTimeout(resolve, 0));

        assert.equal(mock.resumeStreamCalls.length, 1);
        assert.equal(controller.getStatus(), "ready");
        assert.equal(controller.getRunId(), "run_1");
    });

    test("resumeStream defaults afterSeq from the target stream cursor", async () => {
        const mock = createMockClient();
        let callCount = 0;

        mock.setResumeStreamImpl((_agent, input) => {
            callCount += 1;

            if (callCount === 1) {
                assert.equal(input.afterSeq, -1);
                return toAsyncIterable([
                    {
                        type: "RUN_FINISHED",
                        timestamp: 1,
                        runId: "run_1",
                        streamId: "stream_1",
                        __cursor: 10,
                        agentName: "support",
                        result: createRunResult(),
                    } as unknown as ClientEvent,
                ]);
            }

            return toAsyncIterable([]);
        });

        const controller = createAgentChatController(mock.client, {
            agent: "support",
        });

        await controller.resumeStream({ streamId: "stream_1" });
        await controller.resumeStream({ streamId: "stream_2" });

        assert.equal(mock.resumeStreamCalls[1]?.input.afterSeq, -1);
    });

    test("resumeConversation does not infer afterSeq from an unrelated prior stream cursor", async () => {
        const mock = createMockClient();

        mock.setResumeStreamImpl(() =>
            toAsyncIterable([
                {
                    type: "RUN_FINISHED",
                    timestamp: 1,
                    runId: "run_1",
                    streamId: "stream_1",
                    __cursor: 10,
                    agentName: "support",
                    result: createRunResult(),
                } as unknown as ClientEvent,
            ]),
        );
        mock.setResumeConversationImpl((_agent, input) => {
            assert.equal(input.afterSeq, undefined);
            return toAsyncIterable([]);
        });

        const controller = createAgentChatController(mock.client, {
            agent: "support",
            conversationId: "conv_1",
        });

        await controller.resumeStream({ streamId: "stream_1" });
        await controller.resumeConversation();

        assert.equal(mock.resumeConversationCalls[0]?.input.afterSeq, undefined);
    });

    test("resume does not fire onFinish when no events were resumed", async () => {
        const mock = createMockClient();
        let finishCalls = 0;

        mock.setResumeConversationImpl(() => toAsyncIterable([]));

        const controller = createAgentChatController(mock.client, {
            agent: "support",
            conversationId: "conv_1",
            resume: true,
            onFinish: () => {
                finishCalls += 1;
            },
        });

        controller.init();
        await new Promise((resolve) => setTimeout(resolve, 0));

        assert.equal(finishCalls, 0);
        assert.equal(controller.getStatus(), "ready");
    });

    test("resumeStream reports aborted terminal events as aborts", async () => {
        const mock = createMockClient();
        const finishCalls: Array<{ isAbort: boolean; streamId?: string }> = [];

        mock.setResumeStreamImpl(() =>
            toAsyncIterable([
                {
                    type: "RUN_ABORTED",
                    timestamp: 1,
                    runId: "run_1",
                    agentName: "support",
                } as unknown as ClientEvent,
            ]),
        );

        const controller = createAgentChatController(mock.client, {
            agent: "support",
            onFinish: (params) => {
                finishCalls.push({
                    isAbort: params.isAbort,
                    streamId: params.streamId,
                });
            },
        });

        await controller.resumeStream({ streamId: "stream_1" });

        assert.equal(controller.getStatus(), "ready");
        assert.deepEqual(finishCalls, [{ isAbort: true, streamId: "stream_1" }]);
    });

    test("resumeConversation surfaces replayed RUN_ERROR events", async () => {
        const mock = createMockClient();
        const seenErrors: string[] = [];
        let finishCalls = 0;

        mock.setResumeConversationImpl(() =>
            toAsyncIterable([
                {
                    type: "RUN_ERROR",
                    timestamp: 1,
                    runId: "run_1",
                    agentName: "support",
                    error: { message: "Replay failed" },
                } as unknown as ClientEvent,
            ]),
        );

        const controller = createAgentChatController(mock.client, {
            agent: "support",
            conversationId: "conv_1",
            onError: (error) => {
                seenErrors.push(error.message);
            },
            onFinish: () => {
                finishCalls += 1;
            },
        });

        await controller.resumeConversation();

        assert.equal(controller.getStatus(), "error");
        assert.equal(controller.getError()?.message, "Replay failed");
        assert.deepEqual(seenErrors, ["Replay failed"]);
        assert.equal(finishCalls, 0);
    });

    test("resumeStream fires onDisconnect for transport failures", async () => {
        const mock = createMockClient();
        const disconnects: string[] = [];
        const errors: string[] = [];

        mock.setResumeStreamImpl(
            () =>
                ({
                    [Symbol.asyncIterator]() {
                        return {
                            async next() {
                                throw new Error("socket closed");
                            },
                        };
                    },
                }) as AsyncIterable<ClientEvent>,
        );

        const controller = createAgentChatController(mock.client, {
            agent: "support",
            onDisconnect: (info) => {
                disconnects.push(info.error.message);
            },
            onError: (error) => {
                errors.push(error.message);
            },
        });

        await controller.resumeStream({ streamId: "stream_1" });

        assert.equal(controller.getStatus(), "error");
        assert.deepEqual(disconnects, ["socket closed"]);
        assert.deepEqual(errors, ["socket closed"]);
    });

    test("resumeConversation reconstructs the current user turn from replayed RUN_STARTED", async () => {
        const mock = createMockClient();

        mock.setResumeConversationImpl(() =>
            toAsyncIterable([
                {
                    type: "RUN_STARTED",
                    timestamp: 1,
                    runId: "run_1",
                    agentName: "support",
                    conversationId: "conv_1",
                    runInput: { input: "What changed?" },
                } as unknown as ClientEvent,
                {
                    type: "TEXT_MESSAGE_START",
                    timestamp: 2,
                    messageId: "assistant_1",
                    role: "assistant",
                } as unknown as ClientEvent,
                {
                    type: "TEXT_MESSAGE_CONTENT",
                    timestamp: 3,
                    messageId: "assistant_1",
                    delta: "Here is the update.",
                } as unknown as ClientEvent,
                {
                    type: "TEXT_MESSAGE_END",
                    timestamp: 4,
                    messageId: "assistant_1",
                } as unknown as ClientEvent,
                {
                    type: "RUN_FINISHED",
                    timestamp: 5,
                    runId: "run_1",
                    agentName: "support",
                    conversationId: "conv_1",
                    result: createRunResult(),
                } as unknown as ClientEvent,
            ]),
        );

        const controller = createAgentChatController(mock.client, {
            agent: "support",
            conversationId: "conv_1",
        });

        await controller.resumeConversation();

        assert.deepEqual(
            controller.getMessages().map((message) => ({
                role: message.role,
                status: message.status,
                parts: message.parts,
            })),
            [
                {
                    role: "user",
                    status: "sent",
                    parts: [{ type: "text", text: "What changed?", state: "complete" }],
                },
                {
                    role: "assistant",
                    status: undefined,
                    parts: [{ type: "text", text: "Here is the update.", state: "complete" }],
                },
            ],
        );
    });

    test("resumeConversation reconstructs the current user turn from a single structured message input", async () => {
        const mock = createMockClient();

        mock.setResumeConversationImpl(() =>
            toAsyncIterable([
                {
                    type: "RUN_STARTED",
                    timestamp: 1,
                    runId: "run_structured",
                    agentName: "support",
                    conversationId: "conv_1",
                    runInput: {
                        input: {
                            type: "message",
                            role: "user",
                            content: [{ type: "text", text: "Structured hello" }],
                        },
                    },
                } as unknown as ClientEvent,
                {
                    type: "TEXT_MESSAGE_START",
                    timestamp: 2,
                    messageId: "assistant_1",
                    role: "assistant",
                } as unknown as ClientEvent,
                {
                    type: "TEXT_MESSAGE_CONTENT",
                    timestamp: 3,
                    messageId: "assistant_1",
                    delta: "Structured reply",
                } as unknown as ClientEvent,
                {
                    type: "TEXT_MESSAGE_END",
                    timestamp: 4,
                    messageId: "assistant_1",
                } as unknown as ClientEvent,
                {
                    type: "RUN_FINISHED",
                    timestamp: 5,
                    runId: "run_structured",
                    agentName: "support",
                    conversationId: "conv_1",
                    result: createRunResult(),
                } as unknown as ClientEvent,
            ]),
        );

        const controller = createAgentChatController(mock.client, {
            agent: "support",
            conversationId: "conv_1",
        });

        await controller.resumeConversation();

        assert.equal(controller.getMessages()[0]?.role, "user");
        assert.deepEqual(controller.getMessages()[0]?.parts, [
            { type: "text", text: "Structured hello", state: "complete" },
        ]);
        assert.equal(controller.getMessages()[1]?.role, "assistant");
    });

    test("hydrate + resume does not duplicate the current user turn when it is already present", async () => {
        const mock = createMockClient();

        mock.setLoadConversationImpl(async () => ({
            items: [
                {
                    type: "message",
                    role: "user",
                    content: "What changed?",
                },
            ],
        }));
        mock.setResumeConversationImpl(() =>
            toAsyncIterable([
                {
                    type: "RUN_STARTED",
                    timestamp: 1,
                    runId: "run_1",
                    agentName: "support",
                    conversationId: "conv_1",
                    runInput: { input: "What changed?" },
                } as unknown as ClientEvent,
                {
                    type: "TEXT_MESSAGE_START",
                    timestamp: 2,
                    messageId: "assistant_1",
                    role: "assistant",
                } as unknown as ClientEvent,
                {
                    type: "TEXT_MESSAGE_CONTENT",
                    timestamp: 3,
                    messageId: "assistant_1",
                    delta: "Here is the update.",
                } as unknown as ClientEvent,
                {
                    type: "TEXT_MESSAGE_END",
                    timestamp: 4,
                    messageId: "assistant_1",
                } as unknown as ClientEvent,
                {
                    type: "RUN_FINISHED",
                    timestamp: 5,
                    runId: "run_1",
                    agentName: "support",
                    conversationId: "conv_1",
                    result: createRunResult(),
                } as unknown as ClientEvent,
            ]),
        );

        const controller = createAgentChatController(mock.client, {
            agent: "support",
            conversationId: "conv_1",
            hydrateFromServer: true,
            resume: true,
        });

        controller.init();
        await new Promise((resolve) => setTimeout(resolve, 0));

        assert.equal(
            controller.getMessages().filter((message) => message.role === "user").length,
            1,
        );
        assert.equal(controller.getMessages()[0]?.role, "user");
        assert.equal(controller.getMessages()[1]?.role, "assistant");
    });

    test("hydrate + resume does not duplicate the current multimodal user turn when it is already present", async () => {
        const mock = createMockClient();

        mock.setLoadConversationImpl(async () => ({
            items: [
                {
                    type: "message",
                    role: "user",
                    content: [
                        { type: "text", text: "What changed in this image?" },
                        {
                            type: "image",
                            source: { kind: "url", url: "https://example.com/before.png" },
                        },
                    ],
                },
            ],
        }));
        mock.setResumeConversationImpl(() =>
            toAsyncIterable([
                {
                    type: "RUN_STARTED",
                    timestamp: 1,
                    runId: "run_multimodal",
                    agentName: "support",
                    conversationId: "conv_1",
                    runInput: {
                        input: [
                            {
                                type: "message",
                                role: "user",
                                content: [
                                    { type: "text", text: "What changed in this image?" },
                                    {
                                        type: "image",
                                        source: {
                                            kind: "url",
                                            url: "https://example.com/before.png",
                                        },
                                    },
                                ],
                            },
                        ],
                    },
                } as unknown as ClientEvent,
                {
                    type: "TEXT_MESSAGE_START",
                    timestamp: 2,
                    messageId: "assistant_1",
                    role: "assistant",
                } as unknown as ClientEvent,
                {
                    type: "TEXT_MESSAGE_CONTENT",
                    timestamp: 3,
                    messageId: "assistant_1",
                    delta: "The chart has a new highlighted series.",
                } as unknown as ClientEvent,
                {
                    type: "TEXT_MESSAGE_END",
                    timestamp: 4,
                    messageId: "assistant_1",
                } as unknown as ClientEvent,
                {
                    type: "RUN_FINISHED",
                    timestamp: 5,
                    runId: "run_multimodal",
                    agentName: "support",
                    conversationId: "conv_1",
                    result: createRunResult(),
                } as unknown as ClientEvent,
            ]),
        );

        const controller = createAgentChatController(mock.client, {
            agent: "support",
            conversationId: "conv_1",
            hydrateFromServer: true,
            resume: true,
        });

        controller.init();
        await new Promise((resolve) => setTimeout(resolve, 0));

        assert.equal(
            controller.getMessages().filter((message) => message.role === "user").length,
            1,
        );
        assert.equal(controller.getMessages()[0]?.role, "user");
        assert.equal(controller.getMessages()[0]?.parts[0]?.type, "text");
        assert.equal(controller.getMessages()[0]?.parts[1]?.type, "image");
        assert.equal(controller.getMessages()[1]?.role, "assistant");
    });

    test("resumeConversation keeps replay-synthesized user messages out of a pending ghost state on abort", async () => {
        const mock = createMockClient();

        mock.setResumeConversationImpl(() =>
            toAsyncIterable([
                {
                    type: "RUN_STARTED",
                    timestamp: 1,
                    runId: "run_abort",
                    agentName: "support",
                    conversationId: "conv_1",
                    runInput: { input: "Stop here" },
                } as unknown as ClientEvent,
                {
                    type: "RUN_ABORTED",
                    timestamp: 2,
                    runId: "run_abort",
                    agentName: "support",
                    conversationId: "conv_1",
                } as unknown as ClientEvent,
            ]),
        );

        const controller = createAgentChatController(mock.client, {
            agent: "support",
            conversationId: "conv_1",
        });

        await controller.resumeConversation();

        assert.equal(controller.getStatus(), "ready");
        assert.deepEqual(controller.getMessages(), [
            {
                localId: "user_run:run_abort",
                id: "user_run:run_abort",
                role: "user",
                parts: [{ type: "text", text: "Stop here", state: "complete" }],
                status: "sent",
            },
        ]);
    });

    test("delivery auto falls back to run without duplicating the optimistic user message", async () => {
        const mock = createMockClient();

        mock.setStreamImpl(() => {
            throw new Error("Streaming is not supported by this model.");
        });
        mock.setRunImpl(async () => createRunResult());

        const controller = createAgentChatController(mock.client, {
            agent: "support",
            delivery: "auto",
        });

        await controller.sendMessage({ input: "Hi" });

        assert.equal(mock.streamCalls.length, 1);
        assert.equal(mock.runCalls.length, 1);
        assert.equal(
            controller.getMessages().filter((message) => message.role === "user").length,
            1,
        );
        assert.equal(controller.getMessages()[0]?.status, "sent");
    });

    test("delivery auto falls back to run when streaming is not supported", async () => {
        const mock = createMockClient();

        mock.setStreamImpl(() => {
            throw new Error("Streaming is not supported by this model.");
        });
        mock.setRunImpl(async () => createRunResult());

        const controller = createAgentChatController(mock.client, {
            agent: "support",
            delivery: "auto",
        });

        await controller.sendMessage({ input: "Hi" });

        assert.equal(mock.streamCalls.length, 1);
        assert.equal(mock.runCalls.length, 1);
        assert.equal(controller.getStatus(), "ready");
        assert.equal(controller.getError(), undefined);
    });

    test("final delivery calls run directly", async () => {
        const mock = createMockClient();
        mock.setRunImpl(async () => createRunResult());

        const controller = createAgentChatController(mock.client, {
            agent: "support",
            delivery: "final",
        });

        await controller.sendMessage({ input: "Hi" });

        assert.equal(mock.runCalls.length, 1);
        assert.equal(controller.getStatus(), "ready");
        assert.equal(controller.getError(), undefined);
    });

    test("reset clears controller state back to initial snapshot", async () => {
        const mock = createMockClient();
        mock.setRunImpl(async () =>
            createRunResult({
                runId: "run_1",
                response: {
                    output: [],
                    finishReason: "stop",
                    usage: {},
                },
            }),
        );

        const controller = createAgentChatController(mock.client, {
            agent: "support",
            delivery: "final",
            initialMessages: [{ role: "system", parts: [{ type: "text", text: "Be brief" }] }],
        });

        await controller.sendMessage({ input: "Hi" });
        controller.setMessages((messages) => [
            ...messages,
            {
                role: "assistant",
                parts: [{ type: "text", text: "Hello" }],
            },
        ]);
        assert.ok(controller.getMessages().length > 1);

        controller.reset();

        assert.equal(controller.getStatus(), "ready");
        assert.equal(controller.getRunId(), undefined);
        assert.equal(controller.getError(), undefined);
        assert.equal(controller.getMessages().length, 1);
        assert.equal(controller.getMessages()[0]?.role, "system");
    });

    test("retry truncates stale trailing messages and marks replaceHistory for conversation sends", async () => {
        const mock = createMockClient();
        let seenInput: Record<string, unknown> | undefined;

        mock.setRunImpl(async (_agent, input) => {
            seenInput = input;
            return createRunResult();
        });

        const controller = createAgentChatController(mock.client, {
            agent: "support",
            delivery: "final",
            conversationId: "conv_1",
            initialMessages: [
                { localId: "u_1", role: "user", parts: [{ type: "text", text: "First" }] },
                { localId: "a_1", role: "assistant", parts: [{ type: "text", text: "Reply" }] },
                { localId: "u_2", role: "user", parts: [{ type: "text", text: "Second" }] },
                { localId: "a_2", role: "assistant", parts: [{ type: "text", text: "Stale" }] },
            ],
        });

        await controller.retryMessage("u_1");

        assert.equal(controller.getMessages().length, 1);
        assert.equal(controller.getMessages()[0]?.localId, "u_1");
        assert.equal(seenInput?.replaceHistory, true);
        assert.deepEqual(seenInput?.input, [{ type: "message", role: "user", content: "First" }]);
    });

    test("retry preserves multimodal user turns", async () => {
        const mock = createMockClient();

        mock.setRunImpl(async (_agent, _input) => createRunResult());

        const controller = createAgentChatController(mock.client, {
            agent: "support",
            delivery: "final",
            conversationId: "conv_1",
            initialMessages: [
                {
                    localId: "u_1",
                    role: "user",
                    parts: [
                        {
                            type: "image",
                            source: { kind: "url", url: "https://example.com/source.png" },
                        },
                    ],
                },
                { localId: "a_1", role: "assistant", parts: [{ type: "text", text: "Reply" }] },
                { localId: "a_2", role: "assistant", parts: [{ type: "text", text: "Stale" }] },
            ],
        });

        await controller.retryMessage("u_1");

        assert.equal(controller.getMessages().length, 1);
        assert.deepEqual(mock.runCalls[0]?.input.input, [
            {
                type: "message",
                role: "user",
                content: [
                    {
                        type: "image",
                        source: { kind: "url", url: "https://example.com/source.png" },
                    },
                ],
            },
        ]);
        assert.equal(mock.runCalls[0]?.input.replaceHistory, true);
    });

    test("hydrates from the server and updates reset baseline", async () => {
        const mock = createMockClient();
        mock.setLoadConversationImpl(async () => ({
            items: [{ type: "message", role: "user", content: "Stored hello" }],
        }));

        const controller = createAgentChatController(mock.client, {
            agent: "support",
            delivery: "final",
            conversationId: "conv_1",
            hydrateFromServer: true,
            initialMessages: [{ role: "system", parts: [{ type: "text", text: "Fallback" }] }],
        });

        controller.init();
        await new Promise((resolve) => setTimeout(resolve, 0));

        const hydratedFirstPart = controller.getMessages()[0]?.parts[0];
        assert.equal(mock.loadConversationCalls.length, 1);
        assert.equal(hydratedFirstPart?.type, "text");
        assert.equal(
            hydratedFirstPart?.type === "text" ? hydratedFirstPart.text : "",
            "Stored hello",
        );

        controller.setMessages([{ role: "assistant", parts: [{ type: "text", text: "Changed" }] }]);
        controller.reset();
        const resetFirstPart = controller.getMessages()[0]?.parts[0];
        assert.equal(resetFirstPart?.type, "text");
        assert.equal(resetFirstPart?.type === "text" ? resetFirstPart.text : "", "Stored hello");
    });

    test("hydrateFromServer uses a dedicated hydrating status", async () => {
        const mock = createMockClient();
        const statuses: string[] = [];
        mock.setLoadConversationImpl(async () => ({
            items: [{ type: "message", role: "user", content: "Stored hello" }],
        }));

        const controller = createAgentChatController(mock.client, {
            agent: "support",
            delivery: "final",
            conversationId: "conv_1",
            hydrateFromServer: true,
        });

        controller.subscribe(() => {
            statuses.push(controller.getStatus());
        });

        controller.init();
        await new Promise((resolve) => setTimeout(resolve, 0));

        assert.equal(controller.getStatus(), "ready");
        assert.equal(statuses.includes("hydrating"), true);
        assert.equal(statuses.includes("submitted"), false);
    });

    test("hydrates durable items with media and tool history", async () => {
        const mock = createMockClient();
        mock.setLoadConversationImpl(async () => ({
            items: [
                {
                    type: "message",
                    role: "assistant",
                    content: [
                        { type: "text", text: "Stored answer" },
                        {
                            type: "image",
                            source: { kind: "url", url: "https://example.com/answer.png" },
                        },
                    ],
                },
                {
                    type: "tool-call",
                    callId: "call_1",
                    name: "searchDocs",
                    arguments: '{"query":"stored"}',
                },
                {
                    type: "tool-call",
                    callId: "call_1",
                    name: "searchDocs",
                    result: { answer: "stored" },
                },
            ],
        }));

        const controller = createAgentChatController(mock.client, {
            agent: "support",
            delivery: "final",
            conversationId: "conv_1",
            hydrateFromServer: true,
        });

        controller.init();
        await new Promise((resolve) => setTimeout(resolve, 0));

        // The refactored fromConversationItems groups tool-call items into the
        // preceding assistant message, so text+image+tool all live in one message.
        assert.equal(controller.getMessages().length, 1);
        assert.equal(controller.getMessages()[0]?.parts[1]?.type, "image");
        assert.deepEqual(controller.getMessages()[0]?.parts.slice(2), [
            {
                type: "tool-call",
                callId: "call_1",
                name: "searchDocs",
                args: '{"query":"stored"}',
                status: "success",
                state: "completed",
            },
            {
                type: "tool-result",
                callId: "call_1",
                result: { answer: "stored" },
                status: "success",
            },
        ]);
    });

    test("session-changing option updates reset and rehydrate the controller", async () => {
        const mock = createMockClient();
        mock.setLoadConversationImpl(async (_agent, conversationId) => ({
            items: [
                {
                    type: "message",
                    role: "user",
                    content: conversationId === "conv_1" ? "Stored one" : "Stored two",
                },
            ],
        }));

        const controller = createAgentChatController(mock.client, {
            agent: "support",
            delivery: "final",
            conversationId: "conv_1",
            hydrateFromServer: true,
        });

        controller.init();
        await new Promise((resolve) => setTimeout(resolve, 0));
        const firstHydratedPart = controller.getMessages()[0]?.parts[0];
        assert.equal(
            firstHydratedPart?.type === "text" ? firstHydratedPart.text : "",
            "Stored one",
        );

        controller.updateOptions({ conversationId: "conv_2" });
        await new Promise((resolve) => setTimeout(resolve, 0));

        assert.deepEqual(
            mock.loadConversationCalls.map((call) => call.conversationId),
            ["conv_1", "conv_2"],
        );
        const secondHydratedPart = controller.getMessages()[0]?.parts[0];
        assert.equal(
            secondHydratedPart?.type === "text" ? secondHydratedPart.text : "",
            "Stored two",
        );
        assert.equal(controller.getSnapshot().conversationId, "conv_2");
    });

    test("non-session option updates do not reset local message state", async () => {
        const mock = createMockClient();
        const controller = createAgentChatController(mock.client, {
            agent: "support",
            delivery: "final",
            initialMessages: [{ role: "user", parts: [{ type: "text", text: "Hi" }] }],
        });

        controller.setMessages((messages) => [
            ...messages,
            { role: "assistant", parts: [{ type: "text", text: "Hello" }] },
        ]);
        controller.updateOptions({
            onError: () => undefined,
            modelOptions: { reasoningEffort: "high" } as Record<string, unknown>,
        });

        assert.equal(controller.getMessages().length, 2);
        assert.equal(controller.getMessages()[1]?.role, "assistant");
    });

    test("hydration failure is non-fatal", async () => {
        const mock = createMockClient();
        const seenErrors: string[] = [];
        mock.setLoadConversationImpl(async () => {
            throw new Error("hydrate failed");
        });

        const controller = createAgentChatController(mock.client, {
            agent: "support",
            delivery: "final",
            conversationId: "conv_1",
            hydrateFromServer: true,
            initialMessages: [{ role: "system", parts: [{ type: "text", text: "Fallback" }] }],
            onError: (error) => seenErrors.push(error.message),
        });

        controller.init();
        await new Promise((resolve) => setTimeout(resolve, 0));

        assert.equal(controller.getStatus(), "ready");
        assert.equal(controller.getMessages()[0]?.role, "system");
        assert.deepEqual(seenErrors, ["hydrate failed"]);
    });

    test("hydration aborted by sendMessage does not trigger resume", async () => {
        const mock = createMockClient();
        const gate = deferred<{ items: Array<Record<string, unknown>> } | null>();

        mock.setLoadConversationImpl(
            async (_agent, _conversationId, options) =>
                await new Promise((resolve, reject) => {
                    options?.signal?.addEventListener("abort", () => reject(abortError()), {
                        once: true,
                    });
                    void gate.promise.then(resolve, reject);
                }),
        );
        mock.setRunImpl(async () => createRunResult());

        const controller = createAgentChatController(mock.client, {
            agent: "support",
            delivery: "final",
            conversationId: "conv_1",
            hydrateFromServer: true,
            resume: { streamId: "stream_1" },
        });

        controller.init();
        await controller.sendMessage({ input: "Hi" });
        gate.resolve(null);
        await new Promise((resolve) => setTimeout(resolve, 0));

        assert.equal(mock.resumeStreamCalls.length, 0);
        assert.equal(controller.getStatus(), "ready");
    });

    test("hydration is skipped when the client lacks loadConversation", async () => {
        const mock = createMockClient();
        const client = {
            ...mock.client,
            loadConversation: undefined,
        } as unknown as BetterAgentClient;
        const controller = createAgentChatController(client, {
            agent: "support",
            delivery: "final",
            conversationId: "conv_1",
            hydrateFromServer: true,
            resume: { streamId: "stream_1" },
        });

        controller.init();
        await new Promise((resolve) => setTimeout(resolve, 0));

        assert.equal(mock.loadConversationCalls.length, 0);
        assert.equal(mock.resumeStreamCalls.length, 1);
    });

    test("warns once for sendClientHistory with conversationId, but not on retry", async () => {
        const mock = createMockClient();
        const warnings: string[] = [];
        const originalWarn = console.warn;
        console.warn = (message?: unknown) => {
            warnings.push(String(message ?? ""));
        };

        try {
            mock.setRunImpl(async () => createRunResult());
            const controller = createAgentChatController(mock.client, {
                agent: "support",
                delivery: "final",
                conversationId: "conv_1",
                initialMessages: [
                    { localId: "u_1", role: "user", parts: [{ type: "text", text: "Hi" }] },
                ],
            });

            await controller.sendMessage({ input: "First", sendClientHistory: true });
            await controller.sendMessage({ input: "Second", sendClientHistory: true });
            await controller.retryMessage("u_1");
        } finally {
            console.warn = originalWarn;
        }

        assert.equal(warnings.length, 1);
    });

    test("onFinish receives the effective per-run conversationId", async () => {
        const mock = createMockClient();
        const seenConversationIds: string[] = [];
        mock.setRunImpl(async () => createRunResult());

        const controller = createAgentChatController(mock.client, {
            agent: "support",
            delivery: "final",
            conversationId: "conv_default",
            onFinish: (params) => {
                if (params.conversationId) {
                    seenConversationIds.push(params.conversationId);
                }
            },
        });

        await controller.sendMessage({
            input: "Hi",
            conversationId: "conv_override",
        });

        assert.deepEqual(seenConversationIds, ["conv_override"]);
    });

    test("clearError returns controller to ready state", () => {
        const mock = createMockClient();
        const controller = createAgentChatController(mock.client, {
            agent: "support",
            delivery: "stream",
            optimisticUserMessage: { enabled: true, onError: "fail" },
        });

        mock.setStreamImpl(() =>
            toAsyncIterable([
                {
                    type: "RUN_ERROR",
                    timestamp: 1,
                    runId: "run_1",
                    agentName: "support",
                    error: { message: "Boom" },
                } as unknown as ClientEvent,
            ]),
        );

        return controller.sendMessage({ input: "Hi" }).then(() => {
            assert.equal(controller.getStatus(), "error");
            controller.clearError();
            assert.equal(controller.getStatus(), "ready");
            assert.equal(controller.getError(), undefined);
        });
    });

    test("prepareMessages overrides default client-history serialization", async () => {
        const mock = createMockClient();
        mock.setRunImpl(async () => createRunResult());

        const controller = createAgentChatController(mock.client, {
            agent: "support",
            delivery: "final",
            initialMessages: [
                { localId: "u_1", role: "user", parts: [{ type: "text", text: "Earlier" }] },
            ],
            prepareMessages: ({ messages, input }) => [
                {
                    type: "message",
                    role: "system",
                    content: `count=${messages.length.toString()}`,
                },
                {
                    type: "message",
                    role: "user",
                    content: String(input),
                },
            ],
        });

        await controller.sendMessage({ input: "Now", sendClientHistory: true });

        assert.deepEqual(mock.runCalls[0]?.input.input, [
            { type: "message", role: "system", content: "count=2" },
            { type: "message", role: "user", content: "Now" },
        ]);
    });
});
