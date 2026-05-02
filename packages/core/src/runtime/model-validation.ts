import { supportsStructuredOutput, supportsTextOutput } from "../capabilities";
import type { AgentModelLike } from "../models";
import type { AgentOutput } from "../schema";
import { createRuntimeError } from "./errors";

export function validateModelSupportsTextOutput(model: AgentModelLike): void {
    if (supportsTextOutput(model.capabilities)) {
        return;
    }

    throw createRuntimeError("VALIDATION_FAILED", "Agent models must support text output.", {
        context: {
            providerId: model.providerId,
            modelId: model.modelId,
        },
    });
}

export function validateModelSupportsStructuredOutput(
    model: AgentModelLike,
    output: AgentOutput | undefined,
): void {
    if (!output || supportsStructuredOutput(model.capabilities)) {
        return;
    }

    throw createRuntimeError("VALIDATION_FAILED", "Model does not support structured output.", {
        context: {
            providerId: model.providerId,
            modelId: model.modelId,
        },
    });
}
