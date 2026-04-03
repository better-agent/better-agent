import { writable } from "svelte/store";
import { AgentChatController } from "../core/controller";
import {
    cloneControllerOptions,
    getLatestUserMessageId,
    normalizeSendInput,
} from "../framework-internals/utils";
import type { BetterAgentClient } from "../types/client";
import type { AgentNameFromApp } from "../types/client-type-helpers";
import type { AgentChatOptions, AgentChatSnapshot, AgentChatStore } from "./types";

/**
 * Creates a Svelte store for one Better Agent conversation.
 *
 * Returns a readable store plus chat actions.
 *
 * @example
 * ```ts
 * const agent = createAgentChat(client, {
 *   agent: "assistant",
 *   conversationId: "conv_123",
 * });
 *
 * await agent.sendMessage("Hello");
 *
 * const unsubscribe = agent.subscribe((snapshot) => {
 *   console.log(snapshot.messages);
 *   console.log(snapshot.status);
 * });
 *
 * unsubscribe();
 * ```
 *
 * @example
 * ```svelte
 * <script lang="ts">
 *   const agent = createAgentChat(client, { agent: "assistant" });
 * </script>
 *
 * {#each $agent.messages as message}
 *   <div>{message.role}</div>
 * {/each}
 *
 * <button on:click={() => agent.sendMessage("Hello")}>Send</button>
 * ```
 */
export function createAgentChat<
    TApp = unknown,
    TAgentName extends AgentNameFromApp<TApp> = AgentNameFromApp<TApp>,
>(
    client: BetterAgentClient<TApp>,
    options: AgentChatOptions<TApp, TAgentName>,
): AgentChatStore<TApp, TAgentName> {
    let currentClient = client;
    let currentOptions = options;
    let controller: AgentChatController<TApp, TAgentName> | null = null;

    const getController = () => {
        if (!controller) {
            controller = new AgentChatController<TApp, TAgentName>(
                currentClient,
                cloneControllerOptions(currentOptions),
            );
        }
        return controller;
    };

    /** Pushes the latest client and options into the controller. */
    const syncController = () => {
        const activeController = getController();
        activeController.updateClient(currentClient);
        activeController.updateOptions(
            cloneControllerOptions(currentOptions) as AgentChatOptions<TApp, TAgentName>,
        );
        return activeController;
    };

    const store = writable(
        getController().getSnapshot(),
        (set: (value: AgentChatSnapshot) => void) => {
            const activeController = syncController();
            const unsubscribe = activeController.subscribe(() => {
                set(activeController.getSnapshot());
            });

            set(activeController.getSnapshot());
            if (typeof window !== "undefined") {
                activeController.init();
            }

            return () => {
                unsubscribe();
                activeController.destroy();
                if (controller === activeController) {
                    controller = null;
                }
            };
        },
    );

    return {
        subscribe: store.subscribe,
        sendMessage: (input, requestOptions) =>
            syncController().sendMessage(normalizeSendInput(input), requestOptions),
        regenerate: async () => {
            const activeController = syncController();
            await activeController.retryMessage(getLatestUserMessageId(activeController));
        },
        retryMessage: (localId) => syncController().retryMessage(localId),
        stop: () => {
            syncController().stop();
        },
        resumeStream: (resumeOptions) => syncController().resumeStream(resumeOptions),
        resumeConversation: (resumeOptions) => syncController().resumeConversation(resumeOptions),
        approveToolCall: (params) => syncController().approveToolCall(params),
        clearError: () => {
            syncController().clearError();
        },
        reset: () => {
            syncController().reset();
        },
        setMessages: (input) => {
            syncController().setMessages(input);
        },
        updateOptions: (input) => {
            currentOptions = {
                ...currentOptions,
                ...input,
            };
            syncController();
        },
        updateClient: (nextClient) => {
            currentClient = nextClient;
            syncController();
        },
    };
}
