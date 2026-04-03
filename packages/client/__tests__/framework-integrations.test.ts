import "./setup";
import assert from "node:assert/strict";
import { afterEach, describe, test } from "node:test";
import type { RunResult } from "@better-agent/core";
import { JSDOM } from "jsdom";
import { h, render as preactRender } from "preact";
import { useLayoutEffect as usePreactLayoutEffect, useRef as usePreactRef } from "preact/hooks";
import { act as preactAct } from "preact/test-utils";
import { createElement } from "react";
import {
    act as reactAct,
    useLayoutEffect as useReactLayoutEffect,
    useRef as useReactRef,
} from "react";
import { type Root as ReactRoot, createRoot as createReactRoot } from "react-dom/client";
import { createRoot, createSignal } from "solid-js";
import { useAgent as usePreactAgent } from "../src/preact/useAgent";
import { useAgent as useReactAgent } from "../src/react/useAgent";
import { useAgent as useSolidAgent } from "../src/solid/useAgent";
import { createAgentChat } from "../src/svelte/createAgentChat";
import type { BetterAgentClient } from "../src/types/client";

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
    }> = [];
    const loadConversationCalls: Array<{
        agent: string;
        conversationId: string;
    }> = [];

    const client: BetterAgentClient = {
        async run(agent, input) {
            runCalls.push({
                agent: String(agent),
                input: input as Record<string, unknown>,
            });
            return createRunResult();
        },
        stream() {
            throw new Error("Not used in this test.");
        },
        resumeStream() {
            throw new Error("Not used in this test.");
        },
        resumeConversation() {
            throw new Error("Not used in this test.");
        },
        async loadConversation(agent, conversationId) {
            loadConversationCalls.push({
                agent: String(agent),
                conversationId,
            });
            return null;
        },
        async submitToolResult() {},
        async submitToolApproval() {},
        async abortRun() {},
    } as BetterAgentClient;

    return { client, runCalls, loadConversationCalls };
};

describe("framework integrations", () => {
    let dom: JSDOM | undefined;
    let previousWindow: typeof globalThis.window | undefined;
    let previousDocument: typeof globalThis.document | undefined;
    let previousNavigator: typeof globalThis.navigator | undefined;
    let previousElement: typeof globalThis.Element | undefined;
    let previousHTMLElement: typeof globalThis.HTMLElement | undefined;
    let previousSVGElement: typeof globalThis.SVGElement | undefined;
    const testGlobal = globalThis as typeof globalThis & {
        IS_REACT_ACT_ENVIRONMENT?: boolean;
    };

    const installDom = () => {
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
    };

    afterEach(() => {
        if (dom) {
            dom.window.close();
            dom = undefined;
        }
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
        previousWindow = undefined;
        previousDocument = undefined;
        previousNavigator = undefined;
        previousElement = undefined;
        previousHTMLElement = undefined;
        previousSVGElement = undefined;
        testGlobal.IS_REACT_ACT_ENVIRONMENT = undefined;
    });

    test("svelte store does not eagerly init during server-side subscription", () => {
        const mock = createMockClient();
        previousWindow = globalThis.window;
        previousDocument = globalThis.document;
        previousNavigator = globalThis.navigator;
        Reflect.deleteProperty(globalThis, "window");
        Reflect.deleteProperty(globalThis, "document");
        Reflect.deleteProperty(globalThis, "navigator");

        const agent = createAgentChat(mock.client, {
            agent: "support",
            conversationId: "conv_1",
            hydrateFromServer: true,
        });

        const unsubscribe = agent.subscribe(() => {});
        unsubscribe();

        assert.equal(mock.loadConversationCalls.length, 0);
    });

    test("svelte store recreates its controller after unsubscribe", async () => {
        const mock = createMockClient();
        const agent = createAgentChat(mock.client, {
            agent: "support",
            delivery: "final",
        });

        const unsubscribe = agent.subscribe(() => {});
        unsubscribe();

        const secondUnsubscribe = agent.subscribe(() => {});
        await agent.sendMessage("Hello again");
        secondUnsubscribe();

        assert.equal(mock.runCalls.length, 1);
        assert.equal(mock.runCalls[0]?.input.input, "Hello again");
    });

    test("vue useAgent updates the transport client from refs/getters", async () => {
        const first = createMockClient();
        const second = createMockClient();
        installDom();
        const { createApp, defineComponent, h, nextTick, ref } = await import("vue");
        const { useAgent: useVueAgent } = await import("../src/vue/useAgent");

        const clientRef = ref(first.client);
        const optionsRef = ref({
            agent: "support" as never,
            delivery: "final" as const,
        });
        let agent:
            | {
                  sendMessage(input: string): Promise<unknown>;
              }
            | undefined;

        const app = createApp(
            defineComponent({
                setup() {
                    agent = useVueAgent(clientRef, optionsRef);
                    return () => h("div");
                },
            }),
        );

        app.mount(document.createElement("div"));
        clientRef.value = second.client;
        await nextTick();
        await agent?.sendMessage("Hello");
        app.unmount();

        assert.equal(first.runCalls.length, 0);
        assert.equal(second.runCalls.length, 1);
        assert.equal(second.runCalls[0]?.input.input, "Hello");
    });

    test("solid useAgent tracks accessor-based client and option changes", async () => {
        const first = createMockClient();
        const second = createMockClient();
        let agent:
            | {
                  sendMessage(input: string): Promise<unknown>;
              }
            | undefined;
        let setClient!: (client: BetterAgentClient) => void;
        let setConversationId!: (conversationId: string) => void;

        const dispose = createRoot((dispose) => {
            const [client, updateClient] = createSignal<BetterAgentClient>(first.client);
            const [conversationId, updateConversationId] = createSignal("conv_1");
            setClient = updateClient;
            setConversationId = updateConversationId;
            agent = useSolidAgent(client, () => ({
                agent: "support" as never,
                delivery: "final" as const,
                conversationId: conversationId(),
            }));
            return dispose;
        });

        setClient(second.client);
        setConversationId("conv_2");
        await Promise.resolve();
        await agent?.sendMessage("Hello");
        dispose();

        assert.equal(first.runCalls.length, 0);
        assert.equal(second.runCalls.length, 1);
        assert.equal(second.runCalls[0]?.input.conversationId, "conv_2");
    });

    test("react useAgent uses the latest client and options during layout-effect actions", async () => {
        const first = createMockClient();
        const second = createMockClient();
        installDom();
        const container = document.createElement("div");
        document.body.appendChild(container);
        const root: ReactRoot = createReactRoot(container);

        type HarnessProps = {
            client: BetterAgentClient;
            conversationId: string;
            sendOnMount?: boolean;
        };

        function Harness({ client, conversationId, sendOnMount }: HarnessProps) {
            const agent = useReactAgent(client, {
                agent: "support",
                delivery: "final",
                conversationId,
            });
            const sentRef = useReactRef(false);

            useReactLayoutEffect(() => {
                if (!sendOnMount || sentRef.current) return;
                sentRef.current = true;
                void agent.sendMessage("Hello");
            }, [agent, sendOnMount]);

            return null;
        }

        await reactAct(async () => {
            root.render(createElement(Harness, { client: first.client, conversationId: "conv_1" }));
        });

        await reactAct(async () => {
            root.render(
                createElement(Harness, {
                    client: second.client,
                    conversationId: "conv_2",
                    sendOnMount: true,
                }),
            );
        });

        await reactAct(async () => {
            await Promise.resolve();
        });

        assert.equal(first.runCalls.length, 0);
        assert.equal(second.runCalls.length, 1);
        assert.equal(second.runCalls[0]?.input.conversationId, "conv_2");

        await reactAct(async () => {
            root.unmount();
        });
    });

    test("preact useAgent uses the latest client and options during layout-effect actions", async () => {
        const first = createMockClient();
        const second = createMockClient();
        installDom();
        const container = document.createElement("div");
        document.body.appendChild(container);

        type HarnessProps = {
            client: BetterAgentClient;
            conversationId: string;
            sendOnMount?: boolean;
        };

        function Harness({ client, conversationId, sendOnMount }: HarnessProps) {
            const agent = usePreactAgent(client, {
                agent: "support",
                delivery: "final",
                conversationId,
            });
            const sentRef = usePreactRef(false);

            usePreactLayoutEffect(() => {
                if (!sendOnMount || sentRef.current) return;
                sentRef.current = true;
                void agent.sendMessage("Hello");
            }, [agent, sendOnMount]);

            return null;
        }

        await preactAct(async () => {
            preactRender(h(Harness, { client: first.client, conversationId: "conv_1" }), container);
        });

        await preactAct(async () => {
            preactRender(
                h(Harness, {
                    client: second.client,
                    conversationId: "conv_2",
                    sendOnMount: true,
                }),
                container,
            );
        });

        await preactAct(async () => {
            await Promise.resolve();
        });

        assert.equal(first.runCalls.length, 0);
        assert.equal(second.runCalls.length, 1);
        assert.equal(second.runCalls[0]?.input.conversationId, "conv_2");

        await preactAct(async () => {
            preactRender(null, container);
        });
    });
});
