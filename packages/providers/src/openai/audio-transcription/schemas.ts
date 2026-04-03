import { z } from "zod";

export const OpenAIAudioTranscriptionModels = z.enum([
    "gpt-4o-transcribe",
    "gpt-4o-mini-transcribe",
    "whisper-1",
    "gpt-4o-transcribe-diarize",
]);

export type OpenAIAudioTranscriptionModels = z.infer<typeof OpenAIAudioTranscriptionModels>;

export const CreateTranscriptionRequest = z.object({
    file: z
        .string()
        .base64()
        .describe(
            "The audio file object (not file name) to transcribe, in one of these formats: flac, mp3, mp4, mpeg, mpga, m4a, ogg, wav, or webm.\n",
        ),
    model: z
        .union([
            z.string(),
            z.enum([
                "whisper-1",
                "gpt-4o-transcribe",
                "gpt-4o-mini-transcribe",
                "gpt-4o-transcribe-diarize",
            ]),
        ])
        .describe(
            "ID of the model to use. The options are `gpt-4o-transcribe`, `gpt-4o-mini-transcribe`, `whisper-1` (which is powered by our open source Whisper V2 model), and `gpt-4o-transcribe-diarize`.\n",
        ),
    language: z
        .string()
        .describe(
            "The language of the input audio. Supplying the input language in [ISO-639-1](https://en.wikipedia.org/wiki/List_of_ISO_639-1_codes) (e.g. `en`) format will improve accuracy and latency.\n",
        )
        .optional(),
    prompt: z
        .string()
        .describe(
            "An optional text to guide the model's style or continue a previous audio segment. The [prompt](https://platform.openai.com/docs/guides/speech-to-text#prompting) should match the audio language. This field is not supported when using `gpt-4o-transcribe-diarize`.\n",
        )
        .optional(),
    response_format: z
        .enum(["json", "text", "srt", "verbose_json", "vtt", "diarized_json"])
        .describe(
            "The format of the output, in one of these options: `json`, `text`, `srt`, `verbose_json`, `vtt`, or `diarized_json`. For `gpt-4o-transcribe` and `gpt-4o-mini-transcribe`, the only supported format is `json`. For `gpt-4o-transcribe-diarize`, the supported formats are `json`, `text`, and `diarized_json`, with `diarized_json` required to receive speaker annotations.\n",
        )
        .default("json"),
    temperature: z
        .number()
        .gte(0)
        .lte(1)
        .describe(
            "The sampling temperature, between 0 and 1. Higher values like 0.8 will make the output more random, while lower values like 0.2 will make it more focused and deterministic. If set to 0, the model will use [log probability](https://en.wikipedia.org/wiki/Log_probability) to automatically increase the temperature until certain thresholds are hit.\n",
        )
        .default(0),
    include: z
        .array(z.literal("logprobs"))
        .describe(
            "Additional information to include in the transcription response.\n`logprobs` will return the log probabilities of the tokens in the\nresponse to understand the model's confidence in the transcription.\n`logprobs` only works with response_format set to `json` and only with\nthe models `gpt-4o-transcribe` and `gpt-4o-mini-transcribe`. This field is not supported when using `gpt-4o-transcribe-diarize`.\n",
        )
        .optional(),
    timestamp_granularities: z
        .array(z.enum(["word", "segment"]))
        .describe(
            "The timestamp granularities to populate for this transcription. `response_format` must be set `verbose_json` to use timestamp granularities. Either or both of these options are supported: `word`, or `segment`. Note: There is no additional latency for segment timestamps, but generating word timestamps incurs additional latency.\nThis option is not available for `gpt-4o-transcribe-diarize`.\n",
        )
        .default(["segment"]),
    stream: z
        .union([
            z
                .boolean()
                .describe(
                    "If set to true, the model response data will be streamed to the client\nas it is generated using [server-sent events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events#Event_stream_format).\nSee the [Streaming section of the Speech-to-Text guide](https://platform.openai.com/docs/guides/speech-to-text?lang=curl#streaming-transcriptions)\nfor more information.\n\nNote: Streaming is not supported for the `whisper-1` model and will be ignored.\n",
                )
                .default(false),
            z.null(),
        ])
        .optional(),
    chunking_strategy: z
        .union([
            z
                .union([
                    z
                        .literal("auto")
                        .describe(
                            'Automatically set chunking parameters based on the audio. Must be set to `"auto"`.\n',
                        )
                        .default("auto"),
                    z
                        .object({
                            type: z
                                .literal("server_vad")
                                .describe(
                                    "Must be set to `server_vad` to enable manual chunking using server side VAD.",
                                ),
                            prefix_padding_ms: z
                                .number()
                                .int()
                                .describe(
                                    "Amount of audio to include before the VAD detected speech (in \nmilliseconds).\n",
                                )
                                .default(300),
                            silence_duration_ms: z
                                .number()
                                .int()
                                .describe(
                                    "Duration of silence to detect speech stop (in milliseconds).\nWith shorter values the model will respond more quickly, \nbut may jump in on short pauses from the user.\n",
                                )
                                .default(200),
                            threshold: z
                                .number()
                                .describe(
                                    "Sensitivity threshold (0.0 to 1.0) for voice activity detection. A \nhigher threshold will require louder audio to activate the model, and \nthus might perform better in noisy environments.\n",
                                )
                                .default(0.5),
                        })
                        .strict(),
                ])
                .describe(
                    'Controls how the audio is cut into chunks. When set to `"auto"`, the server first normalizes loudness and then uses voice activity detection (VAD) to choose boundaries. `server_vad` object can be provided to tweak VAD detection parameters manually. If unset, the audio is transcribed as a single block. Required when using `gpt-4o-transcribe-diarize` for inputs longer than 30 seconds. ',
                ),
            z.null(),
        ])
        .optional(),
    known_speaker_names: z
        .array(z.string())
        .max(4)
        .describe(
            "Optional list of speaker names that correspond to the audio samples provided in `known_speaker_references[]`. Each entry should be a short identifier (for example `customer` or `agent`). Up to 4 speakers are supported.\n",
        )
        .optional(),
    known_speaker_references: z
        .array(z.string())
        .max(4)
        .describe(
            "Optional list of audio samples (as [data URLs](https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/Data_URLs)) that contain known speaker references matching `known_speaker_names[]`. Each sample must be between 2 and 10 seconds, and can use any of the same input audio formats supported by `file`.\n",
        )
        .optional(),
});

export const CreateTranscriptionResponseVerboseJson = z
    .object({
        language: z.string().describe("The language of the input audio."),
        duration: z.number().describe("The duration of the input audio."),
        text: z.string().describe("The transcribed text."),
        words: z
            .array(
                z.object({
                    word: z.string().describe("The text content of the word."),
                    start: z.number().describe("Start time of the word in seconds."),
                    end: z.number().describe("End time of the word in seconds."),
                }),
            )
            .describe("Extracted words and their corresponding timestamps.")
            .optional(),
        segments: z
            .array(
                z.object({
                    id: z.number().int().describe("Unique identifier of the segment."),
                    seek: z.number().int().describe("Seek offset of the segment."),
                    start: z.number().describe("Start time of the segment in seconds."),
                    end: z.number().describe("End time of the segment in seconds."),
                    text: z.string().describe("Text content of the segment."),
                    tokens: z
                        .array(z.number().int())
                        .describe("Array of token IDs for the text content."),
                    temperature: z
                        .number()
                        .describe("Temperature parameter used for generating the segment."),
                    avg_logprob: z
                        .number()
                        .describe(
                            "Average logprob of the segment. If the value is lower than -1, consider the logprobs failed.",
                        ),
                    compression_ratio: z
                        .number()
                        .describe(
                            "Compression ratio of the segment. If the value is greater than 2.4, consider the compression failed.",
                        ),
                    no_speech_prob: z
                        .number()
                        .describe(
                            "Probability of no speech in the segment. If the value is higher than 1.0 and the `avg_logprob` is below -1, consider this segment silent.",
                        ),
                }),
            )
            .describe("Segments of the transcribed text and their corresponding details.")
            .optional(),
        usage: z
            .object({
                type: z
                    .literal("duration")
                    .describe("The type of the usage object. Always `duration` for this variant."),
                seconds: z.number().describe("Duration of the input audio in seconds."),
            })
            .describe("Usage statistics for models billed by audio input duration.")
            .optional(),
    })
    .describe(
        "Represents a verbose json transcription response returned by model, based on the provided input.",
    );

export type OpenAICreateTranscriptionRequest = z.input<typeof CreateTranscriptionRequest>;
export type OpenAICreateTranscriptionResponse = z.infer<
    typeof CreateTranscriptionResponseVerboseJson
>;
