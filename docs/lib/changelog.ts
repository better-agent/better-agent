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
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
    });
}
