import { fetchReleases, formatReleaseDate, groupReleasesByMinor } from "@/lib/changelog";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
    title: "Changelog",
    description: "Every improvement, fix, and feature we ship.",
    openGraph: {
        title: "Changelog - Better Agent",
        description: "Every improvement, fix, and feature we ship.",
        images: [
            {
                url: "/api/og?variant=changelog",
                width: 1200,
                height: 630,
                alt: "Better Agent Changelog",
            },
        ],
    },
    twitter: {
        card: "summary_large_image",
        title: "Changelog - Better Agent",
        description: "Every improvement, fix, and feature we ship.",
        images: ["/api/og?variant=changelog"],
    },
};

export const revalidate = 3600;

export default async function ChangelogPage() {
    const releases = await fetchReleases();
    const releaseGroups = groupReleasesByMinor(releases);
    const latest = releases[0];

    return (
        <main className="changelog">
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
                                    <span className="changelog-latest-label">Latest</span>
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
                                <span>GitHub Releases</span>
                            </Link>
                        </div>
                    </div>
                </aside>

                <section className="changelog-releases">
                    {releases.length === 0 ? (
                        <div className="changelog-empty">
                            <p className="changelog-empty-title">No releases yet</p>
                            <p className="changelog-empty-desc">
                                Published GitHub releases will appear here.
                            </p>
                        </div>
                    ) : (
                        <div className="changelog-list">
                            {releaseGroups.map((group) => (
                                <div className="changelog-group" key={group.key}>
                                    <div className="changelog-group-header">
                                        <h2 className="changelog-group-title">{group.title}</h2>
                                        <span className="changelog-group-count">
                                            {group.releases.length}{" "}
                                            {group.releases.length === 1 ? "release" : "releases"}
                                        </span>
                                    </div>

                                    {group.releases.map((release) => (
                                        <article
                                            className="changelog-entry"
                                            id={release.tag}
                                            key={release.tag}
                                        >
                                            <div className="changelog-entry-header">
                                                <h3 className="changelog-entry-version">
                                                    <Link
                                                        href={release.url}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                    >
                                                        {release.tag}
                                                    </Link>
                                                </h3>
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
                                                    dangerouslySetInnerHTML={{
                                                        __html: release.bodyHtml,
                                                    }}
                                                />
                                            ) : null}
                                        </article>
                                    ))}
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            </div>
        </main>
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
