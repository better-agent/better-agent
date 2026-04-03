import "./setup";
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, test } from "node:test";
import type { RunResult } from "@better-agent/core";
import { JSDOM } from "jsdom";
import { h, render as preactRender } from "preact";
import { act as preactAct } from "preact/test-utils";
import { act as reactAct } from "react";
import { type Root as ReactRoot, createRoot as createReactRoot } from "react-dom/client";
import { createSignal, createRoot as createSolidRoot } from "solid-js";
import { useAgent as usePreactAgent } from "../src/preact/useAgent";
import { useAgent as useReactAgent } from "../src/react/useAgent";
import { useAgent as useSolidAgent } from "../src/solid/useAgent";
import { createAgentChat } from "../src/svelte/createAgentChat";
import type { BetterAgentClient } from "../src/types/client";
import type { UIMessage } from "../src/types/ui";

const createRunResult = (overrides?: Record<string, unknown>): RunResult =>
    ({
        response: {
            output: [],
            finishReason: "stop",
            usage: {},
        },
        ...(overrides ?? {}),
    }) as RunResult;

const createMockClient = (options?: { runError?: Error }) => {
    const runCalls: Array<{
        agent: string;
        input: Record<string, unknown>;
    }> = [];
    const resumeStreamCalls: Array<{
        agent: string;
        input: Record<string, unknown>;
    }> = [];
    const resumeConversationCalls: Array<{
        agent: string;
        input: Record<string, unknown>;
    }> = [];
    const submitToolApprovalCalls: Array<Record<string, unknown>> = [];

    const client: BetterAgentClient = {
        async run(agent, input) {
            runCalls.push({
                agent: String(agent),
                input: input as Record<string, unknown>,
            });
            if (options?.runError) {
                throw options.runError;
            }
            return createRunResult();
        },
        stream() {
            throw new Error("Not used in this test.");
        },
        resumeStream(agent, input) {
            resumeStreamCalls.push({
                agent: String(agent),
                input: input as Record<string, unknown>,
            });
            return {
                async next() {
                    return { done: true, value: undefined as never };
                },
                [Symbol.asyncIterator]() {
                    return this;
                },
            } as AsyncIterableIterator<never>;
        },
        resumeConversation(agent, input) {
            resumeConversationCalls.push({
                agent: String(agent),
                input: input as Record<string, unknown>,
            });
            return {
                async next() {
                    return { done: true, value: undefined as never };
                },
                [Symbol.asyncIterator]() {
                    return this;
                },
            } as AsyncIterableIterator<never>;
        },
        async submitToolResult() {},
        async submitToolApproval(input) {
            submitToolApprovalCalls.push(input as unknown as Record<string, unknown>);
        },
        async abortRun() {},
    } as BetterAgentClient;

    return {
        client,
        runCalls,
        resumeStreamCalls,
        resumeConversationCalls,
        submitToolApprovalCalls,
    };
};

const waitForTask = () => new Promise((resolve) => setTimeout(resolve, 10));

type SnapshotLike = {
    messages: UIMessage[];
    status: string;
    error?: Error | { message?: string } | undefined;
    pendingToolApprovals: unknown[];
};

type MountedAgent = {
    read(): SnapshotLike;
    sendMessage(input: string): Promise<void>;
    regenerate(): Promise<void>;
    retryMessage(localId: string): Promise<void>;
    resumeStream(input: { streamId: string; afterSeq?: number }): Promise<void>;
    resumeConversation(input?: { afterSeq?: number }): Promise<void>;
    approveToolCall(input: {
        toolCallId: string;
        decision: "approved" | "denied";
        runId: string;
    }): Promise<void>;
    clearError(): void;
    setMessages(input: UIMessage[]): void;
    update(params: {
        client?: BetterAgentClient;
        options?: Record<string, unknown>;
    }): Promise<void>;
    destroy(): Promise<void>;
};

type Adapter = {
    name: string;
    mount(params: {
        client: BetterAgentClient;
        options?: Record<string, unknown>;
    }): Promise<MountedAgent>;
};

describe("framework parity", () => {
    let dom: JSDOM;
    let reactContainer: HTMLDivElement;
    let preactContainer: HTMLDivElement;
    let previousWindow: typeof globalThis.window | undefined;
    let previousDocument: typeof globalThis.document | undefined;
    let previousNavigator: typeof globalThis.navigator | undefined;
    let previousElement: typeof globalThis.Element | undefined;
    let previousHTMLElement: typeof globalThis.HTMLElement | undefined;
    let previousSVGElement: typeof globalThis.SVGElement | undefined;
    const testGlobal = globalThis as typeof globalThis & {
        IS_REACT_ACT_ENVIRONMENT?: boolean;
    };

    const adapters: Adapter[] = [
        {
            name: "react",
            async mount({ client, options }) {
                let agent: ReturnType<typeof useReactAgent> | null = null;
                let root: ReactRoot | null = createReactRoot(reactContainer);
                let currentClient = client;
                let currentOptions = options ?? {};

                function Harness() {
                    agent = useReactAgent(currentClient, {
                        agent: "support",
                        delivery: "final",
                        ...currentOptions,
                    } as never);
                    return null;
                }

                await reactAct(async () => {
                    if (!root) {
                        throw new Error("React root is not available.");
                    }
                    root.render(<Harness />);
                });

                return {
                    read: () => ({
                        messages: agent?.messages ?? [],
                        status: agent?.status ?? "ready",
                        error: agent?.error,
                        pendingToolApprovals: agent?.pendingToolApprovals ?? [],
                    }),
                    sendMessage: async (input) => {
                        await reactAct(async () => {
                            await agent?.sendMessage(input);
                        });
                    },
                    regenerate: async () => {
                        await reactAct(async () => {
                            await agent?.regenerate();
                        });
                    },
                    retryMessage: async (localId) => {
                        await reactAct(async () => {
                            await agent?.retryMessage(localId);
                        });
                    },
                    resumeStream: async (input) => {
                        await reactAct(async () => {
                            await agent?.resumeStream(input);
                        });
                    },
                    resumeConversation: async (input) => {
                        await reactAct(async () => {
                            await agent?.resumeConversation(input);
                        });
                    },
                    approveToolCall: async (input) => {
                        await reactAct(async () => {
                            await agent?.approveToolCall(input as never);
                        });
                    },
                    clearError: () => {
                        reactAct(() => {
                            agent?.clearError();
                        });
                    },
                    setMessages: (input) => {
                        reactAct(() => {
                            agent?.setMessages(input);
                        });
                    },
                    update: async ({ client: nextClient, options: nextOptions }) => {
                        if (nextClient) {
                            currentClient = nextClient;
                        }
                        if (nextOptions) {
                            currentOptions = nextOptions;
                        }
                        await reactAct(async () => {
                            if (!root) {
                                throw new Error("React root is not available.");
                            }
                            root.render(<Harness />);
                        });
                    },
                    destroy: async () => {
                        const currentRoot = root;
                        if (!currentRoot) return;
                        await reactAct(async () => {
                            currentRoot.unmount();
                        });
                        root = null;
                    },
                };
            },
        },
        {
            name: "preact",
            async mount({ client, options }) {
                let agent: ReturnType<typeof usePreactAgent> | null = null;
                let currentClient = client;
                let currentOptions = options ?? {};

                function Harness() {
                    agent = usePreactAgent(currentClient, {
                        agent: "support",
                        delivery: "final",
                        ...currentOptions,
                    } as never);
                    return null;
                }

                await preactAct(async () => {
                    preactRender(h(Harness, {}), preactContainer);
                });

                return {
                    read: () => ({
                        messages: agent?.messages ?? [],
                        status: agent?.status ?? "ready",
                        error: agent?.error,
                        pendingToolApprovals: agent?.pendingToolApprovals ?? [],
                    }),
                    sendMessage: async (input) => {
                        await preactAct(async () => {
                            await agent?.sendMessage(input);
                        });
                    },
                    regenerate: async () => {
                        await preactAct(async () => {
                            await agent?.regenerate();
                        });
                    },
                    retryMessage: async (localId) => {
                        await preactAct(async () => {
                            await agent?.retryMessage(localId);
                        });
                    },
                    resumeStream: async (input) => {
                        await preactAct(async () => {
                            await agent?.resumeStream(input);
                        });
                    },
                    resumeConversation: async (input) => {
                        await preactAct(async () => {
                            await agent?.resumeConversation(input);
                        });
                    },
                    approveToolCall: async (input) => {
                        await preactAct(async () => {
                            await agent?.approveToolCall(input as never);
                        });
                    },
                    clearError: () => {
                        preactAct(() => {
                            agent?.clearError();
                        });
                    },
                    setMessages: (input) => {
                        preactAct(() => {
                            agent?.setMessages(input);
                        });
                    },
                    update: async ({ client: nextClient, options: nextOptions }) => {
                        if (nextClient) {
                            currentClient = nextClient;
                        }
                        if (nextOptions) {
                            currentOptions = nextOptions;
                        }
                        await preactAct(async () => {
                            preactRender(h(Harness, {}), preactContainer);
                        });
                    },
                    destroy: async () => {
                        await preactAct(async () => {
                            preactRender(null, preactContainer);
                        });
                    },
                };
            },
        },
        {
            name: "vue",
            async mount({ client, options }) {
                const { createApp, defineComponent, h, nextTick, ref } = await import("vue");
                const { useAgent } = await import("../src/vue/useAgent");
                let agent: ReturnType<typeof useAgent> | undefined;
                const clientRef = ref(client);
                const optionsRef = ref<Record<string, unknown>>({
                    agent: "support",
                    delivery: "final",
                    ...(options ?? {}),
                });
                const app = createApp(
                    defineComponent({
                        setup() {
                            agent = useAgent(clientRef, optionsRef as never);
                            return () => h("div");
                        },
                    }),
                );
                const container = document.createElement("div");
                app.mount(container);
                await nextTick();

                return {
                    read: () => ({
                        messages: agent?.messages.value ?? [],
                        status: agent?.status.value ?? "ready",
                        error: agent?.error.value,
                        pendingToolApprovals: agent?.pendingToolApprovals.value ?? [],
                    }),
                    sendMessage: async (input) => {
                        await agent?.sendMessage(input);
                        await nextTick();
                    },
                    regenerate: async () => {
                        await agent?.regenerate();
                        await nextTick();
                    },
                    retryMessage: async (localId) => {
                        await agent?.retryMessage(localId);
                        await nextTick();
                    },
                    resumeStream: async (input) => {
                        await agent?.resumeStream(input);
                        await nextTick();
                    },
                    resumeConversation: async (input) => {
                        await agent?.resumeConversation(input);
                        await nextTick();
                    },
                    approveToolCall: async (input) => {
                        await agent?.approveToolCall(input as never);
                        await nextTick();
                    },
                    clearError: () => {
                        agent?.clearError();
                    },
                    setMessages: (input) => {
                        agent?.setMessages(input);
                    },
                    update: async ({ client: nextClient, options: nextOptions }) => {
                        if (nextClient) {
                            clientRef.value = nextClient;
                        }
                        if (nextOptions) {
                            optionsRef.value = {
                                agent: "support",
                                delivery: "final",
                                ...nextOptions,
                            };
                        }
                        await nextTick();
                    },
                    destroy: async () => {
                        app.unmount();
                        await nextTick();
                    },
                };
            },
        },
        {
            name: "solid",
            async mount({ client, options }) {
                let agent: ReturnType<typeof useSolidAgent> | undefined;
                let setClient!: (client: BetterAgentClient) => void;
                let setOptions!: (options: Record<string, unknown>) => void;

                const dispose = createSolidRoot((dispose) => {
                    const [clientSignal, updateClient] = createSignal(client);
                    const [optionsSignal, updateOptions] = createSignal({
                        agent: "support",
                        delivery: "final",
                        ...(options ?? {}),
                    } as never);
                    setClient = updateClient;
                    setOptions = updateOptions;
                    agent = useSolidAgent(clientSignal, optionsSignal);
                    return dispose;
                });

                await Promise.resolve();

                return {
                    read: () => ({
                        messages: agent?.messages() ?? [],
                        status: agent?.status() ?? "ready",
                        error: agent?.error(),
                        pendingToolApprovals: agent?.pendingToolApprovals() ?? [],
                    }),
                    sendMessage: async (input) => {
                        await agent?.sendMessage(input);
                    },
                    regenerate: async () => {
                        await agent?.regenerate();
                    },
                    retryMessage: async (localId) => {
                        await agent?.retryMessage(localId);
                    },
                    resumeStream: async (input) => {
                        await agent?.resumeStream(input);
                    },
                    resumeConversation: async (input) => {
                        await agent?.resumeConversation(input);
                    },
                    approveToolCall: async (input) => {
                        await agent?.approveToolCall(input as never);
                    },
                    clearError: () => {
                        agent?.clearError();
                    },
                    setMessages: (input) => {
                        agent?.setMessages(input);
                    },
                    update: async ({ client: nextClient, options: nextOptions }) => {
                        if (nextClient) {
                            setClient(nextClient);
                        }
                        if (nextOptions) {
                            setOptions({
                                agent: "support",
                                delivery: "final",
                                ...nextOptions,
                            } as never);
                        }
                        await Promise.resolve();
                    },
                    destroy: async () => {
                        dispose();
                    },
                };
            },
        },
        {
            name: "svelte",
            async mount({ client, options }) {
                const agent = createAgentChat(client, {
                    agent: "support",
                    delivery: "final",
                    ...(options ?? {}),
                } as never);
                let snapshot: SnapshotLike = {
                    messages: [] as UIMessage[],
                    status: "ready",
                    error: undefined,
                    pendingToolApprovals: [],
                };
                const unsubscribe = agent.subscribe((value) => {
                    snapshot = {
                        messages: value.messages,
                        status: value.status,
                        error: value.error,
                        pendingToolApprovals: value.pendingToolApprovals,
                    };
                });

                return {
                    read: () => snapshot,
                    sendMessage: async (input) => {
                        await agent.sendMessage(input);
                    },
                    regenerate: async () => {
                        await agent.regenerate();
                    },
                    retryMessage: async (localId) => {
                        await agent.retryMessage(localId);
                    },
                    resumeStream: async (input) => {
                        await agent.resumeStream(input);
                    },
                    resumeConversation: async (input) => {
                        await agent.resumeConversation(input);
                    },
                    approveToolCall: async (input) => {
                        await agent.approveToolCall(input as never);
                    },
                    clearError: () => {
                        agent.clearError();
                    },
                    setMessages: (input) => {
                        agent.setMessages(input);
                    },
                    update: async ({ client: nextClient, options: nextOptions }) => {
                        if (nextClient) {
                            agent.updateClient(nextClient);
                        }
                        if (nextOptions) {
                            agent.updateOptions(nextOptions as never);
                        }
                    },
                    destroy: async () => {
                        unsubscribe();
                    },
                };
            },
        },
    ];

    beforeEach(() => {
        previousWindow = globalThis.window;
        previousDocument = globalThis.document;
        previousNavigator = globalThis.navigator;
        previousElement = globalThis.Element;
        previousHTMLElement = globalThis.HTMLElement;
        previousSVGElement = globalThis.SVGElement;
        dom = new JSDOM("<!doctype html><html><body></body></html>");
        globalThis.window = dom.window as unknown as typeof window;
        globalThis.document = dom.window.document;
        globalThis.navigator = dom.window.navigator;
        globalThis.Element = dom.window.Element;
        globalThis.HTMLElement = dom.window.HTMLElement;
        globalThis.SVGElement = dom.window.SVGElement;
        testGlobal.IS_REACT_ACT_ENVIRONMENT = true;
        reactContainer = document.createElement("div");
        preactContainer = document.createElement("div");
        document.body.appendChild(reactContainer);
        document.body.appendChild(preactContainer);
    });

    afterEach(() => {
        dom.window.close();
        if (previousWindow === undefined) {
            Reflect.deleteProperty(globalThis, "window");
        } else {
            globalThis.window = previousWindow;
        }
        if (previousDocument === undefined) {
            Reflect.deleteProperty(globalThis, "document");
        } else {
            globalThis.document = previousDocument;
        }
        if (previousNavigator === undefined) {
            Reflect.deleteProperty(globalThis, "navigator");
        } else {
            globalThis.navigator = previousNavigator;
        }
        if (previousElement === undefined) {
            Reflect.deleteProperty(globalThis, "Element");
        } else {
            globalThis.Element = previousElement;
        }
        if (previousHTMLElement === undefined) {
            Reflect.deleteProperty(globalThis, "HTMLElement");
        } else {
            globalThis.HTMLElement = previousHTMLElement;
        }
        if (previousSVGElement === undefined) {
            Reflect.deleteProperty(globalThis, "SVGElement");
        } else {
            globalThis.SVGElement = previousSVGElement;
        }
        testGlobal.IS_REACT_ACT_ENVIRONMENT = undefined;
    });

    for (const adapter of adapters) {
        test(`${adapter.name} exposes pending approvals and setMessages consistently`, async () => {
            const mock = createMockClient();
            const mounted = await adapter.mount({
                client: mock.client,
                options: {
                    initialMessages: [
                        {
                            localId: "a_1",
                            role: "assistant",
                            parts: [
                                {
                                    type: "tool-call",
                                    callId: "call_1",
                                    name: "searchWeb",
                                    status: "pending",
                                    state: "approval-requested",
                                    approval: { input: { query: "weather" } },
                                },
                            ],
                        },
                    ],
                },
            });

            assert.equal(mounted.read().pendingToolApprovals.length, 1);

            mounted.setMessages([
                {
                    localId: "u_1",
                    role: "user",
                    parts: [{ type: "text", text: "Hello" }],
                },
            ]);
            await waitForTask();

            assert.deepEqual(mounted.read().messages, [
                {
                    localId: "u_1",
                    role: "user",
                    parts: [{ type: "text", text: "Hello" }],
                },
            ]);

            await mounted.destroy();
        });

        test(`${adapter.name} regenerates and retries the latest user turn`, async () => {
            const mock = createMockClient();
            const mounted = await adapter.mount({ client: mock.client });

            mounted.setMessages([
                {
                    localId: "u_1",
                    role: "user",
                    parts: [{ type: "text", text: "Hello" }],
                },
            ]);

            await mounted.regenerate();
            await mounted.retryMessage("u_1");

            assert.equal(mock.runCalls.length, 2);
            assert.deepEqual(mock.runCalls[0]?.input.input, [
                { type: "message", role: "user", content: "Hello" },
            ]);
            assert.deepEqual(mock.runCalls[1]?.input.input, [
                { type: "message", role: "user", content: "Hello" },
            ]);

            await mounted.destroy();
        });

        test(`${adapter.name} clears failed optimistic send state consistently`, async () => {
            const error = new Error("Boom");
            const mock = createMockClient({ runError: error });
            const mounted = await adapter.mount({
                client: mock.client,
                options: {
                    optimisticUserMessage: true,
                },
            });

            await mounted.sendMessage("Hello");
            await waitForTask();

            assert.equal(mounted.read().status, "error");
            assert.equal(mounted.read().messages[0]?.status, "failed");
            mounted.clearError();
            await waitForTask();
            assert.equal(mounted.read().status, "ready");
            assert.equal(mounted.read().error, undefined);

            await mounted.destroy();
        });

        test(`${adapter.name} uses the latest client for the next imperative action`, async () => {
            const first = createMockClient();
            const second = createMockClient();
            const mounted = await adapter.mount({ client: first.client });

            await mounted.update({ client: second.client });
            await mounted.sendMessage("Hello");

            assert.equal(first.runCalls.length, 0);
            assert.equal(second.runCalls.length, 1);
            assert.equal(second.runCalls[0]?.input.input, "Hello");

            await mounted.destroy();
        });

        test(`${adapter.name} uses the latest conversation options for the next imperative action`, async () => {
            const mock = createMockClient();
            const mounted = await adapter.mount({ client: mock.client });

            await mounted.update({
                options: {
                    conversationId: "conv_2",
                },
            });
            await mounted.sendMessage("Hello");

            assert.equal(mock.runCalls[0]?.input.conversationId, "conv_2");

            await mounted.destroy();
        });

        test(`${adapter.name} forwards resume and approval actions consistently`, async () => {
            const mock = createMockClient();
            const mounted = await adapter.mount({
                client: mock.client,
                options: {
                    conversationId: "conv_7",
                },
            });

            await mounted.resumeStream({ streamId: "stream_1", afterSeq: 3 });
            await mounted.resumeConversation({ afterSeq: 5 });
            await mounted.approveToolCall({
                toolCallId: "call_1",
                decision: "approved",
                runId: "run_1",
            });

            assert.deepEqual(mock.resumeStreamCalls[0], {
                agent: "support",
                input: { streamId: "stream_1", afterSeq: 3 },
            });
            assert.deepEqual(mock.resumeConversationCalls[0], {
                agent: "support",
                input: { conversationId: "conv_7", afterSeq: 5 },
            });
            assert.deepEqual(mock.submitToolApprovalCalls[0], {
                agent: "support",
                toolCallId: "call_1",
                decision: "approved",
                runId: "run_1",
            });

            await mounted.destroy();
        });
    }
});
