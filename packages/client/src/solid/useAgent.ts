import { createRenderEffect, createSignal, onCleanup, onMount } from "solid-js";
import { AgentChatController } from "../core/controller";
import {
    cloneControllerOptions,
    getLatestUserMessageId,
    normalizeSendInput,
} from "../framework-internals/utils";
import type { BetterAgentClient } from "../types/client";
import type { AgentNameFromApp } from "../types/client-type-helpers";
import type { MaybeAccessor, UseAgentOptions, UseAgentResult } from "./types";

const resolve = <T>(value: MaybeAccessor<T>): T =>
    typeof value === "function" ? (value as () => T)() : value;

/**
 * Solid primitive for talking to one Better Agent conversation.
 *
 * Returns reactive chat state and chat actions.
 *
 * @example
 * ```ts
 * const agent = useAgent(client, {
 *   agent: "assistant",
 *   conversationId: "conv_123",
 * });
 *
 * await agent.sendMessage("Hello");
 *
 * console.log(agent.messages());
 * console.log(agent.status());
 * agent.stop();
 * ```
 *
 * @example
 * ```tsx
 * function Chat() {
 *   const agent = useAgent(client, { agent: "assistant" });
 *
 *   return (
 *     <div>
 *       <For each={agent.messages()}>
 *         {(message) => <div>{message.role}</div>}
 *       </For>
 *       <button onClick={() => agent.sendMessage("Hello")}>Send</button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useAgent<
    TApp = unknown,
    TAgentName extends AgentNameFromApp<TApp> = AgentNameFromApp<TApp>,
>(
    client: MaybeAccessor<BetterAgentClient<TApp>>,
    options: MaybeAccessor<UseAgentOptions<TApp, TAgentName>>,
): UseAgentResult<TApp, TAgentName> {
    const controller = new AgentChatController<TApp, TAgentName>(
        resolve(client),
        cloneControllerOptions(resolve(options)),
    );
    const [snapshot, setSnapshot] = createSignal(controller.getSnapshot());

    /** Pushes the latest client and options into the controller. */
    const syncController = () => {
        controller.updateClient(resolve(client));
        controller.updateOptions(
            cloneControllerOptions(resolve(options)) as UseAgentOptions<TApp, TAgentName>,
        );
    };

    const unsubscribe = controller.subscribe(() => {
        setSnapshot(controller.getSnapshot());
    });

    createRenderEffect(() => {
        syncController();
    });

    onMount(() => {
        syncController();
        controller.init();
    });

    onCleanup(() => {
        unsubscribe();
        controller.destroy();
    });

    const messages = () => snapshot().messages;
    const id = () => snapshot().id;
    const status = () => snapshot().status;
    const error = () => snapshot().error;
    const streamId = () => snapshot().streamId;
    const runId = () => snapshot().runId;
    const isLoading = () => snapshot().isLoading;
    const isStreaming = () => snapshot().isStreaming;
    const conversationId = () => snapshot().conversationId;
    const pendingToolApprovals = () => snapshot().pendingToolApprovals;

    return {
        id,
        messages,
        status,
        error,
        streamId,
        runId,
        conversationId,
        isLoading,
        isStreaming,
        pendingToolApprovals,
        sendMessage: (input, requestOptions) => {
            syncController();
            return controller.sendMessage(normalizeSendInput(input), requestOptions);
        },
        regenerate: async () => {
            syncController();
            await controller.retryMessage(getLatestUserMessageId(controller));
        },
        retryMessage: (localId) => {
            syncController();
            return controller.retryMessage(localId);
        },
        stop: () => {
            syncController();
            controller.stop();
        },
        resumeStream: (resumeOptions) => {
            syncController();
            return controller.resumeStream(resumeOptions);
        },
        resumeConversation: (resumeOptions) => {
            syncController();
            return controller.resumeConversation(resumeOptions);
        },
        approveToolCall: (params) => {
            syncController();
            return controller.approveToolCall(params);
        },
        clearError: () => {
            syncController();
            controller.clearError();
        },
        reset: () => {
            syncController();
            controller.reset();
        },
        setMessages: (input) => {
            syncController();
            controller.setMessages(input);
        },
    };
}
