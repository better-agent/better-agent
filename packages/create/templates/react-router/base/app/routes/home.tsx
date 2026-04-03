export default function HomePage() {
    return (
        <main className="min-h-screen bg-[color:var(--background)] px-4 py-4 text-[color:var(--foreground)] sm:px-6 sm:py-6">
            <title>Better Agent Starter</title>
            <section className="mx-auto grid w-full max-w-3xl gap-4 border border-[color:var(--border)] bg-[color:var(--panel)] px-4 py-5 shadow-[0_24px_80px_rgba(0,0,0,0.34)] sm:px-5 sm:py-6">
                <p className="m-0 font-mono text-[11px] uppercase tracking-[0.24em] text-[color:var(--accent-strong)]">
                    Better Agent
                </p>
                <div className="grid gap-2">
                    <h1 className="m-0 text-[1.9rem] font-medium tracking-[-0.06em] sm:text-[2.25rem]">
                        Operator Console
                    </h1>
                    <p className="m-0 max-w-xl text-[14px] leading-6 text-[color:var(--muted)]">
                        Better Agent is wired in. Add your own UI or rerun create with the starter
                        UI enabled.
                    </p>
                </div>
            </section>
        </main>
    );
}
