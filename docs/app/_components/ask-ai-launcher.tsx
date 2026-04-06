"use client";

import { client } from "@/lib/better-agent/client";
import type app from "@/lib/better-agent/server";
import { cn } from "@/lib/utils";
import type { NormalizeClientApp } from "@better-agent/client";
import { type UseAgentResult, useAgent } from "@better-agent/client/react";
import { ArrowUp, FileText, Loader2, MessageSquareText, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Markdown } from "./markdown";
import { Drawer, DrawerClose, DrawerContent, DrawerHeader, DrawerTitle } from "./ui/drawer";

type AskDocsAgent = UseAgentResult<NormalizeClientApp<typeof app>, "askDocs">;

const DEFAULT_PANEL_WIDTH = 500;
const MIN_PANEL_WIDTH = 320;
const MAX_PANEL_WIDTH = 800;
const LG_BREAKPOINT = 1024;

function getMessageText(message: { parts: Array<{ type: string; text?: string }> }) {
    return message.parts
        .map((p) => (p.type === "text" && typeof p.text === "string" ? p.text : ""))
        .join("");
}

export function AskAILauncher() {
    const pathname = usePathname();
    const [isOpen, setIsOpen] = useState(false);
    const [isDesktop, setIsDesktop] = useState<boolean | undefined>(undefined);
    const [panelWidth, setPanelWidth] = useState(DEFAULT_PANEL_WIDTH);
    const [dragging, setDragging] = useState(false);
    const startX = useRef(0);
    const startWidth = useRef(panelWidth);

    const agent = useAgent(client, {
        agent: "askDocs",
        context: {},
    });

    useEffect(() => {
        const mql = window.matchMedia(`(min-width: ${LG_BREAKPOINT}px)`);
        const onChange = () =>
            setIsDesktop(window.matchMedia(`(min-width: ${LG_BREAKPOINT}px)`).matches);
        mql.addEventListener("change", onChange);
        onChange();
        return () => mql.removeEventListener("change", onChange);
    }, []);

    useEffect(() => {
        if (!dragging) return;
        const onMouseMove = (e: MouseEvent) => {
            const delta = startX.current - e.clientX;
            setPanelWidth(
                Math.min(MAX_PANEL_WIDTH, Math.max(MIN_PANEL_WIDTH, startWidth.current + delta)),
            );
        };
        const onMouseUp = () => setDragging(false);
        window.addEventListener("mousemove", onMouseMove);
        window.addEventListener("mouseup", onMouseUp);
        return () => {
            window.removeEventListener("mousemove", onMouseMove);
            window.removeEventListener("mouseup", onMouseUp);
        };
    }, [dragging]);

    if (pathname.startsWith("/changelog")) return null;
    if (isDesktop === undefined) return null;

    const panelContents = (
        <>
            <ChatMessages agent={agent} className="flex-1" />
            <ChatInput agent={agent} />
        </>
    );

    return (
        <>
            {/* Desktop side panel */}
            {isDesktop && isOpen && (
                <>
                    <div
                        className="fixed inset-y-0 right-0 z-[100] flex flex-col border-l border-[color:var(--border)] bg-[color:var(--background)] shadow-[-8px_0_24px_-4px_rgba(0,0,0,0.1)] dark:shadow-[-8px_0_30px_-2px_rgba(0,0,0,0.7)]"
                        style={{ width: panelWidth }}
                    >
                        {/* Resize handle */}
                        <div
                            className="absolute inset-y-0 left-0 w-1 cursor-col-resize transition-colors hover:bg-[color:var(--foreground)]/10 active:bg-[color:var(--foreground)]/15"
                            onMouseDown={(e) => {
                                e.preventDefault();
                                startX.current = e.clientX;
                                startWidth.current = panelWidth;
                                setDragging(true);
                            }}
                        />
                        <div className="flex size-full min-h-0 flex-col overflow-hidden p-3">
                            {/* Header */}
                            <div className="flex items-center gap-2 border-b border-[color:var(--border)] px-3 pb-3">
                                <div className="flex flex-1 items-center gap-2">
                                    <p className="text-sm font-medium">Ask AI</p>
                                    <span className="docs-version-badge">BETA</span>
                                </div>
                                <button
                                    type="button"
                                    aria-label="Close"
                                    className="p-1 text-[color:var(--muted-foreground)] transition-colors hover:text-[color:var(--foreground)]"
                                    onClick={() => setIsOpen(false)}
                                >
                                    <X className="size-4" />
                                </button>
                            </div>
                            {panelContents}
                        </div>
                    </div>
                    {dragging && <div className="fixed inset-0 z-[201] cursor-col-resize" />}
                </>
            )}

            {/* Mobile drawer */}
            {!isDesktop && (
                <Drawer open={isOpen} onOpenChange={setIsOpen}>
                    <DrawerContent className="h-[85vh] max-h-[85vh]">
                        <DrawerHeader className="flex flex-row items-center gap-2 border-b border-[color:var(--border)]">
                            <div className="flex flex-1 items-center gap-2">
                                <DrawerTitle className="text-left text-sm font-medium">
                                    Ask AI
                                </DrawerTitle>
                                <span className="docs-version-badge">BETA</span>
                            </div>
                            <DrawerClose className="p-1 text-[color:var(--muted-foreground)] transition-colors hover:text-[color:var(--foreground)]">
                                <X className="size-4" />
                            </DrawerClose>
                        </DrawerHeader>
                        <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-2 pb-3">
                            {panelContents}
                        </div>
                    </DrawerContent>
                </Drawer>
            )}

            {/* Launch button */}
            <button
                type="button"
                onClick={() => setIsOpen((v) => !v)}
                className={cn(
                    "fixed bottom-5 end-5 z-40 flex items-center gap-2.5 rounded-full border border-[color:var(--border)] bg-[color:var(--background)] px-4 py-2 text-sm font-medium shadow-lg transition-all hover:bg-[color:var(--accent)] active:scale-95",
                    isOpen && "translate-y-12 opacity-0",
                )}
            >
                <MessageSquareText className="size-4" />
                Ask AI
            </button>
        </>
    );
}

function ChatMessages({ agent, className }: { agent: AskDocsAgent; className?: string }) {
    const { messages, status } = agent;
    const containerRef = useRef<HTMLDivElement>(null);

    const visibleMessages = useMemo(
        () => messages.filter((m) => m.role === "user" || getMessageText(m).trim().length > 0),
        [messages],
    );

    // Auto-scroll to bottom as content grows
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const scrollToBottom = () =>
            container.scrollTo({ top: container.scrollHeight, behavior: "instant" });

        const resizeObserver = new ResizeObserver(scrollToBottom);
        const observeChildren = () => {
            resizeObserver.disconnect();
            for (const c of container.children) resizeObserver.observe(c);
        };

        observeChildren();
        const mutationObserver = new MutationObserver(observeChildren);
        mutationObserver.observe(container, { childList: true });

        return () => {
            resizeObserver.disconnect();
            mutationObserver.disconnect();
        };
    }, []);

    // Thinking indicator visibility
    const lastMessage = messages.at(-1);
    const hasNoText =
        !lastMessage ||
        lastMessage.role !== "assistant" ||
        !lastMessage.parts?.some((p) => p.type === "text" && (p as { text?: string }).text?.length);
    const showThinking = status === "submitted" || (status === "streaming" && hasNoText);
    const isSearching =
        showThinking &&
        lastMessage?.parts?.some(
            (p) => p.type === "tool-call" && (p as { status: string }).status === "pending",
        );

    return (
        <div
            ref={containerRef}
            className={cn(
                "flex flex-col overflow-y-auto overscroll-contain select-text px-2 py-4",
                className,
            )}
            style={{
                maskImage:
                    "linear-gradient(to bottom, transparent, white 1rem, white calc(100% - 1rem), transparent 100%)",
            }}
        >
            {visibleMessages.length === 0 ? (
                <div className="flex size-full flex-col items-center justify-center gap-2 py-6 text-center text-sm text-[color:var(--muted-foreground)]/80">
                    <MessageSquareText className="size-5" />
                    <p>Start a new chat below.</p>
                </div>
            ) : (
                <div className="flex flex-col gap-6">
                    {visibleMessages.map((message) => {
                        const isUser = message.role === "user";
                        let text = getMessageText(message);
                        let links: Array<{ text: string; url: string }> = [];

                        if (!isUser) {
                            // Fix incomplete code blocks mid-stream
                            if ((text.match(/```/g) || []).length % 2 !== 0) text += "\n```";
                            ({ links, cleaned: text } = parseSourceLinks(text));
                        }

                        return (
                            <div key={message.localId}>
                                <p
                                    className={cn(
                                        "mb-1 text-[11px] font-medium uppercase tracking-wider text-[color:var(--muted-foreground)]",
                                        !isUser && "text-[color:var(--foreground)]",
                                    )}
                                >
                                    {isUser ? "you" : "assistant"}
                                </p>

                                <div className="prose prose-sm max-w-none text-sm leading-relaxed dark:prose-invert">
                                    {isUser ? (
                                        <p className="m-0 whitespace-pre-wrap">{text}</p>
                                    ) : (
                                        <Markdown text={text} />
                                    )}
                                </div>

                                {links.length > 0 && (
                                    <div className="mt-4 flex flex-col gap-2 border-t border-[color:var(--border)] pt-3">
                                        <p className="text-[11px] font-medium uppercase tracking-wider text-[color:var(--muted-foreground)]">
                                            Sources
                                        </p>
                                        <div className="flex flex-wrap gap-2">
                                            {links.map((link) => (
                                                <a
                                                    key={link.url}
                                                    href={link.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-1.5 rounded-md border border-[color:var(--border)] bg-[color:var(--accent)]/50 px-2 py-1 font-mono text-[11px] text-[color:var(--muted-foreground)] transition-colors hover:bg-[color:var(--accent)] hover:text-[color:var(--foreground)]"
                                                >
                                                    <FileText className="size-3 shrink-0 opacity-70" />
                                                    {link.text}
                                                </a>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    {showThinking && (
                        <div className="flex items-center gap-2 py-2 text-[12px] text-[color:var(--muted-foreground)]">
                            <Loader2 className="size-3 animate-spin" />
                            <span>{isSearching ? "Searching docs..." : "Thinking..."}</span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

function ChatInput({ agent }: { agent: AskDocsAgent }) {
    const { status, sendMessage, stop, messages, setMessages, error, clearError } = agent;
    const [input, setInput] = useState("");
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const isLoading = status === "submitted" || status === "streaming";

    const adjustHeight = useCallback(() => {
        const el = textareaRef.current;
        if (!el) return;
        el.style.height = "auto";
        el.style.height = `${Math.min(window.innerHeight * 0.35, Math.max(el.scrollHeight, 38))}px`;
    }, []);

    useEffect(() => {
        adjustHeight();
    }, [adjustHeight]);

    const onSubmit = (e?: React.SubmitEvent<HTMLFormElement>) => {
        e?.preventDefault();
        if (!input.trim() || isLoading) return;
        clearError();
        sendMessage({
            input,
            context: { url: window.location.href, title: document.title },
        });
        setInput("");
        requestAnimationFrame(adjustHeight);
    };

    return (
        <div className="relative mt-2">
            {error && (
                <div className="mb-2 rounded-lg border border-red-500/20 bg-red-500/6 px-3 py-2 text-[12px] text-red-600 dark:text-red-400">
                    {error.message}
                </div>
            )}
            <div
                className={cn(
                    "rounded-xl border transition-all duration-200",
                    "border-[color:var(--border)] bg-[color:var(--accent)]/50",
                    "focus-within:border-[color:var(--foreground)]/15 focus-within:bg-[color:var(--background)]",
                    "focus-within:shadow-[0_0_0_1px_rgba(0,0,0,0.04)]",
                )}
            >
                <form onSubmit={onSubmit}>
                    <div className="flex items-end p-1">
                        <textarea
                            ref={textareaRef}
                            value={input}
                            rows={1}
                            disabled={isLoading}
                            placeholder={isLoading ? "AI is answering..." : "Ask a question"}
                            style={{ height: 38 }}
                            className="flex-1 resize-none bg-transparent px-3 py-2 text-[13px] leading-relaxed text-[color:var(--foreground)] outline-none placeholder:text-[color:var(--muted-foreground)]"
                            onChange={(e) => {
                                if (error) clearError();
                                setInput(e.target.value);
                                adjustHeight();
                            }}
                            onKeyDown={(e) => {
                                if (!e.shiftKey && e.key === "Enter") {
                                    e.preventDefault();
                                    onSubmit();
                                }
                            }}
                        />
                        <div className="shrink-0 pb-1 pr-1">
                            {isLoading ? (
                                <button
                                    type="button"
                                    onClick={stop}
                                    className="flex size-7 items-center justify-center rounded-full border border-[color:var(--border)] text-[color:var(--muted-foreground)] transition-all hover:text-[color:var(--foreground)]"
                                >
                                    <Loader2 className="size-3.5 animate-spin" />
                                </button>
                            ) : (
                                <button
                                    type="submit"
                                    disabled={!input.trim()}
                                    className={cn(
                                        "flex size-7 items-center justify-center rounded-full transition-all",
                                        input.trim()
                                            ? "bg-[color:var(--foreground)] text-[color:var(--background)] hover:opacity-90"
                                            : "bg-[color:var(--muted-foreground)]/10 text-[color:var(--muted-foreground)] opacity-50",
                                    )}
                                >
                                    <ArrowUp className="size-3.5 stroke-[2.5]" />
                                </button>
                            )}
                        </div>
                    </div>
                </form>
            </div>

            <div className="mt-2 flex items-center gap-1.5 px-1">
                {messages.length > 0 && !isLoading && (
                    <button
                        type="button"
                        className="flex items-center gap-1.5 rounded-full border border-[color:var(--border)] px-2.5 py-1 text-[11px] text-[color:var(--muted-foreground)] transition-colors hover:text-[color:var(--foreground)]"
                        onClick={() => setMessages([])}
                    >
                        Clear Chat
                    </button>
                )}
                <p className="flex-1 text-right text-[10px] text-[color:var(--muted-foreground)] opacity-50">
                    Powered by Better Agent
                </p>
            </div>
        </div>
    );
}

function parseSourceLinks(text: string): {
    links: Array<{ text: string; url: string }>;
    cleaned: string;
} {
    const sourcesRegex = /(?:^|\n)(?:#{1,6}\s+)?\**Sources:?\**\s*\n([\s\S]*)$/i;
    const sourcesMatch = text.match(sourcesRegex);
    if (!sourcesMatch) return { links: [], cleaned: text };

    const links: Array<{ text: string; url: string }> = [];
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;

    for (const match of sourcesMatch[1].matchAll(linkRegex)) {
        let url = match[2];
        if (url.includes(".mdx")) {
            const mdxMatch = url.match(/(?:docs\/contents\/|docs\/)?(docs|cookbook)\/(.+?)\.mdx/);
            if (mdxMatch) url = `/${mdxMatch[1]}/${mdxMatch[2]}`;
            else continue;
        } else if (!url.startsWith("/docs/") && !url.startsWith("/cookbook/")) {
            continue;
        }
        links.push({ text: match[1].replace(/`/g, "").replace(/\.mdx$/, ""), url });
    }

    const cleaned = links.length > 0 ? text.replace(sourcesRegex, "").trim() : text;
    return { links, cleaned };
}
