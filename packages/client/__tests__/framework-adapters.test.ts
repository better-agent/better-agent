import { afterEach, describe, expect, test } from "bun:test";
import { JSDOM } from "jsdom";
import { h, render as preactRender } from "preact";
import { act as preactAct } from "preact/test-utils";
import { createRoot as createSolidRoot } from "solid-js";
import { createAgentChat } from "../src/svelte";
import type {
    AgentControllerFinish,
    BetterAgentClientAgentMemoryHandle,
    UIMessage,
} from "../src/types";

function createMockAgent() {
    const streamCalls: Array<Record<string, unknown>> = [];
    const abortCalls: string[] = [];
    const messageListCalls: string[] = [];

    const runs = {
        async abort(runId: string) {
            abortCalls.push(runId);
        },
        resumeStream() {
            return emptyStream();
        },
    };

    const agent = {
        runs,
        async run() {
            return { runId: "run_1", outcome: "success", messages: [] };
        },
        stream(input) {
            streamCalls.push(input as Record<string, unknown>);
            return emptyStream();
        },
        memory: {
            threads: {
                async list() {
                    return [];
                },
                async create() {
                    return { id: "thread_1", agentName: "support", createdAt: 1, updatedAt: 1 };
                },
                async get(threadId: string) {
                    return { id: threadId, agentName: "support", createdAt: 1, updatedAt: 1 };
                },
                async update(threadId: string) {
                    return { id: threadId, agentName: "support", createdAt: 1, updatedAt: 1 };
                },
                async delete() {},
                async runtime() {
                    return {};
                },
            },
            messages: {
                async list(threadId: string) {
                    messageListCalls.push(threadId);
                    return [];
                },
            },
        },
    } satisfies BetterAgentClientAgentMemoryHandle<unknown, never>;

    return { agent, streamCalls, abortCalls, messageListCalls };
}

async function* emptyStream() {}

function installDom() {
    const previous = {
        window: globalThis.window,
        document: globalThis.document,
        navigator: globalThis.navigator,
        Element: globalThis.Element,
        HTMLElement: globalThis.HTMLElement,
        SVGElement: globalThis.SVGElement,
    };
    const dom = new JSDOM("<!doctype html><html><body></body></html>");
    globalThis.window = dom.window as unknown as typeof window;
    globalThis.document = dom.window.document;
    globalThis.navigator = dom.window.navigator;
    globalThis.Element = dom.window.Element;
    globalThis.HTMLElement = dom.window.HTMLElement;
    globalThis.SVGElement = dom.window.SVGElement;

    return () => {
        dom.window.close();
        restoreGlobal("window", previous.window);
        restoreGlobal("document", previous.document);
        restoreGlobal("navigator", previous.navigator);
        restoreGlobal("Element", previous.Element);
        restoreGlobal("HTMLElement", previous.HTMLElement);
        restoreGlobal("SVGElement", previous.SVGElement);
    };
}

function restoreGlobal<T extends keyof typeof globalThis>(
    key: T,
    value: (typeof globalThis)[T] | undefined,
) {
    if (value === undefined) {
        Reflect.deleteProperty(globalThis, key);
    } else {
        globalThis[key] = value;
    }
}

describe("framework adapters", () => {
    let cleanupDom: (() => void) | undefined;

    afterEach(() => {
        cleanupDom?.();
        cleanupDom = undefined;
    });

    test("preact useAgent sends messages through an agent handle", async () => {
        cleanupDom = installDom();
        const { useAgent } = await import("../src/preact");
        const { agent, streamCalls } = createMockAgent();
        let chat:
            | {
                  messages: UIMessage[];
                  sendMessage(input: string): Promise<void>;
              }
            | undefined;

        function Harness() {
            chat = useAgent(agent);
            return null;
        }

        const container = document.createElement("div");
        await preactAct(async () => {
            preactRender(h(Harness, {}), container);
        });
        await preactAct(async () => {
            await chat?.sendMessage("hello");
        });
        preactRender(null, container);

        expect(streamCalls).toHaveLength(1);
        expect(streamCalls[0]?.messages).toEqual([{ role: "user", content: "hello" }]);
        expect(chat?.messages[0]?.role).toBe("user");
    });

    test("preact useAgent reads latest lifecycle callbacks and memory helpers", async () => {
        cleanupDom = installDom();
        const { useAgent } = await import("../src/preact");
        const { agent, messageListCalls } = createMockAgent();
        const finishes: string[] = [];
        let chat:
            | {
                  sendMessage(input: string): Promise<void>;
                  loadMessages(threadId?: string): Promise<void>;
              }
            | undefined;
        let onFinish = (_finish: AgentControllerFinish) => {
            finishes.push("first");
        };

        function Harness() {
            chat = useAgent(agent, { onFinish });
            return null;
        }

        const container = document.createElement("div");
        await preactAct(async () => {
            preactRender(h(Harness, {}), container);
        });
        onFinish = () => {
            finishes.push("second");
        };
        await preactAct(async () => {
            preactRender(h(Harness, {}), container);
        });
        await preactAct(async () => {
            await chat?.sendMessage("hello");
            await chat?.loadMessages("thread_1");
        });
        preactRender(null, container);

        expect(finishes).toEqual(["second"]);
        expect(messageListCalls).toEqual(["thread_1"]);
    });

    test("vue useAgent sends messages through an agent handle", async () => {
        cleanupDom = installDom();
        const { createApp, defineComponent, h: vueH, nextTick } = await import("vue");
        const { useAgent } = await import("../src/vue");
        const { agent, streamCalls } = createMockAgent();
        let chat:
            | {
                  messages: { value: UIMessage[] };
                  sendMessage(input: string): Promise<void>;
              }
            | undefined;

        const app = createApp(
            defineComponent({
                setup() {
                    chat = useAgent(agent);
                    return () => vueH("div");
                },
            }),
        );

        app.mount(document.createElement("div"));
        await nextTick();
        await chat?.sendMessage("hello");
        await nextTick();
        app.unmount();

        expect(streamCalls).toHaveLength(1);
        expect(streamCalls[0]?.messages).toEqual([{ role: "user", content: "hello" }]);
        expect(chat?.messages.value[0]?.role).toBe("user");
    });

    test("vue useAgent reads latest lifecycle callbacks and memory helpers", async () => {
        cleanupDom = installDom();
        const { createApp, defineComponent, h: vueH, nextTick, ref } = await import("vue");
        const { useAgent } = await import("../src/vue");
        const { agent, messageListCalls } = createMockAgent();
        const finishes: string[] = [];
        const options = ref({
            onFinish: (_finish: AgentControllerFinish) => {
                finishes.push("first");
            },
        });
        let chat:
            | {
                  sendMessage(input: string): Promise<void>;
                  loadMessages(threadId?: string): Promise<void>;
              }
            | undefined;

        const app = createApp(
            defineComponent({
                setup() {
                    chat = useAgent(agent, options);
                    return () => vueH("div");
                },
            }),
        );

        app.mount(document.createElement("div"));
        options.value = {
            onFinish: () => {
                finishes.push("second");
            },
        };
        await nextTick();
        await chat?.sendMessage("hello");
        await chat?.loadMessages("thread_1");
        app.unmount();

        expect(finishes).toEqual(["second"]);
        expect(messageListCalls).toEqual(["thread_1"]);
    });

    test("solid useAgent sends messages through an agent handle", async () => {
        const { useAgent } = await import("../src/solid");
        const { agent, streamCalls } = createMockAgent();
        let chat:
            | {
                  messages(): UIMessage[];
                  sendMessage(input: string): Promise<void>;
              }
            | undefined;

        const dispose = createSolidRoot((disposeRoot) => {
            chat = useAgent(agent);
            return disposeRoot;
        });

        await chat?.sendMessage("hello");
        dispose();

        expect(streamCalls).toHaveLength(1);
        expect(streamCalls[0]?.messages).toEqual([{ role: "user", content: "hello" }]);
        expect(chat?.messages()[0]?.role).toBe("user");
    });

    test("solid useAgent reads latest lifecycle callbacks and memory helpers", async () => {
        const { createSignal } = await import("solid-js");
        const { useAgent } = await import("../src/solid");
        const { agent, messageListCalls } = createMockAgent();
        const finishes: string[] = [];
        let setOnFinish: ((next: (finish: AgentControllerFinish) => void) => void) | undefined;
        let chat:
            | {
                  sendMessage(input: string): Promise<void>;
                  loadMessages(threadId?: string): Promise<void>;
              }
            | undefined;

        const dispose = createSolidRoot((disposeRoot) => {
            const [onFinish, setFinish] = createSignal((_finish: AgentControllerFinish) => {
                finishes.push("first");
            });
            setOnFinish = setFinish;
            chat = useAgent(agent, () => ({ onFinish: onFinish() }));
            return disposeRoot;
        });

        setOnFinish?.(() => {
            finishes.push("second");
        });
        await chat?.sendMessage("hello");
        await chat?.loadMessages("thread_1");
        dispose();

        expect(finishes).toEqual(["second"]);
        expect(messageListCalls).toEqual(["thread_1"]);
    });

    test("svelte createAgentChat sends messages through an agent handle", async () => {
        const { agent, streamCalls } = createMockAgent();
        const chat = createAgentChat(agent);
        let snapshot: { messages: UIMessage[] } | undefined;
        const unsubscribe = chat.subscribe((next) => {
            snapshot = next;
        });

        await chat.sendMessage("hello");
        unsubscribe();

        expect(streamCalls).toHaveLength(1);
        expect(streamCalls[0]?.messages).toEqual([{ role: "user", content: "hello" }]);
        expect(snapshot?.messages[0]?.role).toBe("user");
    });

    test("svelte createAgentChat exposes lifecycle callbacks and memory helpers", async () => {
        const { agent, messageListCalls } = createMockAgent();
        const finishes: string[] = [];
        const chat = createAgentChat(agent, {
            onFinish: () => {
                finishes.push("finish");
            },
        });
        const unsubscribe = chat.subscribe(() => {});

        await chat.sendMessage("hello");
        await chat.loadMessages("thread_1");
        unsubscribe();

        expect(finishes).toEqual(["finish"]);
        expect(messageListCalls).toEqual(["thread_1"]);
    });
});
