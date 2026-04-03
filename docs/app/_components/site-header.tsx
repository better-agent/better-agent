"use client";

import type { Folder, Item, Root } from "fumadocs-core/page-tree";
import { useSearchContext } from "fumadocs-ui/contexts/search";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { CloseIcon, GitHubIcon, MenuIcon } from "./icons";
import { ThemeToggle } from "./theme-toggle";

const navItems = [
    { href: "/", label: "Home" },
    { href: "/docs", label: "Docs" },
    { href: "/cookbook", label: "Cookbook" },
    { href: "/changelog", label: "Changelog" },
] as const;

const socialItems = [
    {
        href: "https://github.com/better-agent/better-agent",
        label: "GitHub",
        icon: GitHubIcon,
    },
] as const;

const LOGO_TEXT = "BETTER-AGENT.";
const SCRAMBLE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ.-";
type LogoChar = {
    value: string;
    scrambled: boolean;
    accented: boolean;
    accentClassName: string | null;
};

function getFinalLogoChars(): LogoChar[] {
    return LOGO_TEXT.split("").map((value) => ({
        value,
        scrambled: false,
        accented: false,
        accentClassName: null,
    }));
}

function useScrambleLogo() {
    const [displayChars, setDisplayChars] = useState<LogoChar[]>(() => getFinalLogoChars());
    const intervalRef = useRef<number | null>(null);
    const hasMounted = useSyncExternalStore(
        () => () => {},
        () => true,
        () => false,
    );

    useEffect(() => {
        return () => {
            if (intervalRef.current !== null) {
                window.clearInterval(intervalRef.current);
            }
        };
    }, []);

    const runScramble = useCallback(
        (durationMs: number) => {
            if (!hasMounted) return;

            if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
                setDisplayChars(getFinalLogoChars());
                return;
            }

            if (intervalRef.current !== null) {
                window.clearInterval(intervalRef.current);
            }

            const startedAt = window.performance.now();

            intervalRef.current = window.setInterval(() => {
                const elapsed = window.performance.now() - startedAt;
                const progress = Math.min(elapsed / durationMs, 1);
                const revealCount = Math.floor(progress * LOGO_TEXT.length);

                const nextChars = LOGO_TEXT.split("").map((char, index) => {
                    if (char === " ") {
                        return {
                            value: char,
                            scrambled: false,
                            accented: false,
                            accentClassName: null,
                        };
                    }

                    if (index < revealCount) {
                        return {
                            value: LOGO_TEXT[index] ?? char,
                            scrambled: false,
                            accented: false,
                            accentClassName: null,
                        };
                    }

                    const useAccent =
                        char === "." || char === "-" || index % 4 === 0 || Math.random() > 0.78;
                    const accentClassName = [
                        "text-[color:var(--header-scramble-1)]",
                        "text-[color:var(--header-scramble-2)]",
                        "text-[color:var(--header-scramble-3)]",
                    ][index % 3];

                    return {
                        value:
                            SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)] ??
                            char,
                        scrambled: true,
                        accented: useAccent,
                        accentClassName: useAccent ? accentClassName : null,
                    };
                });

                setDisplayChars(progress >= 1 ? getFinalLogoChars() : nextChars);

                if (progress >= 1 && intervalRef.current !== null) {
                    window.clearInterval(intervalRef.current);
                    intervalRef.current = null;
                }
            }, 32);
        },
        [hasMounted],
    );

    useEffect(() => {
        if (!hasMounted) return;
        const frame = window.requestAnimationFrame(() => {
            runScramble(1180);
        });

        return () => {
            window.cancelAnimationFrame(frame);
        };
    }, [hasMounted, runScramble]);

    return {
        displayChars,
        triggerScramble: () => runScramble(760),
    };
}

function getFolders(tree: Root): Folder[] {
    return tree.children.filter((n): n is Folder => n.type === "folder");
}

function getPages(folder: Folder): Item[] {
    const pages: Item[] = [];
    if (folder.index) pages.push(folder.index);
    for (const child of folder.children) {
        if (child.type === "page") pages.push(child);
    }
    return pages;
}

const mobileNavItemClass =
    "group flex min-h-11 items-center px-5 text-[11.5px] font-semibold tracking-[0.02em] transition-colors hover:bg-[color:color-mix(in_srgb,var(--foreground)_4%,transparent)]";

const mobileNavLabelClass = "uppercase transition-colors";
const mobileNavLabelActive = "text-[color:var(--foreground)]";
const mobileNavLabelInactive = "text-[color:var(--header-link)]";

function formatFolderLabel(name: string) {
    if (name !== "providers" && name !== "Providers") return name;

    return (
        <>
            <span>Providers</span>
            <span className="docs-soon-badge">(more soon!)</span>
        </>
    );
}

type SiteHeaderProps = {
    pageTree?: Root;
};

export default function SiteHeader({ pageTree }: SiteHeaderProps) {
    const pathname = usePathname();
    const previousPathnameRef = useRef(pathname);
    const [menuOpen, setMenuOpen] = useState(false);
    const { displayChars: logoChars, triggerScramble } = useScrambleLogo();
    const { setOpenSearch, enabled: searchEnabled } = useSearchContext();
    const [navDepth, setNavDepth] = useState(0);
    const [activeFolder, setActiveFolder] = useState<Folder | null>(null);

    const isLanding = pathname === "/";
    useEffect(() => {
        if (!menuOpen) {
            const t = setTimeout(() => {
                setNavDepth(0);
                setActiveFolder(null);
            }, 300);
            return () => clearTimeout(t);
        }
    }, [menuOpen]);

    useEffect(() => {
        if (previousPathnameRef.current === pathname) return;
        previousPathnameRef.current = pathname;

        const t = window.setTimeout(() => {
            setMenuOpen(false);
        }, 0);

        return () => {
            window.clearTimeout(t);
        };
    }, [pathname]);

    const folders = pageTree ? getFolders(pageTree) : [];

    return (
        <header className="sticky top-0 z-40">
            <div
                className={`transition-[background-color,border-color] duration-300 ${
                    isLanding
                        ? "border-b border-transparent bg-transparent"
                        : "border-b border-[var(--line)] bg-[color:color-mix(in_srgb,var(--background)_88%,transparent)] backdrop-blur"
                }`}
            >
                <div className="mx-auto flex h-(--header-height) w-full max-w-none items-center justify-between px-4 lg:px-3 xl:px-2">
                    <Link
                        aria-label="Better Agent"
                        className="group inline-flex items-center transition-opacity hover:opacity-80 xl:w-[var(--fd-sidebar-width,18.75rem)] xl:-ml-8 xl:pl-[calc(0.88rem+2px+1rem+0.46rem)]"
                        href="/"
                        onFocus={triggerScramble}
                        onMouseEnter={triggerScramble}
                    >
                        <span className="inline-flex items-center gap-2">
                            <span
                                aria-hidden="true"
                                className="font-sans text-[12.5px] font-semibold uppercase tracking-[0.03em] text-[color:var(--foreground)]"
                            >
                                {logoChars.map((char, index) => (
                                    <span
                                        className={
                                            char.scrambled && char.accented
                                                ? (char.accentClassName ??
                                                  "text-[color:var(--header-scramble-1)]")
                                                : "text-[color:var(--foreground)]"
                                        }
                                        key={`${index}-${char.value}`}
                                    >
                                        {char.value}
                                    </span>
                                ))}
                            </span>
                            <span className="docs-version-badge">BETA</span>
                        </span>
                    </Link>
                    <div className="hidden items-center gap-1 md:flex">
                        <nav aria-label="Primary" className="flex items-center gap-0.5">
                            {navItems.map((item) => {
                                const isActive =
                                    item.href === "/"
                                        ? pathname === "/"
                                        : pathname === item.href ||
                                          pathname.startsWith(`${item.href}/`);

                                return (
                                    <Link
                                        aria-current={isActive ? "page" : undefined}
                                        className={`group relative inline-flex h-[1.65rem] items-center justify-center px-[0.5rem] text-[10px] font-bold tracking-[0.015em] transition-colors hover:text-[color:var(--foreground)] ${
                                            isActive
                                                ? "after:absolute after:bottom-[0.28rem] after:left-1/2 after:h-px after:w-[0.92rem] after:-translate-x-1/2 after:bg-[color:var(--header-active-underline)] after:content-['']"
                                                : ""
                                        }`}
                                        href={item.href}
                                        key={item.label}
                                    >
                                        <span
                                            className={`uppercase transition-colors ${
                                                isActive
                                                    ? "text-[color:var(--foreground)]"
                                                    : "text-[color:var(--header-link)]"
                                            }`}
                                        >
                                            {item.label}
                                        </span>
                                    </Link>
                                );
                            })}
                        </nav>

                        <span className="mx-1.5 h-3.5 w-px bg-[color:color-mix(in_srgb,var(--foreground)_10%,transparent)]" />

                        <div className="flex items-center gap-0.5">
                            {searchEnabled ? (
                                <button
                                    aria-label="Open Search"
                                    className="group inline-flex h-[1.75rem] cursor-pointer items-center gap-1.5 rounded-md px-[0.5rem] text-[color:var(--header-link)] transition-colors hover:bg-[color:color-mix(in_srgb,var(--foreground)_6%,transparent)] hover:text-[color:var(--foreground)]"
                                    onClick={() => setOpenSearch(true)}
                                    type="button"
                                >
                                    <Search className="size-[0.82rem] shrink-0" strokeWidth={2} />
                                    <span className="inline-flex items-center gap-[0.1rem] text-[11px] font-medium opacity-60">
                                        <kbd className="bg-transparent p-0 font-inherit text-inherit">
                                            ⌘
                                        </kbd>
                                        <kbd className="bg-transparent p-0 text-[9px] font-inherit text-inherit">
                                            K
                                        </kbd>
                                    </span>
                                </button>
                            ) : null}

                            {socialItems.map((item) => {
                                const Icon = item.icon;
                                return (
                                    <Link
                                        aria-label={item.label}
                                        className="group inline-flex h-[1.75rem] w-[1.75rem] items-center justify-center rounded-md transition-colors hover:bg-[color:color-mix(in_srgb,var(--foreground)_6%,transparent)]"
                                        href={item.href}
                                        key={item.label}
                                    >
                                        <Icon className="size-[0.88rem] text-[color:var(--header-link)] transition-colors group-hover:text-[color:var(--foreground)]" />
                                    </Link>
                                );
                            })}

                            <div className="ml-0.5 inline-flex items-center">
                                <ThemeToggle />
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-1 md:hidden">
                        <div className="inline-flex items-center">
                            <ThemeToggle />
                        </div>
                        <button
                            aria-expanded={menuOpen}
                            aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
                            className="group inline-flex h-[1.75rem] w-[1.75rem] cursor-pointer items-center justify-center rounded-md transition-colors hover:bg-[color:color-mix(in_srgb,var(--foreground)_6%,transparent)]"
                            onClick={() => setMenuOpen((open) => !open)}
                            type="button"
                        >
                            <span className="text-[color:var(--header-link)] transition-colors group-hover:text-[color:var(--foreground)]">
                                {menuOpen ? (
                                    <CloseIcon className="size-[0.9rem]" />
                                ) : (
                                    <MenuIcon className="size-[0.9rem]" />
                                )}
                            </span>
                        </button>
                    </div>
                </div>
                <div
                    className={`overflow-hidden transition-[max-height,opacity] duration-300 md:hidden ${
                        menuOpen ? "max-h-[80svh] opacity-100" : "max-h-0 opacity-0"
                    }`}
                >
                    <div className="overflow-hidden border-t border-[color:color-mix(in_srgb,var(--foreground)_8%,transparent)] bg-[color:color-mix(in_srgb,var(--background)_92%,transparent)] backdrop-blur">
                        <div
                            className="flex transition-transform duration-250 ease-in-out"
                            style={{ transform: `translateX(-${navDepth * 100}%)` }}
                        >
                            <nav
                                aria-label="Mobile Primary"
                                className="flex w-full shrink-0 flex-col"
                            >
                                {navItems.map((item) => {
                                    const isActive =
                                        item.href === "/"
                                            ? pathname === "/"
                                            : pathname === item.href ||
                                              pathname.startsWith(`${item.href}/`);
                                    if (item.label === "Docs" && pageTree) {
                                        return (
                                            <button
                                                className={`${mobileNavItemClass} justify-between ${
                                                    isActive
                                                        ? "underline underline-offset-[0.32rem] decoration-1 decoration-[color:var(--header-active-underline)]"
                                                        : ""
                                                }`}
                                                key={item.label}
                                                onClick={() => setNavDepth(1)}
                                                type="button"
                                            >
                                                <span
                                                    className={`${mobileNavLabelClass} ${isActive ? mobileNavLabelActive : mobileNavLabelInactive}`}
                                                >
                                                    {item.label}
                                                </span>
                                                <ChevronRight className="size-3.5 text-[color:var(--header-link)]" />
                                            </button>
                                        );
                                    }

                                    return (
                                        <Link
                                            aria-current={isActive ? "page" : undefined}
                                            className={`${mobileNavItemClass} ${
                                                isActive
                                                    ? "underline underline-offset-[0.32rem] decoration-1 decoration-[color:var(--header-active-underline)]"
                                                    : ""
                                            }`}
                                            href={item.href}
                                            key={item.label}
                                            onClick={() => setMenuOpen(false)}
                                        >
                                            <span
                                                className={`${mobileNavLabelClass} ${isActive ? mobileNavLabelActive : mobileNavLabelInactive}`}
                                            >
                                                {item.label}
                                            </span>
                                        </Link>
                                    );
                                })}

                                {searchEnabled ? (
                                    <button
                                        className="group flex min-h-11 cursor-pointer items-center justify-between px-5 text-[13.5px] font-medium transition-colors hover:bg-[color:color-mix(in_srgb,var(--foreground)_4%,transparent)]"
                                        onClick={() => {
                                            setMenuOpen(false);
                                            setOpenSearch(true);
                                        }}
                                        type="button"
                                    >
                                        <span className="text-[color:var(--header-link)] transition-colors group-hover:text-[color:var(--foreground)]">
                                            Search
                                        </span>
                                        <Search className="size-4 text-[color:var(--header-link)] transition-colors group-hover:text-[color:var(--foreground)]" />
                                    </button>
                                ) : null}

                                <div className="flex items-center gap-2 px-5 py-2.5">
                                    {socialItems.map((item) => {
                                        const Icon = item.icon;
                                        return (
                                            <Link
                                                aria-label={item.label}
                                                className="group inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-[color:color-mix(in_srgb,var(--foreground)_6%,transparent)]"
                                                href={item.href}
                                                key={item.label}
                                                onClick={() => setMenuOpen(false)}
                                            >
                                                <Icon className="size-4 text-[color:var(--header-link)] transition-colors group-hover:text-[color:var(--foreground)]" />
                                            </Link>
                                        );
                                    })}
                                </div>
                            </nav>
                            <nav
                                aria-label="Documentation categories"
                                className="flex w-full shrink-0 flex-col"
                            >
                                <button
                                    className="group flex min-h-11 cursor-pointer items-center gap-1.5 border-b border-[color:color-mix(in_srgb,var(--foreground)_6%,transparent)] px-5 text-[11px] font-semibold tracking-[0.02em] text-[color:var(--header-link)] transition-colors hover:bg-[color:color-mix(in_srgb,var(--foreground)_4%,transparent)] hover:text-[color:var(--foreground)]"
                                    onClick={() => setNavDepth(0)}
                                    type="button"
                                >
                                    <ChevronLeft className="size-3.5" />
                                    <span className="uppercase">Back</span>
                                </button>
                                <div className="max-h-[60svh] overflow-y-auto">
                                    {folders.map((folder) => {
                                        const folderPages = getPages(folder);
                                        const isInFolder = folderPages.some(
                                            (p) => p.url === pathname,
                                        );
                                        if (
                                            folder.index &&
                                            folder.children.filter((c) => c.type === "page")
                                                .length === 0
                                        ) {
                                            return (
                                                <Link
                                                    className={`${mobileNavItemClass} gap-3`}
                                                    href={folder.index.url}
                                                    key={folder.index.url}
                                                    onClick={() => setMenuOpen(false)}
                                                >
                                                    {folder.icon && (
                                                        <span className="flex size-4 shrink-0 items-center justify-center text-[color:color-mix(in_srgb,var(--foreground)_45%,transparent)]">
                                                            {folder.icon}
                                                        </span>
                                                    )}
                                                    <span
                                                        className={`text-[12px] font-medium tracking-normal ${isInFolder ? "text-[color:var(--foreground)]" : "text-[color:var(--header-link)]"}`}
                                                    >
                                                        {formatFolderLabel(folder.name as string)}
                                                    </span>
                                                </Link>
                                            );
                                        }

                                        return (
                                            <button
                                                className={`${mobileNavItemClass} justify-between gap-3`}
                                                key={String(folder.name)}
                                                onClick={() => {
                                                    setActiveFolder(folder);
                                                    setNavDepth(2);
                                                }}
                                                type="button"
                                            >
                                                <span className="flex items-center gap-3">
                                                    {folder.icon && (
                                                        <span className="flex size-4 shrink-0 items-center justify-center text-[color:color-mix(in_srgb,var(--foreground)_45%,transparent)]">
                                                            {folder.icon}
                                                        </span>
                                                    )}
                                                    <span
                                                        className={`text-[12px] font-medium tracking-normal ${isInFolder ? "text-[color:var(--foreground)]" : "text-[color:var(--header-link)]"}`}
                                                    >
                                                        {formatFolderLabel(folder.name as string)}
                                                    </span>
                                                </span>
                                                <ChevronRight className="size-3.5 shrink-0 text-[color:var(--header-link)]" />
                                            </button>
                                        );
                                    })}
                                </div>
                            </nav>
                            <nav
                                aria-label={
                                    activeFolder
                                        ? `${formatFolderLabel(activeFolder.name as string)} pages`
                                        : "Pages"
                                }
                                className="flex w-full shrink-0 flex-col"
                            >
                                <button
                                    className="group flex min-h-11 cursor-pointer items-center gap-1.5 border-b border-[color:color-mix(in_srgb,var(--foreground)_6%,transparent)] px-5 text-[11px] font-semibold tracking-[0.02em] text-[color:var(--header-link)] transition-colors hover:bg-[color:color-mix(in_srgb,var(--foreground)_4%,transparent)] hover:text-[color:var(--foreground)]"
                                    onClick={() => setNavDepth(1)}
                                    type="button"
                                >
                                    <ChevronLeft className="size-3.5" />
                                    <span className="uppercase">
                                        {activeFolder
                                            ? formatFolderLabel(activeFolder.name as string)
                                            : "Back"}
                                    </span>
                                </button>
                                <div className="max-h-[60svh] overflow-y-auto">
                                    {activeFolder &&
                                        getPages(activeFolder).map((page) => {
                                            const isActive = pathname === page.url;
                                            return (
                                                <Link
                                                    className={`${mobileNavItemClass} gap-3 ${
                                                        isActive
                                                            ? "bg-[color:color-mix(in_srgb,var(--foreground)_4%,transparent)]"
                                                            : ""
                                                    }`}
                                                    href={page.url}
                                                    key={page.url}
                                                    onClick={() => setMenuOpen(false)}
                                                >
                                                    {page.icon && (
                                                        <span className="flex size-4 shrink-0 items-center justify-center text-[color:color-mix(in_srgb,var(--foreground)_45%,transparent)]">
                                                            {page.icon}
                                                        </span>
                                                    )}
                                                    <span
                                                        className={`text-[12px] font-medium tracking-normal ${
                                                            isActive
                                                                ? "text-[color:var(--foreground)]"
                                                                : "text-[color:var(--header-link)]"
                                                        }`}
                                                    >
                                                        {page.name as string}
                                                    </span>
                                                </Link>
                                            );
                                        })}
                                </div>
                            </nav>
                        </div>
                    </div>
                </div>
            </div>
        </header>
    );
}
