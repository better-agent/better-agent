import { z } from "zod";

export const OpenAIVideoModels = z.enum(["sora-2", "sora-2-pro"]);

export type OpenAIVideoModels = z.infer<typeof OpenAIVideoModels>;

export const OpenAICreateVideoSchema = z.object({
    model: z
        .union([z.string(), OpenAIVideoModels])
        .describe(
            "The video generation model to use (allowed values: sora-2, sora-2-pro). Defaults to `sora-2`.",
        )
        .optional(),
    prompt: z
        .string()
        .min(1)
        .max(32000)
        .describe("Text prompt that describes the video to generate."),
    input_reference: z
        .string()
        .base64()
        .describe("Optional image reference that guides generation.")
        .optional(),
    seconds: z
        .enum(["4", "8", "12"])
        .describe("Clip duration in seconds (allowed values: 4, 8, 12). Defaults to 4 seconds.")
        .optional(),
    size: z
        .enum(["720x1280", "1280x720", "1024x1792", "1792x1024"])
        .describe(
            "Output resolution formatted as width x height (allowed values: 720x1280, 1280x720, 1024x1792, 1792x1024). Defaults to 720x1280.",
        )
        .optional(),
});

export const OpenAICreateVideo = z
    .object({
        id: z.string().describe("Unique identifier for the video job."),
        object: z
            .literal("video")
            .describe("The object type, which is always `video`.")
            .default("video"),
        model: z
            .union([z.string(), OpenAIVideoModels])
            .describe("The video generation model that produced the job."),
        status: z
            .enum(["queued", "in_progress", "completed", "failed"])
            .describe("Current lifecycle status of the video job."),
        progress: z
            .number()
            .int()
            .describe("Approximate completion percentage for the generation task."),
        created_at: z
            .number()
            .int()
            .describe("Unix timestamp (seconds) for when the job was created."),
        completed_at: z.union([
            z
                .number()
                .int()
                .describe("Unix timestamp (seconds) for when the job completed, if finished."),
            z.null(),
        ]),
        expires_at: z.union([
            z
                .number()
                .int()
                .describe(
                    "Unix timestamp (seconds) for when the downloadable assets expire, if set.",
                ),
            z.null(),
        ]),
        prompt: z.union([
            z.string().describe("The prompt that was used to generate the video."),
            z.null(),
        ]),
        size: z
            .enum(["720x1280", "1280x720", "1024x1792", "1792x1024"])
            .describe("The resolution of the generated video."),
        seconds: z.enum(["4", "8", "12"]).describe("Duration of the generated clip in seconds."),
        remixed_from_video_id: z.union([
            z.string().describe("Identifier of the source video if this video is a remix."),
            z.null(),
        ]),
        error: z.union([
            z
                .object({
                    code: z.string(),
                    message: z.string(),
                })
                .describe("Error payload that explains why generation failed, if applicable."),
            z.null(),
        ]),
    })
    .describe("Structured information describing a generated video job.");

export type OpenAICreateVideoSchema = z.input<typeof OpenAICreateVideoSchema>;
export type OpenAICreateVideo = z.infer<typeof OpenAICreateVideo>;
