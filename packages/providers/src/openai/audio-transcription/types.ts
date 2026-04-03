import type { OpenAICreateTranscriptionRequest } from "./schemas";

export type OpenAIAudioTranscriptionCaps = {
    inputModalities: { audio: true };
    inputShape: "prompt";
    replayMode: "single_turn_persistent";
    supportsInstruction: false;
    outputModalities: {
        text: true;
    };
    additionalSupportedRoles: readonly ["developer"];
};

export type OpenAIAudioTranscriptionEndpointOptions = {
    language?: OpenAICreateTranscriptionRequest["language"];
    prompt?: OpenAICreateTranscriptionRequest["prompt"];
    response_format?: OpenAICreateTranscriptionRequest["response_format"];
    temperature?: OpenAICreateTranscriptionRequest["temperature"];
    include?: OpenAICreateTranscriptionRequest["include"];
    timestamp_granularities?: OpenAICreateTranscriptionRequest["timestamp_granularities"];
    stream?: OpenAICreateTranscriptionRequest["stream"];
    chunking_strategy?: OpenAICreateTranscriptionRequest["chunking_strategy"];
    known_speaker_names?: OpenAICreateTranscriptionRequest["known_speaker_names"];
    known_speaker_references?: OpenAICreateTranscriptionRequest["known_speaker_references"];
};
