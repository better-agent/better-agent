import { DocsPageActions } from "@/app/_components/docs-page-actions";
import { JsonLdScript } from "@/app/_components/json-ld-script";
import { PmTab, PmTabs } from "@/app/_components/pm-tabs";
import {
    generateBreadcrumbStructuredData,
    generateDocsMetadata,
    generateTechArticleStructuredData,
} from "@/lib/seo-utils";
import { source } from "@/lib/source";
import type { DocData } from "fumadocs-mdx/runtime/types";
import { Tab, Tabs } from "fumadocs-ui/components/tabs";
import { DocsBody, DocsDescription, DocsPage, DocsTitle } from "fumadocs-ui/layouts/docs/page";
import defaultMdxComponents from "fumadocs-ui/mdx";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

interface PageProps {
    params: Promise<{ slug?: string[] }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { slug } = await params;

    if (!slug?.length) {
        return generateDocsMetadata({
            slug: [],
            title: "Documentation",
            description: "Better Agent documentation and guides",
        });
    }

    const page = source.getPage(slug);

    if (!page) {
        return generateDocsMetadata({
            slug,
            title: "Not Found",
            description: "Page not found",
        });
    }

    return generateDocsMetadata({
        slug,
        title: page.data.title,
        description: page.data.description,
        imagePath: `/docs-og/${slug.join("/")}`,
    });
}

export default async function Page({ params }: PageProps) {
    const { slug } = await params;

    if (!slug?.length) {
        redirect("/docs/get-started/introduction");
    }

    const page = source.getPage(slug);

    if (!page) notFound();

    const pageData = page.data as typeof page.data & Pick<DocData, "body" | "toc">;
    const title = page.data.title ?? "Documentation";
    const description = page.data.description ?? "";
    const MDX = pageData.body;
    const breadcrumbJsonLd = generateBreadcrumbStructuredData(slug, title);
    const articleJsonLd = generateTechArticleStructuredData(title, description, slug);
    const markdownUrl = `${page.url}.mdx`;
    const githubUrl = `https://github.com/better-agent/better-agent/blob/main/docs/contents/docs/${page.path}`;

    return (
        <>
            <JsonLdScript data={breadcrumbJsonLd} />
            <JsonLdScript data={articleJsonLd} />
            <DocsPage
                breadcrumb={{ enabled: false }}
                footer={{ enabled: false }}
                toc={pageData.toc}
                tableOfContent={{
                    style: "clerk",
                }}
            >
                <div className="flex flex-col gap-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
                        <div className="flex flex-wrap items-center gap-2">
                            <DocsTitle className="mb-0">{title}</DocsTitle>
                        </div>
                        <DocsPageActions markdownUrl={markdownUrl} githubUrl={githubUrl} />
                    </div>
                    <DocsDescription className="mb-0 mt-0">{description}</DocsDescription>
                    <div className="mb-6 border-b pb-0" />
                </div>
                <DocsBody>
                    <MDX
                        components={{
                            ...defaultMdxComponents,
                            Tab,
                            Tabs,
                            PmTabs,
                            PmTab,
                        }}
                    />
                </DocsBody>
                <div className="mt-10 border-b" />
            </DocsPage>
        </>
    );
}

export function generateStaticParams() {
    return source.generateParams();
}
