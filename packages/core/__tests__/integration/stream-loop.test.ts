import { describe, expect, test } from "bun:test";
import { Events } from "../../src/events";
import type { BetterAgentRuntime } from "../../src/run";
import { createRuntime } from "../../src/run";
import {
    collectStreamEvents,
    createStreamModel,
    createTextAgent,
    createTextResponse,
} from "../helpers/mock-model";

describe("runtime.stream()", () => {
    test("stream emits model events and resolves final result", async () => {
        const agent = createTextAgent({
            model: createStreamModel({
                response: createTextResponse("streamed"),
            }),
        });
        const runtime = createRuntime({
            agents: [agent] as const,
        }) as unknown as BetterAgentRuntime;

        const stream = runtime.stream(agent.name, { input: "hello" });
        const [events, result] = await Promise.all([
            collectStreamEvents(stream.events),
            stream.result,
        ]);

        expect(events.map((event) => event.type)).toContain(Events.TEXT_MESSAGE_START);
        expect(events.map((event) => event.type)).toContain(Events.TEXT_MESSAGE_CONTENT);
        expect(events.map((event) => event.type)).toContain(Events.TEXT_MESSAGE_END);
        expect(result.response.output).toEqual(createTextResponse("streamed").output);
    });
});
