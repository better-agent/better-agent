import { describe, expect, test } from "bun:test";
import type { BetterAgentRuntime } from "../../src/run";
import { createRuntime } from "../../src/run";
import type { OnToolError } from "../../src/tools";
import { defineTool } from "../../src/tools";
import {
    createScriptedModel,
    createTextAgent,
    createTextResponse,
    createToolCallResponse,
} from "../helpers/mock-model";

describe("tool errors", () => {
    const replaceExecutionError = (async (error: { errorKind: string }) =>
        error.errorKind === "execution"
            ? { action: "result", value: { ok: true } }
            : { action: "skip" }) as unknown as OnToolError;

    test("parse and validation errors are sent back to the model as tool_error results", async () => {
        const agent = createTextAgent({
            model: createScriptedModel([
                createToolCallResponse([{ callId: "call_1", name: "lookup", arguments: "{bad" }]),
                createToolCallResponse([
                    { callId: "call_2", name: "lookup", arguments: '{"wrong":1}' },
                ]),
                createTextResponse("done"),
            ]),
            tools: [
                defineTool({
                    name: "lookup",
                    schema: {
                        type: "object",
                        properties: { id: { type: "string" } },
                        required: ["id"],
                        additionalProperties: false,
                    } as const,
                }).server(async ({ id }) => ({ id })) as never,
            ] as never,
        });
        const runtime = createRuntime({
            agents: [agent] as const,
        }) as unknown as BetterAgentRuntime;

        const result = await runtime.run(agent.name, { input: "hello" });
        expect(result.response.output).toEqual(createTextResponse("done").output);
    });

    test("execution error throws when toolErrorMode is throw", async () => {
        const agent = createTextAgent({
            model: createScriptedModel([
                createToolCallResponse([{ callId: "call_1", name: "explode", arguments: "{}" }]),
            ]),
            tools: [
                defineTool({
                    name: "explode",
                    schema: {
                        type: "object",
                        properties: {},
                        additionalProperties: false,
                    } as const,
                }).server(async () => {
                    throw new Error("boom");
                }, undefined) as never,
            ] as never,
            toolErrorMode: "throw",
        });
        const runtime = createRuntime({
            agents: [agent] as const,
        }) as unknown as BetterAgentRuntime;

        expect(runtime.run(agent.name, { input: "hello" })).rejects.toBeDefined();
    });

    test("onToolError can replace an execution error with a result", async () => {
        const agent = createTextAgent({
            model: createScriptedModel([
                createToolCallResponse([{ callId: "call_1", name: "explode", arguments: "{}" }]),
                createTextResponse("recovered"),
            ]),
            tools: [
                defineTool({
                    name: "explode",
                    schema: {
                        type: "object",
                        properties: {},
                        additionalProperties: false,
                    } as const,
                }).server(async () => {
                    throw new Error("boom");
                }) as never,
            ] as never,
            onToolError: replaceExecutionError,
        });
        const runtime = createRuntime({
            agents: [agent] as const,
        }) as unknown as BetterAgentRuntime;

        const result = await runtime.run(agent.name, { input: "hello" });
        expect(result.response.output).toEqual(createTextResponse("recovered").output);
    });
});
