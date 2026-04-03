import type { MetaFunction } from "@remix-run/node";

export const meta: MetaFunction = () => [{ title: "Better Agent Starter" }];

export default function IndexRoute() {
    return (
        <main className="min-h-screen bg-[color:var(--background)] px-4 py-4 text-[color:var(--foreground)] sm:px-6 sm:py-6">
            <section className="mx-auto grid w-full max-w-2xl overflow-hidden border border-[color:var(--border)] bg-[color:var(--panel)] shadow-[0_24px_80px_rgba(0,0,0,0.34)]">
                <header className="grid gap-2 border-b border-[color:var(--border)] px-4 py-4 sm:px-5 sm:py-5">
                    <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-[color:var(--accent-strong)]">
                        Better Agent
                    </p>
                    <div className="space-y-2">
                        <h1 className="text-[1.9rem] font-medium tracking-[-0.06em] text-[color:var(--foreground)] sm:text-[2.25rem]">
                            Operator Console
                        </h1>
                        <p className="max-w-xl text-[13px] leading-5 text-[color:var(--muted)] sm:text-sm">
                            Better Agent is wired in. Add your own UI or rerun create with the
                            starter UI enabled.
                        </p>
                    </div>
                </header>
                <div className="grid gap-4 px-4 py-4 sm:px-5 sm:py-5">
                    <div className="grid gap-2 border border-dashed border-[color:var(--border-strong)] bg-[color:var(--panel-elevated)] px-4 py-4 text-[13px] leading-6 text-[color:var(--muted)]">
                        <p className="m-0 font-mono text-[11px] uppercase tracking-[0.16em] text-[color:var(--accent-strong)]">
                            next step
                        </p>
                        <p className="m-0">
                            Import the generated Better Agent client into your UI, or rerun create
                            with the starter UI enabled.
                        </p>
                    </div>
                </div>
            </section>
        </main>
    );
}
