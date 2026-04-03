import type {
    AudioContentBase,
    Capabilities,
    ConversationItem,
    ConversationMessage,
    EmbeddingContentBase,
    FileContentBase,
    GenerativeModelInput,
    GenerativeModelInputItem,
    GenerativeModelInputMessage,
    GenerativeModelInputMessageContent,
    GenerativeModelToolCallResult,
    ImageContentBase,
    ReasoningContentBase,
    TextContentBase,
    TranscriptContentBase,
    VideoContentBase,
} from "../providers";

/** Converts run input into provider input items. */
export const normalizeInputToMessages = (
    input: GenerativeModelInput,
    caps: Capabilities,
): GenerativeModelInputItem[] => {
    if (typeof input === "string") {
        return [
            caps.inputShape === "prompt"
                ? {
                      type: "message",
                      content: input,
                  }
                : {
                      type: "message",
                      role: "user",
                      content: input,
                  },
        ] as GenerativeModelInputItem[];
    }

    return [...input];
};

/** Converts run input into durable conversation items. */
export const normalizeInputToConversationItems = (
    input: GenerativeModelInput,
    caps: Capabilities,
): ConversationItem[] =>
    normalizeInputToMessages(input, caps).map((item) =>
        item.type === "message"
            ? ({
                  type: "message",
                  role: "role" in item ? item.role : "user",
                  content: item.content,
              } satisfies ConversationMessage)
            : item,
    );

/** Projects durable conversation items back into provider input. */
export const projectConversationItemsToInput = (
    items: ConversationItem[],
    caps: Capabilities,
): GenerativeModelInputItem[] =>
    items.flatMap((item) => {
        switch (item.type) {
            case "message": {
                const projectedContent =
                    typeof item.content === "string"
                        ? item.content
                        : (item.content
                              .map((part) => {
                                  switch (part.type) {
                                      case "text":
                                      case "image":
                                      case "audio":
                                      case "video":
                                      case "file":
                                      case "embedding":
                                      case "transcript":
                                      case "reasoning":
                                          return part;
                                  }
                              })
                              .filter(
                                  (part) => part !== null,
                              ) as GenerativeModelInputMessageContent);
                if (projectedContent === null) {
                    return [];
                }
                if (Array.isArray(projectedContent) && projectedContent.length === 0) {
                    return [];
                }

                return [
                    caps.inputShape === "prompt"
                        ? ({
                              type: "message",
                              content: projectedContent,
                          } as GenerativeModelInputItem)
                        : ({
                              type: "message",
                              role: item.role,
                              content: projectedContent,
                          } as GenerativeModelInputItem),
                ];
            }
            case "tool-call":
                return "result" in item ? [item as GenerativeModelToolCallResult] : [];
            case "provider-tool-result":
                return [item];
        }
    });

/** Removes replayed parts the model cannot accept. */
export const pruneInputByCapabilities = (
    input: GenerativeModelInputItem[],
    caps: Capabilities,
): GenerativeModelInputItem[] => {
    const textSupported = caps.inputModalities?.text !== false;

    const isSupportedPart = (
        part:
            | TextContentBase
            | TranscriptContentBase
            | ReasoningContentBase
            | ImageContentBase
            | AudioContentBase
            | VideoContentBase
            | FileContentBase
            | EmbeddingContentBase,
    ): boolean => {
        switch (part.type) {
            case "text":
            case "transcript":
            case "reasoning":
                return textSupported;
            case "image":
            case "audio":
            case "video":
            case "file":
            case "embedding":
                return caps.inputModalities?.[part.type] === true;
        }
    };

    const pruneMessage = (message: GenerativeModelInputMessage): GenerativeModelInputItem[] => {
        if (typeof message.content === "string") {
            return textSupported ? [message] : [];
        }

        const content = message.content.filter(isSupportedPart);
        if (content.length === 0) {
            return [];
        }

        return [{ ...message, content }];
    };

    return input.flatMap((item) => {
        if (item.type !== "message") {
            return [item];
        }

        return pruneMessage(item);
    });
};
