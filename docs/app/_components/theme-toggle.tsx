"use client";

import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import { MoonIcon, SunIcon } from "./icons";

type ThemeToggleProps = {
    className?: string;
};

function cn(...values: Array<string | false | null | undefined>) {
    return values.filter(Boolean).join(" ");
}

export function ThemeToggle({ className }: ThemeToggleProps) {
    const { resolvedTheme, setTheme } = useTheme();
    const mounted = useSyncExternalStore(
        () => () => {},
        () => true,
        () => false,
    );

    const isDark = mounted ? resolvedTheme === "dark" : true;

    return (
        <button
            aria-label="Toggle theme"
            aria-pressed={mounted ? isDark : undefined}
            className={cn(
                "group flex h-[1.68rem] w-[3.38rem] cursor-pointer items-center rounded-full border p-[0.17rem] transition-[background-color,border-color,box-shadow] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--foreground)]",
                isDark
                    ? "border-zinc-800 bg-zinc-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                    : "border-stone-300 bg-stone-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.95)]",
                className,
            )}
            onClick={() => setTheme(isDark ? "light" : "dark")}
            type="button"
        >
            <span className="flex w-full items-center justify-between">
                <span
                    className={cn(
                        "flex h-[1.34rem] w-[1.34rem] items-center justify-center rounded-full shadow-sm transition-[transform,background-color,box-shadow] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
                        isDark
                            ? "translate-x-0 bg-zinc-800 shadow-[0_0_0_1px_rgba(255,255,255,0.04)]"
                            : "translate-x-[1.69rem] bg-amber-100 shadow-[0_0_0_1px_rgba(217,119,6,0.16),0_0_18px_rgba(251,191,36,0.35)]",
                    )}
                >
                    {isDark ? (
                        <MoonIcon className="size-[0.82rem] text-white transition-opacity duration-500 group-hover:opacity-100" />
                    ) : (
                        <SunIcon className="size-[0.82rem] text-amber-700 transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:rotate-12" />
                    )}
                </span>

                <span
                    className={cn(
                        "flex h-[1.34rem] w-[1.34rem] items-center justify-center rounded-full transition-[transform,opacity] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
                        isDark ? "opacity-100" : "-translate-x-[1.69rem] opacity-90",
                    )}
                >
                    {isDark ? (
                        <SunIcon className="size-[0.82rem] text-zinc-500/80" />
                    ) : (
                        <MoonIcon className="size-[0.82rem] text-stone-700" />
                    )}
                </span>
            </span>
        </button>
    );
}
