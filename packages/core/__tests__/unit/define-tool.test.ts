import { describe, expect, test } from "bun:test";
import { TOOL_CLEANUP, TOOL_JSON_SCHEMA } from "../../src/tools/constants";
import { defineTool } from "../../src/tools/define-tool";

describe("defineTool", () => {
    test("defineTool().server() produces server tool with handler", async () => {
        const tool = defineTool({
            name: "lookup",
            schema: { type: "object", properties: {}, additionalProperties: false } as const,
        }).server(async () => "ok");

        expect(tool.kind).toBe("server");
        await expect(tool.handler({} as never, {} as never)).resolves.toBe("ok");
    });

    test("defineTool().client() produces client tool", () => {
        const tool = defineTool({
            name: "lookup",
            schema: { type: "object", properties: {}, additionalProperties: false } as const,
        }).client();

        expect(tool.kind).toBe("client");
        expect("handler" in tool).toBeFalse();
    });

    test("defineTool with as option renames the tool", () => {
        const tool = defineTool({
            name: "lookup",
            schema: { type: "object", properties: {}, additionalProperties: false } as const,
        }).server(async () => "ok", { as: "lookup_v2" });

        expect(tool.name).toBe("lookup_v2");
    });

    test("tool schema and cleanup are preserved on the definition", () => {
        const cleanup = () => {};
        const contract = defineTool({
            name: "lookup",
            schema: { type: "object", properties: {}, additionalProperties: false } as const,
            [TOOL_CLEANUP]: cleanup,
        });

        expect(contract[TOOL_JSON_SCHEMA]).toMatchObject({ type: "object" });
        expect(contract[TOOL_CLEANUP]).toBe(cleanup);
    });

    test("defineTool rejects invalid schema at definition time", () => {
        const callDefineTool = defineTool as unknown as (config: unknown) => unknown;

        expect(() =>
            callDefineTool({
                name: "lookup",
                schema: {
                    type: 123,
                },
            }),
        ).toThrow();
    });

    test("defineTool rejects validation-only standard schema at definition time", () => {
        const callDefineTool = defineTool as unknown as (config: unknown) => unknown;

        expect(() =>
            callDefineTool({
                name: "lookup",
                schema: {
                    "~standard": {
                        version: 1,
                        vendor: "test",
                        validate(value: unknown) {
                            return { value };
                        },
                    },
                },
            }),
        ).toThrow(/Standard JSON Schema/);
    });

    test("defineTool accepts Standard JSON Schema without Ajv precompiling exported formats", () => {
        const tool = defineTool({
            name: "email_lookup",
            schema: {
                "~standard": {
                    version: 1,
                    vendor: "test",
                    validate(value: unknown) {
                        return { value };
                    },
                    jsonSchema: {
                        input() {
                            return {
                                type: "object",
                                properties: {
                                    email: {
                                        type: "string",
                                        format: "email",
                                    },
                                },
                                required: ["email"],
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
        }).server(async ({ email }) => ({ email }));

        expect(tool.kind).toBe("server");
        expect(tool[TOOL_JSON_SCHEMA]).toMatchObject({
            properties: {
                email: {
                    type: "string",
                    format: "email",
                },
            },
        });
    });
});
