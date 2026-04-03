import { describe, expect, test } from "bun:test";
import { Events } from "../../src/events";
import type { BetterAgentRuntime } from "../../src/run";
import { createRuntime } from "../../src/run";
import {
    collectEvents,
    createScriptedModel,
    createTextAgent,
    createToolCallResponse,
} from "../helpers/mock-model";

describe("maxSteps and abort", () => {
    test("maxSteps enforces loop termination", async () => {
        const agent = createTextAgent({
            model: createScriptedModel([
                createToolCallResponse([{ callId: "call_1", name: "noop", arguments: "{}" }]),
                createToolCallResponse([{ callId: "call_2", name: "noop", arguments: "{}" }]),
            ]),
            tools: [
                {
                    kind: "server",
                    name: "noop",
                    schema: { type: "object", properties: {}, additionalProperties: false },
                    handler: async () => ({ ok: true }),
                    ["json_schema" as never]: {
                        type: "object",
                        properties: {},
                        additionalProperties: false,
                    },
                } as never,
            ],
        });
        const { events, onEvent } = collectEvents();
        const runtime = createRuntime({
            agents: [agent] as const,
        }) as unknown as BetterAgentRuntime;

        await runtime.run(agent.name, {
            input: "start",
            maxSteps: 1,
            onEvent,
        });

        const finish = events.find((event) => event.type === Events.STEP_FINISH);
        expect(finish && "terminationReason" in finish ? finish.terminationReason : undefined).toBe(
            "max_steps",
        );
    });

    test("aborted run emits RUN_ABORTED", async () => {
        const controller = new AbortController();
        const agent = createTextAgent();
        const { events, onEvent } = collectEvents();
        const runtime = createRuntime({
            agents: [agent] as const,
        }) as unknown as BetterAgentRuntime;

        controller.abort();

        expect(
            runtime.run(agent.name, {
                input: "hello",
                signal: controller.signal,
                onEvent,
            }),
        ).rejects.toMatchObject({ code: "ABORTED" });

        expect(events.map((event) => event.type)).toContain(Events.RUN_ABORTED);
    });
});
