import type { Capabilities, GenerativeModel } from "@better-agent/core/providers";

import type { XAIResponseModels } from "../shared/schemas";
import type { XAICreateResponseSchema } from "./schemas";

export interface XAIResponseCaps extends Capabilities {
    inputModalities: { text: true; image: true; file: true };
    inputShape: "chat";
    replayMode: "multi_turn";
    supportsInstruction: true;
    outputModalities: {
        text: {
            options: {
                logprobs?: XAICreateResponseSchema["logprobs"];
                max_output_tokens?: XAICreateResponseSchema["max_output_tokens"];
                temperature?: XAICreateResponseSchema["temperature"];
                top_logprobs?: XAICreateResponseSchema["top_logprobs"];
                top_p?: XAICreateResponseSchema["top_p"];
            };
        };
    };
    tools: true;
    structured_output: true;
    additionalSupportedRoles: readonly ["developer"];
}

export type XAIResponseEndpointOptions = {
    include?: XAICreateResponseSchema["include"];
    instructions?: XAICreateResponseSchema["instructions"];
    metadata?: XAICreateResponseSchema["metadata"];
    parallel_tool_calls?: XAICreateResponseSchema["parallel_tool_calls"];
    previous_response_id?: XAICreateResponseSchema["previous_response_id"];
    reasoning?: XAICreateResponseSchema["reasoning"];
    search_parameters?: XAICreateResponseSchema["search_parameters"];
    service_tier?: XAICreateResponseSchema["service_tier"];
    store?: XAICreateResponseSchema["store"];
    logprobs?: XAICreateResponseSchema["logprobs"];
    temperature?: XAICreateResponseSchema["temperature"];
    top_logprobs?: XAICreateResponseSchema["top_logprobs"];
    top_p?: XAICreateResponseSchema["top_p"];
    user?: XAICreateResponseSchema["user"];
    max_output_tokens?: XAICreateResponseSchema["max_output_tokens"];
};

type SuggestedModelId<TKnown extends string> = TKnown | (string & {});
export type XAIResponseModelId = SuggestedModelId<XAIResponseModels>;

export type XAIResponseGenerativeModel<M extends XAIResponseModelId = XAIResponseModelId> =
    GenerativeModel<XAIResponseEndpointOptions, "xai", M, XAIResponseCaps>;
