import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";
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
    options?: UseAgentOptions<TApp, TName>,
): UseAgentResult<TApp, TName>;
export function useAgent<TApp = unknown, TName extends AgentNameOf<TApp> = AgentNameOf<TApp>>(
    agent: BetterAgentClientAgentHandle<TApp, TName>,
    options?: UseAgentOptions<TApp, TName>,
): UseAgentResult<TApp, TName>;
export function useAgent<TApp = unknown, TName extends AgentNameOf<TApp> = AgentNameOf<TApp>>(
    agent: BetterAgentClientAgentHandle<TApp, TName>,
    options: UseAgentOptions<TApp, TName> = {},
): UseAgentResult<TApp, TName> {
    const latestOptionsRef = useRef(options);
    latestOptionsRef.current = options;

    const toolHandlers = useMemo<AgentControllerOptions<TApp, TName>["toolHandlers"]>(
        () =>
            new Proxy(
                {},
                {
                    get(_target, key) {
                        const handlers = latestOptionsRef.current.toolHandlers as
                            | Record<PropertyKey, unknown>
                            | undefined;
                        return handlers?.[key];
                    },
                },
            ) as AgentControllerOptions<TApp, TName>["toolHandlers"],
        [],
    );

    const lifecycleHooks = useMemo<
        Pick<AgentControllerOptions<TApp, TName>, "onEvent" | "onFinish" | "onError">
    >(
        () => ({
            onEvent: (event) => latestOptionsRef.current.onEvent?.(event),
            onFinish: (finish) => latestOptionsRef.current.onFinish?.(finish),
            onError: (error) => latestOptionsRef.current.onError?.(error),
        }),
        [],
    );

    const controller = useMemo(() => {
        const controllerOptions: AgentControllerOptions<TApp, TName> = {
            initialMessages: options.initialMessages,
            initialState: options.initialState,
            initialInterruptState: options.initialInterruptState,
            resume: options.resume,
            context: options.context,
            threadId: options.threadId,
            toolHandlers,
            onEvent: lifecycleHooks.onEvent,
            onFinish: lifecycleHooks.onFinish,
            onError: lifecycleHooks.onError,
        };
        return createAgentController<TApp, TName>(agent, controllerOptions);
    }, [
        agent,
        options.initialMessages,
        options.initialState,
        options.initialInterruptState,
        options.resume,
        options.context,
        options.threadId,
        toolHandlers,
        lifecycleHooks,
    ]);

    useEffect(() => {
        controller.start();
    }, [controller]);

    const snapshot = useSyncExternalStore(
        (listener) => controller.subscribe(listener),
        () => controller.getSnapshot(),
        () => controller.getSnapshot(),
    );

    return {
        ...snapshot,
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
