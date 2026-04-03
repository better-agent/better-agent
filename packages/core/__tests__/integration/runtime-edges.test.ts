import { describe, expect, test } from "bun:test";
import { ok } from "@better-agent/shared/neverthrow";
import { Events } from "../../src/events";
import {
    type ConversationStore,
    createMemoryConversationRuntimeStateStore,
    createMemoryStreamStore,
} from "../../src/persistence";
import type { BetterAgentRuntime } from "../../src/run";
import { createRuntime } from "../../src/run";
import { collectEvents, createTextAgent } from "../helpers/mock-model";

describe("runtime edge cases", () => {
    test("hosted tool in run loop throws NOT_IMPLEMENTED", async () => {
        const agent = createTextAgent({
            model: {
                ...createTextAgent().model,
                async doGenerate() {
                    return ok({
                        response: {
                            output: [
                                {
                                    type: "tool-call" as const,
                                    callId: "call_1",
                                    name: "lookup",
                                    arguments: "{}",
                                },
                            ],
                            finishReason: "stop" as const,
                            usage: {},
                        },
                    });
                },
            },
            tools: [
                {
                    kind: "hosted",
                    provider: "test",
                    type: "lookup",
                    config: {},
                } as never,
            ] as never,
        });
        const runtime = createRuntime({
            agents: [agent] as const,
        }) as unknown as BetterAgentRuntime;

        expect(runtime.run(agent.name, { input: "hello" })).rejects.toMatchObject({
            code: "NOT_IMPLEMENTED",
        });
    });

    test("duplicate app and agent tool names are rejected", async () => {
        const sharedTool = {
            kind: "server",
            name: "shared",
            schema: { type: "object", properties: {}, additionalProperties: false },
            handler: async () => null,
            ["json_schema" as never]: {
                type: "object",
                properties: {},
                additionalProperties: false,
            },
        } as never;
        const agent = createTextAgent({ tools: [sharedTool] as never });

        const runtime = createRuntime({
            agents: [agent] as const,
        }) as unknown as BetterAgentRuntime;

        expect(
            runtime.run(agent.name, {
                input: "hello",
            }),
        ).resolves.toBeDefined();
    });

    test("run fails when saving conversation history fails", async () => {
        const conversations: ConversationStore = {
            async load() {
                return null;
            },
            async save() {
                throw new Error("db down");
            },
        };
        const agent = createTextAgent();
        const runtime = createRuntime({
            agents: [agent] as const,
            conversations,
        }) as unknown as BetterAgentRuntime;
        const { events, onEvent } = collectEvents();

        expect(
            runtime.run(agent.name, {
                input: "hello",
                conversationId: "conv_1",
                onEvent,
            }),
        ).rejects.toMatchObject({
            code: "INTERNAL",
        });

        expect(events.map((event) => event.type)).toContain(Events.RUN_ERROR);
        expect(events.map((event) => event.type)).not.toContain(Events.RUN_FINISHED);
    });

    test("resumeConversation returns events for an active conversation stream", async () => {
        const stream = createMemoryStreamStore();
        await stream.open("stream_1", { runId: "run_1" });
        await stream.append("stream_1", {
            type: Events.RUN_STARTED,
            runId: "run_1",
            agentName: "assistant",
            runInput: { input: "hello" },
            timestamp: 1,
            seq: 0,
        });
        await stream.close("stream_1");

        const runtimeState = createMemoryConversationRuntimeStateStore();
        await runtimeState.set({
            conversationId: "conv_1",
            agentName: "assistant",
            activeRunId: "run_1",
            activeStreamId: "stream_1",
            status: "running",
            updatedAt: Date.now(),
        });

        const runtime = createRuntime({
            agents: [createTextAgent()] as const,
            stream,
            runtimeState,
        }) as unknown as BetterAgentRuntime;

        const resumed = await runtime.resumeConversation("assistant", {
            conversationId: "conv_1",
        });

        const events = [];
        if (resumed) {
            for await (const event of resumed) {
                events.push(event);
            }
        }
        expect(events).toHaveLength(1);
        expect(events[0]).toMatchObject({
            type: Events.RUN_STARTED,
            runId: "run_1",
            seq: 0,
        });
    });

    test("resumeConversation returns null once runtime state is terminal", async () => {
        const runtimeState = createMemoryConversationRuntimeStateStore();
        await runtimeState.set({
            conversationId: "conv_1",
            agentName: "assistant",
            activeRunId: "run_1",
            activeStreamId: "stream_1",
            status: "finished",
            updatedAt: Date.now(),
        });

        const runtime = createRuntime({
            agents: [createTextAgent()] as const,
            stream: createMemoryStreamStore(),
            runtimeState,
        }) as unknown as BetterAgentRuntime;

        expect(
            runtime.resumeConversation("assistant", { conversationId: "conv_1" }),
        ).resolves.toBeNull();
    });

    test("resumeStream rejects blank stream ids", async () => {
        const runtime = createRuntime({
            agents: [createTextAgent()] as const,
            stream: createMemoryStreamStore(),
        }) as unknown as BetterAgentRuntime;

        expect(runtime.resumeStream({ streamId: "   " })).rejects.toMatchObject({
            code: "VALIDATION_FAILED",
            message: "streamId must be a non-empty string.",
        });
    });
});
