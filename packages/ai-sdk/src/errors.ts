import { BetterAgentError } from "@better-agent/shared/errors";

export const disableAiSdkWarnings = (): void => {
    globalThis.AI_SDK_LOG_WARNINGS = false;
};

const getErrorMessage = (error: unknown): string => {
    if (error instanceof Error && error.message.trim()) {
        return error.message;
    }

    return "AI provider request failed.";
};

export const wrapAiSdkError = (error: unknown): BetterAgentError => {
    if (error instanceof BetterAgentError) {
        return error;
    }

    return BetterAgentError.fromCode("UPSTREAM_FAILED", getErrorMessage(error), {
        stackFrom: wrapAiSdkError,
    });
};
