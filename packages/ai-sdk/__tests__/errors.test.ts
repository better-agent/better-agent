import { describe, expect, test } from "bun:test";
import { BetterAgentError } from "@better-agent/shared/errors";
import { disableAiSdkWarnings, wrapAiSdkError } from "../src/errors";

describe("errors", () => {
    test("disableAiSdkWarnings disables global AI SDK warnings", () => {
        (globalThis as { AI_SDK_LOG_WARNINGS?: unknown }).AI_SDK_LOG_WARNINGS = () => {};

        disableAiSdkWarnings();

        expect((globalThis as { AI_SDK_LOG_WARNINGS?: unknown }).AI_SDK_LOG_WARNINGS).toBe(false);
    });

    test("wrapAiSdkError returns BetterAgentError unchanged", () => {
        const error = BetterAgentError.fromCode("VALIDATION_FAILED", "Invalid input.");

        expect(wrapAiSdkError(error)).toBe(error);
    });

    test("wrapAiSdkError wraps provider errors", () => {
        const error = wrapAiSdkError(new Error("Provider failed."));

        expect(error).toBeInstanceOf(BetterAgentError);
        expect(error.code).toBe("UPSTREAM_FAILED");
        expect(error.message).toBe("Provider failed.");
    });

    test("wrapAiSdkError uses a fallback message", () => {
        expect(wrapAiSdkError({}).message).toBe("AI provider request failed.");
    });
});
