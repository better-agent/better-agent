import { useEffect, useReducer, useRef } from "preact/hooks";
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
 * Preact hook for talking to one Better Agent conversation.
 *
 * Returns chat state and chat actions.
 *
 * @example
 * ```tsx
 * const agent = useAgent(client, {
 *   agent: "assistant",
 *   conversationId: "conv_123",
 * });
 *
 * await agent.sendMessage("Hello");
 *
 * console.log(agent.messages);
 * console.log(agent.status);
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
 *       {agent.messages.map((message) => (
 *         <div key={message.localId}>{message.role}</div>
 *       ))}
 *       <button onClick={() => agent.sendMessage("Hello")}>Send</button>
 *     </div>
 *   );
 * }
 * ```
 */
export const useAgent = <
    TApp = unknown,
    TAgentName extends AgentNameFromApp<TApp> = AgentNameFromApp<TApp>,
>(
    client: BetterAgentClient<TApp>,
    options: UseAgentOptions<TApp, TAgentName>,
): UseAgentResult<TApp, TAgentName> => {
    const [, forceRender] = useReducer((count: number) => count + 1, 0);
    const mountVersionRef = useRef(0);
    const latestClientRef = useRef(client);
    const latestOptionsRef = useRef(options);
    latestClientRef.current = client;
    latestOptionsRef.current = options;

    const controllerRef = useRef<AgentChatController<TApp, TAgentName> | null>(null);
    if (!controllerRef.current) {
        controllerRef.current = new AgentChatController<TApp, TAgentName>(
            client,
            cloneControllerOptions(options),
        );
    }
    const controller = controllerRef.current;

    /** Pushes the latest client and options into the controller. */
    const syncController = () => {
        controller.updateClient(latestClientRef.current);
        controller.updateOptions(
            cloneControllerOptions(latestOptionsRef.current) as UseAgentOptions<TApp, TAgentName>,
        );
    };

    useEffect(() => {
        controller.updateClient(latestClientRef.current);
        controller.updateOptions(
            cloneControllerOptions(latestOptionsRef.current) as UseAgentOptions<TApp, TAgentName>,
        );
    }, [controller]);

    useEffect(() => {
        const handleControllerChange = () => forceRender(undefined as never);
        return controller.subscribe(handleControllerChange);
    }, [controller]);

    useEffect(() => {
        const mountVersion = ++mountVersionRef.current;
        controller.updateClient(latestClientRef.current);
        controller.updateOptions(
            cloneControllerOptions(latestOptionsRef.current) as UseAgentOptions<TApp, TAgentName>,
        );
        controller.init();

        return () => {
            queueMicrotask(() => {
                if (mountVersionRef.current !== mountVersion) {
                    return;
                }

                controller.destroy();
                if (controllerRef.current === controller) {
                    controllerRef.current = null;
                }
            });
        };
    }, [controller]);

    const snapshot = controller.getSnapshot();

    return {
        id: snapshot.id,
        messages: snapshot.messages,
        status: snapshot.status,
        error: snapshot.error,
        streamId: snapshot.streamId,
        runId: snapshot.runId,
        conversationId: snapshot.conversationId,
        isLoading: snapshot.isLoading,
        isStreaming: snapshot.isStreaming,
        pendingToolApprovals: snapshot.pendingToolApprovals,
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
};
