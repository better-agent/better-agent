import { createRenderEffect, createSignal, onCleanup, onMount } from "solid-js";
import { createAgentController } from "../core/controller";
import type { AgentNameOf } from "../core/inference";
import type {
    AgentControllerOptions,
    BetterAgentClientAgentHandle,
    BetterAgentClientAgentMemoryHandle,
} from "../types";
import type { MaybeAccessor, UseAgentOptions, UseAgentResult } from "./types";

const resolve = <T>(value: MaybeAccessor<T>): T =>
    typeof value === "function" ? (value as () => T)() : value;

export function useAgent<TApp = unknown, TName extends AgentNameOf<TApp> = AgentNameOf<TApp>>(
    agent: BetterAgentClientAgentMemoryHandle<TApp, TName>,
    options?: MaybeAccessor<UseAgentOptions<TApp, TName> | undefined>,
): UseAgentResult<TApp, TName>;
export function useAgent<TApp = unknown, TName extends AgentNameOf<TApp> = AgentNameOf<TApp>>(
    agent: BetterAgentClientAgentHandle<TApp, TName>,
    options?: MaybeAccessor<UseAgentOptions<TApp, TName> | undefined>,
): UseAgentResult<TApp, TName>;
export function useAgent<TApp = unknown, TName extends AgentNameOf<TApp> = AgentNameOf<TApp>>(
    agent: BetterAgentClientAgentHandle<TApp, TName>,
    options?: MaybeAccessor<UseAgentOptions<TApp, TName> | undefined>,
): UseAgentResult<TApp, TName> {
    const readOptions = (): UseAgentOptions<TApp, TName> =>
        (options === undefined ? {} : (resolve(options) ?? {})) as UseAgentOptions<TApp, TName>;
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
    const [snapshot, setSnapshot] = createSignal(controller.getSnapshot());

    const unsubscribe = controller.subscribe(() => {
        setSnapshot(controller.getSnapshot());
    });

    createRenderEffect(() => {
        readOptions();
    });

    onMount(() => {
        controller.start();
    });

    onCleanup(() => {
        unsubscribe();
        controller.stop();
    });

    return {
        messages: () => snapshot().messages,
        state: () => snapshot().state,
        status: () => snapshot().status,
        error: () => snapshot().error,
        runId: () => snapshot().runId,
        threadId: () => snapshot().threadId,
        isRunning: () => snapshot().isRunning,
        pendingClientTools: () => snapshot().pendingClientTools,
        pendingToolApprovals: () => snapshot().pendingToolApprovals,
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
