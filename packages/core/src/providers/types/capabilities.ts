import type { IsAny, UnionToIntersection } from "../../internal/types";
import type { InferSchemaInput, ResolvableSchema } from "../../schema";

/**
 * Supported input and output modalities.
 */
export type Modality = "text" | "image" | "video" | "audio" | "file" | "embedding";

/**
 * How persisted conversation history should be treated on subsequent runs.
 */
export type ReplayMode = "multi_turn" | "single_turn_persistent" | "single_turn_only";

/**
 * Capability spec for an input modality.
 */
export type InputModalitySpec = boolean;

/**
 * Shape of input expected by a model.
 */
export type InputShape = "chat" | "prompt";

/**
 * Capability spec for an output modality.
 */
export type OutputModalitySpec =
    | boolean
    | {
          options?: Record<string, unknown>;
      };

/**
 * Model capability flags and modality support.
 */
export interface Capabilities {
    /**
     * Supported input modalities and their capability extensions.
     */
    inputModalities?: Partial<Record<Modality, InputModalitySpec>>;
    /**
     * Supported output modalities and their capability extensions.
     */
    outputModalities?: Partial<Record<Modality, OutputModalitySpec>>;
    /**
     * Shape of the model input.
     */
    inputShape?: InputShape;

    /**
     * Whether stored conversation history should be replayed into future model calls.
     */
    replayMode?: ReplayMode;

    /**
     * Whether agent/system instruction controls are supported for this model.
     */
    supportsInstruction?: boolean;

    /**
     * Whether structured output is supported.
     */
    structured_output?: boolean | Record<string, unknown>;
    /**
     * Whether tool calling is supported.
     */
    tools?: boolean;

    /**
     * Additional message roles supported by the model, beyond `"system"`, `"user"`, and `"assistant"`.
     */
    additionalSupportedRoles?: readonly string[];
}

/**
 * Schema accepted for requested structured output.
 */
export type OutputSchemaSource = ResolvableSchema;

/**
 * User-facing structured output definition.
 *
 * Requires a text-output model.
 */
export type OutputSchemaDefinition<TSchema extends OutputSchemaSource = OutputSchemaSource> = {
    /** Schema that the model output should match. */
    schema: TSchema;
    /** Optional name forwarded to providers that support named structured outputs. */
    name?: string;
    /** Whether strict schema adherence should be requested when supported. */
    strict?: boolean;
};

/**
 * Structured output definition gated by model capabilities.
 */
export type OutputSchemaForCaps<
    TCaps extends Capabilities,
    TSchema extends OutputSchemaSource = OutputSchemaSource,
> = CapEnabled<TCaps["structured_output"]> extends true ? OutputSchemaDefinition<TSchema> : never;

/**
 * Infers the validated structured output type from a schema definition.
 */
export type InferOutputSchema<TOutput> = TOutput extends { schema: infer TSchema }
    ? InferSchemaInput<NonNullable<TSchema>>
    : unknown;

/**
 * Determines whether a capability is enabled.
 */
export type CapEnabled<C> = IsAny<C> extends true
    ? true
    : [C] extends [false | undefined]
      ? false
      : [Extract<C, true | boolean | Record<string, unknown>>] extends [never]
        ? false
        : true;

/**
 * Resolved structured output config sent to providers.
 */
export interface StructuredOutput {
    name: string;
    schema: Record<string, unknown>;
    strict?: boolean;
}

/**
 * Tuple of enabled output modalities, or `undefined`.
 */
export type ModalitiesParam<TCaps extends Capabilities> =
    | undefined
    | readonly [EnabledOutputModality<TCaps>, ...EnabledOutputModality<TCaps>[]];

/**
 * Extracts output spec for a modality from model capabilities.
 */
type OutputSpec<
    TCaps extends Capabilities,
    M extends Modality,
> = TCaps["outputModalities"] extends infer O
    ? O extends Partial<Record<Modality, OutputModalitySpec>>
        ? O[M]
        : undefined
    : undefined;

/**
 * Extracts input spec for a modality from model capabilities.
 */
type InputSpec<
    TCaps extends Capabilities,
    M extends Modality,
> = TCaps["inputModalities"] extends infer I
    ? I extends Partial<Record<Modality, InputModalitySpec>>
        ? I[M]
        : undefined
    : undefined;

/**
 * Conditional object fields based on capability enablement.
 */
export type IfCap<C, T extends object> = CapEnabled<C> extends true ? T : object;

/**
 * Whether a given output modality is enabled.
 */
export type OutputEnabled<TCaps extends Capabilities, M extends Modality> = CapEnabled<
    OutputSpec<TCaps, M>
> extends true
    ? true
    : false;

/**
 * Whether a given input modality is enabled.
 */
export type InputEnabled<TCaps extends Capabilities, M extends Modality> = IsAny<TCaps> extends true
    ? true
    : M extends "text"
      ? TCaps["inputModalities"] extends Partial<Record<Modality, InputModalitySpec>>
          ? [InputSpec<TCaps, "text">] extends [false]
              ? false
              : true
          : true
      : TCaps["inputModalities"] extends Partial<Record<Modality, InputModalitySpec>>
        ? CapEnabled<InputSpec<TCaps, M>>
        : false;

/**
 * Whether system or instruction prompting is supported for a model.
 */
export type InstructionEnabled<TCaps extends Capabilities> = IsAny<TCaps> extends true
    ? true
    : TCaps["supportsInstruction"] extends true
      ? true
      : false;

/**
 * Union of all enabled output modalities.
 */
type EnabledOutputModality<TCaps extends Capabilities> =
    | (CapEnabled<OutputSpec<TCaps, "text">> extends true ? "text" : never)
    | (CapEnabled<OutputSpec<TCaps, "image">> extends true ? "image" : never)
    | (CapEnabled<OutputSpec<TCaps, "video">> extends true ? "video" : never)
    | (CapEnabled<OutputSpec<TCaps, "audio">> extends true ? "audio" : never)
    | (CapEnabled<OutputSpec<TCaps, "embedding">> extends true ? "embedding" : never);

type IsUnion<T, U = T> = T extends unknown ? ([U] extends [T] ? false : true) : never;

/**
 * Extracts provider-specific output options for a modality spec.
 */
type OutputOptionsOfSpec<S> = S extends {
    options?: infer O;
}
    ? O extends object
        ? O
        : object
    : object;

type DefaultModalityOptionsFor<TCaps extends Capabilities> = [
    EnabledOutputModality<TCaps>,
] extends [never]
    ? object
    : IsUnion<EnabledOutputModality<TCaps>> extends true
      ? object
      : EnabledOutputModality<TCaps> extends infer K
        ? K extends keyof NonNullable<TCaps["outputModalities"]>
            ? OutputOptionsOfSpec<NonNullable<TCaps["outputModalities"]>[K]>
            : object
        : object;

/**
 * Aggregates output options for all selected modalities.
 */
export type ModalityOptionsFor<
    TCaps extends Capabilities,
    T extends readonly unknown[] | undefined,
> = [T] extends [undefined]
    ? DefaultModalityOptionsFor<TCaps>
    : T extends readonly (infer K)[]
      ? UnionToIntersection<
            K extends keyof NonNullable<TCaps["outputModalities"]>
                ? OutputOptionsOfSpec<NonNullable<TCaps["outputModalities"]>[K]>
                : object
        >
      : object;

/**
 * Adds the `modalities` field when required.
 */
export type ModalitiesField<TModalities> = undefined extends TModalities
    ? {
          modalities?: TModalities;
      }
    : {
          modalities: TModalities;
      };
