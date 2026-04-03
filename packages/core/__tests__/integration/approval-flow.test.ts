import { describe, expect, test } from "bun:test";
import { ok } from "@better-agent/shared/neverthrow";
import type { AnyAgentDefinition } from "../../src";
import { Events } from "../../src/events";
import type { BetterAgentRuntime } from "../../src/run";
import { createRuntime } from "../../src/run";
import { defineTool } from "../../src/tools";
import {
    collectEvents,
    createScriptedModel,
    createTextAgent,
    createTextResponse,
    createToolCallResponse,
} from "../helpers/mock-model";

describe("tool approval flow", () => {
    test("run rejects agents with approval-gated tools", async () => {
        const tool = defineTool({
            name: "dangerous",
            schema: {
                type: "object",
                properties: { amount: { type: "number" } },
                required: ["amount"],
                additionalProperties: false,
            } as const,
            approval: { required: true, timeoutMs: 50 },
        }).server(async ({ amount }) => ({ approved: amount < 5 }));

        const agent = createTextAgent({
            model: createScriptedModel([
                createToolCallResponse([
                    { callId: "call_1", name: "dangerous", arguments: '{"amount":10}' },
                ]),
                createTextResponse("handled denial"),
            ]),
            tools: [tool] as never,
        }) as unknown as AnyAgentDefinition;
        const { onEvent } = collectEvents();
        const runtime = createRuntime({
            agents: [agent] as const,
        }) as unknown as BetterAgentRuntime;

        expect(runtime.run(agent.name, { input: "run", onEvent })).rejects.toMatchObject({
            code: "BAD_REQUEST",
            message:
                "Run failed: Non-stream runs do not support interactive tools. Use stream() for approval-gated tool 'dangerous'.",
        });
    });

    test("stream approval request emits events and denied approval returns control to the model", async () => {
        const tool = defineTool({
            name: "dangerous",
            schema: {
                type: "object",
                properties: { amount: { type: "number" } },
                required: ["amount"],
                additionalProperties: false,
            } as const,
            approval: { required: true, timeoutMs: 5_000 },
        }).server(async ({ amount }) => ({ approved: amount < 5 }));

        const responses = [
            createToolCallResponse([
                { callId: "call_1", name: "dangerous", arguments: '{"amount":10}' },
            ]),
            createTextResponse("handled denial"),
        ];
        const agent = createTextAgent({
            model: {
                ...createTextAgent().model,
                async doGenerateStream() {
                    const response = responses.shift() ?? createTextResponse("handled denial");
                    return ok({
                        events: (async function* () {})(),
                        final: Promise.resolve(response),
                    });
                },
            },
            tools: [tool] as never,
        }) as unknown as AnyAgentDefinition;
        const { events, onEvent } = collectEvents();
        const runtime = createRuntime({
            agents: [agent] as const,
        }) as unknown as BetterAgentRuntime;
        const stream = runtime.stream(agent.name, { input: "run", onEvent });
        const consumeEvents = (async () => {
            for await (const _event of stream.events) {
                // drain stream events while onEvent collects them
            }
        })();

        await new Promise((resolve) => setTimeout(resolve, 10));
        const requiredEvent = events.find((event) => event.type === Events.TOOL_APPROVAL_REQUIRED);
        expect(requiredEvent).toBeDefined();
        const runId = requiredEvent && "runId" in requiredEvent ? requiredEvent.runId : "";

        const submitted = await runtime.submitToolApproval({
            runId,
            toolCallId: "call_1",
            decision: "denied",
            note: "nope",
        });

        expect(submitted).toBeTrue();
        const result = await stream.result;
        await consumeEvents;

        expect(result.response.output).toEqual(createTextResponse("handled denial").output);
        expect(events.map((event) => event.type)).toContain(Events.TOOL_APPROVAL_UPDATED);
    });

    test("agent advanced approval timeout applies when tool approval timeout is omitted", async () => {
        const tool = defineTool({
            name: "dangerous",
            schema: {
                type: "object",
                properties: { amount: { type: "number" } },
                required: ["amount"],
                additionalProperties: false,
            } as const,
            approval: { required: true },
        }).server(async ({ amount }) => ({ approved: amount < 5 }));

        const agent = createTextAgent({
            model: {
                ...createTextAgent().model,
                async doGenerateStream() {
                    return ok({
                        events: (async function* () {})(),
                        final: Promise.resolve(
                            createToolCallResponse([
                                { callId: "call_1", name: "dangerous", arguments: '{"amount":10}' },
                            ]),
                        ),
                    });
                },
            },
            advanced: {
                toolApprovalTimeoutMs: 1,
            },
            tools: [tool] as never,
        }) as unknown as AnyAgentDefinition;
        const runtime = createRuntime({
            agents: [agent] as const,
        }) as unknown as BetterAgentRuntime;

        const stream = runtime.stream(agent.name, { input: "run" });

        expect(stream.result).rejects.toMatchObject({
            code: "TIMEOUT",
            message: "Run failed: Timed out waiting for approval of 'dangerous'.",
        });
    });
});
