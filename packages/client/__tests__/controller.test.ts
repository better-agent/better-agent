import { describe, expect, test } from "bun:test";
import type { AgentEvent, AgentMessage, MemoryMessage, RunResult } from "@better-agent/core";
import { EventType } from "@better-agent/core";
import { createAgentController } from "../src/core/controller";
import type {
    AgentControllerFinish,
    BetterAgentClient,
    ClientMemoryThread,
    ClientThreadRuntime,
    UIMessage,
} from "../src/types";
import { fromAgentMessages } from "../src/ui/convert";

function mockClient(
    streamImpl: () => AsyncIterable<AgentEvent>,
    overrides: Record<string, unknown> & {
        run?: (agentName: unknown, input: unknown) => Promise<RunResult>;
        resumeRun?: (agentName: unknown, input: unknown) => Promise<RunResult>;
        stream?: (agentName: unknown, input: unknown) => AsyncIterable<AgentEvent>;
        abortRun?: (runId: string) => Promise<void>;
        resumeStream?: (input: {
            runId: string;
            afterSequence?: number;
        }) => AsyncIterable<AgentEvent>;
        memory?: {
            thread?: ClientMemoryThread;
            messages?: MemoryMessage[];
            runtime?: ClientThreadRuntime;
            listMessages?: (
                threadId: string,
                input?: { limit?: number; beforeRunId?: string },
            ) => Promise<MemoryMessage[]> | MemoryMessage[];
        };
    } = {},
): BetterAgentClient<unknown> {
    const run =
        overrides.run ??
        overrides.resumeRun ??
        (async () => {
            throw new Error("unimplemented");
        });
    const abort =
        overrides.abortRun ??
        (async () => {
            return;
        });
    const resumeStream =
        overrides.resumeStream ??
        (async function* () {} as (input: {
            runId: string;
            afterSequence?: number;
        }) => AsyncIterable<AgentEvent>);

    const runs = {
        abort,
        resumeStream,
    };

    const client = {
        agent(agentName) {
            const handle = {
                runs,
                run(input: unknown) {
                    return run(agentName, input);
                },
                stream: (input: unknown) => overrides.stream?.(agentName, input) ?? streamImpl(),
            };
            if (overrides.memory) {
                return {
                    ...handle,
                    memory: {
                        threads: {
                            list: async () =>
                                overrides.memory?.thread ? [overrides.memory.thread] : [],
                            create: async () =>
                                overrides.memory?.thread ??
                                ({
                                    id: "thread_1",
                                    agentName: String(agentName),
                                    createdAt: 1,
                                    updatedAt: 1,
                                } as ClientMemoryThread),
                            get: async () => overrides.memory?.thread,
                            update: async () =>
                                overrides.memory?.thread ??
                                ({
                                    id: "thread_1",
                                    agentName: String(agentName),
                                    createdAt: 1,
                                    updatedAt: 1,
                                } as ClientMemoryThread),
                            delete: async () => {},
                            runtime: async () => overrides.memory?.runtime ?? {},
                        },
                        messages: {
                            list: async (threadId, input) =>
                                overrides.memory?.listMessages
                                    ? overrides.memory.listMessages(threadId, input)
                                    : (overrides.memory?.messages ?? []),
                        },
                    },
                };
            }
            return handle;
        },
        runs,
    } as BetterAgentClient<unknown>;

    return client;
}

function deferred(): { promise: Promise<void>; resolve: () => void } {
    let resolve!: () => void;
    const promise = new Promise<void>((done) => {
        resolve = done;
    });

    return { promise, resolve };
}

function runStartedEvent(runId: string, messages: AgentMessage[] = []): AgentEvent {
    return {
        type: EventType.RUN_STARTED,
        timestamp: Date.now(),
        threadId: "",
        runId,
        input: { runId, threadId: "", messages, tools: [], context: [] },
    } as unknown as AgentEvent;
}

function hasResume(input: unknown): input is { resume: unknown[]; threadId?: string } {
    return Boolean(input && typeof input === "object" && "resume" in input);
}

async function* assistantTextStream(text: string): AsyncIterable<AgentEvent> {
    yield {
        type: EventType.TEXT_MESSAGE_CONTENT,
        timestamp: Date.now(),
        messageId: "assistant_1",
        delta: text,
    } as AgentEvent;
}

function approvalInterruptEvent(): AgentEvent {
    return {
        type: EventType.RUN_FINISHED,
        timestamp: Date.now(),
        runId: "run_1",
        threadId: "",
        outcome: "interrupt",
        interrupts: [
            {
                id: "tool_1:approval",
                reason: "tool_approval_pending",
                toolCallId: "tool_1",
            },
        ],
    } as AgentEvent;
}

function messageWithToolCall(): UIMessage {
    return {
        id: "assistant_1",
        role: "assistant",
        parts: [
            {
                type: "tool-call",
                toolCallId: "tool_1",
                toolName: "deleteFile",
                input: JSON.stringify({ path: "/tmp/x" }),
                inputText: '{"path":"/tmp/x"}',
                state: "input-available",
            },
        ],
    };
}

function messageWithToolCalls(): UIMessage {
    return {
        id: "assistant_tools",
        role: "assistant",
        parts: [
            {
                type: "tool-call",
                toolCallId: "tool_1",
                toolName: "getWeather",
                input: { city: "Addis Ababa" },
                inputText: '{"city":"Addis Ababa"}',
                state: "input-available",
            },
            {
                type: "tool-call",
                toolCallId: "tool_2",
                toolName: "getLocation",
                input: { precise: true },
                inputText: '{"precise":true}',
                state: "input-available",
            },
        ],
    };
}

describe("AgentController lifecycle", () => {
    test("onFinish success when stream ends without error", async () => {
        const finishes: AgentControllerFinish[] = [];
        const client = mockClient(async function* () {
            /* no events */
        });
        const c = createAgentController(client.agent("assistant" as never), {
            onFinish: (f) => {
                finishes.push(f);
            },
        });
        await c.sendMessage("hello");
        expect(finishes).toEqual([
            {
                generatedMessages: [],
                messages: expect.any(Array),
                runId: undefined,
                threadId: undefined,
                isAbort: false,
                isDisconnect: false,
                isError: false,
                isInterrupted: false,
                pendingClientTools: [],
                pendingToolApprovals: [],
            },
        ]);
    });

    test("onFinish error and onError when RUN_ERROR", async () => {
        const finishes: AgentControllerFinish[] = [];
        const errors: string[] = [];
        const client = mockClient(async function* () {
            yield {
                type: EventType.RUN_ERROR,
                timestamp: Date.now(),
                message: "upstream failed",
            };
        });
        const c = createAgentController(client.agent("assistant" as never), {
            onFinish: (f) => {
                finishes.push(f);
            },
            onError: (e) => {
                errors.push(e.message);
            },
        });
        await c.sendMessage("hello");
        expect(finishes).toHaveLength(1);
        expect(finishes[0]?.isError).toBe(true);
        expect(finishes[0]?.error?.message).toBe("upstream failed");
        expect(errors).toEqual(["upstream failed"]);
    });

    test("onEvent receives events", async () => {
        const events: string[] = [];
        const client = mockClient(async function* () {
            yield {
                type: EventType.RUN_ERROR,
                timestamp: Date.now(),
                message: "x",
            };
        });
        const c = createAgentController(client.agent("assistant" as never), {
            onEvent: (event) => {
                events.push(event.type);
            },
        });
        await c.sendMessage("hello");
        expect(events).toEqual([EventType.RUN_ERROR]);
    });

    test("stop aborts the active server run", async () => {
        const abortedRunIds: string[] = [];
        const stream = deferred();
        const client = mockClient(
            async function* () {
                yield runStartedEvent("run_1");
                await stream.promise;
            },
            {
                async abortRun(runId) {
                    abortedRunIds.push(runId);
                },
            },
        );
        const c = createAgentController(client.agent("assistant" as never), {
            initialMessages: [messageWithToolCall()],
        });

        const sent = c.sendMessage("hello");
        await Promise.resolve();
        c.stop();
        c.stop();
        stream.resolve();
        await sent;

        expect(abortedRunIds).toEqual(["run_1"]);
        expect(c.getSnapshot().status).toBe("ready");
    });

    test("early stop waits for run start before aborting the server run", async () => {
        const abortedRunIds: string[] = [];
        const start = deferred();
        const stream = deferred();
        const client = mockClient(
            async function* () {
                await start.promise;
                yield runStartedEvent("run_late");
                await stream.promise;
            },
            {
                async abortRun(runId) {
                    abortedRunIds.push(runId);
                },
            },
        );
        const c = createAgentController(client.agent("assistant" as never), {
            initialMessages: [messageWithToolCall()],
        });

        const sent = c.sendMessage("hello");
        await Promise.resolve();
        c.stop();

        expect(abortedRunIds).toEqual([]);

        start.resolve();
        stream.resolve();
        await sent;

        expect(abortedRunIds).toEqual(["run_late"]);
        expect(c.getSnapshot().status).toBe("ready");
    });

    test("RUN_STARTED input replaces optimistic user message with server message", async () => {
        const client = mockClient(async function* () {
            yield runStartedEvent("run_1", [
                { id: "server_user_1", role: "user", content: "hello" },
            ]);
        });
        const c = createAgentController(client.agent("assistant" as never), {});

        await c.sendMessage("hello");

        expect(c.getSnapshot().messages).toEqual([
            {
                id: "server_user_1",
                role: "user",
                parts: [{ type: "text", text: "hello" }],
            },
        ]);
    });

    test("client tool resume appends generated messages", async () => {
        const finishes: AgentControllerFinish[] = [];
        const initialStream = async function* () {
            yield {
                type: EventType.RUN_STARTED,
                timestamp: Date.now(),
                runId: "run_1",
                threadId: "",
                input: { runId: "run_1", threadId: "", messages: [], tools: [], context: [] },
            } as AgentEvent;
            yield {
                type: EventType.TOOL_CALL_START,
                timestamp: Date.now(),
                parentMessageId: "assistant_tool",
                toolCallId: "tool_1",
                toolCallName: "getWeather",
            } as AgentEvent;
            yield {
                type: EventType.TOOL_CALL_ARGS,
                timestamp: Date.now(),
                toolCallId: "tool_1",
                delta: '{"city":"Addis Ababa"}',
            } as AgentEvent;
            yield {
                type: EventType.TOOL_CALL_END,
                timestamp: Date.now(),
                toolCallId: "tool_1",
            } as AgentEvent;
            yield {
                type: EventType.RUN_FINISHED,
                timestamp: Date.now(),
                runId: "run_1",
                threadId: "",
                outcome: "interrupt",
                interrupts: [
                    {
                        id: "tool_1:client_result",
                        reason: "client_tool_pending",
                        toolCallId: "tool_1",
                    },
                ],
            } as AgentEvent;
        };
        const client = mockClient(initialStream, {
            stream(_agentName, input): AsyncIterable<AgentEvent> {
                return hasResume(input) ? assistantTextStream("Sunny") : initialStream();
            },
        });

        const c = createAgentController(client.agent("assistant" as never), {
            toolHandlers: {
                getWeather: () => "Sunny",
            },
            onFinish: (finish) => {
                finishes.push(finish);
            },
        });

        await c.sendMessage("hello");

        expect(finishes).toHaveLength(1);
        expect(finishes[0]?.messages.map((message) => message.role)).toEqual([
            "user",
            "assistant",
            "assistant",
        ]);
        expect(finishes[0]?.generatedMessages.map((message) => message.role)).toEqual([
            "assistant",
            "assistant",
        ]);
    });

    test("client tool handler result updates the existing tool part before resume output", async () => {
        const initialStream = async function* () {
            yield {
                type: EventType.TOOL_CALL_START,
                timestamp: Date.now(),
                parentMessageId: "assistant_tool",
                toolCallId: "tool_1",
                toolCallName: "getWeather",
            } as AgentEvent;
            yield {
                type: EventType.TOOL_CALL_ARGS,
                timestamp: Date.now(),
                toolCallId: "tool_1",
                delta: '{"city":"Addis Ababa"}',
            } as AgentEvent;
            yield {
                type: EventType.TOOL_CALL_END,
                timestamp: Date.now(),
                toolCallId: "tool_1",
            } as AgentEvent;
            yield {
                type: EventType.RUN_FINISHED,
                timestamp: Date.now(),
                runId: "run_1",
                threadId: "",
                outcome: "interrupt",
                interrupts: [
                    {
                        id: "tool_1:client_result",
                        reason: "client_tool_pending",
                        toolCallId: "tool_1",
                    },
                ],
            } as AgentEvent;
        };
        const client = mockClient(initialStream, {
            stream(_agentName, input): AsyncIterable<AgentEvent> {
                return hasResume(input) ? assistantTextStream("Sunny") : initialStream();
            },
        });

        const c = createAgentController(client.agent("assistant" as never), {
            toolHandlers: {
                getWeather: () => ({ temperature: 22 }),
            },
        });

        await c.sendMessage("weather");

        const toolResultPart = c
            .getSnapshot()
            .messages.flatMap((message) => message.parts)
            .find((part) => part.type === "tool-result" && part.toolCallId === "tool_1");

        expect(toolResultPart).toMatchObject({
            type: "tool-result",
            state: "output-available",
            result: '{"temperature":22}',
        });
    });

    test("resolves multiple client tool interrupts in one resume call", async () => {
        const streamCalls: unknown[] = [];
        const initialStream = async function* () {
            yield {
                type: EventType.RUN_FINISHED,
                timestamp: Date.now(),
                runId: "run_1",
                threadId: "thread_1",
                outcome: "interrupt",
                interrupts: [
                    {
                        id: "tool_1:client_result",
                        reason: "client_tool_pending",
                        toolCallId: "tool_1",
                    },
                    {
                        id: "tool_2:client_result",
                        reason: "client_tool_pending",
                        toolCallId: "tool_2",
                    },
                ],
            } as AgentEvent;
        };
        const client = mockClient(initialStream, {
            stream(_agentName, input): AsyncIterable<AgentEvent> {
                if (hasResume(input)) {
                    streamCalls.push(input);
                    return (async function* () {})();
                }
                return initialStream();
            },
        });

        const c = createAgentController(client.agent("assistant" as never), {
            threadId: "thread_1",
            initialMessages: [messageWithToolCalls()],
            toolHandlers: {
                getWeather: () => ({ temperature: 22 }),
                getLocation: () => ({ lat: 1, lng: 2 }),
            },
        });

        await c.sendMessage("continue");

        expect(streamCalls).toEqual([
            {
                resume: [
                    {
                        interruptId: "tool_1:client_result",
                        status: "resolved",
                        payload: { status: "success", result: { temperature: 22 } },
                    },
                    {
                        interruptId: "tool_2:client_result",
                        status: "resolved",
                        payload: { status: "success", result: { lat: 1, lng: 2 } },
                    },
                ],
                threadId: "thread_1",
            },
        ]);
        expect(c.getSnapshot().pendingClientTools).toEqual([]);
    });

    test("approval interrupts finish as approval pending", async () => {
        const finishes: AgentControllerFinish[] = [];
        const client = mockClient(async function* () {
            yield approvalInterruptEvent();
        });
        const c = createAgentController(client.agent("assistant" as never), {
            initialMessages: [messageWithToolCall()],
            onFinish: (finish) => {
                finishes.push(finish);
            },
        });

        await c.sendMessage("hello");

        expect(finishes).toHaveLength(1);
        expect(finishes[0]?.isInterrupted).toBe(true);
        expect(finishes[0]?.interruptReason).toBe("tool_approval_pending");
    });

    test("interrupt expirations populate pending expiresAt", async () => {
        const expiresAt = new Date(Date.now() + 30_000).toISOString();
        const client = mockClient(async function* () {
            yield {
                type: EventType.RUN_FINISHED,
                timestamp: Date.now(),
                runId: "run_1",
                outcome: "interrupt",
                interrupts: [
                    {
                        id: "tool_1:approval",
                        reason: "tool_approval_pending",
                        toolCallId: "tool_1",
                        expiresAt,
                    },
                    {
                        id: "tool_2:client_result",
                        reason: "client_tool_pending",
                        toolCallId: "tool_2",
                        expiresAt,
                    },
                ],
            } as AgentEvent;
        });
        const c = createAgentController(client.agent("assistant" as never), {
            initialMessages: [messageWithToolCalls()],
        });

        await c.sendMessage("continue");

        expect(c.getSnapshot().pendingToolApprovals[0]?.expiresAt).toBe(expiresAt);
        expect(c.getSnapshot().pendingClientTools[0]?.expiresAt).toBe(expiresAt);
    });

    test("approveToolCall resumes approval with approved payload", async () => {
        const finishes: AgentControllerFinish[] = [];
        const resumeCalls: unknown[] = [];
        const initialStream = async function* () {
            yield approvalInterruptEvent();
        };
        const client = mockClient(initialStream, {
            stream(_agentName, input): AsyncIterable<AgentEvent> {
                if (!hasResume(input)) {
                    return initialStream();
                }
                resumeCalls.push(input);
                return (async function* () {
                    yield {
                        type: EventType.TOOL_CALL_RESULT,
                        timestamp: Date.now(),
                        toolCallId: "tool_1",
                        content: '{"saved":true,"note":"cool"}',
                        status: "success",
                    } as AgentEvent;
                    yield* assistantTextStream("Deleted");
                })();
            },
        });
        const c = createAgentController(client.agent("assistant" as never), {
            initialMessages: [messageWithToolCall()],
            onFinish: (finish) => {
                finishes.push(finish);
            },
        });

        await c.sendMessage("delete it");
        await c.approveToolCall("tool_1:approval");

        expect(resumeCalls).toEqual([
            {
                resume: [
                    {
                        interruptId: "tool_1:approval",
                        status: "resolved",
                        payload: { approved: true },
                    },
                ],
            },
        ]);
        expect(c.getSnapshot().pendingToolApprovals).toEqual([]);
        expect(c.getSnapshot().messages[0]?.parts[0]).toMatchObject({
            type: "tool-call",
            toolCallId: "tool_1",
            state: "approval-responded",
            approval: {
                interruptId: "tool_1:approval",
                needsApproval: true,
                approved: true,
            },
        });
        expect(c.getSnapshot().messages[0]?.parts[1]).toMatchObject({
            type: "tool-result",
            toolCallId: "tool_1",
            state: "output-available",
            result: { saved: true, note: "cool" },
        });
        expect(
            c.getSnapshot().messages.find((message) => message.id === "assistant_1"),
        ).toMatchObject({
            role: "assistant",
            parts: expect.arrayContaining([{ type: "text", text: "Deleted" }]),
        });
        expect(finishes.at(-1)?.isInterrupted).toBe(false);
    });

    test("resumes multiple approval interrupts after all decisions are provided", async () => {
        const streamCalls: unknown[] = [];
        const initialStream = async function* () {
            yield {
                type: EventType.RUN_FINISHED,
                timestamp: Date.now(),
                runId: "run_1",
                threadId: "thread_1",
                outcome: "interrupt",
                interrupts: [
                    {
                        id: "tool_1:approval",
                        reason: "tool_approval_pending",
                        toolCallId: "tool_1",
                    },
                    {
                        id: "tool_2:approval",
                        reason: "tool_approval_pending",
                        toolCallId: "tool_2",
                        metadata: { risk: "low" },
                    },
                ],
            } as AgentEvent;
        };
        const client = mockClient(initialStream, {
            stream(_agentName, input): AsyncIterable<AgentEvent> {
                if (hasResume(input)) {
                    streamCalls.push(input);
                    return (async function* () {})();
                }
                return initialStream();
            },
        });

        const c = createAgentController(client.agent("assistant" as never), {
            threadId: "thread_1",
            initialMessages: [messageWithToolCalls()],
        });

        await c.sendMessage("continue");

        expect(c.getSnapshot().pendingToolApprovals).toHaveLength(2);
        await c.approveToolCall("tool_1:approval");

        expect(streamCalls).toEqual([]);
        expect(c.getSnapshot().pendingToolApprovals).toHaveLength(1);
        expect(c.getSnapshot().pendingToolApprovals[0]?.interruptId).toBe("tool_2:approval");

        await c.rejectToolCall("tool_2:approval", "No thanks");

        expect(streamCalls).toEqual([
            {
                resume: [
                    {
                        interruptId: "tool_1:approval",
                        status: "resolved",
                        payload: { approved: true },
                    },
                    {
                        interruptId: "tool_2:approval",
                        status: "resolved",
                        payload: { approved: false, metadata: { note: "No thanks" } },
                    },
                ],
                threadId: "thread_1",
            },
        ]);
        expect(c.getSnapshot().pendingToolApprovals).toEqual([]);
    });

    test("rejectToolCall resumes approval with denied payload", async () => {
        const resumeCalls: unknown[] = [];
        const client = mockClient(async function* () {}, {
            stream(_agentName, input): AsyncIterable<AgentEvent> {
                resumeCalls.push(input);
                return (async function* () {
                    yield {
                        type: EventType.TOOL_CALL_RESULT,
                        timestamp: Date.now(),
                        toolCallId: "tool_1",
                        content: '{"approved":false,"metadata":{"note":"Not allowed"}}',
                        status: "denied",
                    } as AgentEvent;
                    yield* assistantTextStream("Cancelled");
                })();
            },
        });
        const c = createAgentController(client.agent("assistant" as never), {
            initialMessages: [messageWithToolCall()],
            initialInterruptState: {
                runId: "run_1",
                status: "interrupted",
                pendingToolApprovals: [
                    {
                        interruptId: "tool_1:approval",
                        runId: "run_1",
                        toolCallId: "tool_1",
                        toolName: "deleteFile",
                        input: { path: "/tmp/x" },
                    },
                ],
            },
        });

        await c.rejectToolCall("tool_1:approval", "Not allowed");

        expect(resumeCalls).toEqual([
            {
                resume: [
                    {
                        interruptId: "tool_1:approval",
                        status: "resolved",
                        payload: { approved: false, metadata: { note: "Not allowed" } },
                    },
                ],
            },
        ]);
        expect(c.getSnapshot().pendingToolApprovals).toEqual([]);
        const deniedPart = c
            .getSnapshot()
            .messages.flatMap((message) => message.parts)
            .find((part) => part.type === "tool-call" && part.toolCallId === "tool_1");
        expect(deniedPart).toMatchObject({
            type: "tool-call",
            toolCallId: "tool_1",
            state: "approval-responded",
            approval: {
                interruptId: "tool_1:approval",
                needsApproval: true,
                approved: false,
                metadata: {
                    note: "Not allowed",
                },
            },
        });
        expect(
            c.getSnapshot().messages.find((message) => message.id === "assistant_1"),
        ).toMatchObject({
            role: "assistant",
            parts: expect.arrayContaining([{ type: "text", text: "Cancelled" }]),
        });
    });

    test("hydrated denied approvals stay on the tool-call approval state", () => {
        const messages = fromAgentMessages([
            {
                id: "assistant_1",
                role: "assistant",
                content: "",
                toolCalls: [
                    {
                        id: "tool_1",
                        type: "function",
                        function: {
                            name: "deleteFile",
                            arguments: '{"path":"/tmp/x"}',
                        },
                    },
                ],
            },
            {
                id: "tool_1_result",
                role: "tool",
                toolCallId: "tool_1",
                content: '{"approved":false,"metadata":{"note":"Not allowed"}}',
                status: "denied",
                approval: {
                    approved: false,
                    metadata: {
                        note: "Not allowed",
                    },
                },
            },
        ] as AgentMessage[]);

        const deniedPart = messages
            .flatMap((message) => message.parts)
            .find((part) => part.type === "tool-call" && part.toolCallId === "tool_1");
        expect(deniedPart).toMatchObject({
            type: "tool-call",
            toolCallId: "tool_1",
            state: "approval-responded",
            approval: {
                interruptId: "tool_1:approval",
                needsApproval: true,
                approved: false,
                metadata: {
                    note: "Not allowed",
                },
            },
        });
    });

    test("hydrated approved tool results keep approval state and parsed output", () => {
        const messages = fromAgentMessages([
            {
                id: "assistant_1",
                role: "assistant",
                content: "",
                toolCalls: [
                    {
                        id: "tool_1",
                        type: "function",
                        function: {
                            name: "save_note",
                            arguments: '{"note":"cool"}',
                        },
                    },
                ],
            },
            {
                id: "tool_1_result",
                role: "tool",
                toolCallId: "tool_1",
                content: '{"saved":true,"note":"cool"}',
                status: "success",
                approval: {
                    approved: true,
                },
            },
        ] as AgentMessage[]);

        const parts = messages[0]?.parts.filter(
            (part) => part.type !== "text" || part.text.length > 0,
        );

        expect(parts).toMatchObject([
            {
                type: "tool-call",
                toolCallId: "tool_1",
                state: "approval-responded",
                approval: {
                    interruptId: "tool_1:approval",
                    needsApproval: true,
                    approved: true,
                },
            },
            {
                type: "tool-result",
                toolCallId: "tool_1",
                state: "output-available",
                result: { saved: true, note: "cool" },
            },
        ]);
    });

    test("approval resume can continue into client tool interrupt", async () => {
        const resumeCalls: unknown[] = [];
        const initialStream = async function* () {
            yield approvalInterruptEvent();
        };
        const client = mockClient(initialStream, {
            stream(_agentName, input): AsyncIterable<AgentEvent> {
                if (!hasResume(input)) {
                    return initialStream();
                }
                resumeCalls.push(input);
                if (resumeCalls.length === 1) {
                    return (async function* () {
                        yield {
                            type: EventType.RUN_FINISHED,
                            timestamp: Date.now(),
                            runId: "run_2",
                            outcome: "interrupt",
                            interrupts: [
                                {
                                    id: "tool_2:client_result",
                                    reason: "client_tool_pending",
                                    toolCallId: "tool_2",
                                },
                            ],
                        } as AgentEvent;
                    })();
                }

                return assistantTextStream("Done");
            },
        });
        const c = createAgentController(client.agent("assistant" as never), {
            initialMessages: [messageWithToolCalls()],
            toolHandlers: {
                getLocation: () => ({ lat: 1, lng: 2 }),
            },
        });

        await c.sendMessage("delete it");
        await c.approveToolCall("tool_1:approval");

        expect(resumeCalls).toEqual([
            {
                resume: [
                    {
                        interruptId: "tool_1:approval",
                        status: "resolved",
                        payload: { approved: true },
                    },
                ],
            },
            {
                resume: [
                    {
                        interruptId: "tool_2:client_result",
                        status: "resolved",
                        payload: { status: "success", result: { lat: 1, lng: 2 } },
                    },
                ],
            },
        ]);
        expect(c.getSnapshot().pendingClientTools).toEqual([]);
        expect(c.getSnapshot().pendingToolApprovals).toEqual([]);
        expect(c.getSnapshot().messages.at(-1)).toMatchObject({
            role: "assistant",
            parts: [{ type: "text", text: "Done" }],
        });
    });

    test("messages initialize the snapshot", () => {
        const messages: UIMessage[] = [
            {
                id: "user_1",
                role: "user",
                parts: [{ type: "text", text: "hello" }],
            },
        ];
        const client = mockClient(async function* () {
            /* no events */
        });

        const c = createAgentController(client.agent("assistant" as never), {
            initialMessages: messages,
        });

        expect(c.getSnapshot()).toMatchObject({
            messages,
            status: "ready",
            pendingClientTools: [],
            pendingToolApprovals: [],
        });
    });

    test("threaded send sends only the new input message", async () => {
        const sentMessages: unknown[] = [];
        const client = mockClient(async function* () {}, {
            stream(_agentName, input) {
                sentMessages.push((input as { messages?: unknown[] }).messages);
                return (async function* () {})();
            },
        });

        const c = createAgentController(client.agent("assistant" as never), {
            threadId: "thread_1",
            initialMessages: [
                {
                    id: "assistant_1",
                    role: "assistant",
                    parts: [
                        {
                            type: "tool-result",
                            toolCallId: "tool_1",
                            state: "output-available",
                            result: "Sunny",
                        },
                    ],
                },
            ],
        });

        await c.sendMessage("next");

        expect(sentMessages).toHaveLength(1);
        expect(sentMessages[0]).toEqual([
            {
                role: "user",
                content: "next",
            },
        ]);
    });

    test("provider-executed tool parts survive a later messages snapshot", async () => {
        const client = mockClient(async function* () {
            yield {
                type: EventType.MESSAGES_SNAPSHOT,
                timestamp: Date.now(),
                messages: [
                    {
                        id: "assistant_1",
                        role: "assistant",
                        content: "Here are the latest headlines.",
                        toolCalls: [
                            {
                                id: "tool_1",
                                type: "function",
                                function: {
                                    name: "web_search",
                                    arguments:
                                        '{"action":{"type":"search","query":"latest US news"}}',
                                },
                                providerExecuted: true,
                            },
                        ],
                        sources: [
                            {
                                id: "source_1",
                                sourceType: "url",
                                url: "https://example.com/news",
                                title: "Example News",
                            },
                        ],
                    },
                    {
                        id: "tool_1_result",
                        role: "tool",
                        toolCallId: "tool_1",
                        content: '{"action":{"type":"search","query":"latest US news"}}',
                        status: "success",
                    },
                ],
            } as AgentEvent;
        });

        const c = createAgentController(client.agent("assistant" as never), {});

        await c.sendMessage("latest US news");

        expect(c.getSnapshot().messages.at(-1)).toMatchObject({
            id: "assistant_1",
            role: "assistant",
            parts: [
                { type: "text", text: "Here are the latest headlines." },
                {
                    type: "tool-call",
                    toolCallId: "tool_1",
                    toolName: "web_search",
                    input: { action: { type: "search", query: "latest US news" } },
                    inputText: '{"action":{"type":"search","query":"latest US news"}}',
                    state: "input-available",
                    providerExecuted: true,
                },
                {
                    type: "tool-result",
                    toolCallId: "tool_1",
                    state: "output-available",
                    result: { action: { type: "search", query: "latest US news" } },
                },
                {
                    type: "source",
                    sourceId: "source_1",
                    sourceType: "url",
                    url: "https://example.com/news",
                    title: "Example News",
                },
            ],
        });
    });

    test("interruptState restores pending approval and marks the tool call", () => {
        const client = mockClient(async function* () {
            /* no events */
        });

        const c = createAgentController(client.agent("assistant" as never), {
            initialMessages: [messageWithToolCall()],
            initialInterruptState: {
                runId: "run_1",
                pendingToolApprovals: [
                    {
                        interruptId: "tool_1:approval",
                        runId: "run_1",
                        toolCallId: "tool_1",
                        toolName: "deleteFile",
                        input: { path: "/tmp/x" },
                    },
                ],
            },
        });

        const snapshot = c.getSnapshot();
        expect(snapshot.status).toBe("interrupted");
        expect(snapshot.runId).toBe("run_1");
        expect(snapshot.pendingToolApprovals).toEqual([
            {
                interruptId: "tool_1:approval",
                runId: "run_1",
                toolCallId: "tool_1",
                toolName: "deleteFile",
                input: { path: "/tmp/x" },
            },
        ]);
        expect(snapshot.messages[0]?.parts[0]).toMatchObject({
            type: "tool-call",
            toolCallId: "tool_1",
            state: "approval-requested",
            approval: {
                interruptId: "tool_1:approval",
                needsApproval: true,
            },
        });
    });

    test("interruptState restores pending client tools when no handler is registered", async () => {
        let resolveFinish: (finish: AgentControllerFinish) => void = () => {};
        const finished = new Promise<AgentControllerFinish>((resolve) => {
            resolveFinish = resolve;
        });
        const client = mockClient(async function* () {
            /* no events */
        });

        const c = createAgentController(client.agent("assistant" as never), {
            initialInterruptState: {
                runId: "run_1",
                pendingClientTools: [
                    {
                        interruptId: "client_tool_1",
                        runId: "run_1",
                        toolCallId: "tool_1",
                        toolName: "getLocation",
                        input: { precise: true },
                    },
                ],
            },
            onFinish: resolveFinish,
        });
        c.start();

        const finish = await finished;
        expect(finish).toMatchObject({
            isInterrupted: true,
            interruptReason: "client_tool_pending",
        });
        expect(c.getSnapshot()).toMatchObject({
            status: "interrupted",
            runId: "run_1",
            pendingClientTools: [
                {
                    interruptId: "client_tool_1",
                    runId: "run_1",
                    toolCallId: "tool_1",
                    toolName: "getLocation",
                    input: { precise: true },
                },
            ],
            pendingToolApprovals: [],
        });
    });

    test("interruptState executes pending client tools when a handler is registered", async () => {
        const resumeCalls: unknown[] = [];
        let resolveFinish: (finish: AgentControllerFinish) => void = () => {};
        const finished = new Promise<AgentControllerFinish>((resolve) => {
            resolveFinish = resolve;
        });
        const client = mockClient(
            async function* () {
                /* no events */
            },
            {
                stream(_agentName, input): AsyncIterable<AgentEvent> {
                    resumeCalls.push(input);
                    return assistantTextStream("Located");
                },
            },
        );

        const c = createAgentController(client.agent("assistant" as never), {
            initialInterruptState: {
                runId: "run_1",
                pendingClientTools: [
                    {
                        interruptId: "client_tool_1",
                        runId: "run_1",
                        toolCallId: "tool_1",
                        toolName: "getLocation",
                        input: { precise: true },
                    },
                ],
            },
            toolHandlers: {
                getLocation: () => ({ lat: 1, lng: 2 }),
            },
            onFinish: resolveFinish,
        });
        c.start();

        expect(c.getSnapshot().status).toBe("streaming");
        const finish = await finished;

        expect(resumeCalls).toEqual([
            {
                resume: [
                    {
                        interruptId: "client_tool_1",
                        status: "resolved",
                        payload: { status: "success", result: { lat: 1, lng: 2 } },
                    },
                ],
            },
        ]);
        expect(finish.isInterrupted).toBe(false);
        expect(c.getSnapshot()).toMatchObject({
            status: "ready",
            pendingClientTools: [],
            messages: [
                {
                    id: "assistant_1",
                    role: "assistant",
                    parts: [{ type: "text", text: "Located" }],
                },
            ],
        });
    });

    test("threadId hydrates latest interrupted run metadata", async () => {
        const client = mockClient(
            async function* () {
                /* no events */
            },
            {
                memory: {
                    messages: [
                        {
                            id: "assistant_1",
                            role: "assistant",
                            content: "",
                            toolCalls: [
                                {
                                    id: "tool_1",
                                    type: "function",
                                    function: {
                                        name: "deleteFile",
                                        arguments: '{"path":"/tmp/x"}',
                                    },
                                },
                            ],
                            threadId: "thread_1",
                            runId: "run_1",
                            createdAt: 1,
                        },
                    ],
                    runtime: {
                        interrupted: {
                            runId: "run_1",
                            interrupts: [
                                {
                                    id: "tool_1:approval",
                                    reason: "tool_approval_pending",
                                    toolCallId: "tool_1",
                                },
                            ],
                        },
                    },
                },
            },
        );

        const c = createAgentController(client.agent("assistant" as never), {
            threadId: "thread_1",
        });
        c.start();
        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(c.getSnapshot()).toMatchObject({
            status: "interrupted",
            runId: "run_1",
            pendingToolApprovals: [
                {
                    interruptId: "tool_1:approval",
                    runId: "run_1",
                    toolCallId: "tool_1",
                    toolName: "deleteFile",
                    input: { path: "/tmp/x" },
                },
            ],
        });
        expect(
            c
                .getSnapshot()
                .messages.flatMap((message) => message.parts)
                .find((part) => part.type === "tool-call" && part.toolCallId === "tool_1"),
        ).toMatchObject({
            type: "tool-call",
            state: "approval-requested",
        });
    });

    test("threadId resumable runtime loads prior messages and replays from zero", async () => {
        const listInputs: unknown[] = [];
        const replayCalls: unknown[] = [];
        let resolveFinish: (finish: AgentControllerFinish) => void = () => {};
        const finished = new Promise<AgentControllerFinish>((resolve) => {
            resolveFinish = resolve;
        });
        const client = mockClient(
            async function* () {
                /* no events */
            },
            {
                resumeStream(input) {
                    replayCalls.push(input);
                    return assistantTextStream("Replayed");
                },
                memory: {
                    runtime: {
                        resumable: {
                            runId: "run_1",
                            afterSequence: 0,
                        },
                    },
                    listMessages: (_threadId, input) => {
                        listInputs.push(input);
                        return [
                            {
                                id: "user_old",
                                role: "user",
                                content: "old",
                                threadId: "thread_1",
                                runId: "run_0",
                                createdAt: 1,
                            },
                        ];
                    },
                },
            },
        );

        const c = createAgentController(client.agent("assistant" as never), {
            threadId: "thread_1",
            onFinish: resolveFinish,
        });
        c.start();
        const finish = await finished;

        expect(listInputs).toEqual([{ beforeRunId: "run_1" }]);
        expect(replayCalls).toEqual([{ runId: "run_1", afterSequence: 0 }]);
        expect(finish.isInterrupted).toBe(false);
        expect(c.getSnapshot().messages).toMatchObject([
            {
                id: "user_old",
                role: "user",
                parts: [{ type: "text", text: "old" }],
            },
            {
                id: "assistant_1",
                role: "assistant",
                parts: [{ type: "text", text: "Replayed" }],
            },
        ]);
    });

    test("client tool handler returning undefined resumes as an empty success result", async () => {
        const resumeCalls: unknown[] = [];
        let resolveFinish: (finish: AgentControllerFinish) => void = () => {};
        const finished = new Promise<AgentControllerFinish>((resolve) => {
            resolveFinish = resolve;
        });
        const client = mockClient(
            async function* () {
                /* no events */
            },
            {
                stream(_agentName, input): AsyncIterable<AgentEvent> {
                    resumeCalls.push(input);
                    return (async function* () {})();
                },
            },
        );

        const c = createAgentController(client.agent("assistant" as never), {
            initialInterruptState: {
                runId: "run_1",
                pendingClientTools: [
                    {
                        interruptId: "client_tool_1",
                        runId: "run_1",
                        toolCallId: "tool_1",
                        toolName: "getLocation",
                        input: { precise: true },
                    },
                ],
            },
            toolHandlers: {
                getLocation: () => undefined,
            },
            onFinish: resolveFinish,
        });
        c.start();

        const finish = await finished;

        expect(resumeCalls).toEqual([
            {
                resume: [
                    {
                        interruptId: "client_tool_1",
                        status: "resolved",
                        payload: { status: "success", result: {} },
                    },
                ],
            },
        ]);
        expect(finish.isInterrupted).toBe(false);
    });

    test("client tool handler errors resume as an error result", async () => {
        const resumeCalls: unknown[] = [];
        let resolveFinish: (finish: AgentControllerFinish) => void = () => {};
        const finished = new Promise<AgentControllerFinish>((resolve) => {
            resolveFinish = resolve;
        });
        const client = mockClient(
            async function* () {
                /* no events */
            },
            {
                stream(_agentName, input): AsyncIterable<AgentEvent> {
                    resumeCalls.push(input);
                    return (async function* () {})();
                },
            },
        );

        const c = createAgentController(client.agent("assistant" as never), {
            initialMessages: [messageWithToolCall()],
            initialInterruptState: {
                runId: "run_1",
                pendingClientTools: [
                    {
                        interruptId: "client_tool_1",
                        runId: "run_1",
                        toolCallId: "tool_1",
                        toolName: "deleteFile",
                        input: { path: "/tmp/x" },
                    },
                ],
            },
            toolHandlers: {
                deleteFile: () => {
                    throw new Error("No permission");
                },
            },
            onFinish: resolveFinish,
        });
        c.start();

        const finish = await finished;

        expect(resumeCalls).toEqual([
            {
                resume: [
                    {
                        interruptId: "client_tool_1",
                        status: "resolved",
                        payload: { status: "error", error: "No permission" },
                    },
                ],
            },
        ]);
        expect(
            c
                .getSnapshot()
                .messages.flatMap((message) => message.parts)
                .find((part) => part.type === "tool-result" && part.toolCallId === "tool_1"),
        ).toMatchObject({
            type: "tool-result",
            state: "output-error",
            error: "No permission",
        });
        expect(finish.isInterrupted).toBe(false);
    });

    test("state initializes the snapshot", () => {
        const client = mockClient(async function* () {
            /* no events */
        });

        const c = createAgentController(client.agent("assistant" as never), {
            threadId: "thread_1",
            initialState: {
                selectedItemId: "sku_1",
            },
        });

        expect(c.getSnapshot()).toMatchObject({
            state: {
                selectedItemId: "sku_1",
            },
            status: "ready",
        });
    });

    test("STATE_SNAPSHOT replaces state during streaming", async () => {
        const client = mockClient(async function* () {
            yield {
                type: EventType.STATE_SNAPSHOT,
                timestamp: Date.now(),
                snapshot: { status: "working", count: 1 },
            } as AgentEvent;
        });
        const c = createAgentController(client.agent("assistant" as never), {
            initialState: { status: "idle" },
        });

        await c.sendMessage("hello");

        expect(c.getSnapshot().state).toEqual({ status: "working", count: 1 });
    });

    test("STATE_DELTA patches state during streaming", async () => {
        const client = mockClient(async function* () {
            yield {
                type: EventType.STATE_DELTA,
                timestamp: Date.now(),
                delta: [{ op: "replace", path: "/status", value: "done" }],
            } as AgentEvent;
        });
        const c = createAgentController(client.agent("assistant" as never), {
            initialState: { status: "idle" },
        });

        await c.sendMessage("hello");

        expect(c.getSnapshot().state).toEqual({ status: "done" });
    });

    test("resume replays stream events from the requested run", async () => {
        const replayCalls: unknown[] = [];
        let resolveFinish: (finish: AgentControllerFinish) => void = () => {};
        const finished = new Promise<AgentControllerFinish>((resolve) => {
            resolveFinish = resolve;
        });
        const client = mockClient(
            async function* () {
                /* no events */
            },
            {
                resumeStream(input) {
                    replayCalls.push(input);
                    return (async function* () {
                        yield runStartedEvent("run_1", [
                            { id: "server_user_1", role: "user", content: "hello" },
                        ]);
                        yield {
                            type: EventType.TEXT_MESSAGE_CONTENT,
                            timestamp: Date.now(),
                            messageId: "assistant_1",
                            delta: "Replayed",
                            seq: 43,
                        } as AgentEvent;
                    })();
                },
            },
        );

        const c = createAgentController(client.agent("assistant" as never), {
            resume: {
                runId: "run_1",
                afterSequence: 42,
            },
            onFinish: resolveFinish,
        });
        c.start();

        expect(c.getSnapshot().status).toBe("streaming");
        const finish = await finished;

        expect(replayCalls).toEqual([{ runId: "run_1", afterSequence: 42 }]);
        expect(finish).toMatchObject({
            isAbort: false,
            isError: false,
            isInterrupted: false,
            runId: "run_1",
        });
        expect(c.getSnapshot()).toMatchObject({
            status: "ready",
            runId: "run_1",
            messages: [
                {
                    id: "server_user_1",
                    role: "user",
                    parts: [{ type: "text", text: "hello" }],
                },
                {
                    id: "assistant_1",
                    role: "assistant",
                    parts: [{ type: "text", text: "Replayed" }],
                },
            ],
        });
    });

    test("resume does not surface an error while the page is tearing down", async () => {
        const previousWindow = (globalThis as { window?: Window }).window;
        (globalThis as { window?: Window }).window = {
            __baPageTeardown: true,
            __baPageTeardownInstalled: true,
        } as Window;

        try {
            let resolveFinish: (finish: AgentControllerFinish) => void = () => {};
            const finished = new Promise<AgentControllerFinish>((resolve) => {
                resolveFinish = resolve;
            });
            const c = createAgentController(
                mockClient(
                    async function* () {
                        /* no-op */
                    },
                    {
                        resumeStream() {
                            return {
                                async *[Symbol.asyncIterator]() {
                                    yield* [];
                                    throw new Error("network dropped");
                                },
                            };
                        },
                    },
                ).agent("assistant" as never),
                {
                    resume: {
                        runId: "run_1",
                        afterSequence: 0,
                    },
                    onFinish: resolveFinish,
                },
            );
            c.start();

            const finish = await finished;

            expect(finish).toMatchObject({
                isAbort: true,
                isError: false,
            });
            expect(c.getSnapshot()).toMatchObject({
                status: "ready",
                error: undefined,
            });
        } finally {
            if (previousWindow === undefined) {
                (globalThis as { window?: Window }).window = undefined;
            } else {
                (globalThis as { window?: Window }).window = previousWindow;
            }
        }
    });
});
