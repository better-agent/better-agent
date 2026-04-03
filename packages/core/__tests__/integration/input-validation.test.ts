import { describe, expect, test } from "bun:test";
import { logger } from "@better-agent/shared/logger";
import { betterAgent } from "../../src";
import type { ConversationStore } from "../../src/persistence";
import type { BetterAgentRuntime } from "../../src/run";
import { createRuntime } from "../../src/run";
import { createTextAgent } from "../helpers/mock-model";
import { createStructuredModel, createStructuredTextResponse } from "../helpers/mock-model";

const imageInput = [
    {
        type: "message" as const,
        role: "user" as const,
        content: [
            {
                type: "image" as const,
                source: { kind: "url" as const, url: "https://example.com/image.png" },
            },
        ],
    },
];

const embeddingInput = [
    {
        type: "message" as const,
        role: "assistant" as const,
        content: [{ type: "embedding" as const, embedding: [0.1, 0.2] }],
    },
];

describe("runtime input capability validation", () => {
    test("run rejects unsupported image input for text-only models", async () => {
        const agent = createTextAgent();
        const runtime = createRuntime({ agents: [agent] as const } as Parameters<
            typeof createRuntime
        >[0]) as unknown as BetterAgentRuntime;

        expect(runtime.run(agent.name, { input: imageInput as never })).rejects.toMatchObject({
            code: "VALIDATION_FAILED",
        });
    });

    test("stream rejects unsupported image input before execution starts", async () => {
        const agent = createTextAgent();
        const runtime = createRuntime({ agents: [agent] as const } as Parameters<
            typeof createRuntime
        >[0]) as unknown as BetterAgentRuntime;

        const stream = runtime.stream(agent.name, { input: imageInput as never });
        expect(stream.result).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    });

    test("run rejects unsupported stored replay parts when omission is disabled", async () => {
        const agent = createTextAgent();
        const conversations: ConversationStore = {
            async load() {
                return { items: imageInput as never, cursor: "cursor_1" };
            },
            async save() {
                throw new Error("save should not be called when validation fails");
            },
        };
        const runtime = createRuntime({
            agents: [agent] as const,
            conversations,
        } as Parameters<typeof createRuntime>[0]) as unknown as BetterAgentRuntime;

        await expect(
            runtime.run(agent.name, {
                input: "hello",
                conversationId: "conv_1",
                conversationReplay: { omitUnsupportedParts: false },
            }),
        ).rejects.toMatchObject({
            code: "VALIDATION_FAILED",
        });
    });

    test("agent-level conversationReplay defaults apply to stored history replay", async () => {
        const agent = createTextAgent({
            conversationReplay: { omitUnsupportedParts: false },
        });
        const conversations: ConversationStore = {
            async load() {
                return { items: imageInput as never, cursor: "cursor_1" };
            },
            async save() {
                throw new Error("save should not be called when validation fails");
            },
        };
        const runtime = createRuntime({
            agents: [agent] as const,
            conversations,
        } as Parameters<typeof createRuntime>[0]) as unknown as BetterAgentRuntime;

        await expect(
            runtime.run(agent.name, { input: "hello", conversationId: "conv_1" }),
        ).rejects.toMatchObject({
            code: "VALIDATION_FAILED",
        });
    });

    test("run-level conversationReplay overrides the agent default", async () => {
        const agent = createTextAgent({
            conversationReplay: { omitUnsupportedParts: false },
        });
        const conversations: ConversationStore = {
            async load() {
                return { items: imageInput as never, cursor: "cursor_1" };
            },
            async save() {
                return { cursor: "cursor_2" };
            },
        };
        const runtime = createRuntime({
            agents: [agent] as const,
            conversations,
        } as Parameters<typeof createRuntime>[0]) as unknown as BetterAgentRuntime;

        await expect(
            runtime.run(agent.name, {
                input: "hello",
                conversationId: "conv_1",
                conversationReplay: { omitUnsupportedParts: true },
            }),
        ).resolves.toBeDefined();
    });

    test("run rejects unsupported embedding replay parts when omission is disabled", async () => {
        const agent = createTextAgent({
            model: {
                ...createTextAgent().model,
                caps: {
                    inputShape: "chat",
                    inputModalities: {
                        text: true,
                        image: false,
                        audio: false,
                        video: false,
                        file: false,
                        embedding: false,
                    },
                    outputModalities: { text: true },
                },
            },
        });
        const conversations: ConversationStore = {
            async load() {
                return { items: embeddingInput as never, cursor: "cursor_1" };
            },
            async save() {
                throw new Error("save should not be called when validation fails");
            },
        };
        const runtime = createRuntime({
            agents: [agent] as const,
            conversations,
        } as Parameters<typeof createRuntime>[0]) as unknown as BetterAgentRuntime;

        await expect(
            runtime.run(agent.name, {
                input: "hello",
                conversationId: "conv_1",
                conversationReplay: { omitUnsupportedParts: false },
            }),
        ).rejects.toMatchObject({
            code: "VALIDATION_FAILED",
        });
    });

    test("run rejects malformed conversationReplay.prepareInput output", async () => {
        const agent = createTextAgent();
        const conversations: ConversationStore = {
            async load() {
                return {
                    items: [{ type: "message", role: "user", content: "stored" }],
                    cursor: "c1",
                };
            },
            async save() {
                throw new Error("save should not be called when validation fails");
            },
        };
        const runtime = createRuntime({
            agents: [agent] as const,
            conversations,
        } as Parameters<typeof createRuntime>[0]) as unknown as BetterAgentRuntime;

        await expect(
            runtime.run(agent.name, {
                input: "hello",
                conversationId: "conv_1",
                conversationReplay: {
                    prepareInput: () =>
                        ({ type: "message", role: "user", content: "bad" }) as never,
                },
            }),
        ).rejects.toThrow(
            "conversationReplay.prepareInput must return a valid array of model input items.",
        );
    });

    test("run-level null prepareInput disables an inherited agent replay hook", async () => {
        const agent = createTextAgent({
            conversationReplay: {
                prepareInput: () => [{ type: "message", role: "system", content: "blocked" }],
            },
        });
        const conversations: ConversationStore = {
            async load() {
                return { items: imageInput as never, cursor: "cursor_1" };
            },
            async save() {
                return { cursor: "cursor_2" };
            },
        };
        const runtime = createRuntime({
            agents: [agent] as const,
            conversations,
        } as Parameters<typeof createRuntime>[0]) as unknown as BetterAgentRuntime;

        await expect(
            runtime.run(agent.name, {
                input: "hello",
                conversationId: "conv_1",
                conversationReplay: {
                    prepareInput: null,
                    omitUnsupportedParts: true,
                },
            }),
        ).resolves.toBeDefined();
    });

    test("run rejects role-less messages from prepareInput for chat-shaped models", async () => {
        const agent = createTextAgent();
        const conversations: ConversationStore = {
            async load() {
                return {
                    items: [{ type: "message", role: "user", content: "stored" }],
                    cursor: "c1",
                };
            },
            async save() {
                throw new Error("save should not be called when validation fails");
            },
        };
        const runtime = createRuntime({
            agents: [agent] as const,
            conversations,
        } as Parameters<typeof createRuntime>[0]) as unknown as BetterAgentRuntime;

        await expect(
            runtime.run(agent.name, {
                input: "hello",
                conversationId: "conv_1",
                conversationReplay: {
                    prepareInput: () => [{ type: "message", content: "bad" }] as never,
                },
            }),
        ).rejects.toThrow(
            "conversationReplay.prepareInput returned a role-less message for a chat-shaped model.",
        );
    });

    test("run rejects role-bearing messages from prepareInput for prompt-shaped models", async () => {
        const agent = createTextAgent({
            model: {
                ...createTextAgent().model,
                caps: {
                    inputShape: "prompt",
                    replayMode: "multi_turn",
                    inputModalities: { text: true },
                    outputModalities: { text: true },
                },
            },
        });
        const conversations: ConversationStore = {
            async load() {
                return {
                    items: [{ type: "message", role: "user", content: "stored" }],
                    cursor: "c1",
                };
            },
            async save() {
                throw new Error("save should not be called when validation fails");
            },
        };
        const runtime = createRuntime({
            agents: [agent] as const,
            conversations,
        } as Parameters<typeof createRuntime>[0]) as unknown as BetterAgentRuntime;

        await expect(
            runtime.run(agent.name, {
                input: "hello",
                conversationId: "conv_1",
                conversationReplay: {
                    prepareInput: () =>
                        [{ type: "message", role: "user", content: "bad" }] as never,
                },
            }),
        ).rejects.toThrow(
            "conversationReplay.prepareInput returned a role-bearing message for a prompt-shaped model.",
        );
    });

    test("run rejects unsupported output modalities before execution starts", async () => {
        const agent = createTextAgent();
        const runtime = createRuntime({ agents: [agent] as const } as Parameters<
            typeof createRuntime
        >[0]) as unknown as BetterAgentRuntime;

        await expect(
            runtime.run(agent.name, {
                input: "hello",
                modalities: ["image"] as never,
            }),
        ).rejects.toMatchObject({
            code: "VALIDATION_FAILED",
        });
    });

    test("run warns when conversationReplay is provided for a non-multi-turn model", async () => {
        const warnMessages: string[] = [];
        const originalWarn = logger.warn;
        logger.warn = (message) => {
            warnMessages.push(String(message));
        };

        try {
            const agent = createTextAgent({
                model: {
                    ...createTextAgent().model,
                    caps: {
                        inputShape: "prompt",
                        inputModalities: { text: true },
                        outputModalities: { text: true },
                    },
                },
            });
            const runtime = createRuntime({
                agents: [agent] as const,
            } as Parameters<typeof createRuntime>[0]) as unknown as BetterAgentRuntime;

            await runtime.run(agent.name, {
                input: "hello",
                conversationReplay: { omitUnsupportedParts: false },
            });

            expect(warnMessages).toHaveLength(1);
            expect(warnMessages[0]).toContain("conversationReplay was provided");
            expect(warnMessages[0]).toContain("single_turn_persistent");
        } finally {
            logger.warn = originalWarn;
        }
    });

    test("betterAgent rejects malformed agent definitions up front", () => {
        expect(() =>
            betterAgent({
                agents: [
                    {
                        name: "structured",
                        model: createStructuredModel([createStructuredTextResponse('{"ok":true}')]),
                        outputSchema: {
                            schema: {
                                type: 123,
                            },
                        },
                    } as never,
                ] as const,
            }),
        ).toThrow();
    });
});
