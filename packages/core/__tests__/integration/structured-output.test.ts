import { describe, expect, test } from "bun:test";
import { defineAgent } from "../../src/agent";
import { createRuntime } from "../../src/run";
import { toStructuredOutputRequest } from "../../src/run/helpers";
import { createStructuredModel, createStructuredTextResponse } from "../helpers/mock-model";

describe("structured output", () => {
    const outputSchema = {
        schema: {
            type: "object",
            properties: { summary: { type: "string" } },
            required: ["summary"],
            additionalProperties: false,
        } as const,
    };

    test("valid JSON matching schema produces structured output", async () => {
        const agent = defineAgent({
            name: "structured",
            model: createStructuredModel([createStructuredTextResponse('{"summary":"ok"}')]),
            outputSchema,
        });
        const runtime = createRuntime({
            agents: [agent] as const,
        });

        const result = await runtime.run(agent.name, { input: "hello" });

        expect(result.structured).toEqual({ summary: "ok" });
    });

    test("invalid JSON throws when outputErrorMode is throw", async () => {
        const agent = defineAgent({
            name: "structured",
            model: createStructuredModel([createStructuredTextResponse("{bad json}")]),
            outputSchema,
            outputErrorMode: "throw",
        });
        const runtime = createRuntime({
            agents: [agent] as const,
        });

        expect(runtime.run(agent.name, { input: "hello" })).rejects.toMatchObject({
            code: "VALIDATION_FAILED",
        });
    });

    test("repair_text and repair_value recover parse and validation errors", async () => {
        const repairParseAgent = defineAgent({
            name: "repair-parse",
            model: createStructuredModel([createStructuredTextResponse("{bad json}")]),
            outputSchema,
            outputErrorMode: "repair",
            onOutputError: async (error) =>
                error.errorKind === "parse"
                    ? { action: "repair_text", text: '{"summary":"fixed"}' }
                    : { action: "throw" },
        });

        const repairValidationAgent = defineAgent({
            name: "repair-validation",
            model: createStructuredModel([createStructuredTextResponse('{"wrong":true}')]),
            outputSchema,
            outputErrorMode: "repair",
            onOutputError: async (error) =>
                error.errorKind === "validation"
                    ? { action: "repair_value", value: { summary: "fixed" } }
                    : { action: "throw" },
        });

        const runtime = createRuntime({
            agents: [repairParseAgent, repairValidationAgent] as const,
        });

        const parseResult = await runtime.run(repairParseAgent.name, { input: "hello" });
        const validationResult = await runtime.run(repairValidationAgent.name, { input: "hello" });

        expect(parseResult.structured).toEqual({ summary: "fixed" });
        expect(validationResult.structured).toEqual({ summary: "fixed" });
    });

    test("missing text triggers output error path", async () => {
        const agent = defineAgent({
            name: "missing-text",
            model: createStructuredModel([
                {
                    output: [
                        {
                            type: "message",
                            role: "assistant",
                            content: [{ type: "embedding", embedding: [0.1] }],
                        },
                    ],
                    finishReason: "stop",
                    usage: {},
                },
            ]),
            outputSchema,
            outputErrorMode: "repair",
            onOutputError: async (error) =>
                error.errorKind === "missing_text"
                    ? { action: "repair_value", value: { summary: "fallback" } }
                    : { action: "throw" },
        });
        const runtime = createRuntime({
            agents: [agent] as const,
        });

        const result = await runtime.run(agent.name, { input: "hello" });
        expect(result.structured).toEqual({ summary: "fallback" });
    });

    test("default outputSchema conversion is reused after defineAgent preflight", async () => {
        let conversionCalls = 0;
        const agent = defineAgent({
            name: "cached-structured",
            model: createStructuredModel([createStructuredTextResponse('{"summary":"ok"}')]),
            outputSchema: {
                schema: {
                    "~standard": {
                        version: 1,
                        vendor: "test",
                        jsonSchema: {
                            input(options: { target: string }) {
                                conversionCalls += 1;
                                if (options.target !== "draft-07") {
                                    throw new Error(`unsupported target: ${options.target}`);
                                }

                                return {
                                    type: "object",
                                    properties: { summary: { type: "string" } },
                                    required: ["summary"],
                                    additionalProperties: false,
                                };
                            },
                            output() {
                                return {
                                    type: "object",
                                };
                            },
                        },
                    },
                } as const,
            },
        });
        const runtime = createRuntime({
            agents: [agent] as const,
        });

        const result = await runtime.run(agent.name, { input: "hello" });

        expect(result.structured).toEqual({ summary: "ok" });
        expect(conversionCalls).toBe(1);
    });

    test("structured output normalizes object schemas to disallow extra properties", () => {
        const agent = defineAgent({
            name: "normalized-structured",
            model: createStructuredModel([createStructuredTextResponse('{"summary":"ok"}')]),
            outputSchema: {
                schema: {
                    "~standard": {
                        version: 1,
                        vendor: "test",
                        jsonSchema: {
                            input() {
                                return {
                                    type: "object",
                                    properties: {
                                        summary: { type: "string" },
                                        meta: {
                                            type: "object",
                                            properties: {
                                                source: { type: "string" },
                                            },
                                            required: ["source"],
                                        },
                                    },
                                    required: ["summary", "meta"],
                                };
                            },
                            output() {
                                return {
                                    type: "object",
                                };
                            },
                        },
                    },
                } as const,
            },
        });

        const structuredOutput = toStructuredOutputRequest(agent, agent.outputSchema);

        expect(structuredOutput).toMatchObject({
            schema: {
                type: "object",
                additionalProperties: false,
                properties: {
                    summary: { type: "string" },
                    meta: {
                        type: "object",
                        additionalProperties: false,
                        properties: {
                            source: { type: "string" },
                        },
                    },
                },
            },
        });
    });
});
