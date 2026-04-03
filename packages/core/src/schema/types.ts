import type {
    StandardJSONSchemaV1,
    StandardSchemaV1,
    StandardTypedV1,
} from "@standard-schema/spec";
import type { FromSchema } from "json-schema-to-ts";

/** Any Standard Schema v1 instance. */
// biome-ignore lint/suspicious/noExplicitAny: intentional
export type AnyStandardSchemaV1 = StandardSchemaV1<any, any>;

/** Standard Schema v1 typed schema. */
export type StandardSchema<I = unknown, O = I> = StandardTypedV1<I, O>;

/** Schema inputs that can be resolved to JSON Schema. */
export type ResolvableSchema<I = unknown, O = I> =
    | StandardJSONSchemaV1<I, O>
    | Record<string, unknown>;

/** Schema inputs that can be validated at runtime. */
export type ValidatableSchema<I = unknown, O = I> = StandardSchemaV1<I, O> | ResolvableSchema<I, O>;

/** Infers the input type from a Standard Schema v1 typed schema. */
export type InferStandardInput<TSchema> = TSchema extends {
    "~standard"?: { types?: { input?: infer I } };
}
    ? I
    : never;

/**
 * Infers the input type from either a Standard Schema v1 typed schema or a JSON Schema object.
 */
export type InferSchemaInput<TSchema> = [InferStandardInput<TSchema>] extends [never]
    ? TSchema extends Record<string, unknown>
        ? FromSchema<TSchema>
        : unknown
    : InferStandardInput<TSchema>;
