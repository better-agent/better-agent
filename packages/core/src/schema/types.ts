import type { StandardJSONSchemaV1 } from "@standard-schema/spec";
import type { FromSchema } from "json-schema-to-ts";

export type JsonSchema = Record<string, unknown>;

export type StandardSchema<I = unknown, O = I> = StandardJSONSchemaV1<I, O>;

export type ResolvableSchema<I = unknown, O = I> = StandardSchema<I, O> | JsonSchema;

export interface AgentOutput<TSchema extends ResolvableSchema = ResolvableSchema> {
    schema: TSchema;
    name?: string;
    description?: string;
}

export type InferStandardSchemaInput<TSchema> = TSchema extends {
    "~standard"?: { types?: { input?: infer TInput } };
}
    ? TInput
    : never;

export type InferStandardSchemaOutput<TSchema> = TSchema extends {
    "~standard"?: { types?: { output?: infer TOutput } };
}
    ? TOutput
    : never;

export type InferJsonSchema<TSchema> = TSchema extends JsonSchema ? FromSchema<TSchema> : never;

export type InferSchemaInput<TSchema> = [InferStandardSchemaInput<TSchema>] extends [never]
    ? InferJsonSchema<TSchema>
    : InferStandardSchemaInput<TSchema>;

export type InferSchemaOutput<TSchema> = [InferStandardSchemaOutput<TSchema>] extends [never]
    ? InferJsonSchema<TSchema>
    : InferStandardSchemaOutput<TSchema>;

export type InferAgentOutput<TOutput> = TOutput extends AgentOutput<infer TSchema>
    ? InferSchemaOutput<TSchema>
    : unknown;
