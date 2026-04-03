import type { Capabilities } from "@better-agent/core/providers";
import type { OpenAICreateResponseSchema } from "./schemas";

export interface OpenAIResponseCaps extends Capabilities {
    inputModalities: { text: true; image: true; file: true };
    inputShape: "chat";
    replayMode: "multi_turn";
    supportsInstruction: true;
    outputModalities: {
        text: {
            options: {
                max_output_tokens?: OpenAICreateResponseSchema["max_output_tokens"];
                max_tool_calls?: OpenAICreateResponseSchema["max_tool_calls"];
                temperature?: OpenAICreateResponseSchema["temperature"];
                top_logprobs?: OpenAICreateResponseSchema["top_logprobs"];
                top_p?: OpenAICreateResponseSchema["top_p"];
            };
        };
    };
    tools: true;
    structured_output: true;
    additionalSupportedRoles: readonly ["developer"];
}

export type OpenAIResponseEndpointOptions = {
    conversation?: OpenAICreateResponseSchema["conversation"];
    include?: OpenAICreateResponseSchema["include"];
    instructions?: OpenAICreateResponseSchema["instructions"];
    logprobs?: boolean | number;
    max_output_tokens?: OpenAICreateResponseSchema["max_output_tokens"];
    metadata?: OpenAICreateResponseSchema["metadata"];
    max_tool_calls?: OpenAICreateResponseSchema["max_tool_calls"];
    maxToolCalls?: OpenAICreateResponseSchema["max_tool_calls"];
    parallel_tool_calls?: OpenAICreateResponseSchema["parallel_tool_calls"];
    previous_response_id?: OpenAICreateResponseSchema["previous_response_id"];
    prompt_cache_key?: OpenAICreateResponseSchema["prompt_cache_key"];
    prompt_cache_retention?: OpenAICreateResponseSchema["prompt_cache_retention"];
    reasoning?: OpenAICreateResponseSchema["reasoning"];
    reasoningEffort?: NonNullable<OpenAICreateResponseSchema["reasoning"]> extends infer TReasoning
        ? TReasoning extends { effort?: infer TEffort }
            ? TEffort
            : never
        : never;
    reasoningSummary?: NonNullable<OpenAICreateResponseSchema["reasoning"]> extends infer TReasoning
        ? TReasoning extends { summary?: infer TSummary }
            ? TSummary
            : never
        : never;
    safety_identifier?: OpenAICreateResponseSchema["safety_identifier"];
    service_tier?: OpenAICreateResponseSchema["service_tier"];
    store?: OpenAICreateResponseSchema["store"];
    temperature?: OpenAICreateResponseSchema["temperature"];
    text?: OpenAICreateResponseSchema["text"];
    textVerbosity?: NonNullable<OpenAICreateResponseSchema["text"]> extends infer TText
        ? TText extends { verbosity?: infer TVerbosity }
            ? TVerbosity
            : never
        : never;
    top_logprobs?: OpenAICreateResponseSchema["top_logprobs"];
    top_p?: OpenAICreateResponseSchema["top_p"];
    truncation?: OpenAICreateResponseSchema["truncation"];
};
