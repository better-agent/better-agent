import type { Metadata } from "next";
import Link from "next/link";
import { JsonLdScript } from "../_components/json-ld-script";

const BASE_URL = "https://better-agent.com";

export const metadata: Metadata = {
    title: "Cookbook - Guides and Recipes",
    description:
        "Practical Better Agent guides for RAG chat, human-in-the-loop chat, structured extraction, and MCP-powered chat.",
    keywords: [
        "Better Agent cookbook",
        "RAG chat tutorial",
        "human in the loop chat",
        "structured extraction",
        "MCP chat",
        "agent guides",
    ],
    openGraph: {
        type: "website",
        title: "Cookbook - Guides and Recipes | Better Agent",
        description: "Practical Better Agent guides for common app patterns.",
        url: `${BASE_URL}/cookbook`,
        images: [
            {
                url: `${BASE_URL}/cookbook-og`,
                width: 1200,
                height: 630,
                alt: "Better Agent Cookbook",
            },
        ],
    },
    twitter: {
        card: "summary_large_image",
        title: "Cookbook - Guides and Recipes | Better Agent",
        description: "Practical Better Agent guides for common app patterns.",
        images: [`${BASE_URL}/cookbook-og`],
    },
    alternates: {
        canonical: `${BASE_URL}/cookbook`,
    },
};

const guides = [
    {
        title: "Build a\nRAG Chat",
        href: "/cookbook/build-a-rag-agent",
        bg: "linear-gradient(160deg, #3a4f6a, #2c3d55)",
    },
    {
        title: "Build a\nHuman-in-the-Loop\nChat",
        href: "/cookbook/build-a-human-in-the-loop-chat",
        bg: "linear-gradient(160deg, #3d5c52, #2d4a40)",
    },
    {
        title: "Build a\nStructured\nExtraction\nPipeline",
        href: "/cookbook/build-a-structured-extraction-pipeline",
        bg: "linear-gradient(160deg, #5a4060, #46324c)",
    },
    {
        title: "Build an\nMCP Chat",
        href: "/cookbook/build-an-mcp-chat",
        bg: "linear-gradient(160deg, #5c4a35, #483928)",
    },
];

export default function CookbookPage() {
    const organizationJsonLd = {
        "@context": "https://schema.org",
        "@type": "Organization",
        name: "Better Agent",
        url: BASE_URL,
    };

    const websiteJsonLd = {
        "@context": "https://schema.org",
        "@type": "WebSite",
        name: "Better Agent Cookbook",
        url: `${BASE_URL}/cookbook`,
    };

    return (
        <>
            <JsonLdScript data={organizationJsonLd} />
            <JsonLdScript data={websiteJsonLd} />
            <main className="cookbook-landing">
                <div className="cookbook-landing-inner">
                    <h1 className="cookbook-landing-title">Cookbook</h1>

                    <div className="cookbook-section">
                        <div className="cookbook-section-header">
                            <h2 className="cookbook-section-title">Guides</h2>
                        </div>

                        <div className="cookbook-grid">
                            {guides.map((guide) => (
                                <Link
                                    key={guide.href}
                                    href={guide.href}
                                    className="cookbook-book"
                                    style={{ "--book-bg": guide.bg } as React.CSSProperties}
                                >
                                    <span className="cookbook-book-texture" />
                                    <span className="cookbook-book-title">{guide.title}</span>
                                </Link>
                            ))}
                        </div>
                    </div>
                </div>
            </main>
        </>
    );
}
