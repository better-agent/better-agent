import { ImageResponse } from "next/og";

export const OG_IMAGE_SIZE = {
    width: 1200,
    height: 630,
} as const;

export const OG_IMAGE_CONTENT_TYPE = "image/png";

type OgImageProps = {
    eyebrowLeft: string;
    eyebrowRight: string;
    title: string;
    titleLines?: string[];
    description?: string;
    command?: string;
    descriptionMaxLength?: number;
};

function trimText(value: string | undefined, max: number) {
    if (!value) return undefined;
    const normalized = value.replace(/\s+/g, " ").trim();
    if (normalized.length <= max) return normalized;
    return `${normalized.slice(0, Math.max(0, max - 1)).trimEnd()}...`;
}

function getTitleFontSize(title: string) {
    const words = title.split(/\s+/).filter(Boolean);
    const longestWord = words.reduce((max, word) => Math.max(max, word.length), 0);
    const hasHyphen = title.includes("-");
    const isDenseShortTitle =
        title.length > 18 && (words.length >= 4 || longestWord >= 12 || hasHyphen);

    if (title.length > 58) return 50;
    if (title.length > 42) return 56;
    if (title.length > 28) return 64;
    if (title.length > 18) return 82;
    if (isDenseShortTitle) return 88;
    return 104;
}

function getDescriptionFontSize(description: string | undefined) {
    if (!description) return 0;
    if (description.length > 110) return 26;
    return 32;
}

function splitTitleForOg(title: string) {
    const normalized = title.replace(/\s+/g, " ").trim();
    if (!normalized) return [title];

    const words = normalized.split(" ");
    const longestWord = words.reduce((max, word) => Math.max(max, word.length), 0);
    const shouldSplit =
        words.length >= 4 &&
        (normalized.length > 24 || normalized.includes("-") || longestWord >= 12);

    if (!shouldSplit) return [normalized];
    if (words.length === 3) return [`${words[0]} ${words[1]}`, words[2]];
    if (words.length === 4) return [`${words[0]} ${words[1]}`, `${words[2]} ${words[3]}`];

    const midpoint = Math.ceil(words.length / 2);
    return [words.slice(0, midpoint).join(" "), words.slice(midpoint).join(" ")];
}

export function createOgImageResponse({
    eyebrowLeft,
    eyebrowRight,
    title,
    titleLines,
    description,
    command,
    descriptionMaxLength = 180,
}: OgImageProps) {
    const safeTitle = trimText(title, 72) ?? "Better Agent";
    const autoTitleLines = titleLines ? [] : splitTitleForOg(safeTitle);
    const safeTitleLines =
        (titleLines ?? autoTitleLines).map((line) => trimText(line, 36) ?? "").filter(Boolean) ??
        [];
    const safeDescription = trimText(description, descriptionMaxLength);
    const hasExplicitTitleLines = safeTitleLines.length > 0;
    const effectiveTitle = hasExplicitTitleLines ? safeTitleLines.join(" ") : safeTitle;
    const renderedTitle = hasExplicitTitleLines ? safeTitleLines.join("\n") : safeTitle;
    const titleFontSize = hasExplicitTitleLines ? 62 : getTitleFontSize(effectiveTitle);
    const descriptionFontSize = getDescriptionFontSize(safeDescription);
    const wordCount = effectiveTitle.split(/\s+/).filter(Boolean).length;
    const longestWord = effectiveTitle
        .split(/\s+/)
        .filter(Boolean)
        .reduce((max, word) => Math.max(max, word.length), 0);
    const isVeryLongTitle = !hasExplicitTitleLines && effectiveTitle.length > 42;
    const isLongTitle = !hasExplicitTitleLines && !isVeryLongTitle && effectiveTitle.length > 28;
    const isMediumTitle =
        !hasExplicitTitleLines &&
        !isVeryLongTitle &&
        !isLongTitle &&
        wordCount >= 3 &&
        effectiveTitle.length > 18;
    const isDenseTitle =
        !hasExplicitTitleLines &&
        !isVeryLongTitle &&
        (effectiveTitle.includes("-") ||
            longestWord >= 10 ||
            (wordCount >= 3 && effectiveTitle.length > 14));
    const titleMaxWidth = hasExplicitTitleLines
        ? 720
        : isVeryLongTitle
          ? 620
          : isLongTitle
            ? 700
            : isDenseTitle
              ? 760
              : isMediumTitle
                ? 820
                : 860;
    const titleLineHeight = hasExplicitTitleLines
        ? 1.06
        : isVeryLongTitle
          ? 1.04
          : isLongTitle
            ? 1.02
            : isDenseTitle
              ? 0.96
              : isMediumTitle
                ? 0.96
                : 0.9;
    const titleLetterSpacing = hasExplicitTitleLines
        ? "-0.05em"
        : isVeryLongTitle
          ? "-0.045em"
          : isLongTitle
            ? "-0.05em"
            : isDenseTitle
              ? "-0.055em"
              : isMediumTitle
                ? "-0.065em"
                : "-0.085em";
    const descriptionMarginTop = hasExplicitTitleLines
        ? 34
        : isVeryLongTitle
          ? 24
          : isLongTitle
            ? 28
            : isDenseTitle
              ? 34
              : isMediumTitle
                ? 34
                : 46;

    return new ImageResponse(
        <div
            style={{
                width: "100%",
                height: "100%",
                display: "flex",
                background: "#000000",
                color: "#f5f3ee",
            }}
        >
            <div
                style={{
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    padding: "38px 42px 42px",
                    background: "#000000",
                }}
            >
                <div
                    style={{
                        position: "relative",
                        width: "100%",
                        height: "100%",
                        display: "flex",
                        flexDirection: "column",
                        background: "#040404",
                        border: "1px solid rgba(255,255,255,0.12)",
                        overflow: "hidden",
                    }}
                >
                    <div
                        style={{
                            width: "100%",
                            minHeight: 94,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "0 46px",
                            borderBottom: "1px solid rgba(255,255,255,0.1)",
                        }}
                    >
                        <div
                            style={{
                                display: "flex",
                                fontFamily: "monospace",
                                fontSize: 18,
                                letterSpacing: "0.19em",
                                color: "rgba(244,244,239,0.7)",
                                textTransform: "uppercase",
                            }}
                        >
                            {eyebrowLeft}
                        </div>
                        <div
                            style={{
                                display: "flex",
                                fontFamily: "monospace",
                                fontSize: 18,
                                letterSpacing: "0.19em",
                                color: "rgba(244,244,239,0.7)",
                                textTransform: "uppercase",
                            }}
                        >
                            {eyebrowRight}
                        </div>
                    </div>

                    <div
                        style={{
                            width: "100%",
                            display: "flex",
                            flexDirection: "column",
                            flex: 1,
                        }}
                    >
                        <div
                            style={{
                                display: "flex",
                                flexDirection: "column",
                                flex: 1,
                                maxWidth: titleMaxWidth,
                                padding: "122px 88px 58px",
                            }}
                        >
                            <div
                                style={{
                                    display: "block",
                                    maxWidth: titleMaxWidth,
                                    fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
                                    fontSize: titleFontSize,
                                    fontWeight: 800,
                                    lineHeight: titleLineHeight,
                                    letterSpacing: titleLetterSpacing,
                                    color: "#f5f3ee",
                                    whiteSpace: hasExplicitTitleLines ? "pre-wrap" : "normal",
                                }}
                            >
                                {renderedTitle}
                            </div>
                            {safeDescription ? (
                                <div
                                    style={{
                                        display: "block",
                                        marginTop: descriptionMarginTop,
                                        maxWidth: hasExplicitTitleLines ? 700 : 760,
                                        fontFamily: "monospace",
                                        fontSize: hasExplicitTitleLines
                                            ? Math.max(descriptionFontSize - 6, 18)
                                            : Math.max(descriptionFontSize - 4, 20),
                                        fontWeight: 300,
                                        lineHeight: hasExplicitTitleLines ? 1.18 : 1.22,
                                        letterSpacing: "-0.04em",
                                        color: "rgba(244,244,239,0.5)",
                                    }}
                                >
                                    {safeDescription}
                                </div>
                            ) : null}
                            {command ? (
                                <div
                                    style={{
                                        display: "flex",
                                        marginTop: 34,
                                        fontFamily: "monospace",
                                        fontSize: 23,
                                        letterSpacing: "-0.03em",
                                        color: "rgba(244,244,239,0.5)",
                                    }}
                                >
                                    <span>$&nbsp;</span>
                                    <span style={{ color: "rgba(244,244,239,0.74)" }}>
                                        {command}
                                    </span>
                                </div>
                            ) : null}
                        </div>
                        <div
                            style={{
                                height: 70,
                                display: "flex",
                                borderTop: "1px solid rgba(255,255,255,0.1)",
                                backgroundColor: "#060606",
                                backgroundImage:
                                    "repeating-linear-gradient(45deg, rgba(255,255,255,0.028) 0px, rgba(255,255,255,0.028) 2px, transparent 2px, transparent 18px)",
                            }}
                        />
                    </div>
                </div>
            </div>
        </div>,
        {
            width: OG_IMAGE_SIZE.width,
            height: OG_IMAGE_SIZE.height,
        },
    );
}
