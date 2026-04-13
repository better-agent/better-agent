import type { GenerativeModel } from "@better-agent/core/providers";
import type { OpenRouterChatCompletionsRequestSchema } from "../responses/schemas";

export type OpenRouterAudioCaps = {
    inputModalities: { text: true; audio: true };
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
        audio: true;
    };
    tools: true;
    structured_output: true;
    additionalSupportedRoles: readonly ["developer"];
};

export type OpenRouterAudioEndpointOptions = {
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
    audio?: OpenRouterChatCompletionsRequestSchema["audio"];
};

export type OpenRouterAudioGenerativeModel<
    M extends string = string,
> = GenerativeModel<OpenRouterAudioEndpointOptions, "openrouter", M, OpenRouterAudioCaps>;
