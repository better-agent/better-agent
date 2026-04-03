import { describe, expect, test } from "bun:test";
import { Events } from "@better-agent/core/events";
import {
    mapFromOpenAIAudioSpeechResponse,
    mapFromOpenAIAudioSpeechStreamEvent,
    mapToOpenAIAudioSpeechRequest,
} from "../../src/openai/audio-speech/mappers";
import {
    mapFromOpenAIAudioTranscriptionResponse,
    mapFromOpenAIAudioTranscriptionStreamEvent,
    mapToOpenAIAudioTranscriptionRequest,
} from "../../src/openai/audio-transcription/mappers";
import {
    MOCK_AUDIO_DATA_URL,
    SPEECH_FIXTURE,
    TRANSCRIPTION_FIXTURE,
} from "../fixtures/openai.audio";

describe("openai-audio mapper", () => {
    test("speech request maps default voice and options", () => {
        const mapped = mapToOpenAIAudioSpeechRequest({
            modelId: "gpt-4o-mini-tts",
            options: SPEECH_FIXTURE.request,
        });
        if (mapped.isErr()) throw mapped.error;

        expect(mapped.value.model).toBe("gpt-4o-mini-tts");
        expect(mapped.value.input).toBe("Say hello.");
        expect(mapped.value.voice).toBe("alloy");
        expect(mapped.value.response_format).toBe("mp3");
    });

    test("speech request accepts a single prompt-style message with string content", () => {
        const mapped = mapToOpenAIAudioSpeechRequest({
            modelId: "gpt-4o-mini-tts",
            options: {
                input: [{ type: "message", content: "Say hello." }],
            } as never,
        });
        if (mapped.isErr()) throw mapped.error;

        expect(mapped.value.input).toBe("Say hello.");
    });

    test("speech response maps binary payload to assistant audio", () => {
        const raw = new ArrayBuffer(3);
        const view = new Uint8Array(raw);
        view[0] = 1;
        view[1] = 2;
        view[2] = 3;
        const response = mapFromOpenAIAudioSpeechResponse(raw);

        const message = response.output[0];
        expect(message?.type).toBe("message");
        if (!message || message.type !== "message" || typeof message.content === "string") {
            throw new Error("Expected mapped speech output message content");
        }
        const audioPart = message.content[0];
        expect(audioPart?.type).toBe("audio");
        if (!audioPart || audioPart.type !== "audio" || audioPart.source.kind !== "base64") {
            throw new Error("Expected mapped speech audio base64 part");
        }
        expect(audioPart.source.data).toBe("AQID");
    });

    test("speech stream events map delta and done", () => {
        const delta = mapFromOpenAIAudioSpeechStreamEvent(
            {
                type: "speech.audio.delta",
                audio: "AQID",
            },
            {
                ...SPEECH_FIXTURE.streamContext,
            },
        );
        if (delta.isErr()) throw delta.error;
        expect(delta.value?.kind).toBe("event");
        if (!delta.value || delta.value.kind !== "event") {
            throw new Error("Expected speech delta to map to event");
        }
        expect(delta.value.event.type).toBe(Events.AUDIO_MESSAGE_CONTENT);

        const done = mapFromOpenAIAudioSpeechStreamEvent(
            {
                type: "speech.audio.done",
                usage: {
                    input_tokens: 1,
                    output_tokens: 2,
                    total_tokens: 3,
                },
            },
            {
                ...SPEECH_FIXTURE.streamContext,
                audioBase64: "AQID",
            },
        );
        if (done.isErr()) throw done.error;
        expect(done.value?.kind).toBe("final");
        if (!done.value || done.value.kind !== "final") {
            throw new Error("Expected speech done to map to final");
        }
        const doneMessage = done.value.response.output[0];
        expect(doneMessage?.type).toBe("message");
        if (
            !doneMessage ||
            doneMessage.type !== "message" ||
            typeof doneMessage.content === "string"
        ) {
            throw new Error("Expected mapped speech done output message content");
        }
        const doneAudioPart = doneMessage.content[0];
        expect(doneAudioPart?.type).toBe("audio");
        if (
            !doneAudioPart ||
            doneAudioPart.type !== "audio" ||
            doneAudioPart.source.kind !== "base64"
        ) {
            throw new Error("Expected mapped speech done audio base64 part");
        }
        expect(doneAudioPart.source.data).toBe("AQID");
        expect(done.value.response.usage.inputTokens).toBe(1);
        expect(done.value.response.usage.outputTokens).toBe(2);
        expect(done.value.response.usage.totalTokens).toBe(3);
    });

    test("transcription request maps options", () => {
        const mapped = mapToOpenAIAudioTranscriptionRequest({
            modelId: "gpt-4o-transcribe",
            options: TRANSCRIPTION_FIXTURE.request,
        });
        if (mapped.isErr()) throw mapped.error;

        expect(mapped.value.file).toBe(MOCK_AUDIO_DATA_URL);
        expect(mapped.value.language).toBe("en");
        expect(mapped.value.prompt).toBe("Transcribe clearly.");
        expect(mapped.value.response_format).toBe("verbose_json");
        expect(mapped.value.temperature).toBe(0);
        expect(mapped.value.include).toEqual(["logprobs"]);
        expect(mapped.value.timestamp_granularities).toEqual(["word", "segment"]);
    });

    test("transcription response maps text and empty payloads", () => {
        const withText = mapFromOpenAIAudioTranscriptionResponse({
            text: "hello from transcript",
            language: "english",
            duration: 1.2,
            words: [],
            segments: [],
        });
        const textMessage = withText.output[0];
        expect(textMessage?.type).toBe("message");
        if (!textMessage || textMessage.type !== "message") {
            throw new Error("Expected mapped transcription message");
        }
        expect(textMessage.content).toBe("hello from transcript");

        const empty = mapFromOpenAIAudioTranscriptionResponse({
            text: "",
            language: "english",
            duration: 0,
            words: [],
            segments: [],
        });
        expect(empty.output.length).toBe(0);
    });

    test("transcription stream events map delta, segment, and done", () => {
        const delta = mapFromOpenAIAudioTranscriptionStreamEvent(
            {
                type: "transcript.text.delta",
                delta: "hel",
                segment_id: "seg_1",
            },
            {
                ...TRANSCRIPTION_FIXTURE.streamContext,
            },
        );
        if (delta.isErr()) throw delta.error;
        expect(delta.value?.kind).toBe("event");
        if (!delta.value || delta.value.kind !== "event") {
            throw new Error("Expected transcription delta to map to event");
        }
        expect(delta.value.event.type).toBe(Events.TRANSCRIPT_MESSAGE_CONTENT);

        const segment = mapFromOpenAIAudioTranscriptionStreamEvent(
            {
                type: "transcript.text.segment",
                id: "seg_1",
                start: 0,
                end: 1,
                text: "hello",
                speaker: "speaker_1",
            },
            {
                ...TRANSCRIPTION_FIXTURE.streamContext,
            },
        );
        if (segment.isErr()) throw segment.error;
        expect(segment.value?.kind).toBe("event");
        if (!segment.value || segment.value.kind !== "event") {
            throw new Error("Expected transcription segment to map to event");
        }
        expect(segment.value.event.type).toBe(Events.TRANSCRIPT_MESSAGE_SEGMENT);

        const done = mapFromOpenAIAudioTranscriptionStreamEvent(
            {
                type: "transcript.text.done",
                text: "hello world",
                usage: {
                    input_tokens: 3,
                    output_tokens: 2,
                    total_tokens: 5,
                },
            },
            {
                ...TRANSCRIPTION_FIXTURE.streamContext,
                text: "hello world",
            },
        );
        if (done.isErr()) throw done.error;
        expect(done.value?.kind).toBe("final");
        if (!done.value || done.value.kind !== "final") {
            throw new Error("Expected transcription done to map to final");
        }
        const doneTextMessage = done.value.response.output[0];
        expect(doneTextMessage?.type).toBe("message");
        if (!doneTextMessage || doneTextMessage.type !== "message") {
            throw new Error("Expected mapped transcription done message");
        }
        expect(doneTextMessage.content).toBe("hello world");
        expect(done.value.response.usage.inputTokens).toBe(3);
        expect(done.value.response.usage.outputTokens).toBe(2);
        expect(done.value.response.usage.totalTokens).toBe(5);
    });
});
