import { cookbookSource } from "@/lib/cookbook-source";
import { createOgImageResponse } from "@/lib/og";

const cookbookOgTitleOverrides: Record<string, string> = {
    "build-a-human-in-the-loop-chat": "HIL Chat",
};

function splitCookbookTitle(title: string | undefined) {
    if (!title) return undefined;
    const normalized = title.replace(/\s+/g, " ").trim();
    if (!normalized) return undefined;

    const words = normalized.split(" ");
    if (words.length <= 2) return [normalized];
    if (words.length === 3) return [`${words[0]} ${words[1]}`, words[2]];
    if (words.length === 4) return [`${words[0]} ${words[1]} ${words[2]}`, words[3]];

    const midpoint = Math.ceil(words.length / 2);
    return [words.slice(0, midpoint).join(" "), words.slice(midpoint).join(" ")];
}

type RouteContext = {
    params: Promise<{ slug: string }>;
};

export async function GET(_request: Request, { params }: RouteContext) {
    const { slug } = await params;
    const page = slug ? cookbookSource.getPage([slug]) : null;
    const pageData = page?.data as { title?: string; description?: string } | undefined;
    const ogTitle = cookbookOgTitleOverrides[slug] ?? pageData?.title;

    return createOgImageResponse({
        eyebrowLeft: "BETTER-AGENT.",
        eyebrowRight: "COOKBOOK",
        title: ogTitle ?? "Cookbook",
        titleLines: splitCookbookTitle(ogTitle),
        description:
            pageData?.description ?? "Guides and recipes for building AI agents with Better Agent.",
        descriptionMaxLength: 110,
    });
}
