"use client";

import { Check, Copy } from "lucide-react";
import Image from "next/image";
import type { ReactElement } from "react";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { siBun, siNpm, siPnpm } from "simple-icons";
type PackageManager = "npm" | "pnpm" | "bun";

const packageManagers: PackageManager[] = ["npm", "pnpm", "bun"];

const commandByPm: Record<PackageManager, string> = {
    npm: "npm create better-agent",
    pnpm: "pnpm create better-agent",
    bun: "bun create better-agent",
};

const iconByPm = {
    npm: siNpm,
    pnpm: siPnpm,
    bun: siBun,
} satisfies Record<PackageManager, { path: string; title: string; hex: string }>;

function PmBrandIcon({
    path,
    title,
    className = "h-3 w-3",
}: {
    path: string;
    title: string;
    className?: string;
}) {
    return (
        <svg
            aria-hidden="true"
            className={className}
            fill="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
        >
            <title>{title}</title>
            <path d={path} />
        </svg>
    );
}
const TICK_MS = 95;
const LOOP_PAUSE_MS = 10000;

function TerminalAnimation({ command, visible }: { command: string; visible: boolean }) {
    const preRef = useRef<HTMLPreElement>(null);
    const shouldAutoScrollRef = useRef(true);
    const timeCommandEnter = command.length;
    const timeCommandRun = timeCommandEnter + 3;
    const timeModeLabel = timeCommandRun + 2;
    const timeModeOptions = timeModeLabel + 3;
    const timeModeSelected = timeModeOptions + 3;
    const timeFrameworkLabel = timeModeSelected + 4;
    const timeFrameworkOptions = timeFrameworkLabel + 3;
    const timeFrameworkSelected = timeFrameworkOptions + 3;
    const timeProvidersLabel = timeFrameworkSelected + 4;
    const timeProvidersOptions = timeProvidersLabel + 3;
    const timeProvidersSelected = timeProvidersOptions + 3;
    const timePluginsLabel = timeProvidersSelected + 4;
    const timePluginsOptions = timePluginsLabel + 3;
    const timePluginsSelected = timePluginsOptions + 3;
    const timeEnd = timePluginsSelected + 5;

    const [tick, setTick] = useState(0);

    useEffect(() => {
        if (!visible) return;
        const timer = setInterval(() => {
            setTick((prev) => (prev >= timeEnd ? prev : prev + 1));
        }, TICK_MS);
        return () => clearInterval(timer);
    }, [timeEnd, visible]);

    useEffect(() => {
        if (!visible) return;
        if (tick < timeEnd) return;

        const timer = window.setTimeout(() => {
            setTick(0);
            shouldAutoScrollRef.current = true;
            const pre = preRef.current;
            if (pre) pre.scrollTop = 0;
        }, LOOP_PAUSE_MS);

        return () => window.clearTimeout(timer);
    }, [tick, timeEnd, visible]);

    useEffect(() => {
        const pre = preRef.current;
        if (!pre) return;
        if (shouldAutoScrollRef.current) {
            pre.scrollTop = pre.scrollHeight;
        }
    });

    const lines: ReactElement[] = [];

    lines.push(
        <span
            key="cmd"
            className="font-medium tracking-[-0.015em] text-[color:color-mix(in_srgb,var(--foreground)_70%,transparent)]"
        >
            {command.substring(0, tick)}
            {tick < timeCommandEnter && (
                <span className="inline-block h-3.5 w-[3px] animate-pulse bg-current" />
            )}
        </span>,
    );

    if (tick >= timeCommandEnter) {
        lines.push(<span key="space"> </span>);
    }

    if (tick > timeCommandRun) {
        lines.push(
            <Fragment key="response">
                {tick > timeModeLabel && (
                    <span className="font-medium text-[color:var(--foreground)]">◇ Mode</span>
                )}
                {tick > timeModeOptions && (
                    <>
                        <span className={tick > timeModeSelected ? "" : "opacity-50"}>
                            │ ● Create new app
                        </span>
                        <span className="opacity-50">│ ○ Patch existing app</span>
                    </>
                )}
                {tick > timeFrameworkLabel && (
                    <>
                        <span>│</span>
                        <span className="font-medium text-[color:var(--foreground)]">
                            ◆ Framework
                        </span>
                    </>
                )}
                {tick > timeFrameworkOptions && (
                    <>
                        <span className={tick > timeFrameworkSelected ? "" : "opacity-50"}>
                            │ ● Next.js
                        </span>
                        <span className="opacity-50">│ ○ Remix</span>
                        <span className="opacity-50">│ ○ SvelteKit</span>
                        <span className="opacity-50">│ ○ Astro</span>
                        <span className="opacity-50">│ ○ Nuxt</span>
                        <span className="opacity-50">│ ○ TanStack Start</span>
                        <span className="opacity-50">│ ○ SolidStart</span>
                        <span className="opacity-50">│ ○ React Router</span>
                        <span className="opacity-50">│ ○ Generic</span>
                    </>
                )}
                {tick > timeProvidersLabel && (
                    <>
                        <span>│</span>
                        <span className="font-medium text-[color:var(--foreground)]">
                            ◆ Providers
                        </span>
                    </>
                )}
                {tick > timeProvidersOptions && (
                    <>
                        <span className={tick > timeProvidersSelected ? "" : "opacity-50"}>
                            │ ◼ OpenAI
                        </span>
                        <span className={tick > timeProvidersSelected ? "" : "opacity-50"}>
                            │ ◼ Anthropic
                        </span>
                        <span className="opacity-50">│ ◻ xAI</span>
                    </>
                )}
                {tick > timePluginsLabel && (
                    <>
                        <span>│</span>
                        <span className="font-medium text-[color:var(--foreground)]">
                            ◆ Plugins
                        </span>
                    </>
                )}
                {tick > timePluginsOptions && (
                    <>
                        <span className={tick > timePluginsSelected ? "" : "opacity-50"}>
                            │ ◼ Rate Limit
                        </span>
                        <span className="opacity-50">│ ◻ Auth</span>
                        <span className="opacity-50">│ ◻ Sandbox</span>
                        <span className="opacity-50">│ ◻ IP Allowlist</span>
                        <span className="opacity-50">│ ◻ Logging</span>
                    </>
                )}
            </Fragment>,
        );
    }

    return (
        <div
            className="min-h-[240px] p-3 text-[color:color-mix(in_srgb,var(--foreground)_65%,transparent)]"
            onMouseEnter={() => {
                if (tick >= timeEnd) {
                    setTick(0);
                    shouldAutoScrollRef.current = true;
                    const pre = preRef.current;
                    if (pre) pre.scrollTop = 0;
                }
            }}
        >
            {tick >= timeEnd && (
                <div className="absolute right-6 bottom-4 z-10 animate-in fade-in slide-in-from-top-6 overflow-hidden rounded-lg border border-[color:var(--showcase-shell-border)] bg-[var(--panel-elevated)] shadow-lg sm:right-8 sm:bottom-5">
                    <p className="border-b border-[color:var(--showcase-shell-border)] px-3 py-1.5 text-[10.5px] text-[color:color-mix(in_srgb,var(--foreground)_45%,transparent)]">
                        localhost:3000
                    </p>
                    <p className="px-3 py-1.5 text-[12px] font-medium text-[color:var(--foreground)]">
                        Agent server running
                    </p>
                </div>
            )}
            <pre
                className="h-[240px] overflow-y-auto font-mono text-[12px] leading-[1.8] sm:text-[13px]"
                onScroll={(event) => {
                    const pre = event.currentTarget;
                    const distanceFromBottom = pre.scrollHeight - pre.scrollTop - pre.clientHeight;
                    shouldAutoScrollRef.current = distanceFromBottom < 24;
                }}
                ref={preRef}
            >
                <code className="grid">{lines}</code>
            </pre>
        </div>
    );
}
export default function CtaSection() {
    const sectionRef = useRef<HTMLElement>(null);
    const [activePm, setActivePm] = useState<PackageManager>("npm");
    const [copied, setCopied] = useState(false);
    const [visible, setVisible] = useState(false);

    const command = useMemo(() => commandByPm[activePm], [activePm]);

    useEffect(() => {
        const el = sectionRef.current;
        if (!el) return;

        const observer = new IntersectionObserver(
            ([entry]) => {
                setVisible(entry.isIntersecting);
            },
            { threshold: 0.15 },
        );

        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    const handleCopy = useCallback(async () => {
        try {
            await navigator.clipboard.writeText(command);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            const ta = document.createElement("textarea");
            ta.value = command;
            ta.style.position = "fixed";
            ta.style.opacity = "0";
            document.body.appendChild(ta);
            ta.select();
            document.execCommand("copy");
            document.body.removeChild(ta);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    }, [command]);

    return (
        <section
            className="relative mx-auto w-full max-w-[76rem] px-5 pt-8 pb-8 sm:px-8 sm:pt-12 sm:pb-12"
            ref={sectionRef}
        >
            <div className="relative overflow-hidden rounded-2xl p-4 md:p-8">
                <Image
                    alt=""
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 size-full object-cover object-top -z-1"
                    loading="eager"
                    src="/cta-bg.png"
                    fill
                    style={{
                        filter: "hue-rotate(154deg) saturate(0.88) brightness(0.66) contrast(1.08)",
                    }}
                />
                <div className="relative z-10 mx-auto w-full max-w-[700px] overflow-hidden rounded-xl border border-[color:rgba(255,255,255,0.1)] bg-[color:var(--background)] shadow-2xl">
                    <div className="flex items-center gap-2.5 border-b border-[color:var(--showcase-shell-border)] p-2.5 sm:gap-3 sm:p-3">
                        <span className="shrink-0 rounded-md border-2 border-[color:color-mix(in_srgb,var(--code-token-fn)_50%,transparent)] px-2 py-0.5 font-mono text-[11px] font-bold tracking-[0.03em] text-[color:var(--code-token-fn)] uppercase">
                            Try it out
                        </span>
                        <div
                            className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden rounded-lg border border-[color:var(--showcase-shell-border)] px-3 py-2"
                            style={{ background: "var(--showcase-code-bg)" }}
                        >
                            <code className="min-w-0 flex-1 truncate font-mono text-[12px] font-medium tracking-[-0.015em] text-[color:color-mix(in_srgb,var(--foreground)_70%,transparent)] sm:text-[13px]">
                                {command}
                            </code>
                            <button
                                aria-label={copied ? "Copied" : "Copy command"}
                                className="inline-flex shrink-0 cursor-pointer items-center justify-center rounded-md p-1 text-[color:color-mix(in_srgb,var(--foreground)_40%,transparent)] transition-colors hover:bg-[var(--accent)] hover:text-[color:var(--foreground)]"
                                onClick={handleCopy}
                                type="button"
                            >
                                {copied ? (
                                    <Check className="size-3.5 text-green-500" />
                                ) : (
                                    <Copy className="size-3.5" />
                                )}
                            </button>
                        </div>
                    </div>
                    <div className="relative" style={{ background: "var(--showcase-code-bg)" }}>
                        <div className="flex items-center gap-2 border-b border-[color:var(--showcase-shell-border)] px-3 py-2">
                            <svg
                                aria-hidden="true"
                                className="size-3.5 shrink-0 text-[color:color-mix(in_srgb,var(--foreground)_40%,transparent)]"
                                fill="none"
                                stroke="currentColor"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                viewBox="0 0 24 24"
                            >
                                <path d="M12 19h8" />
                                <path d="m4 17 6-6-6-6" />
                            </svg>
                            <span className="shrink-0 font-mono text-[11px] font-medium text-[color:color-mix(in_srgb,var(--foreground)_40%,transparent)]">
                                Terminal
                            </span>
                            <div className="ml-auto inline-flex items-center overflow-hidden rounded-md border border-[color:var(--showcase-shell-border)]">
                                {packageManagers.map((pm) => {
                                    const isActive = pm === activePm;
                                    const icon = iconByPm[pm];
                                    return (
                                        <button
                                            className={`inline-flex cursor-pointer items-center gap-1 px-2 py-1 font-mono text-[9.5px] uppercase tracking-[0.04em] transition-colors ${
                                                isActive
                                                    ? "bg-[color:color-mix(in_srgb,var(--foreground)_10%,transparent)] text-[color:var(--foreground)]"
                                                    : "text-[color:color-mix(in_srgb,var(--foreground)_36%,transparent)] hover:text-[color:var(--foreground)]"
                                            }`}
                                            key={pm}
                                            onClick={() => setActivePm(pm)}
                                            type="button"
                                        >
                                            <PmBrandIcon
                                                className="h-2.5 w-2.5 shrink-0"
                                                path={icon.path}
                                                title={icon.title}
                                            />
                                            {pm}
                                        </button>
                                    );
                                })}
                            </div>

                            <div className="size-2 shrink-0 rounded-full bg-red-400/60" />
                        </div>
                        <TerminalAnimation key={command} command={command} visible={visible} />
                    </div>
                </div>
            </div>
        </section>
    );
}
