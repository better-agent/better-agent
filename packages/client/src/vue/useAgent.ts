import { computed, onMounted, onUnmounted, ref, toValue, watchEffect } from "vue";
import type { MaybeRefOrGetter } from "vue";
import { AgentChatController } from "../core/controller";
import {
    cloneControllerOptions,
    getLatestUserMessageId,
    normalizeSendInput,
} from "../framework-internals/utils";
import type { BetterAgentClient } from "../types/client";
import type { AgentNameFromApp } from "../types/client-type-helpers";
import type { UseAgentOptions, UseAgentResult } from "./types";

/**
 * Vue composable for talking to one Better Agent conversation.
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
 * console.log(agent.messages.value);
 * console.log(agent.status.value);
 * agent.stop();
 * ```
 *
 * @example
 * ```vue
 * <script setup lang="ts">
 * const agent = useAgent(client, { agent: "assistant" });
 * </script>
 *
 * <template>
 *   <div v-for="message in agent.messages.value" :key="message.localId">
 *     {{ message.role }}
 *   </div>
 *   <button @click="agent.sendMessage('Hello')">Send</button>
 * </template>
 * ```
 */
export function useAgent<
    TApp = unknown,
    TAgentName extends AgentNameFromApp<TApp> = AgentNameFromApp<TApp>,
>(
    client: MaybeRefOrGetter<BetterAgentClient<TApp>>,
    options: MaybeRefOrGetter<UseAgentOptions<TApp, TAgentName>>,
): UseAgentResult<TApp, TAgentName> {
    const controller = new AgentChatController<TApp, TAgentName>(
        toValue(client),
        cloneControllerOptions(toValue(options)),
    );
    const version = ref(0);

    /** Pushes the latest client and options into the controller. */
    const syncController = () => {
        controller.updateClient(toValue(client));
        controller.updateOptions(
            cloneControllerOptions(toValue(options)) as UseAgentOptions<TApp, TAgentName>,
        );
    };

    const unsubscribe = controller.subscribe(() => {
        version.value++;
    });

    watchEffect(() => {
        syncController();
    });

    onMounted(() => {
        syncController();
        controller.init();
    });

    onUnmounted(() => {
        unsubscribe();
        controller.destroy();
    });

    const messages = computed(() => {
        void version.value;
        return controller.getMessages();
    });
    const id = computed(() => {
        void version.value;
        return controller.getSnapshot().id;
    });
    const status = computed(() => {
        void version.value;
        return controller.getStatus();
    });
    const error = computed(() => {
        void version.value;
        return controller.getError();
    });
    const streamId = computed(() => {
        void version.value;
        return controller.getStreamId();
    });
    const runId = computed(() => {
        void version.value;
        return controller.getRunId();
    });
    const isLoading = computed(() => {
        void version.value;
        return controller.isLoading;
    });
    const isStreaming = computed(() => {
        void version.value;
        return controller.isStreaming;
    });
    const conversationId = computed(() => {
        void version.value;
        return controller.getSnapshot().conversationId;
    });
    const pendingToolApprovals = computed(() => {
        void version.value;
        return controller.getPendingToolApprovals();
    });

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
