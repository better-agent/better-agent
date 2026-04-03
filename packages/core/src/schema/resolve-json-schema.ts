import { BetterAgentError } from "@better-agent/shared/errors";
import { type Result, err, ok } from "@better-agent/shared/neverthrow";
import type { StandardSchemaV1 } from "@standard-schema/spec";
import Ajv from "ajv";
import type { ValidateFunction } from "ajv";
import Ajv2020 from "ajv/dist/2020.js";
import type { ResolvableSchema, ValidatableSchema } from "./types";

type JsonSchemaTarget = "draft-07" | "draft-2020-12";

const ajvDraft7 = new Ajv({
    allErrors: true,
    logger: false,
});

const ajvDraft2020 = new Ajv2020({
    allErrors: true,
    logger: false,
});

const compiledJsonSchemaCache = new WeakMap<Record<string, unknown>, ValidateFunction>();
const resolvedStandardJsonSchemaCache = new WeakMap<object, Record<string, unknown>>();

const createSchemaError = (params: {
    message: string;
    traceAt: string;
    context?: Record<string, unknown>;
    issues?: readonly unknown[] | null;
    cause?: unknown;
}): BetterAgentError =>
    params.cause
        ? BetterAgentError.wrap({
              err: params.cause,
              message: params.message,
              opts: {
                  code: "VALIDATION_FAILED",
                  context: {
                      ...(params.context ?? {}),
                      ...(params.issues !== undefined ? { issues: params.issues } : {}),
                  },
                  trace: [{ at: params.traceAt }],
              },
          })
        : BetterAgentError.fromCode("VALIDATION_FAILED", params.message, {
              context: {
                  ...(params.context ?? {}),
                  ...(params.issues !== undefined ? { issues: params.issues } : {}),
              },
              trace: [{ at: params.traceAt }],
          });

const compileJsonSchema = (
    schema: Record<string, unknown>,
    traceAt: string,
): Result<ValidateFunction, BetterAgentError> => {
    const cachedValidator = compiledJsonSchemaCache.get(schema);
    if (cachedValidator) {
        return ok(cachedValidator);
    }

    const schemaId = schema.$schema;
    const targets: JsonSchemaTarget[] = [];

    if (typeof schemaId === "string") {
        if (schemaId.includes("draft-07")) {
            targets.push("draft-07");
        } else if (schemaId.includes("draft/2020-12")) {
            targets.push("draft-2020-12");
        } else {
            return err(
                createSchemaError({
                    message: "Tool schema uses an unsupported json_schema dialect.",
                    traceAt,
                    context: {
                        schemaType: "json_schema",
                        schemaDialect: schemaId,
                    },
                }),
            );
        }
    } else {
        targets.push("draft-07", "draft-2020-12");
    }

    const attempts: Array<Record<string, unknown>> = [];

    for (const target of targets) {
        try {
            const validator =
                target === "draft-2020-12"
                    ? ajvDraft2020.compile(schema)
                    : ajvDraft7.compile(schema);
            compiledJsonSchemaCache.set(schema, validator);
            return ok(validator);
        } catch (cause) {
            attempts.push({
                target,
                error: cause instanceof Error ? cause.message : String(cause),
            });
        }
    }

    return err(
        createSchemaError({
            message: "Tool schema is not valid json_schema.",
            traceAt,
            context: {
                schemaType: "json_schema",
                attempts,
            },
        }),
    );
};

const getStandardRecord = (schema: unknown): Record<string, unknown> | undefined => {
    const standard = (schema as { "~standard"?: unknown })?.["~standard"];
    return standard && typeof standard === "object"
        ? (standard as Record<string, unknown>)
        : undefined;
};

const hasStandardValidate = (schema: unknown): schema is StandardSchemaV1 =>
    typeof getStandardRecord(schema)?.validate === "function";

const hasStandardJsonSchema = (
    schema: unknown,
): schema is {
    "~standard": {
        vendor?: string;
        jsonSchema: {
            input: (options: { target: JsonSchemaTarget }) => Record<string, unknown>;
        };
    };
} => {
    const jsonSchema = getStandardRecord(schema)?.jsonSchema;
    return (
        !!jsonSchema &&
        typeof jsonSchema === "object" &&
        typeof (jsonSchema as { input?: unknown }).input === "function"
    );
};

export const resolveToJsonSchema = (
    schema: ResolvableSchema,
): Result<Record<string, unknown>, BetterAgentError> => {
    const traceAt = "core.schema.resolveToJsonSchema";
    const standard = getStandardRecord(schema);

    if (hasStandardJsonSchema(schema)) {
        const cachedSchema = resolvedStandardJsonSchemaCache.get(schema);
        if (cachedSchema) {
            return ok(cachedSchema);
        }

        const attempts: Array<Record<string, unknown>> = [];

        for (const target of ["draft-07", "draft-2020-12"] as const) {
            try {
                const resolvedSchema = schema["~standard"].jsonSchema.input({ target });
                resolvedStandardJsonSchemaCache.set(schema, resolvedSchema);
                return ok(resolvedSchema);
            } catch (cause) {
                attempts.push({
                    target,
                    error: cause instanceof Error ? cause.message : String(cause),
                });
            }
        }

        return err(
            createSchemaError({
                message: "Tool schema could not be resolved to json_schema.",
                traceAt,
                context: {
                    schemaType: "standard_schema",
                    standardVendor: schema["~standard"].vendor,
                    attempts,
                },
            }),
        );
    }

    if (standard !== undefined) {
        return err(
            createSchemaError({
                message:
                    "Tool schema must be raw json_schema or a Standard JSON Schema with `~standard.jsonSchema.input()`.",
                traceAt,
                context: {
                    schemaType: "standard_schema",
                    standardVendor:
                        typeof standard.vendor === "string" ? standard.vendor : undefined,
                    supportsJsonSchema: false,
                },
            }),
        );
    }

    if (!schema || typeof schema !== "object" || Array.isArray(schema)) {
        return err(
            createSchemaError({
                message:
                    "Tool schema must be raw json_schema or a Standard JSON Schema with `~standard.jsonSchema.input()`.",
                traceAt,
                context: {
                    schemaType: "json_schema",
                },
            }),
        );
    }

    const jsonSchema = schema as Record<string, unknown>;
    const compiled = compileJsonSchema(jsonSchema, traceAt);
    if (compiled.isErr()) {
        return err(compiled.error);
    }

    return ok(jsonSchema);
};

export const validateInput = async <T>(
    schema: ValidatableSchema,
    data: unknown,
    options?: {
        invalidMessage?: string;
    },
): Promise<Result<T, BetterAgentError>> => {
    const invalidMessage =
        options?.invalidMessage ?? "The provided data is invalid according to schema.";

    if (hasStandardValidate(schema)) {
        try {
            const result = await schema["~standard"].validate(data);

            if (result.issues && result.issues.length > 0) {
                return err(
                    createSchemaError({
                        message: invalidMessage,
                        traceAt: "core.schema.validateInput",
                        context: {
                            issuesCount: result.issues.length,
                        },
                        issues: result.issues,
                    }),
                );
            }

            return ok(("value" in result ? result.value : data) as T);
        } catch (cause) {
            return err(
                createSchemaError({
                    message: "Schema validation failed.",
                    traceAt: "core.schema.validateInput",
                    cause,
                }),
            );
        }
    }

    const resolved = resolveToJsonSchema(schema);
    if (resolved.isErr()) {
        return err(resolved.error);
    }

    const compiled = compileJsonSchema(resolved.value, "core.schema.validateInput");
    if (compiled.isErr()) {
        return err(compiled.error);
    }

    try {
        const valid = compiled.value(data);
        if (!valid) {
            return err(
                createSchemaError({
                    message: invalidMessage,
                    traceAt: "core.schema.validateInput",
                    context: {
                        issuesCount: compiled.value.errors?.length ?? 0,
                    },
                    issues: compiled.value.errors ?? [],
                }),
            );
        }

        return ok(data as T);
    } catch (cause) {
        return err(
            createSchemaError({
                message: "Schema validation failed.",
                traceAt: "core.schema.validateInput",
                cause,
            }),
        );
    }
};
