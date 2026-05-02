import { writable } from "svelte/store";
import { createAgentController } from "../core/controller";
import type { AgentNameOf } from "../core/inference";
import type { BetterAgentClientAgentHandle, BetterAgentClientAgentMemoryHandle } from "../types";
import type { AgentChatOptions, AgentChatState, AgentChatStore } from "./types";

export function createAgentChat<
    TApp = unknown,
    TName extends AgentNameOf<TApp> = AgentNameOf<TApp>,
>(
    agent: BetterAgentClientAgentMemoryHandle<TApp, TName>,
    options?: AgentChatOptions<TApp, TName>,
): AgentChatStore<TApp, TName>;
export function createAgentChat<
    TApp = unknown,
    TName extends AgentNameOf<TApp> = AgentNameOf<TApp>,
>(
    agent: BetterAgentClientAgentHandle<TApp, TName>,
    options?: AgentChatOptions<TApp, TName>,
): AgentChatStore<TApp, TName>;
export function createAgentChat<
    TApp = unknown,
    TName extends AgentNameOf<TApp> = AgentNameOf<TApp>,
>(
    agent: BetterAgentClientAgentHandle<TApp, TName>,
    options: AgentChatOptions<TApp, TName> = {},
): AgentChatStore<TApp, TName> {
    const controller = createAgentController<TApp, TName>(agent, options);
    const store = writable<AgentChatState>(controller.getSnapshot(), (set) => {
        const unsubscribe = controller.subscribe(() => {
            set(controller.getSnapshot());
        });

        set(controller.getSnapshot());
        controller.start();

        return () => {
            unsubscribe();
            controller.stop();
        };
    });

    return {
        subscribe: store.subscribe,
        sendMessage: (input, sendOptions) => controller.sendMessage(input, sendOptions),
        stop: () => controller.stop(),
        resume: (resume) => controller.resume(resume),
        selectThread: (threadId) => controller.selectThread(threadId),
        clearThread: () => controller.clearThread(),
        loadMessages: (threadId) => controller.loadMessages(threadId),
        approveToolCall: (interruptId, metadata) =>
            controller.approveToolCall(interruptId, metadata),
        rejectToolCall: (interruptId, metadata) => controller.rejectToolCall(interruptId, metadata),
        setMessages: (messages) => controller.setMessages(messages),
    };
}
