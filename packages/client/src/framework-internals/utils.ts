import type { AgentChatController } from "../core/controller";
import type { AgentNameFromApp } from "../types/client-type-helpers";
import type { AgentChatControllerOptions, ControllerRunInput } from "../types/controller";

/**
 * Normalizes the public `sendMessage` shorthand into the controller's full input shape.
 *
 * Framework wrappers allow `sendMessage("hello")`, but the controller expects
 * an object like `{ input: "hello" }`.
 */
export const normalizeSendInput = (input: ControllerRunInput | string): ControllerRunInput =>
    typeof input === "string" ? { input } : input;

/**
 * Returns the newest user message id so integrations can implement `regenerate()`.
 *
 * Regeneration is modeled as "retry the last user-authored message". If the
 * conversation has no user message yet, regeneration is not possible.
 */
export const getLatestUserMessageId = <
    TApp,
    TAgentName extends AgentNameFromApp<TApp> = AgentNameFromApp<TApp>,
>(
    controller: AgentChatController<TApp, TAgentName>,
): string => {
    const latestUserMessage = [...controller.getMessages()]
        .reverse()
        .find((message) => message.role === "user");

    if (!latestUserMessage) {
        throw new Error("Cannot regenerate without a prior user message.");
    }

    return latestUserMessage.localId;
};

/**
 * Copies controller options before wrappers pass them into `AgentChatController`.
 *
 * This keeps the controller from sharing the same `resume` or
 * `optimisticUserMessage` objects with the caller.
 */
export const cloneControllerOptions = <
    TApp,
    TAgentName extends AgentNameFromApp<TApp> = AgentNameFromApp<TApp>,
>(
    options: AgentChatControllerOptions<TApp, TAgentName>,
): AgentChatControllerOptions<TApp, TAgentName> => ({
    ...options,
    ...(typeof options.resume === "object" && options.resume !== null
        ? { resume: { ...options.resume } }
        : {}),
    ...(typeof options.optimisticUserMessage === "object" &&
    options.optimisticUserMessage !== null &&
    !Array.isArray(options.optimisticUserMessage)
        ? {
              optimisticUserMessage: {
                  ...options.optimisticUserMessage,
              },
          }
        : {}),
});
