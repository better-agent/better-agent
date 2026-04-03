import Link from "next/link";
import { GitHubIcon } from "./icons";

export default function SiteFooter() {
    return (
        <footer className="relative mx-auto w-full max-w-[76rem] px-5 sm:px-8">
            <div className="flex items-center justify-between gap-4 border-t border-[color:color-mix(in_srgb,var(--foreground)_7%,transparent)] py-6">
                <Link
                    aria-label="Better Agent"
                    className="inline-flex items-center transition-opacity hover:opacity-80"
                    href="/"
                >
                    <span
                        aria-hidden="true"
                        className="font-sans text-[11px] font-semibold uppercase tracking-[0.02em] text-[color:color-mix(in_srgb,var(--foreground)_50%,transparent)]"
                    >
                        BETTER-AGENT.
                    </span>
                </Link>
                <div className="flex items-center gap-3">
                    <a
                        className="text-[color:color-mix(in_srgb,var(--foreground)_36%,transparent)] transition-colors hover:text-[color:var(--foreground)]"
                        href="https://github.com/better-agent/better-agent"
                        rel="noopener noreferrer"
                        target="_blank"
                    >
                        <GitHubIcon className="size-3.5" />
                        <span className="sr-only">GitHub</span>
                    </a>
                    <span className="text-[11.5px] text-[color:color-mix(in_srgb,var(--foreground)_28%,transparent)]">
                        &copy; {new Date().getFullYear()}
                    </span>
                </div>
            </div>
        </footer>
    );
}
