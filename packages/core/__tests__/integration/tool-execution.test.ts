import { describe, expect, test } from "bun:test";
import { ok } from "@better-agent/shared/neverthrow";
import { Events } from "../../src/events";
import type { Event } from "../../src/events";
import type { BetterAgentRuntime } from "../../src/run";
import { createRuntime } from "../../src/run";
import { defineTool } from "../../src/tools";
import {
    collectEvents,
    createScriptedModel,
    createTextAgent,
    createTextResponse,
    createToolCallResponse,
} from "../helpers/mock-model";

const waitUntil = async (predicate: () => boolean, timeoutMs = 250) => {
    const start = Date.now();
    while (!predicate()) {
        if (Date.now() - start > timeoutMs) {
            throw new Error("Timed out waiting for condition.");
        }
        await new Promise((resolve) => setTimeout(resolve, 5));
    }
};

const submitToolResultEventually = async (
    runtime: BetterAgentRuntime,
    params: {
        runId: string;
        toolCallId: string;
        status: "success";
        result: unknown;
    },
    timeoutMs = 250,
) => {
    const start = Date.now();
    while (true) {
        const submitted = await runtime.submitToolResult(params);
        if (submitted) {
            return true;
        }

        if (Date.now() - start > timeoutMs) {
            return false;
        }

        await new Promise((resolve) => setTimeout(resolve, 10));
    }
};

const isPlainClientToolEvent = (event: Event) =>
    event.type === Events.TOOL_CALL_START ||
    event.type === Events.TOOL_CALL_ARGS ||
    event.type === Events.TOOL_CALL_END;

const isHilClientToolEvent = (event: Event) =>
    event.type === Events.TOOL_CALL_START ||
    event.type === Events.TOOL_CALL_ARGS ||
    event.type === Events.TOOL_APPROVAL_REQUIRED ||
    event.type === Events.TOOL_APPROVAL_UPDATED ||
    event.type === Events.TOOL_CALL_END;

describe("tool execution", () => {
    test("run reuses provider-emitted assistant message id for tool parent linkage", async () => {
        const tool = defineTool({
            name: "lookup",
            schema: {
                type: "object",
                properties: {},
                additionalProperties: false,
            } as const,
        }).server(async () => ({ ok: true }));

        let callCount = 0;
        const agent = createTextAgent({
            model: {
                ...createTextAgent().model,
                async doGenerate(_options: unknown, ctx: { generateMessageId(): string }) {
                    if (callCount === 0) {
                        callCount += 1;
                        const messageId = ctx.generateMessageId();
                        return ok({
                            response: createToolCallResponse([
                                { callId: "call_1", name: "lookup", arguments: "{}" },
                            ]),
                            events: [
                                {
                                    type: Events.TEXT_MESSAGE_START,
                                    messageId,
                                    role: "assistant",
                                    timestamp: Date.now(),
                                },
                                {
                                    type: Events.TEXT_MESSAGE_CONTENT,
                                    messageId,
                                    delta: "Let me check that.",
                                    timestamp: Date.now(),
                                },
                                {
                                    type: Events.TEXT_MESSAGE_END,
                                    messageId,
                                    timestamp: Date.now(),
                                },
                            ],
                        });
                    }

                    return ok({
                        response: createTextResponse("done"),
                    });
                },
            },
            tools: [tool] as never,
        });
        const { events, onEvent } = collectEvents();
        const runtime = createRuntime({
            agents: [agent] as const,
        }) as unknown as BetterAgentRuntime;

        await runtime.run(agent.name, { input: "go", onEvent });

        const assistantStart = events.find((event) => event.type === Events.TEXT_MESSAGE_START);
        const toolStart = events.find((event) => event.type === Events.TOOL_CALL_START);

        expect(assistantStart).toBeDefined();
        expect(toolStart).toBeDefined();
        expect(
            assistantStart && "messageId" in assistantStart ? assistantStart.messageId : undefined,
        ).toBe(toolStart && "parentMessageId" in toolStart ? toolStart.parentMessageId : undefined);
    });

    test("stream reuses provider-emitted assistant message id for tool parent linkage", async () => {
        const tool = defineTool({
            name: "lookup",
            schema: {
                type: "object",
                properties: {},
                additionalProperties: false,
            } as const,
        }).server(async () => ({ ok: true }));

        let callCount = 0;
        const agent = createTextAgent({
            model: {
                ...createTextAgent().model,
                async doGenerateStream(_options: unknown, ctx: { generateMessageId(): string }) {
                    const currentCall = callCount++;
                    if (currentCall === 0) {
                        const messageId = ctx.generateMessageId();
                        return ok({
                            events: (async function* () {
                                yield ok({
                                    type: Events.TEXT_MESSAGE_START,
                                    messageId,
                                    role: "assistant",
                                    timestamp: Date.now(),
                                });
                                yield ok({
                                    type: Events.TEXT_MESSAGE_CONTENT,
                                    messageId,
                                    delta: "Let me check that.",
                                    timestamp: Date.now(),
                                });
                                yield ok({
                                    type: Events.TEXT_MESSAGE_END,
                                    messageId,
                                    timestamp: Date.now(),
                                });
                            })(),
                            final: Promise.resolve(
                                createToolCallResponse([
                                    { callId: "call_1", name: "lookup", arguments: "{}" },
                                ]),
                            ),
                        });
                    }

                    return ok({
                        events: (async function* () {})(),
                        final: Promise.resolve(createTextResponse("done")),
                    });
                },
            },
            tools: [tool] as never,
        });
        const runtime = createRuntime({
            agents: [agent] as const,
        }) as unknown as BetterAgentRuntime;

        const stream = runtime.stream(agent.name, { input: "go" });
        const seenEvents: Event[] = [];
        for await (const event of stream.events) {
            seenEvents.push(event);
        }
        await stream.result;

        const assistantStart = seenEvents.find((event) => event.type === Events.TEXT_MESSAGE_START);
        const toolStart = seenEvents.find((event) => event.type === Events.TOOL_CALL_START);

        expect(assistantStart).toBeDefined();
        expect(toolStart).toBeDefined();
        expect(
            assistantStart && "messageId" in assistantStart ? assistantStart.messageId : undefined,
        ).toBe(toolStart && "parentMessageId" in toolStart ? toolStart.parentMessageId : undefined);
    });

    test("server tool executes and result is fed back into the next model step", async () => {
        const seenInputs: unknown[] = [];
        const model = createScriptedModel([
            createToolCallResponse([
                { callId: "call_1", name: "lookup", arguments: '{"city":"Addis"}' },
            ]),
            createTextResponse("weather delivered"),
        ]);
        const agent = createTextAgent({
            model: {
                ...model,
                async doGenerate(
                    options: { input: unknown },
                    ctx: Parameters<NonNullable<typeof model.doGenerate>>[1],
                ) {
                    seenInputs.push(options.input);
                    if (!model.doGenerate) {
                        throw new Error("Expected scripted model to implement doGenerate");
                    }

                    return model.doGenerate(options as never, ctx);
                },
            },
            tools: [
                defineTool({
                    name: "lookup",
                    schema: {
                        type: "object",
                        properties: { city: { type: "string" } },
                        required: ["city"],
                        additionalProperties: false,
                    } as const,
                }).server(async ({ city }) => ({ city, temperature: 26 })) as never,
            ] as never,
        });
        const runtime = createRuntime({
            agents: [agent] as const,
        }) as unknown as BetterAgentRuntime;

        const result = await runtime.run(agent.name, { input: "weather?" });

        expect(result.response.output).toEqual(createTextResponse("weather delivered").output);
        expect(JSON.stringify(seenInputs[1])).toContain("temperature");
        expect(JSON.stringify(seenInputs[1])).toContain('"arguments":"{\\"city\\":\\"Addis\\"}"');
    });

    test("run rejects agents with client tools", async () => {
        const agent = createTextAgent({
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
        });
        const runtime = createRuntime({
            agents: [agent] as const,
        }) as unknown as BetterAgentRuntime;
        expect(runtime.run(agent.name, { input: "go" })).rejects.toMatchObject({
            code: "BAD_REQUEST",
            message:
                "Run failed: Non-stream runs do not support interactive tools. Use stream() for client tool 'confirm'.",
        });
    });

    test("stream exposes client tool completion before waiting for plain client-tool results", async () => {
        const responses = [
            createToolCallResponse([
                { callId: "call_1", name: "confirm", arguments: '{"ok":true}' },
            ]),
            createTextResponse("confirmed"),
        ];
        const agent = createTextAgent({
            model: {
                ...createTextAgent().model,
                async doGenerateStream() {
                    const response = responses.shift() ?? createTextResponse("done");
                    return ok({
                        events: (async function* () {})(),
                        final: Promise.resolve(response),
                    });
                },
            },
            toolErrorMode: "throw",
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
        });
        const runtime = createRuntime({
            agents: [agent] as const,
        }) as unknown as BetterAgentRuntime;

        const stream = runtime.stream(agent.name, { input: "go" });
        const seenEvents: Event[] = [];
        const consumeEvents = (async () => {
            for await (const event of stream.events) {
                seenEvents.push(event);
            }
        })();

        await waitUntil(() => {
            const toolEvents = seenEvents.filter(isPlainClientToolEvent);

            return toolEvents.some((event) => event.type === Events.TOOL_CALL_END);
        });

        const toolEvents = seenEvents.filter(isPlainClientToolEvent);

        expect(toolEvents.map((event) => event.type)).toEqual([
            Events.TOOL_CALL_START,
            Events.TOOL_CALL_ARGS,
            Events.TOOL_CALL_END,
        ]);

        const runStarted = seenEvents.find((event) => event.type === Events.RUN_STARTED);
        const runId = runStarted && "runId" in runStarted ? runStarted.runId : "";
        const submitted = await runtime.submitToolResult({
            runId,
            toolCallId: "call_1",
            status: "success",
            result: { accepted: true },
        });

        expect(submitted).toBeTrue();
        const result = await stream.result;
        await consumeEvents;

        expect(result.response.output).toEqual(createTextResponse("confirmed").output);
    });

    test("stream uses per-run advanced client tool timeout defaults", async () => {
        const agent = createTextAgent({
            model: {
                ...createTextAgent().model,
                async doGenerateStream() {
                    return ok({
                        events: (async function* () {})(),
                        final: Promise.resolve(
                            createToolCallResponse([
                                { callId: "call_1", name: "confirm", arguments: '{"ok":true}' },
                            ]),
                        ),
                    });
                },
            },
            toolErrorMode: "throw",
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
        });
        const runtime = createRuntime({
            agents: [agent] as const,
        }) as unknown as BetterAgentRuntime;

        const stream = runtime.stream(agent.name, {
            input: "go",
            advanced: { clientToolResultTimeoutMs: 1 },
        });
        const consumeEvents = (async () => {
            try {
                for await (const _event of stream.events) {
                    // drain
                }
            } catch {
                // queue fails when the stream result rejects
            }
        })();

        expect(stream.result).rejects.toMatchObject({
            code: "TIMEOUT",
            message: "Run failed: Timed out waiting for client tool result for 'confirm'.",
        });
        await consumeEvents;
    });

    test("stream exposes approval request before end for HIL client tools", async () => {
        const responses = [
            createToolCallResponse([
                { callId: "call_1", name: "confirm", arguments: '{"ok":true}' },
            ]),
            createTextResponse("confirmed"),
        ];
        const agent = createTextAgent({
            model: {
                ...createTextAgent().model,
                async doGenerateStream() {
                    const response = responses.shift() ?? createTextResponse("done");
                    return ok({
                        events: (async function* () {})(),
                        final: Promise.resolve(response),
                    });
                },
            },
            tools: [
                defineTool({
                    name: "confirm",
                    schema: {
                        type: "object",
                        properties: { ok: { type: "boolean" } },
                        required: ["ok"],
                        additionalProperties: false,
                    } as const,
                    approval: { required: true, timeoutMs: 5_000 },
                }).client() as never,
            ] as never,
        });
        const runtime = createRuntime({
            agents: [agent] as const,
        }) as unknown as BetterAgentRuntime;

        const stream = runtime.stream(agent.name, { input: "go" });
        const seenEvents: Event[] = [];
        const consumeEvents = (async () => {
            for await (const event of stream.events) {
                seenEvents.push(event);
            }
        })();

        await waitUntil(() => {
            const toolEvents = seenEvents.filter(isHilClientToolEvent);

            return (
                toolEvents.some((event) => event.type === Events.TOOL_CALL_END) &&
                toolEvents.some(
                    (event) =>
                        event.type === Events.TOOL_APPROVAL_UPDATED && event.state === "requested",
                )
            );
        });

        const toolEvents = seenEvents.filter(isHilClientToolEvent);

        expect(toolEvents.map((event) => event.type)).toEqual([
            Events.TOOL_CALL_START,
            Events.TOOL_CALL_ARGS,
            Events.TOOL_APPROVAL_REQUIRED,
            Events.TOOL_APPROVAL_UPDATED,
            Events.TOOL_CALL_END,
        ]);
        expect(toolEvents[3]).toMatchObject({
            type: Events.TOOL_APPROVAL_UPDATED,
            state: "requested",
        });

        const runStarted = seenEvents.find((event) => event.type === Events.RUN_STARTED);
        const runId = runStarted && "runId" in runStarted ? runStarted.runId : "";
        const approved = await runtime.submitToolApproval({
            runId,
            toolCallId: "call_1",
            decision: "approved",
        });
        expect(approved).toBeTrue();

        await waitUntil(() =>
            seenEvents.some(
                (event) =>
                    event.type === Events.TOOL_APPROVAL_UPDATED && event.state === "approved",
            ),
        );

        const submitted = await submitToolResultEventually(
            runtime,
            {
                runId,
                toolCallId: "call_1",
                status: "success",
                result: { accepted: true },
            },
            1_000,
        );

        expect(submitted).toBeTrue();
        const result = await stream.result;
        await consumeEvents;

        expect(result.response.output).toEqual(createTextResponse("confirmed").output);
    });
});
