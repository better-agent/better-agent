import { fetchReleases } from "@/lib/changelog";
import { createOgImageResponse } from "@/lib/og";

export async function GET() {
    const releases = await fetchReleases();
    const latest = releases[0];

    return createOgImageResponse({
        eyebrowLeft: "BETTER-AGENT.",
        eyebrowRight: "CHANGELOG",
        title: "What's new in Better Agent",
        description: latest
            ? `${latest.name} is the latest release. Track every improvement, fix, and feature we ship.`
            : "Track every improvement, fix, and feature we ship.",
    });
}
