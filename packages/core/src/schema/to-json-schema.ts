import type { ResolvableSchema } from "./types";

function hasStandardJsonSchema(inputSchema: ResolvableSchema): inputSchema is ResolvableSchema & {
    "~standard": {
        jsonSchema?: {
            input(options: { target: "draft-2020-12" }): Record<string, unknown>;
        };
    };
} {
    return typeof inputSchema === "object" && inputSchema !== null && "~standard" in inputSchema;
}

export function toJsonSchema(
    schema: ResolvableSchema,
    options: { target?: "draft-2020-12" } = {},
): Record<string, unknown> {
    const target = options.target ?? "draft-2020-12";

    if (hasStandardJsonSchema(schema)) {
        return (
            schema["~standard"].jsonSchema?.input({
                target,
            }) ?? { type: "object", properties: {} }
        );
    }

    return schema as Record<string, unknown>;
}
