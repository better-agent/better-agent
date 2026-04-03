import { describe, expect, test } from "bun:test";
import type { GenerativeModelResponse } from "../../src/providers";
import {
    evaluateStopConditions,
    shouldStopByMaxSteps,
    shouldStopNaturally,
} from "../../src/run/stop-conditions";

const createResponse = (output: GenerativeModelResponse["output"]): GenerativeModelResponse => ({
    output,
    finishReason: "stop" as const,
    usage: {},
});

describe("stop conditions", () => {
    test("shouldStopByMaxSteps returns false when maxSteps is undefined", () => {
        expect(shouldStopByMaxSteps({ stepIndex: 4, maxSteps: undefined })).toBeFalse();
    });

    test("shouldStopByMaxSteps returns true at boundary", () => {
        expect(shouldStopByMaxSteps({ stepIndex: 4, maxSteps: 5 })).toBeTrue();
    });

    test("shouldStopNaturally returns true when no tool calls in output", () => {
        expect(
            shouldStopNaturally({
                response: createResponse([{ type: "message", role: "assistant", content: "done" }]),
            }),
        ).toBeTrue();
    });

    test("evaluateStopConditions checks natural stop before maxSteps", () => {
        const decision = evaluateStopConditions({
            maxSteps: 1,
            stepIndex: 0,
            steps: [],
            messages: [],
            lastStep: {
                response: createResponse([{ type: "message", role: "assistant", content: "done" }]),
            } as never,
        });

        expect(decision).toEqual({ stop: true, reason: "no_tool_calls" });
    });

    test("evaluateStopConditions calls stopWhen with correct context shape", () => {
        let seen: Record<string, unknown> | undefined;

        const decision = evaluateStopConditions({
            maxSteps: 5,
            stepIndex: 1,
            stopWhen: (context) => {
                seen = context as unknown as Record<string, unknown>;
                return true;
            },
            steps: [] as never,
            messages: [{ type: "message", role: "user", content: "hi" }] as never,
            context: { accountId: "acct_1" },
            lastStep: {
                response: createResponse([
                    { type: "tool-call", callId: "call_1", name: "lookup", arguments: "{}" },
                ]),
            } as never,
        });

        expect(decision).toEqual({ stop: true, reason: "stop_when" });
        expect(seen).toMatchObject({
            stepIndex: 1,
            maxSteps: 5,
            context: { accountId: "acct_1" },
        });
    });
});
