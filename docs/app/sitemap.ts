import { cookbookSource } from "@/lib/cookbook-source";
import { source } from "@/lib/source";
import type { MetadataRoute } from "next";

const BASE_URL = "https://better-agent.com";

export default function sitemap(): MetadataRoute.Sitemap {
    const staticPages: MetadataRoute.Sitemap = [
        {
            url: `${BASE_URL}/`,
            lastModified: new Date(),
            changeFrequency: "weekly",
            priority: 1.0,
        },
        {
            url: `${BASE_URL}/docs`,
            lastModified: new Date(),
            changeFrequency: "daily",
            priority: 0.9,
        },
        {
            url: `${BASE_URL}/cookbook`,
            lastModified: new Date(),
            changeFrequency: "weekly",
            priority: 0.8,
        },
        {
            url: `${BASE_URL}/changelog`,
            lastModified: new Date(),
            changeFrequency: "weekly",
            priority: 0.7,
        },
    ];
    const docsPages: MetadataRoute.Sitemap = source.generateParams().map((params) => {
        const slug = params.slug?.join("/") ?? "";

        return {
            url: `${BASE_URL}/docs/${slug}`,
            lastModified: new Date(),
            changeFrequency: "weekly",
            priority: 0.8,
        };
    });
    const cookbookPages: MetadataRoute.Sitemap = cookbookSource.generateParams().map((params) => {
        const slug = params.slug?.[0] ?? "";

        return {
            url: `${BASE_URL}/cookbook/${slug}`,
            lastModified: new Date(),
            changeFrequency: "weekly",
            priority: 0.7,
        };
    });

    return [...staticPages, ...docsPages, ...cookbookPages];
}
