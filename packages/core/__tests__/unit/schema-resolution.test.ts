import { describe, expect, test } from "bun:test";
import { resolveToJsonSchema, validateInput } from "../../src/schema";

const standardSchema = {
    "~standard": {
        version: 1,
        vendor: "test",
        jsonSchema: {
            input() {
                return {
                    type: "object",
                    properties: {
                        name: { type: "string" },
                    },
                    required: ["name"],
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
} as const;

describe("schema resolution", () => {
    test("resolveToJsonSchema accepts raw JSON Schema and Standard JSON Schema", () => {
        expect(
            resolveToJsonSchema({
                type: "object",
                properties: {
                    name: { type: "string" },
                },
            }).isOk(),
        ).toBeTrue();
        expect(resolveToJsonSchema(standardSchema).isOk()).toBeTrue();
    });

    test("resolveToJsonSchema supports Standard JSON Schema adapters that only emit draft-2020-12", () => {
        const schema = {
            "~standard": {
                version: 1,
                vendor: "test",
                jsonSchema: {
                    input(options: { target: string }) {
                        if (options.target !== "draft-2020-12") {
                            throw new Error(`unsupported target: ${options.target}`);
                        }

                        return {
                            $schema: "https://json-schema.org/draft/2020-12/schema",
                            type: "array",
                            prefixItems: [{ type: "string" }],
                        };
                    },
                    output() {
                        return {
                            type: "array",
                        };
                    },
                },
            },
        } as const;

        const resolved = resolveToJsonSchema(schema);
        expect(resolved.isOk()).toBeTrue();
        expect(resolved._unsafeUnwrap()).toEqual({
            $schema: "https://json-schema.org/draft/2020-12/schema",
            type: "array",
            prefixItems: [{ type: "string" }],
        });
    });

    test("resolveToJsonSchema rejects invalid input and accepts unresolved Standard JSON Schema exports", async () => {
        expect(resolveToJsonSchema(null as never).isErr()).toBeTrue();
        expect(resolveToJsonSchema("bad" as never).isErr()).toBeTrue();

        const invalidStandardJsonSchema = {
            "~standard": {
                version: 1,
                vendor: "test",
                jsonSchema: {
                    input() {
                        return {
                            type: 123,
                        };
                    },
                    output() {
                        return {
                            type: "object",
                        };
                    },
                },
            },
        } as const;

        expect(resolveToJsonSchema(invalidStandardJsonSchema).isOk()).toBeTrue();
        expect((await validateInput(invalidStandardJsonSchema, { value: "x" })).isErr()).toBeTrue();
    });

    test("resolveToJsonSchema rejects validation-only Standard Schema", () => {
        const validationOnlySchema = {
            "~standard": {
                version: 1,
                vendor: "test",
                validate(value: unknown) {
                    return { value };
                },
            },
        } as const;

        const resolved = resolveToJsonSchema(validationOnlySchema as never);
        expect(resolved.isErr()).toBeTrue();
        expect(resolved._unsafeUnwrapErr().message).toContain("Standard JSON Schema");
    });

    test("validateInput validates Standard JSON Schema and raw JSON Schema inputs", async () => {
        expect(
            (await validateInput<{ name: string }>(standardSchema, { name: "Ada" })).isOk(),
        ).toBeTrue();
        expect(
            (
                await validateInput<{ name: string }>(
                    {
                        type: "object",
                        properties: { name: { type: "string" } },
                        required: ["name"],
                        additionalProperties: false,
                    },
                    { name: "Ada" },
                )
            ).isOk(),
        ).toBeTrue();
    });

    test("validateInput accepts validation-only Standard Schema", async () => {
        const validationOnlySchema = {
            "~standard": {
                version: 1,
                vendor: "test",
                async validate(value: unknown) {
                    return { value };
                },
            },
        } as const;

        expect(
            (await validateInput(validationOnlySchema as never, { name: "Ada" })).isOk(),
        ).toBeTrue();
    });

    test("validateInput returns errors for invalid data", async () => {
        expect((await validateInput(standardSchema, {})).isErr()).toBeTrue();

        const draft2020Schema = {
            "~standard": {
                version: 1,
                vendor: "test",
                jsonSchema: {
                    input(options: { target: string }) {
                        if (options.target !== "draft-2020-12") {
                            throw new Error(`unsupported target: ${options.target}`);
                        }

                        return {
                            $schema: "https://json-schema.org/draft/2020-12/schema",
                            type: "array",
                            prefixItems: [{ type: "string" }],
                            minItems: 1,
                        };
                    },
                    output() {
                        return {
                            type: "array",
                        };
                    },
                },
            },
        } as const;

        expect((await validateInput(draft2020Schema, ["Ada"])).isOk()).toBeTrue();
        expect((await validateInput(draft2020Schema, [1])).isErr()).toBeTrue();
    });
});
