import { fetchReleases, formatReleaseDate } from "@/lib/changelog";
import type { Metadata } from "next";
import Link from "next/link";
import { JsonLdScript } from "../_components/json-ld-script";

const BASE_URL = "https://better-agent.com";

export const metadata: Metadata = {
    title: "Changelog",
    description:
        "All changes, fixes, and updates. Every release shipped to Better Agent. Track the latest features, improvements, and bug fixes.",
    keywords: [
        "Better Agent changelog",
        "release notes",
        "version history",
        "updates",
        "new features",
        "bug fixes",
    ],
    openGraph: {
        type: "website",
        title: "Changelog | Better Agent",
        description: "Track all changes, fixes, and updates to Better Agent",
        url: `${BASE_URL}/changelog`,
        images: [
            {
                url: `${BASE_URL}/changelog-og`,
                width: 1200,
                height: 630,
                alt: "Better Agent Changelog",
            },
        ],
    },
    twitter: {
        card: "summary_large_image",
        title: "Changelog | Better Agent",
        description: "Track all changes, fixes, and updates to Better Agent",
        images: [`${BASE_URL}/changelog-og`],
    },
    alternates: {
        canonical: `${BASE_URL}/changelog`,
    },
};

export const revalidate = 3600;

export default async function ChangelogPage() {
    const releases = await fetchReleases();
    const latest = releases[0];
    const softwareVersionJsonLd = {
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        name: "Better Agent",
        applicationCategory: "DeveloperApplication",
        softwareVersion: latest?.tag || "1.0.0",
        releaseNotes: releases.map((release) => ({
            "@type": "CreativeWork",
            name: release.name,
            version: release.tag,
            datePublished: release.date,
            url: release.url,
        })),
    };

    return (
        <>
            <JsonLdScript data={softwareVersionJsonLd} />
            <div className="changelog">
                <div className="changelog-inner">
                    <aside className="changelog-hero">
                        <div className="changelog-hero-content">
                            <p className="changelog-label">Changelog</p>
                            <h1 className="changelog-title">What&apos;s new in Better Agent</h1>
                            <p className="changelog-subtitle">
                                A log of every improvement, fix, and feature we ship.
                            </p>

                            <div className="changelog-meta">
                                {latest ? (
                                    <div className="changelog-latest">
                                        <span className="changelog-latest-label">LATEST</span>
                                        <span className="changelog-latest-tag">{latest.tag}</span>
                                    </div>
                                ) : null}

                                <Link
                                    className="changelog-gh-link"
                                    href="https://github.com/better-agent/better-agent/releases"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    <GitHubReleasesIcon />
                                    <span>GITHUB RELEASES</span>
                                </Link>
                            </div>
                        </div>
                    </aside>
                    <section className="changelog-releases">
                        {releases.length === 0 ? (
                            <div className="changelog-empty">
                                <p className="changelog-empty-title">No releases yet</p>
                                <p className="changelog-empty-desc">
                                    When releases are published on GitHub, they will appear here
                                    automatically.
                                </p>
                            </div>
                        ) : (
                            <div className="changelog-list">
                                {releases.map((release) => (
                                    <article
                                        className="changelog-entry"
                                        key={release.tag}
                                        id={release.tag}
                                    >
                                        <div className="changelog-entry-header">
                                            <h2 className="changelog-entry-version">
                                                <a href={`#${release.tag}`}>{release.name}</a>
                                            </h2>
                                            <time
                                                className="changelog-entry-date"
                                                dateTime={release.date}
                                            >
                                                {formatReleaseDate(release.date)}
                                            </time>
                                        </div>
                                        {release.bodyHtml ? (
                                            <div
                                                className="changelog-entry-body"
                                                // biome-ignore lint/security/noDangerouslySetInnerHtml: release.bodyHtml comes from GitHub's rendered HTML API
                                                dangerouslySetInnerHTML={{
                                                    __html: release.bodyHtml,
                                                }}
                                            />
                                        ) : null}
                                        <Link
                                            className="changelog-entry-link"
                                            href={release.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                        >
                                            View changes on GitHub
                                        </Link>
                                    </article>
                                ))}
                            </div>
                        )}
                    </section>
                </div>
            </div>
        </>
    );
}
function GitHubReleasesIcon() {
    return (
        <svg
            aria-hidden="true"
            className="changelog-gh-icon"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
        >
            <path
                d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.992 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}
