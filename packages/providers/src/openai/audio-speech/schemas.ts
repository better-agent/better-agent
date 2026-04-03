import { z } from "zod";

export const OpenAIAudioSpeechModels = z.enum(["gpt-4o-mini-tts", "tts-1", "tts-1-hd"]);

export type OpenAIAudioSpeechModels = z.infer<typeof OpenAIAudioSpeechModels>;

export const CreateSpeechRequest = z.object({
    model: z
        .union([z.string(), z.enum(["tts-1", "tts-1-hd", "gpt-4o-mini-tts"])])
        .describe(
            "One of the available [TTS models](https://platform.openai.com/docs/models#tts): `tts-1`, `tts-1-hd` or `gpt-4o-mini-tts`.\n",
        ),
    input: z
        .string()
        .max(4096)
        .describe("The text to generate audio for. The maximum length is 4096 characters."),
    instructions: z
        .string()
        .max(4096)
        .describe(
            "Control the voice of your generated audio with additional instructions. Does not work with `tts-1` or `tts-1-hd`.",
        )
        .optional(),
    voice: z
        .union([
            z.string(),
            z.enum([
                "alloy",
                "ash",
                "ballad",
                "coral",
                "echo",
                "sage",
                "shimmer",
                "verse",
                "fable",
                "onyx",
                "nova",
            ]),
        ])
        .describe(
            "The voice to use when generating the audio. Supported voices are `alloy`, `ash`, `ballad`, `coral`, `echo`, `fable`, `onyx`, `nova`, `sage`, `shimmer`, and `verse`. Previews of the voices are available in the [Text to speech guide](https://platform.openai.com/docs/guides/text-to-speech#voice-options).",
        ),
    response_format: z
        .enum(["mp3", "opus", "aac", "flac", "wav", "pcm"])
        .describe(
            "The format to audio in. Supported formats are `mp3`, `opus`, `aac`, `flac`, `wav`, and `pcm`.",
        )
        .default("mp3"),
    speed: z
        .number()
        .gte(0.25)
        .lte(4)
        .describe(
            "The speed of the generated audio. Select a value from `0.25` to `4.0`. `1.0` is the default.",
        )
        .default(1),
    stream_format: z
        .enum(["sse", "audio"])
        .describe(
            "The format to stream the audio in. Supported formats are `sse` and `audio`. `sse` is not supported for `tts-1` or `tts-1-hd`.",
        )
        .default("audio"),
    stream: z
        .union([z.boolean(), z.null()])
        .describe(
            "If set to true, the model response data will be streamed to the client\nas it is generated using server-sent events.",
        )
        .optional(),
});

export type OpenAICreateSpeechRequest = z.input<typeof CreateSpeechRequest>;
