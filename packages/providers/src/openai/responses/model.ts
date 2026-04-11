import type { BetterAgentError } from "@better-agent/shared/errors";
import type { Result } from "@better-agent/shared/neverthrow";
import type { Event } from "../../events";
import type { RunContext } from "../../run";
import type { Capabilities, ModalitiesParam } from "./capabilities";
import type { GenerativeModelCallOptions } from "./input";
import type { GenerativeModelResponse } from "./response";

/**
 * Model registry entry describing model options and capabilities.
 */
export type ModelDescriptor<
    TOptions extends Record<string, unknown> = Record<string, unknown>,
    TCaps extends Capabilities = Capabilities,
> = {
    options: TOptions;
    caps: TCaps;
};

/**
 * Model definition used by the runtime.
 *
 * A model can implement non-streaming generation, streaming generation, or both.
 */
export type GenerativeModel<
    TOptions extends Record<string, unknown> = Record<string, unknown>,
    TProviderId extends string = string,
    TModelId extends string = string,
    TModelCaps extends Capabilities = Capabilities,
> = GenerativeModelBase<TProviderId, TModelId, TModelCaps> &
    (
        | GenerativeModelWithGenerate<TModelCaps, TOptions>
        | GenerativeModelWithStream<TModelCaps, TOptions>
        | GenerativeModelWithGenerateAndStream<TModelCaps, TOptions>
    );

interface GenerativeModelBase<
    TProviderId extends string,
    TModelId extends string,
    TModelCaps extends Capabilities,
> {
    /** Provider identifier for this model. */
    readonly providerId: TProviderId;
    /** Model identifier within the provider. */
    readonly modelId: TModelId;
    /** Runtime capability flags. */
    readonly caps: TModelCaps;
}

/**
 * Result returned by `doGenerate`.
 */
export interface GenerativeModelGenerateResult<TModelCaps extends Capabilities> {
    response: GenerativeModelResponse<TModelCaps>;
    events?: Event[];
}

interface GenerativeModelWithGenerate<
    TModelCaps extends Capabilities,
    TOptions extends Record<string, unknown>,
> {
    /**
     * Performs a non-streaming generation.
     *
     * @returns A {@link Result} containing the model response and optional emitted events.
     */
    doGenerate<const TModalities extends ModalitiesParam<TModelCaps> = undefined>(
        options: GenerativeModelCallOptions<TModelCaps, TOptions, TModalities>,
        ctx: RunContext,
    ): Promise<Result<GenerativeModelGenerateResult<TModelCaps>, BetterAgentError>>;
    doGenerateStream?: undefined;
}

interface GenerativeModelWithStream<
    TModelCaps extends Capabilities,
    TOptions extends Record<string, unknown>,
> {
    /**
     * Performs a streaming generation.
     *
     * @returns A {@link Result} containing streamed events and a final response.
     */
    doGenerateStream<const TModalities extends ModalitiesParam<TModelCaps> = undefined>(
        options: GenerativeModelCallOptions<TModelCaps, TOptions, TModalities>,
        ctx: RunContext,
    ): Promise<
        Result<
            {
                events: AsyncGenerator<Result<Event, BetterAgentError>>;
                final: Promise<GenerativeModelResponse<TModelCaps>>;
            },
            BetterAgentError
        >
    >;
    doGenerate?: undefined;
}

interface GenerativeModelWithGenerateAndStream<
    TModelCaps extends Capabilities,
    TOptions extends Record<string, unknown>,
> {
    doGenerate<const TModalities extends ModalitiesParam<TModelCaps> = undefined>(
        options: GenerativeModelCallOptions<TModelCaps, TOptions, TModalities>,
        ctx: RunContext,
    ): Promise<Result<GenerativeModelGenerateResult<TModelCaps>, BetterAgentError>>;
    doGenerateStream<const TModalities extends ModalitiesParam<TModelCaps> = undefined>(
        options: GenerativeModelCallOptions<TModelCaps, TOptions, TModalities>,
        ctx: RunContext,
    ): Promise<
        Result<
            {
                events: AsyncGenerator<Result<Event, BetterAgentError>>;
                final: Promise<GenerativeModelResponse<TModelCaps>>;
            },
            BetterAgentError
        >
    >;
}
