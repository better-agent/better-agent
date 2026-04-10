import type { Capabilities, GenerativeModel } from "@better-agent/core/providers";
import type { OpenRouterChatCompletionsRequestSchema } from "./schemas";

export interface OpenRouterResponseCaps extends Capabilities {
    inputModalities: { text: true; image: true; file: true };
    inputShape: "chat";
    replayMode: "multi_turn";
    supportsInstruction: true;
    outputModalities: {
        text: {
            options: {
                max_tokens?: OpenRouterChatCompletionsRequestSchema["max_tokens"];
                temperature?: OpenRouterChatCompletionsRequestSchema["temperature"];
                top_p?: OpenRouterChatCompletionsRequestSchema["top_p"];
            };
        };
        image: true;
    };
    tools: true;
    structured_output: true;
    additionalSupportedRoles: readonly ["developer"];
}

export type OpenRouterResponseEndpointOptions = {
    max_tokens?: OpenRouterChatCompletionsRequestSchema["max_tokens"];
    temperature?: OpenRouterChatCompletionsRequestSchema["temperature"];
    top_p?: OpenRouterChatCompletionsRequestSchema["top_p"];
    frequency_penalty?: OpenRouterChatCompletionsRequestSchema["frequency_penalty"];
    presence_penalty?: OpenRouterChatCompletionsRequestSchema["presence_penalty"];
    seed?: OpenRouterChatCompletionsRequestSchema["seed"];
    user?: OpenRouterChatCompletionsRequestSchema["user"];
    reasoning?: OpenRouterChatCompletionsRequestSchema["reasoning"];
    include_reasoning?: OpenRouterChatCompletionsRequestSchema["include_reasoning"];
    prediction?: OpenRouterChatCompletionsRequestSchema["prediction"];
    transforms?: OpenRouterChatCompletionsRequestSchema["transforms"];
    route?: OpenRouterChatCompletionsRequestSchema["route"];
    provider?: OpenRouterChatCompletionsRequestSchema["provider"];
    plugins?: OpenRouterChatCompletionsRequestSchema["plugins"];
};

export type OpenRouterResponseGenerativeModel<
    M extends string = string,
> = GenerativeModel<OpenRouterResponseEndpointOptions, "openrouter", M, OpenRouterResponseCaps>;
