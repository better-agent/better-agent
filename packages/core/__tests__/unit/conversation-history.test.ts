import { describe, expect, test } from "bun:test";
import { createMemoryConversationStore } from "../../src/persistence";
import { loadConversationMessages } from "../../src/run/helpers";
import { createRuntime } from "../../src/run/runtime";
import { createTextAgent } from "../helpers/mock-model";

describe("conversation history helpers", () => {
    test("loadConversationMessages skips prepending stored history when replaceHistory is true", async () => {
        const conversations = createMemoryConversationStore();
        await conversations.save({
            conversationId: "conv_1",
            agentName: "assistant",
            items: [{ type: "message", role: "user", content: "stored" }],
        });

        const loaded = await loadConversationMessages({
            conversations,
            conversationId: "conv_1",
            agentName: "assistant",
            input: [{ type: "message", role: "user", content: "fresh" }],
            replaceHistory: true,
        });

        expect(loaded.input).toEqual([{ type: "message", role: "user", content: "fresh" }]);
        expect(loaded.loaded?.cursor).toBe(1);
    });

    test("loadConversationMessages omits unsupported stored parts by default", async () => {
        const conversations = createMemoryConversationStore();
        await conversations.save({
            conversationId: "conv_1",
            agentName: "assistant",
            items: [
                {
                    type: "message",
                    role: "assistant",
                    content: [
                        { type: "text", text: "hello" },
                        {
                            type: "image",
                            source: { kind: "url", url: "https://example.com/a.png" },
                        },
                    ],
                },
            ],
        });

        const loaded = await loadConversationMessages({
            conversations,
            conversationId: "conv_1",
            agentName: "assistant",
            input: [{ type: "message", role: "user", content: "fresh" }],
            caps: {
                inputShape: "chat",
                inputModalities: { text: true, image: false },
                outputModalities: { text: true },
            },
        });

        expect(loaded.input as unknown[]).toEqual([
            {
                type: "message",
                role: "assistant",
                content: [{ type: "text", text: "hello" }],
            },
            { type: "message", role: "user", content: "fresh" },
        ]);
    });

    test("loadConversationMessages can keep unsupported stored parts when omission is disabled", async () => {
        const conversations = createMemoryConversationStore();
        await conversations.save({
            conversationId: "conv_1",
            agentName: "assistant",
            items: [
                {
                    type: "message",
                    role: "assistant",
                    content: [
                        {
                            type: "image",
                            source: { kind: "url", url: "https://example.com/a.png" },
                        },
                    ],
                },
            ],
        });

        const loaded = await loadConversationMessages({
            conversations,
            conversationId: "conv_1",
            agentName: "assistant",
            input: [{ type: "message", role: "user", content: "fresh" }],
            caps: {
                inputShape: "chat",
                inputModalities: { text: true, image: false },
                outputModalities: { text: true },
            },
            conversationReplay: { omitUnsupportedParts: false },
        });

        expect(loaded.input as unknown[]).toEqual([
            {
                type: "message",
                role: "assistant",
                content: [
                    {
                        type: "image",
                        source: { kind: "url", url: "https://example.com/a.png" },
                    },
                ],
            },
            { type: "message", role: "user", content: "fresh" },
        ] as unknown[]);
    });

    test("loadConversationMessages uses prepareInput when provided", async () => {
        const conversations = createMemoryConversationStore();
        await conversations.save({
            conversationId: "conv_1",
            agentName: "assistant",
            items: [{ type: "message", role: "user", content: "stored" }],
        });

        const loaded = await loadConversationMessages({
            conversations,
            conversationId: "conv_1",
            agentName: "assistant",
            input: [{ type: "message", role: "user", content: "fresh" }],
            caps: {
                inputShape: "chat",
                inputModalities: { text: true },
                outputModalities: { text: true },
            },
            conversationReplay: {
                prepareInput: ({ items, caps, agentName, conversationId }) => {
                    expect(items).toEqual([{ type: "message", role: "user", content: "stored" }]);
                    expect(caps.inputModalities?.text).toBe(true);
                    expect(agentName).toBe("assistant");
                    expect(conversationId).toBe("conv_1");
                    return [{ type: "message", role: "system", content: "prepared" }];
                },
            },
        });

        expect(loaded.input).toEqual([
            { type: "message", role: "system", content: "prepared" },
            { type: "message", role: "user", content: "fresh" },
        ]);
    });

    test("createMemoryConversationStore enforces cursor checks", async () => {
        const conversations = createMemoryConversationStore();
        const first = await conversations.save({
            conversationId: "conv_1",
            agentName: "assistant",
            items: [{ type: "message", role: "user", content: "hello" }],
        });

        const loaded = await conversations.load({
            conversationId: "conv_1",
            agentName: "assistant",
        });
        expect(loaded?.cursor).toBe(first.cursor);

        expect(
            conversations.save({
                conversationId: "conv_1",
                agentName: "assistant",
                items: [{ type: "message", role: "user", content: "goodbye" }],
                expectedCursor: 999,
            }),
        ).rejects.toMatchObject({
            message: "Conversation was updated in another session.",
            code: "CONFLICT",
            status: 409,
        });
    });

    test("runtime loadConversation validates stored items", async () => {
        const runtime = createRuntime({
            agents: [createTextAgent()] as const,
            conversations: {
                async load() {
                    return { items: [42] as never[] };
                },
                async save() {
                    return { cursor: 1 };
                },
            },
        });

        expect(runtime.loadConversation("assistant", "conv_1")).rejects.toThrow(
            "Loaded conversation items are invalid.",
        );
    });

    test("runtime loadConversation rejects blank conversation ids", async () => {
        const runtime = createRuntime({
            agents: [createTextAgent()] as const,
            conversations: createMemoryConversationStore(),
        });

        expect(runtime.loadConversation("assistant", "   ")).rejects.toMatchObject({
            code: "VALIDATION_FAILED",
            message: "conversationId must be a non-empty string.",
        });
    });

    test("createMemoryConversationStore isolates histories by agent name", async () => {
        const conversations = createMemoryConversationStore();

        await conversations.save({
            conversationId: "conv_1",
            agentName: "assistant_a",
            items: [{ type: "message", role: "user", content: "from-a" }],
        });

        expect(
            await conversations.load({ conversationId: "conv_1", agentName: "assistant_a" }),
        ).toMatchObject({
            items: [{ type: "message", role: "user", content: "from-a" }],
        });
        expect(
            await conversations.load({ conversationId: "conv_1", agentName: "assistant_b" }),
        ).toBeNull();
    });
});
