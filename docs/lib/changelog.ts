const REPO_OWNER = "better-agent";
const REPO_NAME = "better-agent";
const PER_PAGE = 100;

export type Release = {
    tag: string;
    name: string;
    date: string;
    bodyHtml: string;
    url: string;
    prerelease: boolean;
};

export type ReleaseGroup = {
    key: string;
    title: string;
    releases: Release[];
};

type ParsedReleaseTag = {
    major: number;
    minor: number;
};

function processBodyHtml(html: string): string {
    let processed = html.replace(/<h5>\s*<a[^>]*>View changes on GitHub<\/a>\s*<\/h5>\s*$/i, "");

    processed = processed.replace(
        /(<a[^>]*class="user-mention[^"]*"[^>]*href="https:\/\/github\.com\/([^"]+)"[^>]*>@[^<]+<\/a>)/g,
        (_match, fullAnchor: string, username: string) => {
            const avatar = `<img src="https://github.com/${username}.png?size=40" alt="" class="changelog-avatar" />`;
            return `${fullAnchor} ${avatar}`;
        },
    );

    return processed;
}

function shouldIncludeRelease(tag: string, prerelease: boolean): boolean {
    if (!prerelease) return true;
    return /-beta(?:\.\d+)?$/i.test(tag);
}

function parseReleaseTag(tag: string): ParsedReleaseTag | null {
    const match = /^v?(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/i.exec(tag.trim());
    if (!match) return null;

    return {
        major: Number(match[1]),
        minor: Number(match[2]),
    };
}

export function groupReleasesByMinor(releases: Release[]): ReleaseGroup[] {
    const groups = new Map<string, ReleaseGroup>();

    for (const release of releases) {
        const parsed = parseReleaseTag(release.tag);
        const key = parsed ? `v${parsed.major}.${parsed.minor}` : "Other";
        const title = parsed ? `v${parsed.major}.${parsed.minor}.x` : "Other";

        const group = groups.get(key) ?? {
            key,
            title,
            releases: [],
        };

        group.releases.push(release);
        groups.set(key, group);
    }

    return Array.from(groups.values())
        .map((group) => ({
            ...group,
            releases: group.releases.sort(
                (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
            ),
        }))
        .sort((a, b) => {
            const aTag = parseReleaseTag(a.releases[0]?.tag ?? "");
            const bTag = parseReleaseTag(b.releases[0]?.tag ?? "");

            if (!aTag && !bTag) return a.title.localeCompare(b.title);
            if (!aTag) return 1;
            if (!bTag) return -1;

            return bTag.major - aTag.major || bTag.minor - aTag.minor;
        });
}

export async function fetchReleases(): Promise<Release[]> {
    const releases: Release[] = [];
    let page = 1;

    while (true) {
        const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases?per_page=${PER_PAGE}&page=${page}`;
        const headers: Record<string, string> = {
            Accept: "application/vnd.github.html+json",
            "User-Agent": "better-agent-docs",
        };

        if (process.env.GITHUB_TOKEN) {
            headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
        }

        const res = await fetch(url, { headers, next: { revalidate: 3600 } });

        if (!res.ok) {
            console.warn(
                `[changelog] GitHub API returned ${res.status} on page ${page}, stopping.`,
            );
            break;
        }

        const data: Array<{
            tag_name: string;
            name: string | null;
            published_at: string | null;
            created_at: string;
            body_html?: string;
            html_url: string;
            draft: boolean;
            prerelease: boolean;
        }> = await res.json();

        if (data.length === 0) break;

        for (const release of data) {
            if (release.draft) continue;
            if (!shouldIncludeRelease(release.tag_name, release.prerelease)) continue;

            releases.push({
                tag: release.tag_name,
                name: release.name || release.tag_name,
                date: release.published_at || release.created_at,
                bodyHtml: processBodyHtml(release.body_html || ""),
                url: release.html_url,
                prerelease: release.prerelease,
            });
        }

        if (data.length < PER_PAGE) break;
        page++;
    }

    return releases;
}

export function formatReleaseDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
    });
}
