import { describe, expect, test } from "bun:test";
import { BetterAgentError } from "@better-agent/shared/errors";
import { toJsonSchema } from "../src/schema/to-json-schema";
import { validateInput } from "../src/schema/validate-input";

describe("schema", () => {
    test("returns plain JSON schemas as-is", () => {
        const schema = { type: "object", properties: { name: { type: "string" } } };

        expect(toJsonSchema(schema)).toBe(schema);
    });

    test("uses Standard Schema JSON schema when available", () => {
        const schema = {
            "~standard": {
                jsonSchema: {
                    input: ({ target }: { target: "draft-2020-12" }) => ({
                        type: "object",
                        target,
                    }),
                },
            },
        };

        expect(toJsonSchema(schema)).toEqual({
            type: "object",
            target: "draft-2020-12",
        });
    });

    test("falls back for Standard Schema without JSON schema", () => {
        expect(toJsonSchema({ "~standard": {} })).toEqual({
            type: "object",
            properties: {},
        });
    });

    test("validateInput returns valid values", () => {
        const value = { name: "Ada" };

        expect(
            validateInput(
                {
                    type: "object",
                    properties: { name: { type: "string" } },
                    required: ["name"],
                },
                value,
            ),
        ).toBe(value);
    });

    test("validateInput supports draft-07 schemas", () => {
        const value = { docs: "Next.js routing" };

        expect(
            validateInput(
                {
                    $schema: "http://json-schema.org/draft-07/schema#",
                    type: "object",
                    properties: {
                        docs: { type: "string" },
                    },
                    required: ["docs"],
                },
                value,
            ),
        ).toBe(value);

        expect(() =>
            validateInput(
                {
                    $schema: "http://json-schema.org/draft-07/schema#",
                    type: "object",
                    properties: {
                        docs: { type: "string" },
                    },
                    required: ["docs"],
                },
                { docs: 7 },
            ),
        ).toThrow(BetterAgentError);
    });

    test("validateInput throws BetterAgentError with issues", () => {
        expect(() =>
            validateInput(
                {
                    type: "object",
                    properties: { count: { type: "number" } },
                    required: ["count"],
                },
                { count: "one" },
                { invalidMessage: "Bad payload." },
            ),
        ).toThrow(BetterAgentError);

        try {
            validateInput({ type: "number" }, "one", { invalidMessage: "Bad payload." });
        } catch (error) {
            expect(error).toBeInstanceOf(BetterAgentError);
            expect((error as BetterAgentError).message).toBe("Bad payload.");
            expect((error as BetterAgentError).context?.issues).toBeArray();
        }
    });
});
