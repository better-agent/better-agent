import type { AgentOutput, InferAgentOutput } from "../schema";
import { validateInput } from "../schema";
import { createRuntimeError } from "./errors";

export function finalizeStructuredOutput<TOutput extends AgentOutput | undefined>(input: {
    output: TOutput;
    structured?: unknown;
}): InferAgentOutput<TOutput> | undefined {
    if (!input.output) {
        return undefined;
    }

    if (input.structured === undefined) {
        throw createRuntimeError("VALIDATION_FAILED", "Model did not return structured output.");
    }

    const validated = validateInput(input.output.schema, input.structured, {
        invalidMessage: "Structured output failed schema validation.",
    });

    return validated as InferAgentOutput<TOutput>;
}
