import Link from "next/link";
import HeroHeadline from "./hero-headline";
import InstallTerminal from "./install-terminal";

function ArrowUpRightIcon({ className }: { className?: string }) {
    return (
        <svg
            aria-hidden="true"
            className={className}
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.8"
            viewBox="0 0 24 24"
        >
            <path d="M7 17 17 7" />
            <path d="M8 7h9v9" />
        </svg>
    );
}

const ctaBaseClass =
    "inline-flex h-[2.1rem] items-center justify-center whitespace-nowrap border px-4 font-sans text-[12.5px] font-medium leading-none tracking-[-0.01em] transition-colors";

export default function HeroSection() {
    return (
        <section className="relative overflow-clip px-4 pt-14 pb-10 sm:pt-16 sm:pb-12 md:pt-20 md:pb-14 lg:pt-24 lg:pb-18">
            <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
                <HeroHeadline />

                <div className="mt-8 flex w-full max-w-md justify-center">
                    <InstallTerminal />
                </div>

                <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                    <Link
                        className={`${ctaBaseClass} gap-1.5 rounded-none border-[color:var(--hero-primary-border)] bg-[color:var(--hero-primary-bg)] hover:bg-[color:var(--hero-primary-hover-bg)]`}
                        href="/docs"
                    >
                        <span className="text-[color:var(--hero-primary-fg)] font-semibold">
                            Get Started
                        </span>
                        <span className="text-[color:var(--hero-primary-fg)]">
                            <ArrowUpRightIcon className="h-3.5 w-3.5" />
                        </span>
                    </Link>
                    <Link
                        className={`${ctaBaseClass} rounded-none border border-[color:var(--foreground)]/20 bg-transparent text-[color:var(--foreground)] hover:border-[color:var(--foreground)]/30 hover:bg-[color:var(--foreground)]/5 hover:text-[color:var(--foreground)]`}
                        href="/cookbook"
                    >
                        Open Cookbook
                    </Link>
                </div>
            </div>
        </section>
    );
}
