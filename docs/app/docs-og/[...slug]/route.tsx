import { createOgImageResponse } from "@/lib/og";
import { source } from "@/lib/source";

type RouteContext = {
    params: Promise<{ slug?: string[] }>;
};

export async function GET(_request: Request, { params }: RouteContext) {
    const { slug = [] } = await params;
    const pageSlug = slug.at(-1) === "og.png" ? slug.slice(0, -1) : slug;
    const page = pageSlug.length > 0 ? source.getPage(pageSlug) : null;

    return createOgImageResponse({
        eyebrowLeft: "BETTER-AGENT.",
        eyebrowRight: "DOCUMENTATION",
        title: page?.data.title ?? "Documentation",
        description: page?.data.description ?? "Better Agent documentation and guides.",
    });
}
