import { describe, expect, test } from "bun:test";
import { defineAgent } from "../../src/agent";
import {
    createStructuredModel,
    createStructuredTextResponse,
    createTextModel,
} from "../helpers/mock-model";

describe("defineAgent", () => {
    const instructionModel = {
        ...createTextModel(),
        caps: {
            ...createTextModel().caps,
            supportsInstruction: true as const,
        },
    };

    const validateOnlyContextSchema = {
        "~standard": {
            version: 1,
            vendor: "test",
            async validate(value: unknown) {
                return { value };
            },
        },
    } as const;

    test("defineAgent preserves all config fields", () => {
        const instruction = ({ userId }: { userId: string }) => `Hello ${userId}`;
        const agent = defineAgent({
            name: "assistant",
            model: instructionModel,
            instruction,
            maxSteps: 3,
            conversationReplay: { omitUnsupportedParts: false },
        });

        expect(agent.name).toBe("assistant");
        expect(agent.model.modelId).toBe("text");
        expect(agent.instruction).toBe(instruction);
        expect(agent.maxSteps).toBe(3);
        expect(agent.conversationReplay).toEqual({ omitUnsupportedParts: false });
    });

    test("defineAgent with minimal config works", () => {
        const agent = defineAgent({
            name: "assistant",
            model: createTextModel(),
        });

        expect(agent).toMatchObject({ name: "assistant" });
    });

    test("defineAgent rejects invalid outputSchema at definition time", () => {
        expect(() =>
            defineAgent({
                name: "structured",
                model: createStructuredModel([createStructuredTextResponse('{"ok":true}')]),
                outputSchema: {
                    schema: {
                        type: 123,
                    } as never,
                },
            }),
        ).toThrow();
    });

    test("defineAgent accepts validator-only contextSchema at definition time", () => {
        const agent = defineAgent({
            name: "assistant",
            model: createTextModel(),
            contextSchema: validateOnlyContextSchema,
        });

        expect(agent.contextSchema).toBe(validateOnlyContextSchema);
    });
});
