export const MOCK_AUDIO_DATA_URL =
    "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";

export const SPEECH_FIXTURE = {
    prompt: "Say hello in one short sentence.",
    request: {
        input: "Say hello.",
        response_format: "mp3" as const,
    },
    streamContext: {
        messageId: "msg_1",
        mimeType: "audio/mpeg",
    },
};

export const TRANSCRIPTION_FIXTURE = {
    request: {
        input: "unused",
        file: MOCK_AUDIO_DATA_URL,
        model: "gpt-4o-transcribe" as const,
        language: "en",
        prompt: "Transcribe clearly.",
        response_format: "verbose_json" as const,
        temperature: 0,
        include: ["logprobs"] as Array<"logprobs">,
        timestamp_granularities: ["word", "segment"] as Array<"word" | "segment">,
        stream: false,
        chunking_strategy: {
            type: "server_vad" as const,
        },
    },
    streamContext: {
        messageId: "msg_1",
        text: "",
        segments: [] as Array<{
            id: string;
            start: number;
            end: number;
            text: string;
            speaker?: string;
        }>,
    },
};
