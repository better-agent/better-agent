import { computed, onMounted, onUnmounted, ref, toValue } from "vue";
import type { MaybeRefOrGetter } from "vue";
import { createAgentController } from "../core/controller";
import type { AgentNameOf } from "../core/inference";
import type {
    AgentControllerOptions,
    BetterAgentClientAgentHandle,
    BetterAgentClientAgentMemoryHandle,
} from "../types";
import type { UseAgentOptions, UseAgentResult } from "./types";

export function useAgent<TApp = unknown, TName extends AgentNameOf<TApp> = AgentNameOf<TApp>>(
    agent: BetterAgentClientAgentMemoryHandle<TApp, TName>,
    options?: MaybeRefOrGetter<UseAgentOptions<TApp, TName> | undefined>,
): UseAgentResult<TApp, TName>;
export function useAgent<TApp = unknown, TName extends AgentNameOf<TApp> = AgentNameOf<TApp>>(
    agent: BetterAgentClientAgentHandle<TApp, TName>,
    options?: MaybeRefOrGetter<UseAgentOptions<TApp, TName> | undefined>,
): UseAgentResult<TApp, TName>;
export function useAgent<TApp = unknown, TName extends AgentNameOf<TApp> = AgentNameOf<TApp>>(
    agent: BetterAgentClientAgentHandle<TApp, TName>,
    options?: MaybeRefOrGetter<UseAgentOptions<TApp, TName> | undefined>,
): UseAgentResult<TApp, TName> {
    const readOptions = () => toValue(options) ?? {};
    const toolHandlers = new Proxy(
        {},
        {
            get(_target, key) {
                const handlers = readOptions().toolHandlers as
                    | Record<PropertyKey, unknown>
                    | undefined;
                return handlers?.[key];
            },
        },
    ) as AgentControllerOptions<TApp, TName>["toolHandlers"];

    const initialOptions = readOptions();
    const controller = createAgentController<TApp, TName>(agent, {
        initialMessages: initialOptions.initialMessages,
        initialState: initialOptions.initialState,
        initialInterruptState: initialOptions.initialInterruptState,
        resume: initialOptions.resume,
        context: initialOptions.context,
        threadId: initialOptions.threadId,
        toolHandlers,
        onEvent: (event) => readOptions().onEvent?.(event),
        onFinish: (finish) => readOptions().onFinish?.(finish),
        onError: (error) => readOptions().onError?.(error),
    });
    const version = ref(0);
    const snapshot = () => {
        void version.value;
        return controller.getSnapshot();
    };

    const unsubscribe = controller.subscribe(() => {
        version.value++;
    });

    onMounted(() => {
        controller.start();
    });

    onUnmounted(() => {
        unsubscribe();
        controller.stop();
    });

    return {
        messages: computed(() => snapshot().messages),
        state: computed(() => snapshot().state),
        status: computed(() => snapshot().status),
        error: computed(() => snapshot().error),
        runId: computed(() => snapshot().runId),
        threadId: computed(() => snapshot().threadId),
        isRunning: computed(() => snapshot().isRunning),
        pendingClientTools: computed(() => snapshot().pendingClientTools),
        pendingToolApprovals: computed(() => snapshot().pendingToolApprovals),
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
