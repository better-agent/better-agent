import type { Metadata } from "next";
import CodeDemo from "./_components/code-demo";
import CtaSection from "./_components/cta-section";
import FeaturesSection from "./_components/features-section";
import HeroSection from "./_components/hero-section";
import { JsonLdScript } from "./_components/json-ld-script";
import PrimitivesShowcase from "./_components/primitives-showcase";
import SiteFooter from "./_components/site-footer";

const BASE_URL = "https://better-agent.com";

export const metadata: Metadata = {
    title: "Better Agent",
    description: "The better way to build AI agents in TypeScript.",
    keywords: [
        "AI agents",
        "TypeScript",
        "agent framework",
        "typed agents",
        "durable agents",
        "composable agents",
        "agent tools",
        "structured output",
        "human in the loop",
        "RAG",
        "agent events",
    ],
    alternates: {
        canonical: BASE_URL,
    },
};

function Divider() {
    return (
        <div className="mx-auto w-full max-w-[76rem] px-5 sm:px-8">
            <div className="h-px w-full bg-[color:color-mix(in_srgb,var(--foreground)_7%,transparent)]" />
        </div>
    );
}

export default function Home() {
    const organizationJsonLd = {
        "@context": "https://schema.org",
        "@type": "Organization",
        name: "Better Agent",
        url: BASE_URL,
        description: "The better way to build AI agents in TypeScript.",
    };

    const websiteJsonLd = {
        "@context": "https://schema.org",
        "@type": "WebSite",
        name: "Better Agent",
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
    const softwareJsonLd = {
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        name: "Better Agent",
        applicationCategory: "DeveloperApplication",
        operatingSystem: "Any",
        programmingLanguage: "TypeScript",
        description: "The better way to build AI agents in TypeScript.",
        url: BASE_URL,
    };

    return (
        <>
            <JsonLdScript data={organizationJsonLd} />
            <JsonLdScript data={websiteJsonLd} />
            <JsonLdScript data={softwareJsonLd} />
            <main className="landing-shell relative flex-1">
                <HeroSection />

                <CodeDemo />

                <Divider />

                <FeaturesSection />

                <Divider />

                <PrimitivesShowcase />

                <Divider />

                <CtaSection />

                <SiteFooter />
            </main>
        </>
    );
}
