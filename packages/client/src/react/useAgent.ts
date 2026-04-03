import { useEffect, useReducer, useRef } from "react";
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
 * React hook for talking to one Better Agent conversation.
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
    const latestClientRef = useRef(client);
    const latestOptionsRef = useRef(options);
    latestClientRef.current = client;
    latestOptionsRef.current = options;

    const controllerRef = useRef<AgentChatController<TApp, TAgentName> | null>(null);
    const ensureController = () => {
        if (!controllerRef.current) {
            controllerRef.current = new AgentChatController<TApp, TAgentName>(
                latestClientRef.current,
                cloneControllerOptions(latestOptionsRef.current),
            );
        }

        return controllerRef.current;
    };
    const controller = ensureController();

    const getController = () => {
        const current = ensureController();
        current.updateClient(latestClientRef.current);
        current.updateOptions(
            cloneControllerOptions(latestOptionsRef.current) as UseAgentOptions<TApp, TAgentName>,
        );
        return current;
    };

    useEffect(() => {
        controller.updateClient(latestClientRef.current);
        controller.updateOptions(
            cloneControllerOptions(latestOptionsRef.current) as UseAgentOptions<TApp, TAgentName>,
        );
    }, [controller]);

    useEffect(() => {
        return controller.subscribe(forceRender);
    }, [controller]);

    useEffect(() => {
        controller.updateClient(latestClientRef.current);
        controller.updateOptions(
            cloneControllerOptions(latestOptionsRef.current) as UseAgentOptions<TApp, TAgentName>,
        );
        controller.init();

        return () => {
            controller.destroy();
            if (controllerRef.current === controller) {
                controllerRef.current = null;
            }
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
            return getController().sendMessage(normalizeSendInput(input), requestOptions);
        },
        regenerate: async () => {
            const current = getController();
            await current.retryMessage(getLatestUserMessageId(current));
        },
        retryMessage: (localId) => {
            return getController().retryMessage(localId);
        },
        stop: () => {
            getController().stop();
        },
        resumeStream: (resumeOptions) => {
            return getController().resumeStream(resumeOptions);
        },
        resumeConversation: (resumeOptions) => {
            return getController().resumeConversation(resumeOptions);
        },
        approveToolCall: (params) => {
            return getController().approveToolCall(params);
        },
        clearError: () => {
            getController().clearError();
        },
        reset: () => {
            getController().reset();
        },
        setMessages: (input) => {
            getController().setMessages(input);
        },
    };
};
