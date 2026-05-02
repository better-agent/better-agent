import { createOgImageResponse } from "@/lib/og";

export const runtime = "edge";

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);

    const title = searchParams.get("title")?.trim() || "Better Agent";
    const description = searchParams.get("description")?.trim() || undefined;
    const eyebrow = searchParams.get("eyebrow")?.trim() || "Docs";
    const variantParam = searchParams.get("variant");
    const variant = variantParam === "home" || variantParam === "changelog" ? variantParam : "docs";

    const imageResponse = await createOgImageResponse({
        title,
        description,
        eyebrow,
        variant,
    });

    const headers = new Headers(imageResponse.headers);
    headers.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");

    return new Response(imageResponse.body, {
        headers,
        status: imageResponse.status,
    });
}
