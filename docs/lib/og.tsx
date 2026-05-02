import { ImageResponse } from "next/og";

export const OG_IMAGE_SIZE = {
    width: 1200,
    height: 630,
} as const;

type BuildOgImageUrlOptions = {
    title: string;
    description?: string;
    eyebrow?: string;
    variant?: "docs" | "home" | "changelog";
};

type CreateOgImageOptions = BuildOgImageUrlOptions;

const SITE_URL = "https://better-agent.com";
const DEFAULT_DESCRIPTION =
    "A TypeScript framework for building typed, event-driven, framework-agnostic agent apps.";
const sansRegularFont = fetch(
    new URL("../node_modules/geist/dist/fonts/geist-sans/Geist-Regular.ttf", import.meta.url),
).then((response) => response.arrayBuffer());
const sansBoldFont = fetch(
    new URL("../node_modules/geist/dist/fonts/geist-sans/Geist-Bold.ttf", import.meta.url),
).then((response) => response.arrayBuffer());
const monoRegularFont = fetch(
    new URL("../node_modules/geist/dist/fonts/geist-mono/GeistMono-Regular.ttf", import.meta.url),
).then((response) => response.arrayBuffer());

async function getOgFonts() {
    const [sansRegular, sansBold, monoRegular] = await Promise.all([
        sansRegularFont,
        sansBoldFont,
        monoRegularFont,
    ]);

    return [
        {
            name: "Geist",
            data: sansRegular,
            style: "normal" as const,
            weight: 400 as const,
        },
        {
            name: "Geist",
            data: sansBold,
            style: "normal" as const,
            weight: 700 as const,
        },
        {
            name: "Geist Mono",
            data: monoRegular,
            style: "normal" as const,
            weight: 400 as const,
        },
    ];
}

function normalizeText(value: string | undefined, fallback: string, maxLength: number) {
    const normalized = (value ?? "").replace(/\s+/g, " ").trim() || fallback;

    if (normalized.length <= maxLength) {
        return normalized;
    }

    return `${normalized.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
}

function getTitleFontSize(title: string) {
    if (title.length > 62) return 46;
    if (title.length > 44) return 52;
    if (title.length > 28) return 60;
    return 70;
}

export function buildOgImageUrl({
    title,
    description,
    eyebrow = "Docs",
    variant = "docs",
}: BuildOgImageUrlOptions) {
    const params = new URLSearchParams();
    params.set("variant", variant);
    params.set("title", title);
    params.set("eyebrow", eyebrow);

    if (description) {
        params.set("description", description);
    }

    return `${SITE_URL}/api/og?${params.toString()}`;
}

export async function createOgImageResponse({
    title,
    description,
    eyebrow = "Docs",
    variant = "docs",
}: CreateOgImageOptions) {
    const fonts = await getOgFonts();

    if (variant === "home" || variant === "changelog") {
        const isChangelog = variant === "changelog";
        const mainTitle = isChangelog ? "Changelog" : "Better Agent";
        const tagline = isChangelog
            ? "Every improvement, fix, and feature we ship."
            : "The better way to build AI agents.";
        const command = isChangelog
            ? "github.com/better-agent/better-agent/releases"
            : "npm create better-agent";
        const headerRight = isChangelog
            ? "RELEASES AND PRODUCT UPDATES"
            : "TYPESCRIPT FRAMEWORK FOR AI AGENTS";
        const footer = isChangelog ? "BETTER-AGENT.COM/CHANGELOG" : "BETTER-AGENT.COM";

        return new ImageResponse(
            <div
                style={{
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    position: "relative",
                    overflow: "hidden",
                    backgroundColor: "#050505",
                    color: "#f7f7f3",
                    fontFamily: '"Geist", "Inter", "Helvetica Neue", Arial, sans-serif',
                }}
            >
                <div
                    style={{
                        position: "absolute",
                        inset: 38,
                        display: "flex",
                        border: "1px solid rgba(255,255,255,0.18)",
                    }}
                />
                <div
                    style={{
                        position: "absolute",
                        top: 104,
                        left: 38,
                        right: 38,
                        height: 1,
                        display: "flex",
                        backgroundColor: "rgba(255,255,255,0.18)",
                    }}
                />
                <div
                    style={{
                        position: "absolute",
                        bottom: 82,
                        left: 38,
                        right: 38,
                        height: 1,
                        display: "flex",
                        backgroundColor: "rgba(255,255,255,0.14)",
                    }}
                />

                <div
                    style={{
                        position: "absolute",
                        top: 56,
                        left: 86,
                        right: 86,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                    }}
                >
                    <span
                        style={{
                            display: "flex",
                            fontFamily:
                                '"Geist Mono", "SFMono-Regular", Menlo, Consolas, monospace',
                            fontSize: 18,
                            letterSpacing: 1,
                            textTransform: "uppercase",
                            color: "rgba(247,247,243,0.74)",
                        }}
                    >
                        BETTER-AGENT.
                    </span>
                    <span
                        style={{
                            display: "flex",
                            fontFamily:
                                '"Geist Mono", "SFMono-Regular", Menlo, Consolas, monospace',
                            fontSize: 14,
                            letterSpacing: 1,
                            textTransform: "uppercase",
                            color: "rgba(247,247,243,0.6)",
                        }}
                    >
                        {headerRight}
                    </span>
                </div>

                <div
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "flex-start",
                        padding: "218px 136px 0",
                        width: "100%",
                        position: "relative",
                    }}
                >
                    <div
                        style={{
                            display: "flex",
                            fontSize: 86,
                            fontWeight: 500,
                            lineHeight: 0.95,
                            letterSpacing: -2.5,
                            color: "#ffffff",
                        }}
                    >
                        {mainTitle}
                    </div>
                    <div
                        style={{
                            display: "flex",
                            marginTop: 22,
                            fontFamily:
                                '"Geist Mono", "SF Mono", "SFMono-Regular", Menlo, Consolas, monospace',
                            fontSize: 24,
                            lineHeight: 1.35,
                            letterSpacing: -1.2,
                            fontWeight: 400,
                            color: "rgba(247,247,243,0.7)",
                        }}
                    >
                        {tagline}
                    </div>
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            marginTop: 26,
                            fontFamily:
                                '"Geist Mono", "SF Mono", "SFMono-Regular", Menlo, Consolas, monospace',
                            fontSize: 22,
                            lineHeight: 1,
                            letterSpacing: -1,
                            fontWeight: 400,
                            color: "rgba(247,247,243,0.78)",
                        }}
                    >
                        <span style={{ display: "flex", color: "rgba(247,247,243,0.42)" }}>
                            {isChangelog ? ">" : "$"}
                        </span>
                        <span style={{ display: "flex", marginLeft: 14 }}>{command}</span>
                    </div>
                </div>
                <div
                    style={{
                        position: "absolute",
                        bottom: 48,
                        left: 86,
                        display: "flex",
                        fontFamily: '"Geist Mono", "SFMono-Regular", Menlo, Consolas, monospace',
                        fontSize: 13,
                        letterSpacing: 1,
                        textTransform: "uppercase",
                        color: "rgba(247,247,243,0.42)",
                    }}
                >
                    {footer}
                </div>
            </div>,
            {
                ...OG_IMAGE_SIZE,
                fonts,
            },
        );
    }

    const safeTitle = normalizeText(title, "Better Agent", 84);
    const safeDescription = normalizeText(description, DEFAULT_DESCRIPTION, 170);
    const titleFontSize = getTitleFontSize(safeTitle);
    const eyebrowLabel = eyebrow.toLowerCase() === "docs" ? "BETTER AGENT" : eyebrow;

    return new ImageResponse(
        <div
            style={{
                width: "100%",
                height: "100%",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                position: "relative",
                overflow: "hidden",
                backgroundColor: "#050505",
                color: "#f7f7f3",
            }}
        >
            <div
                style={{
                    position: "absolute",
                    inset: 38,
                    display: "flex",
                    border: "1px solid rgba(255,255,255,0.1)",
                }}
            />
            <div
                style={{
                    position: "absolute",
                    top: 92,
                    left: 38,
                    right: 38,
                    height: 1,
                    display: "flex",
                    backgroundColor: "rgba(255,255,255,0.12)",
                }}
            />
            <div
                style={{
                    position: "absolute",
                    bottom: 104,
                    left: 38,
                    right: 38,
                    height: 1,
                    display: "flex",
                    backgroundColor: "rgba(255,255,255,0.12)",
                }}
            />

            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "52px 80px 0",
                    position: "relative",
                }}
            >
                <div
                    style={{
                        display: "flex",
                        width: 1,
                        height: 22,
                        backgroundColor: "rgba(255,255,255,0.45)",
                    }}
                />
                <span
                    style={{
                        display: "flex",
                        fontFamily: '"Geist Mono", "SFMono-Regular", Menlo, Consolas, monospace',
                        fontSize: 21,
                        letterSpacing: 0,
                        textTransform: "uppercase",
                        color: "rgba(247,247,243,0.55)",
                    }}
                >
                    {eyebrowLabel}
                </span>
            </div>

            <div
                style={{
                    display: "flex",
                    flexDirection: "column",
                    marginTop: "auto",
                    marginBottom: 116,
                    padding: "0 80px",
                    position: "relative",
                }}
            >
                <div
                    style={{
                        display: "flex",
                        maxWidth: 880,
                        fontFamily: '"Geist", "Inter", "Helvetica Neue", Arial, sans-serif',
                        fontSize: titleFontSize,
                        fontWeight: 760,
                        lineHeight: 0.98,
                        letterSpacing: 0,
                        color: "#ffffff",
                    }}
                >
                    {safeTitle}
                </div>
                <div
                    style={{
                        display: "flex",
                        marginTop: 28,
                        maxWidth: 720,
                        fontFamily: '"Geist Mono", "SFMono-Regular", Menlo, Consolas, monospace',
                        fontSize: safeDescription.length > 120 ? 19 : 21,
                        lineHeight: 1.45,
                        letterSpacing: 0,
                        color: "rgba(247,247,243,0.56)",
                    }}
                >
                    {safeDescription}
                </div>
            </div>

            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "flex-start",
                    padding: "0 80px 58px",
                    position: "relative",
                }}
            >
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 16,
                    }}
                >
                    <span
                        style={{
                            display: "flex",
                            fontFamily:
                                '"Geist Mono", "SFMono-Regular", Menlo, Consolas, monospace',
                            fontSize: 17,
                            letterSpacing: 0,
                            textTransform: "uppercase",
                            color: "rgba(247,247,243,0.4)",
                        }}
                    >
                        documentation
                    </span>
                    <div
                        style={{
                            display: "flex",
                            width: 1,
                            height: 18,
                            backgroundColor: "rgba(255,255,255,0.35)",
                        }}
                    />
                    <span
                        style={{
                            display: "flex",
                            fontFamily:
                                '"Geist Mono", "SFMono-Regular", Menlo, Consolas, monospace',
                            fontSize: 17,
                            letterSpacing: 0,
                            textTransform: "uppercase",
                            color: "rgba(247,247,243,0.4)",
                        }}
                    >
                        better-agent.com/docs
                    </span>
                </div>
            </div>
        </div>,
        {
            ...OG_IMAGE_SIZE,
            fonts,
        },
    );
}
