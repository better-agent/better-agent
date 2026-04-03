import { describe, expect, test } from "bun:test";
import { ok } from "@better-agent/shared/neverthrow";
import { type ConversationStore, createMemoryConversationStore } from "../../src/persistence";
import type { BetterAgentRuntime } from "../../src/run";
import { createRuntime } from "../../src/run";
import { createScriptedModel, createTextAgent, createTextResponse } from "../helpers/mock-model";

describe("conversation persistence", () => {
    test("run loads existing conversation and saves merged items", async () => {
        let savedItems: unknown[] = [];
        const conversations: ConversationStore = {
            async load({ agentName }) {
                expect(agentName).toBe("assistant");
                return {
                    items: [{ type: "message", role: "user", content: "history" }],
                    cursor: "cursor_1",
                };
            },
            async save(params) {
                expect(params.agentName).toBe("assistant");
                savedItems = params.items;
                return { cursor: "cursor_2" };
            },
        };

        const agent = createTextAgent({
            model: createScriptedModel([createTextResponse("reply")]),
        });
        const runtime = createRuntime({
            agents: [agent] as const,
            conversations,
        }) as unknown as BetterAgentRuntime;

        await runtime.run(agent.name, {
            input: "hello",
            conversationId: "conv_1",
        });

        expect(JSON.stringify(savedItems)).toContain("history");
        expect(JSON.stringify(savedItems)).toContain("reply");
    });

    test("continued runs preserve durable-only loaded items while replaying rich provider input", async () => {
        let savedItems: unknown[] = [];
        const seenInputs: unknown[] = [];
        const conversations: ConversationStore = {
            async load() {
                return {
                    items: [
                        { type: "message", role: "user", content: "history" },
                        {
                            type: "message",
                            role: "assistant",
                            content: [
                                { type: "text", text: "here is the chart" },
                                {
                                    type: "image",
                                    source: { kind: "url", url: "https://example.com/chart.png" },
                                },
                                { type: "embedding", embedding: [0.1, 0.2] },
                            ],
                        },
                        {
                            type: "provider-tool-result",
                            name: "search",
                            callId: "call_1",
                            result: { ok: true },
                        },
                    ],
                    cursor: "cursor_1",
                };
            },
            async save(params) {
                savedItems = params.items;
                return { cursor: "cursor_2" };
            },
        };

        const agent = createTextAgent({
            model: {
                providerId: "test",
                modelId: "history-preservation",
                caps: {
                    inputShape: "chat",
                    inputModalities: {
                        text: true,
                        image: true,
                        audio: false,
                        video: false,
                        file: false,
                    },
                    outputModalities: { text: true },
                },
                async doGenerate(options: { input: unknown }) {
                    seenInputs.push(options.input);
                    return ok({ response: createTextResponse("reply") });
                },
            },
        });
        const runtime = createRuntime({
            agents: [agent] as const,
            conversations,
        }) as unknown as BetterAgentRuntime;

        await runtime.run(agent.name, {
            input: "hello",
            conversationId: "conv_1",
        });

        expect(savedItems as unknown[]).toEqual([
            { type: "message", role: "user", content: "history" },
            {
                type: "message",
                role: "assistant",
                content: [
                    { type: "text", text: "here is the chart" },
                    {
                        type: "image",
                        source: { kind: "url", url: "https://example.com/chart.png" },
                    },
                    { type: "embedding", embedding: [0.1, 0.2] },
                ],
            },
            {
                type: "provider-tool-result",
                name: "search",
                callId: "call_1",
                result: { ok: true },
            },
            { type: "message", role: "user", content: "hello" },
            { type: "message", role: "assistant", content: "reply" },
        ]);
        expect(seenInputs).toEqual([
            [
                { type: "message", role: "user", content: "history" },
                {
                    type: "message",
                    role: "assistant",
                    content: [
                        { type: "text", text: "here is the chart" },
                        {
                            type: "image",
                            source: { kind: "url", url: "https://example.com/chart.png" },
                        },
                    ],
                },
                {
                    type: "provider-tool-result",
                    name: "search",
                    callId: "call_1",
                    result: { ok: true },
                },
                { type: "message", role: "user", content: "hello" },
            ],
        ]);
    });

    test("continued runs prune unsupported stored replay parts by default", async () => {
        const seenInputs: unknown[] = [];
        const conversations: ConversationStore = {
            async load() {
                return {
                    items: [
                        {
                            type: "message",
                            role: "assistant",
                            content: [
                                { type: "text", text: "here is the chart" },
                                {
                                    type: "image",
                                    source: { kind: "url", url: "https://example.com/chart.png" },
                                },
                            ],
                        },
                    ],
                    cursor: "cursor_1",
                };
            },
            async save(params) {
                return { cursor: params.expectedCursor ?? "cursor_2" };
            },
        };

        const agent = createTextAgent({
            model: {
                providerId: "test",
                modelId: "text-only-replay-prune",
                caps: {
                    inputShape: "chat",
                    inputModalities: {
                        text: true,
                        image: false,
                        audio: false,
                        video: false,
                        file: false,
                    },
                    outputModalities: { text: true },
                },
                async doGenerate(options: { input: unknown }) {
                    seenInputs.push(options.input);
                    return ok({ response: createTextResponse("reply") });
                },
            },
        });
        const runtime = createRuntime({
            agents: [agent] as const,
            conversations,
        }) as unknown as BetterAgentRuntime;

        await runtime.run(agent.name, {
            input: "hello",
            conversationId: "conv_1",
        });

        expect(seenInputs).toEqual([
            [
                {
                    type: "message",
                    role: "assistant",
                    content: [{ type: "text", text: "here is the chart" }],
                },
                { type: "message", role: "user", content: "hello" },
            ],
        ]);
    });

    test("single-turn-persistent prompt models save history without replaying prior conversation", async () => {
        let savedItems: unknown[] = [];
        const seenInputs: unknown[] = [];
        const conversations: ConversationStore = {
            async load() {
                return {
                    items: [
                        { type: "message", role: "user", content: "older prompt" },
                        {
                            type: "message",
                            role: "assistant",
                            content: [
                                {
                                    type: "image",
                                    source: { kind: "url", url: "https://example.com/poster.png" },
                                },
                            ],
                        },
                    ],
                    cursor: "cursor_1",
                };
            },
            async save(params) {
                savedItems = params.items;
                return { cursor: "cursor_2" };
            },
        };

        const agent = createTextAgent({
            model: {
                providerId: "test",
                modelId: "prompt-image-like",
                caps: {
                    inputShape: "prompt",
                    replayMode: "single_turn_persistent",
                    supportsInstruction: false,
                    inputModalities: { text: true, image: true },
                    outputModalities: { image: true },
                },
                async doGenerate(options: { input: unknown }) {
                    seenInputs.push(options.input);
                    return ok({
                        response: {
                            output: [
                                {
                                    type: "message",
                                    role: "assistant",
                                    content: [
                                        {
                                            type: "image",
                                            source: {
                                                kind: "url",
                                                url: "https://example.com/new-poster.png",
                                            },
                                        },
                                    ],
                                },
                            ],
                            finishReason: "stop",
                            usage: {},
                        },
                    });
                },
            },
        });
        const runtime = createRuntime({
            agents: [agent] as const,
            conversations,
        }) as unknown as BetterAgentRuntime;

        await runtime.run(agent.name, {
            input: "make it blue",
            conversationId: "poster_1",
        });

        expect(seenInputs).toEqual([[{ type: "message", content: "make it blue" }]]);
        expect(savedItems as unknown[]).toEqual([
            { type: "message", role: "user", content: "older prompt" },
            {
                type: "message",
                role: "assistant",
                content: [
                    {
                        type: "image",
                        source: { kind: "url", url: "https://example.com/poster.png" },
                    },
                ],
            },
            { type: "message", role: "user", content: "make it blue" },
            {
                type: "message",
                role: "assistant",
                content: [
                    {
                        type: "image",
                        source: { kind: "url", url: "https://example.com/new-poster.png" },
                    },
                ],
            },
        ]);
    });

    test("different agents do not share conversation history for the same conversationId", async () => {
        const agentA = createTextAgent({
            name: "assistant-a",
            model: createScriptedModel([createTextResponse("reply-a")]),
        });
        const agentB = createTextAgent({
            name: "assistant-b",
            model: createScriptedModel([createTextResponse("reply-b")]),
        });
        const runtime = createRuntime({
            agents: [agentA, agentB] as const,
            conversations: createMemoryConversationStore(),
        }) as unknown as BetterAgentRuntime;

        await runtime.run(agentA.name, {
            input: "hello from a",
            conversationId: "shared",
        });

        expect(await runtime.loadConversation("assistant-a", "shared")).not.toBeNull();
        expect(await runtime.loadConversation("assistant-b", "shared")).toBeNull();

        await runtime.run(agentB.name, {
            input: "hello from b",
            conversationId: "shared",
        });

        expect(JSON.stringify(await runtime.loadConversation("assistant-a", "shared"))).toContain(
            "reply-a",
        );
        expect(
            JSON.stringify(await runtime.loadConversation("assistant-a", "shared")),
        ).not.toContain("reply-b");
        expect(JSON.stringify(await runtime.loadConversation("assistant-b", "shared"))).toContain(
            "reply-b",
        );
    });
});
