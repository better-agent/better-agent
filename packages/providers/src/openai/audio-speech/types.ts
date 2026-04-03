import type { OpenAICreateSpeechRequest } from "./schemas";

export type OpenAIAudioSpeechCaps = {
    inputModalities: { text: true };
    inputShape: "prompt";
    replayMode: "single_turn_persistent";
    supportsInstruction: false;
    tools: false;
    outputModalities: {
        audio: true;
    };
    additionalSupportedRoles: readonly ["developer"];
};

export type OpenAIAudioSpeechEndpointOptions = {
    instructions?: OpenAICreateSpeechRequest["instructions"];
    voice?: OpenAICreateSpeechRequest["voice"];
    response_format?: OpenAICreateSpeechRequest["response_format"];
    speed?: OpenAICreateSpeechRequest["speed"];
    stream_format?: OpenAICreateSpeechRequest["stream_format"];
};
