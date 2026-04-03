"use client";

import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "fumadocs-ui/components/ui/popover";
import { Check, ChevronDown, Copy, ExternalLink } from "lucide-react";
import type { MouseEventHandler } from "react";
import { useEffect, useRef, useState, useTransition } from "react";

type DocsPageActionsProps = {
    markdownUrl: string;
    githubUrl: string;
};

const markdownCache = new Map<string, string>();

const actionBaseClass =
    "inline-flex cursor-pointer items-center gap-2 rounded-none border px-2.5 py-1.5 text-[11px] font-medium tracking-[0.01em] transition-colors";

function useCopyFeedback(
    onCopy: () => void | Promise<void>,
): [checked: boolean, onClick: MouseEventHandler] {
    const [checked, setChecked] = useState(false);
    const timeoutRef = useRef<number | null>(null);

    const onClick: MouseEventHandler = () => {
        if (timeoutRef.current) window.clearTimeout(timeoutRef.current);

        void Promise.resolve(onCopy()).then(() => {
            setChecked(true);
            timeoutRef.current = window.setTimeout(() => {
                setChecked(false);
            }, 1500);
        });
    };

    useEffect(() => {
        return () => {
            if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
        };
    }, []);

    return [checked, onClick];
}

function buildAskPrompt(markdownUrl: string) {
    return `Read ${markdownUrl}. Help me understand it and apply it in a Better Agent project.`;
}

async function copyRemoteMarkdown(markdownUrl: string) {
    const cached = markdownCache.get(markdownUrl);

    if (cached) {
        await navigator.clipboard.writeText(cached);
        return;
    }

    const fetchPromise = fetch(markdownUrl).then(async (res) => {
        const text = await res.text();
        markdownCache.set(markdownUrl, text);
        return text;
    });

    if (typeof ClipboardItem !== "undefined") {
        const item = new ClipboardItem({
            "text/plain": fetchPromise.then((text) => new Blob([text], { type: "text/plain" })),
        });
        await navigator.clipboard.write([item]);
        return;
    }

    const text = await fetchPromise;
    await navigator.clipboard.writeText(text);
}

function CopyMarkdownButton({ markdownUrl }: { markdownUrl: string }) {
    const [isLoading, startTransition] = useTransition();
    const [checked, onClick] = useCopyFeedback(async () => {
        await new Promise<void>((resolve) => {
            startTransition(async () => {
                await copyRemoteMarkdown(markdownUrl);
                resolve();
            });
        });
    });

    return (
        <button
            type="button"
            disabled={isLoading}
            onClick={onClick}
            className={cn(
                actionBaseClass,
                "border-[color:var(--sidebar-border)] bg-[color:var(--panel-elevated)] text-[color:var(--foreground)] hover:bg-[color:var(--accent)] disabled:cursor-wait disabled:opacity-70",
                checked &&
                    "border-[color:color-mix(in_srgb,var(--foreground)_10%,transparent)] bg-[color:color-mix(in_srgb,var(--foreground)_4%,transparent)]",
            )}
        >
            {checked ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
            {checked ? "Copied" : "Copy Markdown"}
        </button>
    );
}

function AskWithPopover({
    markdownUrl,
    githubUrl,
}: {
    markdownUrl: string;
    githubUrl: string;
}) {
    const prompt = buildAskPrompt(markdownUrl);

    const chatGptUrl = new URL("https://chatgpt.com/");
    chatGptUrl.searchParams.set("hints", "search");
    chatGptUrl.searchParams.set("q", prompt);

    const claudeUrl = new URL("https://claude.ai/new");
    claudeUrl.searchParams.set("q", prompt);

    const cursorUrl = new URL("https://cursor.com/link/prompt");
    cursorUrl.searchParams.set("text", prompt);

    const items = [
        {
            title: "GitHub",
            description: "View source",
            href: githubUrl,
        },
        {
            title: "ChatGPT",
            description: "Ask with page context",
            href: chatGptUrl.toString(),
        },
        {
            title: "Claude",
            description: "Start a docs-aware thread",
            href: claudeUrl.toString(),
        },
        {
            title: "Cursor",
            description: "Send as a coding prompt",
            href: cursorUrl.toString(),
        },
    ];

    return (
        <Popover>
            <PopoverTrigger
                className={cn(
                    actionBaseClass,
                    "border-[color:var(--sidebar-border)] bg-transparent text-[color:var(--muted-foreground)] hover:bg-[color:var(--accent)] hover:text-[color:var(--foreground)]",
                )}
            >
                Use With
                <ChevronDown className="size-3.5" />
            </PopoverTrigger>
            <PopoverContent
                align="end"
                className="w-64 rounded-none border-[color:var(--sidebar-border)] bg-[color:var(--panel-elevated)] p-1.5 text-[color:var(--foreground)] shadow-none"
            >
                <div className="px-2.5 pb-1.5 pt-1 text-[10px] font-medium uppercase tracking-[0.08em] text-[color:var(--muted-foreground)]">
                    Open This Page In
                </div>
                <div className="flex flex-col gap-1">
                    {items.map((item) => (
                        <a
                            key={item.href}
                            href={item.href}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="group flex cursor-pointer items-center gap-3 rounded-none px-2.5 py-2 transition-colors hover:bg-[color:var(--accent)]"
                        >
                            <div className="min-w-0 flex-1">
                                <div className="text-[12px] font-medium text-[color:var(--foreground)]">
                                    {item.title}
                                </div>
                                <div className="text-[11px] text-[color:var(--muted-foreground)]">
                                    {item.description}
                                </div>
                            </div>
                            <ExternalLink className="size-3.5 shrink-0 text-[color:var(--muted-foreground)] transition-colors group-hover:text-[color:var(--foreground)]" />
                        </a>
                    ))}
                </div>
            </PopoverContent>
        </Popover>
    );
}

export function DocsPageActions({ markdownUrl, githubUrl }: DocsPageActionsProps) {
    return (
        <div className="not-prose flex shrink-0 items-center gap-2">
            <CopyMarkdownButton markdownUrl={markdownUrl} />
            <AskWithPopover markdownUrl={markdownUrl} githubUrl={githubUrl} />
        </div>
    );
}
