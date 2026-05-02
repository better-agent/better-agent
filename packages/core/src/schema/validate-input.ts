import { BetterAgentError } from "@better-agent/shared/errors";
import AjvDraft7 from "ajv";
import Ajv2020 from "ajv/dist/2020.js";
import { toJsonSchema } from "./to-json-schema";
import type { InferSchemaInput, ResolvableSchema } from "./types";

const ajvDraft7 = new AjvDraft7({
    allErrors: true,
    strict: false,
});

const ajv2020 = new Ajv2020({
    allErrors: true,
    strict: false,
});

type JsonSchemaRecord = Record<string, unknown>;
type Validator = ReturnType<typeof ajv2020.compile>;

const validatorCache = new Map<string, Validator>();

function getSchemaDialect(schema: JsonSchemaRecord): "draft-07" | "2020-12" {
    const dialect = typeof schema.$schema === "string" ? schema.$schema : undefined;

    return dialect?.includes("draft-07") ? "draft-07" : "2020-12";
}

function getValidator(schema: ResolvableSchema) {
    const jsonSchema = toJsonSchema(schema);
    const dialect = getSchemaDialect(jsonSchema);
    const cacheKey = `${dialect}:${JSON.stringify(jsonSchema)}`;
    const cached = validatorCache.get(cacheKey);

    if (cached) {
        return cached;
    }

    const compiled = (dialect === "draft-07" ? ajvDraft7 : ajv2020).compile(jsonSchema);
    validatorCache.set(cacheKey, compiled);
    return compiled;
}

export function validateInput<TSchema extends ResolvableSchema>(
    schema: TSchema,
    value: unknown,
    options: {
        invalidMessage?: string;
    } = {},
): InferSchemaInput<TSchema> {
    const validator = getValidator(schema);

    if (!validator(value)) {
        throw BetterAgentError.fromCode(
            "VALIDATION_FAILED",
            options.invalidMessage ?? "Input failed schema validation.",
            {
                context: {
                    issues: validator.errors ?? [],
                },
            },
        );
    }

    return value as InferSchemaInput<TSchema>;
}
