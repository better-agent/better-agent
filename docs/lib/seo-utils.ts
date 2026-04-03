import type { Metadata } from "next";

const BASE_URL = "https://better-agent.com";

interface PageMetadataParams {
    slug: string[];
    title?: string;
    description?: string;
    keywords?: string[];
    imagePath?: string;
}

function toAbsoluteUrl(path: string) {
    if (path.startsWith("http://") || path.startsWith("https://")) return path;
    return `${BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

function buildImageMetadata(path: string) {
    const imageUrl = toAbsoluteUrl(path);

    return {
        openGraph: [
            {
                url: imageUrl,
                width: 1200,
                height: 630,
                alt: "Better Agent",
            },
        ],
        twitter: [imageUrl],
    };
}

export function generateDocsMetadata({
    slug,
    title,
    description,
    keywords,
    imagePath = "/og.png",
}: PageMetadataParams): Metadata {
    const pageSlug = slug.join("/");
    const url = `${BASE_URL}/docs/${pageSlug}`;
    const imageMetadata = buildImageMetadata(imagePath);

    return {
        title: title || "Documentation",
        description: description || "Better Agent documentation and guides",
        keywords: [
            "Better Agent",
            "AI agents",
            "TypeScript",
            "documentation",
            "guide",
            ...(keywords || []),
        ],
        openGraph: {
            type: "article",
            title: title || "Documentation",
            description: description || "Better Agent documentation and guides",
            url,
            siteName: "Better Agent",
            locale: "en_US",
            images: imageMetadata.openGraph,
        },
        twitter: {
            card: "summary_large_image",
            title: title || "Documentation",
            description: description || "Better Agent documentation and guides",
            images: imageMetadata.twitter,
        },
        alternates: {
            canonical: url,
        },
    };
}

export function generateBreadcrumbStructuredData(slug: string[], title: string) {
    const items = [
        { name: "Home", url: BASE_URL },
        { name: "Docs", url: `${BASE_URL}/docs` },
    ];

    let currentPath = "";
    for (let i = 0; i < slug.length; i++) {
        currentPath += `/${slug[i]}`;
        const isLast = i === slug.length - 1;
        items.push({
            name: isLast
                ? title
                : slug[i].replace(/-/g, " ").replace(/^\w/, (c) => c.toUpperCase()),
            url: `${BASE_URL}/docs${currentPath}`,
        });
    }

    return {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: items.map((item, index) => ({
            "@type": "ListItem",
            position: index + 1,
            name: item.name,
            item: item.url,
        })),
    };
}

export function generateTechArticleStructuredData(
    title: string,
    description: string,
    slug: string[],
    datePublished?: string,
    dateModified?: string,
) {
    const url = `${BASE_URL}/docs/${slug.join("/")}`;

    return {
        "@context": "https://schema.org",
        "@type": "TechArticle",
        headline: title,
        description: description,
        url: url,
        mainEntityOfPage: {
            "@type": "WebPage",
            "@id": url,
        },
        author: {
            "@type": "Organization",
            name: "Better Agent",
            url: BASE_URL,
        },
        publisher: {
            "@type": "Organization",
            name: "Better Agent",
            url: BASE_URL,
        },
        ...(datePublished && { datePublished }),
        ...(dateModified && { dateModified }),
    };
}

export function generateOrganizationStructuredData() {
    return {
        "@context": "https://schema.org",
        "@type": "Organization",
        name: "Better Agent",
        url: BASE_URL,
        logo: `${BASE_URL}/logo.png`,
        sameAs: ["https://github.com/better-agent"],
    };
}

export function generateWebSiteStructuredData() {
    return {
        "@context": "https://schema.org",
        "@type": "WebSite",
        name: "Better Agent Documentation",
        url: BASE_URL,
        potentialAction: {
            "@type": "SearchAction",
            target: {
                "@type": "EntryPoint",
                urlTemplate: `${BASE_URL}/api/search?q={search_term_string}`,
            },
            "query-input": "required name=search_term_string",
        },
    };
}

export function generateHowToStructuredData(
    title: string,
    description: string,
    slug: string,
    steps: Array<{ name: string; text: string; url?: string }>,
) {
    const url = `${BASE_URL}/cookbook/${slug}`;

    return {
        "@context": "https://schema.org",
        "@type": "HowTo",
        name: title,
        description: description,
        url: url,
        totalTime: "PT30M",
        step: steps.map((step, index) => ({
            "@type": "HowToStep",
            position: index + 1,
            name: step.name,
            text: step.text,
            ...(step.url && { url: step.url }),
        })),
    };
}
