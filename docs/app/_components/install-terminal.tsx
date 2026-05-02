"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { siBun, siGithub, siNpm, siPnpm } from "simple-icons";

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

function BrandIcon({
    color,
    path,
    title,
    className = "h-4 w-4",
}: {
    color?: string;
    path: string;
    title: string;
    className?: string;
}) {
    return (
        <svg
            aria-hidden="true"
            className={className}
            fill={color ?? "currentColor"}
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
        >
            <title>{title}</title>
            <path d={path} />
        </svg>
    );
}

export default function InstallTerminal() {
    const [activePm, setActivePm] = useState<PackageManager>("bun");
    const command = useMemo(() => commandByPm[activePm], [activePm]);
    const commandParts = command.split(" ");

    return (
        <div className="mt-6 w-full max-w-full sm:max-w-[34.1rem]">
            <div className="inline-flex max-w-full items-center overflow-x-auto border border-[var(--terminal-shell-border)] bg-[var(--terminal-shell-bg)] p-0.5">
                {packageManagers.map((pm) => {
                    const isActive = pm === activePm;
                    const icon = iconByPm[pm];

                    return (
                        <button
                            className={`inline-flex min-w-[2.9rem] cursor-pointer items-center gap-[0.36rem] px-[0.46rem] py-[0.24rem] font-mono text-[9.4px] uppercase tracking-[0.045em] transition-colors sm:min-w-[3.36rem] sm:px-[0.6rem] sm:text-[10.5px] ${
                                isActive
                                    ? "bg-[var(--terminal-shell-elevated)] text-[color:color-mix(in_srgb,var(--foreground)_82%,transparent)]"
                                    : "text-[color:var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[color:color-mix(in_srgb,var(--foreground)_78%,transparent)]"
                            }`}
                            key={pm}
                            onClick={() => setActivePm(pm)}
                            type="button"
                        >
                            <BrandIcon
                                className="h-[0.76rem] w-[0.76rem] shrink-0"
                                path={icon.path}
                                title={icon.title}
                            />
                            {pm}
                        </button>
                    );
                })}
            </div>

            <div className="mt-[0.7rem] w-full border border-[var(--terminal-shell-border)] bg-[var(--terminal-shell-bg)]">
                <div className="flex items-center justify-between gap-[0.4rem] px-[0.7rem] py-[0.46rem]">
                    <div className="min-w-0 flex-1 overflow-x-auto">
                        <code className="flex min-w-max items-center gap-[0.36rem] font-mono text-[8.4px] leading-none uppercase tracking-[0.028em] sm:text-[9.4px]">
                            <span className="shrink-0 whitespace-nowrap text-[color:color-mix(in_srgb,var(--foreground)_78%,transparent)]">
                                &gt;_
                            </span>
                            <span className="shrink-0 text-[var(--syntax-identifier)]">
                                {commandParts[0]}
                            </span>
                            <span className="shrink-0 text-[var(--syntax-comment)]">
                                {commandParts[1]}
                            </span>
                            <span className="shrink-0 text-[var(--syntax-identifier)]">
                                {commandParts.slice(2).join(" ")}
                            </span>
                            <span className="inline-block h-[1em] w-[5px] animate-pulse bg-[var(--line-number)]" />
                        </code>
                    </div>

                    <div className="flex shrink-0 items-center gap-[0.24rem]">
                        <Link
                            aria-label="npm"
                            className="inline-flex h-[1.18rem] w-[1.18rem] items-center justify-center rounded-[4px] text-[color:var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[color:color-mix(in_srgb,var(--foreground)_78%,transparent)]"
                            href="https://www.npmjs.com/package/create-better-agent"
                        >
                            <BrandIcon
                                className="h-[9.5px] w-[9.5px]"
                                path={siNpm.path}
                                title={siNpm.title}
                            />
                        </Link>
                        <Link
                            aria-label="GitHub"
                            className="inline-flex h-[1.18rem] w-[1.18rem] items-center justify-center rounded-[4px] text-[color:var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[color:color-mix(in_srgb,var(--foreground)_78%,transparent)]"
                            href="https://github.com/better-agent/better-agent"
                        >
                            <BrandIcon
                                className="h-[9.5px] w-[9.5px]"
                                path={siGithub.path}
                                title={siGithub.title}
                            />
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
