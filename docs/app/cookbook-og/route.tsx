import { createOgImageResponse } from "@/lib/og";

export async function GET() {
    return createOgImageResponse({
        eyebrowLeft: "BETTER-AGENT.",
        eyebrowRight: "COOKBOOK",
        title: "Cookbook",
        description: "Guides and recipes for building AI agents with Better Agent.",
    });
}
