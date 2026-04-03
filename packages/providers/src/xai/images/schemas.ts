import { z } from "zod";

import { XAIImageModels as XAIImageModelsSchema } from "../shared/schemas";

export type XAICreateImageSchema = z.input<typeof XAICreateImageSchema>;
export type XAICreateImage = z.input<typeof XAICreateImageSchema>;
export type XAIEditImageSchema = z.input<typeof XAIEditImageSchema>;

const XAIImageResponseDataItemSchema = z.object({
    url: z.string().url().optional(),
    b64_json: z.string().optional(),
    mime_type: z.string().optional(),
    revised_prompt: z.string().optional(),
});

const XAIImageUsageSchema = z
    .object({
        cost_in_usd_ticks: z.number().int().nonnegative().optional(),
    })
    .passthrough();

export const XAICreateImageSchema = z.object({
    model: XAIImageModelsSchema,
    n: z.union([z.number().int().gte(1).lte(10), z.null()]).default(1),
    prompt: z.string().optional(),
    quality: z.union([z.string(), z.null()]).optional(),
    response_format: z.union([z.string(), z.null()]).default("url"),
    size: z.union([z.string(), z.null()]).optional(),
    style: z.union([z.string(), z.null()]).optional(),
    user: z.union([z.string(), z.null()]).optional(),
});

const XAIEditImageInputSchema = z.object({
    type: z.literal("image_url").default("image_url"),
    image_url: z.string(),
});

export const XAIEditImageSchema = z
    .object({
        model: XAIImageModelsSchema,
        prompt: z.string(),
        image: XAIEditImageInputSchema.optional(),
        images: z.array(XAIEditImageInputSchema).min(1).optional(),
        n: XAICreateImageSchema.shape.n.optional(),
        quality: XAICreateImageSchema.shape.quality.optional(),
        response_format: XAICreateImageSchema.shape.response_format.optional(),
        size: XAICreateImageSchema.shape.size.optional(),
        style: XAICreateImageSchema.shape.style.optional(),
        user: XAICreateImageSchema.shape.user.optional(),
        aspect_ratio: z.union([z.string(), z.null()]).optional(),
        resolution: z.union([z.string(), z.null()]).optional(),
    })
    .refine((value) => Boolean(value.image || (value.images && value.images.length > 0)), {
        message: "xAI image edits require at least one source image.",
    });

export const XAICreateImage = z.object({
    data: z.array(XAIImageResponseDataItemSchema),
    usage: XAIImageUsageSchema.optional(),
});

export type XAICreateImageResponse = z.infer<typeof XAICreateImage>;
export type XAIImageModels = z.infer<typeof XAIImageModelsSchema>;
