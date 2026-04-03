import { describe, expect, test } from "bun:test";
import { ok } from "@better-agent/shared/neverthrow";
import { Events } from "../../src/events";
import type { BetterAgentRuntime } from "../../src/run";
import { createRuntime } from "../../src/run";
import {
    collectEvents,
    createScriptedModel,
    createTextAgent,
    createTextModel,
    createTextResponse,
    createToolCallResponse,
} from "../helpers/mock-model";

describe("runtime.run()", () => {
    test("merges defaultModelOptions with per-run modelOptions", async () => {
        const seenModelInputs: Array<Record<string, unknown>> = [];
        const agent = createTextAgent({
            defaultModelOptions: {
                reasoningEffort: "low",
                reasoningSummary: "auto",
                textVerbosity: "low",
            },
            model: createTextModel((options) => {
                seenModelInputs.push(options);
            }),
        });
        const runtime = createRuntime({
            agents: [agent] as const,
        }) as unknown as BetterAgentRuntime;

        await runtime.run(agent.name, {
            input: "hello",
            modelOptions: {
                reasoningEffort: "high",
                textVerbosity: "high",
            },
        });

        expect(seenModelInputs[0]?.reasoningEffort).toBe("high");
        expect(seenModelInputs[0]?.reasoningSummary).toBe("auto");
        expect(seenModelInputs[0]?.textVerbosity).toBe("high");
    });

    test("forwards effective modalities and lets run-level modalities override agent defaults", async () => {
        const seenModelInputs: Array<Record<string, unknown>> = [];
        const agent = createTextAgent({
            defaultModalities: ["text"] as const,
            model: {
                providerId: "test",
                modelId: "multimodal",
                caps: {
                    inputShape: "chat",
                    inputModalities: {
                        text: true,
                        image: false,
                        audio: false,
                        video: false,
                        file: false,
                    },
                    outputModalities: {
                        text: true,
                        image: {
                            options: {
                                image_quality: "standard" as const,
                            },
                        },
                    },
                },
                async doGenerate(options: Record<string, unknown>) {
                    seenModelInputs.push(options as Record<string, unknown>);
                    return ok({
                        response: createTextResponse("done"),
                    });
                },
            },
        });
        const runtime = createRuntime({
            agents: [agent] as const,
        }) as unknown as BetterAgentRuntime;

        await runtime.run(agent.name, {
            input: "hello",
            modelOptions: {
                image_quality: "standard",
            },
            modalities: ["image"] as never,
        });

        expect(seenModelInputs[0]?.modalities).toEqual(["image"]);

        await runtime.run(agent.name, {
            input: "hello again",
        });

        expect(seenModelInputs[1]?.modalities).toEqual(["text"]);
    });

    test("single-step run completes and emits ordered lifecycle events", async () => {
        const agent = createTextAgent({
            model: createScriptedModel([createTextResponse("done")]),
        });
        const { events, onEvent } = collectEvents();
        const runtime = createRuntime({
            agents: [agent] as const,
        }) as unknown as BetterAgentRuntime;

        const result = await runtime.run(agent.name, {
            input: "hello",
            onEvent,
        });

        expect(result.response.output).toEqual(createTextResponse("done").output);
        expect(events.map((event) => event.type)).toEqual([
            Events.RUN_STARTED,
            Events.STEP_START,
            Events.STEP_FINISH,
            Events.RUN_FINISHED,
        ]);
    });

    test("multi-step run executes tool loop and returns final assistant response", async () => {
        const tool = {
            kind: "server" as const,
            name: "lookup",
            description: "Lookup",
            schema: {
                type: "object",
                properties: { id: { type: "string" } },
                required: ["id"],
            } as const,
            handler: async ({ id }: { id: string }) => ({ id, status: "ok" }),
            ["json_schema" as never]: {
                type: "object",
                properties: { id: { type: "string" } },
                required: ["id"],
            },
        } as never;

        const agent = createTextAgent({
            model: createScriptedModel([
                createToolCallResponse([
                    { callId: "call_1", name: "lookup", arguments: '{"id":"a1"}' },
                ]),
                createTextResponse("final"),
            ]),
            tools: [tool],
        });
        const runtime = createRuntime({
            agents: [agent] as const,
        }) as unknown as BetterAgentRuntime;

        const result = await runtime.run(agent.name, {
            input: "hello",
        });

        expect(result.response.output).toEqual(createTextResponse("final").output);
    });
});
