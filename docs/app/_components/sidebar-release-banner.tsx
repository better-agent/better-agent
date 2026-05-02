import { fetchReleases } from "@/lib/changelog";
import { Pin } from "lucide-react";
import Link from "next/link";

const href = "/changelog";

export async function SidebarReleaseBanner() {
    const [latest] = await fetchReleases();
    const label = latest?.tag ?? "Releases";

    return (
        <Link aria-label={`Open changelog for ${label}`} className="ba-sidebar-release" href={href}>
            <span className="ba-sidebar-release__version">
                <Pin aria-hidden="true" className="size-2.5" />
                {label}
            </span>
            <span className="ba-sidebar-release__meta">Changelog</span>
        </Link>
    );
}
