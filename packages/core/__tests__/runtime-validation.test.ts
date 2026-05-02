import { describe, expect, test } from "bun:test";
import { BetterAgentError } from "@better-agent/shared/errors";
import type { AgentModelLike } from "../src/models/types";
import { createRuntimeError } from "../src/runtime/errors";
import {
    validateModelSupportsStructuredOutput,
    validateModelSupportsTextOutput,
} from "../src/runtime/model-validation";

async function* emptyEvents() {}

const model = (capabilities: AgentModelLike["capabilities"]): AgentModelLike => ({
    providerId: "test",
    modelId: "model",
    capabilities,
    generate: async () => ({}),
    stream: async () => ({ events: emptyEvents(), final: Promise.resolve({}) }),
});

describe("runtime validation", () => {
    test("validates text and structured output support", () => {
        const supported = model({
            output: {
                supportedMimeTypes: ["text/plain"],
                structuredOutput: true,
            },
        });

        expect(() => validateModelSupportsTextOutput(supported)).not.toThrow();
        expect(() =>
            validateModelSupportsStructuredOutput(supported, { schema: { type: "object" } }),
        ).not.toThrow();
    });

    test("throws runtime errors for unsupported model capabilities", () => {
        expect(() => validateModelSupportsTextOutput(model({}))).toThrow(BetterAgentError);
        expect(() =>
            validateModelSupportsStructuredOutput(
                model({ output: { supportedMimeTypes: ["text/plain"] } }),
                { schema: { type: "object" } },
            ),
        ).toThrow(BetterAgentError);
    });

    test("createRuntimeError preserves code, message, cause, and context", () => {
        const cause = new Error("cause");
        const error = createRuntimeError("INVALID_STATE", "Bad state.", {
            cause,
            context: { runId: "run-1" },
        });

        expect(error).toBeInstanceOf(BetterAgentError);
        expect(error.code).toBe("INVALID_STATE");
        expect(error.message).toBe("Bad state.");
        expect(error.cause).toBe(cause);
        expect(error.context).toEqual({ runId: "run-1" });
    });
});
