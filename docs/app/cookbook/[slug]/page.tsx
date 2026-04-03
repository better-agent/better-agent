import { DocsPageActions } from "@/app/_components/docs-page-actions";
import { JsonLdScript } from "@/app/_components/json-ld-script";
import { cookbookSource } from "@/lib/cookbook-source";
import { generateHowToStructuredData } from "@/lib/seo-utils";
import type { DocData } from "fumadocs-mdx/runtime/types";
import { Tab, Tabs } from "fumadocs-ui/components/tabs";
import { DocsBody, DocsDescription, DocsPage, DocsTitle } from "fumadocs-ui/layouts/docs/page";
import defaultMdxComponents from "fumadocs-ui/mdx";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

const BASE_URL = "https://better-agent.com";

interface PageProps {
    params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { slug } = await params;
    const page = cookbookSource.getPage([slug]);

    if (!page) {
        return {
            title: "Not Found",
            description: "Recipe not found",
        };
    }

    const url = `${BASE_URL}/cookbook/${slug}`;
    const title = page.data.title ?? "Cookbook";
    const description =
        page.data.description ?? `Learn how to ${title.toLowerCase()} with Better Agent`;

    return {
        title,
        description,
        keywords: [
            "Better Agent",
            "cookbook",
            "tutorial",
            "guide",
            "AI agents",
            "recipe",
            slug.replace(/-/g, " "),
        ],
        openGraph: {
            type: "article",
            title,
            description,
            url,
            siteName: "Better Agent",
            images: [
                {
                    url: `${BASE_URL}/cookbook-og/${slug}`,
                    width: 1200,
                    height: 630,
                    alt: title,
                },
            ],
        },
        twitter: {
            card: "summary_large_image",
            title,
            description,
            images: [`${BASE_URL}/cookbook-og/${slug}`],
        },
        alternates: {
            canonical: url,
        },
    };
}

export default async function CookbookRecipePage({ params }: PageProps) {
    const { slug } = await params;
    const page = cookbookSource.getPage([slug]);

    if (!page) notFound();

    const pageData = page.data as typeof page.data & Pick<DocData, "body" | "toc">;
    const title = page.data.title ?? "Cookbook";
    const description = page.data.description ?? "";
    const MDX = pageData.body;
    const markdownUrl = `${page.url}.mdx`;
    const githubUrl = `https://github.com/better-agent/better-agent/blob/main/docs/contents/cookbook/${page.path}`;
    const steps =
        pageData.toc?.map((item) => ({
            name: String(item.title),
            text: `Step for ${item.title}`,
        })) || [];

    const howToJsonLd = generateHowToStructuredData(title, description, slug, steps);

    return (
        <>
            <JsonLdScript data={howToJsonLd} />
            <DocsPage
                toc={pageData.toc}
                tableOfContent={{ style: "clerk" }}
                breadcrumb={{ enabled: false }}
                footer={{ enabled: false }}
            >
                <Link href="/cookbook" className="cookbook-recipe-back">
                    <svg
                        aria-hidden="true"
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <path d="M19 12H5" />
                        <path d="m12 19-7-7 7-7" />
                    </svg>
                    Back to Cookbook
                </Link>
                <div className="flex flex-col gap-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
                        <DocsTitle className="mb-0">{title}</DocsTitle>
                        <DocsPageActions markdownUrl={markdownUrl} githubUrl={githubUrl} />
                    </div>
                    <DocsDescription className="mb-0 mt-0">{description}</DocsDescription>
                    <div className="mb-6 border-b pb-0" />
                </div>
                <DocsBody>
                    <MDX components={{ ...defaultMdxComponents, Tab, Tabs }} />
                </DocsBody>
                <div className="mt-10 border-b" />
            </DocsPage>
        </>
    );
}

export function generateStaticParams() {
    return cookbookSource.generateParams().map((params) => ({
        slug: params.slug?.[0] ?? "",
    }));
}
