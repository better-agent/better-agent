import Link from "next/link";
import SiteFooter from "./_components/site-footer";

export default function NotFound() {
    return (
        <div className="flex flex-1 flex-col">
            <main className="flex flex-1 flex-col items-center justify-center px-6 py-24 text-center">
                <p className="font-mono text-[clamp(5rem,15vw,10rem)] font-semibold leading-none tracking-tighter text-[color:var(--foreground)] opacity-10">
                    404
                </p>
                <h1 className="mt-4 text-[1.15rem] font-semibold tracking-tight text-[color:var(--foreground)]">
                    Page not found
                </h1>
                <p className="mt-2 max-w-sm text-[0.84rem] leading-relaxed text-[color:var(--muted-foreground)]">
                    The page you&apos;re looking for doesn&apos;t exist or has been moved.
                </p>
                <Link
                    className="mt-8 inline-flex h-9 items-center justify-center border border-[color:var(--border)] px-5 text-[0.78rem] font-semibold uppercase tracking-[0.04em] text-[color:var(--foreground)] transition-colors hover:bg-[color:var(--accent)]"
                    href="/"
                >
                    Back to home
                </Link>
            </main>

            <SiteFooter />
        </div>
    );
}
