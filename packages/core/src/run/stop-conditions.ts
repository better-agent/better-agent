import type {
    Capabilities,
    GenerativeModelInputItem,
    GenerativeModelToolCallRequest,
} from "../providers";
import type { ResolvableSchema } from "../schema";
import type { PreviousStepResult, StopWhen, StopWhenContext } from "./types";

/** Stop decision for loop evaluation. */
export type LoopStopDecision =
    | { stop: false }
    | { stop: true; reason: "max_steps" | "stop_when" | "no_tool_calls" };

/** Extracts tool-call requests from a response. */
export const extractToolCallRequests = (
    response: PreviousStepResult["response"],
): GenerativeModelToolCallRequest[] =>
    response.output.filter(
        (item): item is GenerativeModelToolCallRequest =>
            item.type === "tool-call" && "arguments" in item,
    );

/** Checks whether the loop hit `maxSteps`. */
export const shouldStopByMaxSteps = (params: {
    stepIndex: number;
    maxSteps: number | undefined;
}): boolean =>
    params.maxSteps !== undefined && params.maxSteps > 0 && params.stepIndex + 1 >= params.maxSteps;

/** Checks whether the loop produced no tool calls. */
export const shouldStopNaturally = (params: {
    response: PreviousStepResult["response"];
}): boolean => extractToolCallRequests(params.response).length === 0;

/** Evaluates stop conditions for the current step. */
export const evaluateStopConditions = <
    TContextSchema extends ResolvableSchema | undefined,
    TContext,
    TModelCaps extends Capabilities = Capabilities,
>(params: {
    maxSteps: number | undefined;
    stepIndex: number;
    stopWhen?: StopWhen<TContextSchema, TContext, TModelCaps>;
    steps: PreviousStepResult[];
    messages: GenerativeModelInputItem<TModelCaps>[];
    context?: TContext;
    lastStep: PreviousStepResult;
}): LoopStopDecision => {
    if (shouldStopNaturally({ response: params.lastStep.response })) {
        return { stop: true, reason: "no_tool_calls" };
    }

    // Add `context` only when present.
    const baseStopWhenContext = {
        stepIndex: params.stepIndex,
        maxSteps: params.maxSteps,
        lastStep: params.lastStep,
        steps: params.steps,
        messages: params.messages,
    };

    const stopWhenContext =
        params.context !== undefined
            ? { ...baseStopWhenContext, context: params.context }
            : baseStopWhenContext;

    if (
        params.stopWhen?.(
            stopWhenContext as StopWhenContext<TContextSchema, TContext, TModelCaps>,
        ) === true
    ) {
        return { stop: true, reason: "stop_when" };
    }

    if (
        shouldStopByMaxSteps({
            stepIndex: params.stepIndex,
            maxSteps: params.maxSteps,
        })
    ) {
        return { stop: true, reason: "max_steps" };
    }

    return { stop: false };
};
