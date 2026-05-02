"use client";

import { Geist_Mono } from "next/font/google";
import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type ThemedTokenWithVariants, codeToTokensWithThemes } from "shiki";

const geistMono = Geist_Mono({ subsets: ["latin"], weight: ["400", "500", "700"] });

const SERVER_CODE = `export const support = defineAgent({
  name: "support",
  model: openai("gpt-5.5"),
  tools: [searchDocs, createTicket],
  contextSchema: z.object({ userId: z.string() }),
  instruction: ({ userId }) =>
    \`You are a helpful support agent. The user is \${userId}.\`,
});

export const app = betterAgent({
  agents: [support],
  plugins: [rateLimit({ windowMs: "60m", max: 20 })],
});`;

const CLIENT_START = `export const client = createClient<typeof app>({
  baseURL: "/api",
});

const support = client.agent("su`;
const CLIENT_AGENT_COMPLETION = `pport"`;
const CLIENT_INLINE_ARG = `);

const result = await support.run({
  messages: [{ role: "user", content: "How do I get started?" }],
})`;
const CLIENT_BLOCK_ARG_START = `);

const result = await support.run({
  messages: [{ role: "user", content: "How do I get started?" }],`;
const CLIENT_BODY_INPUT = `
  co`;
const CLIENT_CONTEXT_COMPLETION = "ntext";
const CLIENT_CONTEXT_OPEN = `: {
    u`;
const CLIENT_USER_ID_COMPLETION = "serId";
const CLIENT_USER_ID_VALUE = `: "user_123"`;
const CLIENT_CONTEXT_CLOSE = `
  },`;
const CLIENT_INLINE_SUFFIX = ";";
const CLIENT_BLOCK_SUFFIX = `
});`;

const CLIENT_INLINE_CODE =
    CLIENT_START + CLIENT_AGENT_COMPLETION + CLIENT_INLINE_ARG + CLIENT_INLINE_SUFFIX;
const CLIENT_CODE =
    CLIENT_START +
    CLIENT_AGENT_COMPLETION +
    CLIENT_BLOCK_ARG_START +
    CLIENT_BODY_INPUT +
    CLIENT_CONTEXT_COMPLETION +
    CLIENT_CONTEXT_OPEN +
    CLIENT_USER_ID_COMPLETION +
    CLIENT_USER_ID_VALUE +
    CLIENT_CONTEXT_CLOSE +
    CLIENT_BLOCK_SUFFIX;

const CLIENT_AGENT_END = CLIENT_START.length + CLIENT_AGENT_COMPLETION.length;
const CLIENT_INLINE_ARG_END = CLIENT_AGENT_END + CLIENT_INLINE_ARG.length;
const CLIENT_BLOCK_ARG_END = CLIENT_AGENT_END + CLIENT_BLOCK_ARG_START.length;
const CLIENT_BODY_INPUT_END = CLIENT_BLOCK_ARG_END + CLIENT_BODY_INPUT.length;
const CLIENT_CONTEXT_END = CLIENT_BODY_INPUT_END + CLIENT_CONTEXT_COMPLETION.length;
const CLIENT_CONTEXT_OPEN_END = CLIENT_CONTEXT_END + CLIENT_CONTEXT_OPEN.length;
const CLIENT_USER_ID_END = CLIENT_CONTEXT_OPEN_END + CLIENT_USER_ID_COMPLETION.length;
const CLIENT_USER_ID_VALUE_END = CLIENT_USER_ID_END + CLIENT_USER_ID_VALUE.length;

type HighlightToken = {
    dark: string;
    light: string;
    text: string;
};

type RenderToken = HighlightToken;
type RenderLine = RenderToken[];
type HighlightedCode = RenderLine[];

type Suggestion = {
    detail: string;
    label: string;
};

const CHAR_MS = 28;
const NEWLINE_MS = 130;
const PANE_PAUSE_MS = 500;
const AUTOCOMPLETE_MS = 800;
const ENTER_KEY_MS = 250;
const ERROR_FADE_IN_MS = 300;
const ERROR_READ_MS = 1200;
const ERROR_RESOLVE_MS = 500;
const AUTOCOMPLETE_SETTLE_MS = 180;
const DONE_PAUSE_MS = 2500;
const FADE_MS = 600;
const RESET_MS = 800;

type Phase =
    | "idle"
    | "typing-left"
    | "pause-between"
    | "typing-right-1"
    | "autocomplete-agent"
    | "typing-right-2"
    | "enter-key"
    | "show-error"
    | "typing-right-3"
    | "autocomplete-context"
    | "typing-right-4"
    | "autocomplete-userid"
    | "typing-right-5"
    | "error-resolve"
    | "typing-right-6"
    | "done"
    | "fade-out"
    | "resetting";

const PHASE_ORDER: Phase[] = [
    "idle",
    "typing-left",
    "pause-between",
    "typing-right-1",
    "autocomplete-agent",
    "typing-right-2",
    "enter-key",
    "show-error",
    "typing-right-3",
    "autocomplete-context",
    "typing-right-4",
    "autocomplete-userid",
    "typing-right-5",
    "error-resolve",
    "typing-right-6",
    "done",
    "fade-out",
    "resetting",
];

const PHASE_INDEX = new Map(PHASE_ORDER.map((p, i) => [p, i]));

const ERROR_PHASES: Set<Phase> = new Set([
    "show-error",
    "typing-right-3",
    "autocomplete-context",
    "typing-right-4",
    "autocomplete-userid",
    "typing-right-5",
]);

const DIAGNOSTIC_TEXT = "context is missing required property 'userId'";
const PLAIN_TOKEN: HighlightToken = {
    dark: "var(--code-token-primary)",
    light: "var(--code-token-primary)",
    text: "",
};
const PUNCTUATION_TOKEN: HighlightToken = {
    dark: "var(--code-token-punct)",
    light: "var(--code-token-punct)",
    text: "",
};

function tokenStyle(token: HighlightToken): CSSProperties {
    return {
        "--shiki-dark": token.dark,
        "--shiki-light": token.light,
    } as CSSProperties;
}

function tokenFromShiki(token: ThemedTokenWithVariants): HighlightToken {
    return {
        dark: token.variants.dark?.color ?? "var(--code-token-primary)",
        light: token.variants.light?.color ?? "var(--code-token-primary)",
        text: token.content,
    };
}

function fallbackHighlight(code: string): HighlightedCode {
    return code.split("\n").map((line) => (line ? [{ ...PLAIN_TOKEN, text: line }] : []));
}

async function highlightCode(code: string): Promise<HighlightedCode> {
    const lines = await codeToTokensWithThemes(code, {
        lang: "ts",
        themes: {
            light: "github-light-default",
            dark: "github-dark-default",
        },
    });

    return lines.map((line) => line.map(tokenFromShiki));
}

function lineLength(line: RenderLine | undefined): number {
    if (!line) return 0;
    return line.reduce((sum, token) => sum + token.text.length, 0);
}

function splitLineAtColumn(
    line: RenderLine | undefined,
    column: number,
): { after: RenderLine; before: RenderLine } {
    if (!line || line.length === 0) return { before: [], after: [] };

    const before: RenderLine = [];
    const after: RenderLine = [];
    let remaining = Math.max(0, column);

    for (const token of line) {
        const length = token.text.length;

        if (remaining <= 0) {
            after.push(token);
            continue;
        }

        if (remaining >= length) {
            before.push(token);
            remaining -= length;
            continue;
        }

        before.push({ ...token, text: token.text.slice(0, remaining) });
        after.push({ ...token, text: token.text.slice(remaining) });
        remaining = 0;
    }

    return { before, after };
}

function sliceHighlighted(lines: HighlightedCode, upTo: number): RenderLine[] {
    const result: RenderLine[] = [];
    let seen = 0;

    for (const line of lines) {
        const lineLengthValue = lineLength(line);
        if (seen + lineLengthValue < upTo) {
            result.push(line);
            seen += lineLengthValue + 1;
            continue;
        }

        const remaining = Math.max(0, upTo - seen);
        result.push(splitLineAtColumn(line, remaining).before);
        return result;
    }

    return result.length > 0 ? result : [[]];
}

function sliceRange(lines: HighlightedCode, start: number, end: number): RenderLine[] {
    const before = sliceHighlighted(lines, start);
    const after = sliceHighlighted(lines, end);
    const startLine = before.length - 1;
    const startColumn = lineLength(before[startLine]);
    const result = after.slice(startLine);
    result[0] = splitLineAtColumn(result[0], startColumn).after;
    return result;
}

function textToLines(text: string, token = PUNCTUATION_TOKEN): RenderLine[] {
    return text.split("\n").map((line) => (line ? [{ ...token, text: line }] : []));
}

function mergeRenderedLines(base: RenderLine[], extra: RenderLine[]): RenderLine[] {
    if (base.length === 0) return [...extra];
    if (extra.length === 0) return [...base];
    const merged = [...base];
    merged[merged.length - 1] = [...merged[merged.length - 1], ...extra[0]];
    for (let i = 1; i < extra.length; i++) merged.push(extra[i]);
    return merged;
}

function charAt(code: string, index: number): string | undefined {
    return code[index];
}

function AutocompleteDropdown({
    items,
    visible,
}: {
    items: Suggestion[];
    visible: boolean;
}) {
    return (
        <div
            className={`${geistMono.className} pointer-events-none absolute left-0 top-full z-20 mt-1 w-[11.5rem] overflow-hidden border border-[color:var(--showcase-shell-border)] shadow-xl transition-all duration-150`}
            style={{
                background: "var(--showcase-popover-bg)",
                opacity: visible ? 1 : 0,
                transform: visible ? "translateY(0)" : "translateY(-3px)",
            }}
        >
            <div
                className="flex items-center gap-2 px-2.5 py-[5px]"
                style={{ background: "var(--showcase-selection-bg)" }}
            >
                <svg
                    aria-hidden="true"
                    className="size-3.5 shrink-0"
                    fill="none"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.5"
                    style={{ color: "var(--code-token-fn)" }}
                    viewBox="0 0 24 24"
                >
                    <rect height="14" rx="2" width="14" x="5" y="5" />
                    <path d="M9 9h6" />
                    <path d="M9 13h4" />
                </svg>
                <span className="text-[11.5px] text-[color:var(--code-token-primary)]">
                    {items[0]?.label}
                </span>
                <span className="ml-auto text-[10px] text-[color:var(--code-token-punct)]">
                    {items[0]?.detail}
                </span>
            </div>
            {items[1] && (
                <div className="flex items-center gap-2 px-2.5 py-[5px] opacity-35">
                    <svg
                        aria-hidden="true"
                        className="size-3.5 shrink-0"
                        fill="none"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="1.5"
                        style={{ color: "var(--code-token-fn)" }}
                        viewBox="0 0 24 24"
                    >
                        <rect height="14" rx="2" width="14" x="5" y="5" />
                        <path d="M9 9h6" />
                        <path d="M9 13h4" />
                    </svg>
                    <span className="text-[11.5px] text-[color:var(--code-token-primary)]">
                        {items[1].label}
                    </span>
                    <span className="ml-auto text-[10px] text-[color:var(--code-token-punct)]">
                        {items[1].detail}
                    </span>
                </div>
            )}
        </div>
    );
}

function PaneContent({
    autocompleteItems,
    diagnosticVisible,
    diagnosticFading,
    lines,
    cursorLine,
    cursorColumn,
    totalLineCount,
    showCursor,
    isTyping,
    autocompleteVisible,
}: {
    autocompleteItems: Suggestion[];
    diagnosticVisible: boolean;
    diagnosticFading: boolean;
    lines: RenderLine[];
    cursorLine: number;
    cursorColumn?: number;
    totalLineCount: number;
    showCursor: boolean;
    isTyping: boolean;
    autocompleteVisible: boolean;
}) {
    const showDiagnosticDom = diagnosticVisible || diagnosticFading;

    return (
        <div className="flex-1 px-4 py-4 sm:px-5 sm:py-5">
            <pre
                className={`${geistMono.className} m-0 text-[11.5px] font-[350] leading-[1.75] sm:text-[12.5px]`}
            >
                {Array.from({ length: totalLineCount }, (_, i) => {
                    const originalLine = lines[i];
                    const line = originalLine ?? [];
                    const isCursorLine = i === cursorLine;
                    const hasContent = line.length > 0;
                    const lineNumber = i + 1;
                    const effectiveCursorColumn =
                        isCursorLine && cursorColumn !== undefined
                            ? cursorColumn
                            : lineLength(line);
                    const { before, after } =
                        showCursor && isCursorLine
                            ? splitLineAtColumn(line, effectiveCursorColumn)
                            : { before: line, after: [] };

                    return (
                        <div
                            className="grid grid-cols-[1.5rem_minmax(0,1fr)]"
                            key={`line-${lineNumber}`}
                        >
                            <span
                                className="select-none text-right"
                                style={{
                                    color: "var(--line-number)",
                                    opacity: originalLine !== undefined ? 1 : 0.25,
                                }}
                            >
                                {lineNumber}
                            </span>
                            <span className="relative pl-3">
                                {hasContent &&
                                    before.map((token, index) => (
                                        <span
                                            className="code-demo-token"
                                            key={`before:${index}:${token.text}`}
                                            style={tokenStyle(token)}
                                        >
                                            {token.text}
                                        </span>
                                    ))}
                                {showCursor && isCursorLine && (
                                    <span
                                        className="code-demo-cursor"
                                        data-typing={isTyping ? "true" : "false"}
                                    />
                                )}
                                {autocompleteVisible && isCursorLine && (
                                    <span className="relative inline-block h-0 w-0 align-bottom">
                                        <AutocompleteDropdown items={autocompleteItems} visible />
                                    </span>
                                )}
                                {hasContent &&
                                    after.map((token, index) => (
                                        <span
                                            className="code-demo-token"
                                            key={`after:${index}:${token.text}`}
                                            style={tokenStyle(token)}
                                        >
                                            {token.text}
                                        </span>
                                    ))}
                            </span>
                        </div>
                    );
                })}
                <div
                    className="grid grid-cols-[1.5rem_minmax(0,1fr)] transition-all duration-300 ease-out"
                    style={{
                        background:
                            showDiagnosticDom && !diagnosticFading
                                ? "var(--showcase-error-bg)"
                                : "transparent",
                        borderLeft:
                            showDiagnosticDom && !diagnosticFading
                                ? "2px solid var(--showcase-error-border)"
                                : "2px solid transparent",
                        marginLeft: "-2px",
                        opacity: diagnosticVisible && !diagnosticFading ? 1 : 0,
                        maxHeight: showDiagnosticDom ? "2rem" : "0",
                        overflow: "hidden",
                    }}
                >
                    <span
                        className="flex select-none items-center justify-end"
                        style={{ color: "var(--showcase-error-fg)", opacity: 0.85 }}
                    >
                        <svg
                            aria-hidden="true"
                            className="size-3"
                            fill="none"
                            stroke="currentColor"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            viewBox="0 0 24 24"
                        >
                            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                            <line x1="12" x2="12" y1="9" y2="13" />
                            <line x1="12" x2="12.01" y1="17" y2="17" />
                        </svg>
                    </span>
                    <span
                        className="pl-3 text-[11px] leading-[1.75] sm:text-[11.5px]"
                        style={{ color: "var(--showcase-error-fg)" }}
                    >
                        {DIAGNOSTIC_TEXT}
                    </span>
                </div>
            </pre>
        </div>
    );
}

function CodePane({
    children,
    filename,
    joinLeft = false,
}: {
    children: React.ReactNode;
    filename: string;
    joinLeft?: boolean;
}) {
    return (
        <div
            className={`code-demo-pane flex min-h-0 flex-col overflow-hidden border border-[color:var(--showcase-shell-border)] ${joinLeft ? "lg:border-l-0" : ""}`}
            style={{ background: "var(--code-block-bg)" }}
        >
            <div
                className="flex h-9 items-center border-b px-4"
                style={{
                    background: "var(--code-block-bg)",
                    borderColor: "var(--showcase-shell-border)",
                }}
            >
                <span
                    className="text-[11px] tracking-[0.02em]"
                    style={{ color: "var(--showcase-tab-idle)" }}
                >
                    {filename}
                </span>
            </div>
            {children}
        </div>
    );
}

export default function CodeDemo() {
    const sectionRef = useRef<HTMLDivElement>(null);
    const [started, setStarted] = useState(false);
    const [phase, setPhase] = useState<Phase>("idle");
    const [serverIdx, setServerIdx] = useState(0);
    const [clientStartIdx, setClientStartIdx] = useState(0);
    const [inlineArgIdx, setInlineArgIdx] = useState(0);
    const [bodyInputIdx, setBodyInputIdx] = useState(0);
    const [contextOpenIdx, setContextOpenIdx] = useState(0);
    const [userIdValueIdx, setUserIdValueIdx] = useState(0);
    const [contextCloseIdx, setContextCloseIdx] = useState(0);
    const [acVisible, setAcVisible] = useState<"agent" | "context" | "userId" | null>(null);
    const [opacity, setOpacity] = useState(1);
    const [serverHighlight, setServerHighlight] = useState<HighlightedCode>(() =>
        fallbackHighlight(SERVER_CODE),
    );
    const [clientInlineHighlight, setClientInlineHighlight] = useState<HighlightedCode>(() =>
        fallbackHighlight(CLIENT_INLINE_CODE),
    );
    const [clientHighlight, setClientHighlight] = useState<HighlightedCode>(() =>
        fallbackHighlight(CLIENT_CODE),
    );

    useEffect(() => {
        let cancelled = false;

        Promise.all([
            highlightCode(SERVER_CODE),
            highlightCode(CLIENT_INLINE_CODE),
            highlightCode(CLIENT_CODE),
        ])
            .then(([server, clientInline, client]) => {
                if (!cancelled) {
                    setServerHighlight(server);
                    setClientInlineHighlight(clientInline);
                    setClientHighlight(client);
                }
            })
            .catch(() => {
                if (!cancelled) {
                    setServerHighlight(fallbackHighlight(SERVER_CODE));
                    setClientInlineHighlight(fallbackHighlight(CLIENT_INLINE_CODE));
                    setClientHighlight(fallbackHighlight(CLIENT_CODE));
                }
            });

        return () => {
            cancelled = true;
        };
    }, []);

    const serverTotalLines = useMemo(() => fallbackHighlight(SERVER_CODE).length, []);
    const clientTotalLines = useMemo(() => fallbackHighlight(CLIENT_CODE).length, []);

    const isAtOrPast = useCallback(
        (p: Phase) => (PHASE_INDEX.get(phase) ?? 0) >= (PHASE_INDEX.get(p) ?? 0),
        [phase],
    );

    useEffect(() => {
        const el = sectionRef.current;
        if (!el) return;
        const obs = new IntersectionObserver(
            ([e]) => {
                if (e.isIntersecting) {
                    setStarted(true);
                    setPhase("typing-left");
                    obs.disconnect();
                }
            },
            { threshold: 0.15 },
        );
        obs.observe(el);
        return () => obs.disconnect();
    }, []);

    const reset = useCallback(() => {
        setServerIdx(0);
        setClientStartIdx(0);
        setInlineArgIdx(0);
        setBodyInputIdx(0);
        setContextOpenIdx(0);
        setUserIdValueIdx(0);
        setContextCloseIdx(0);
        setAcVisible(null);
        setOpacity(1);
        setPhase("typing-left");
    }, []);

    useEffect(() => {
        if (!started) return;
        let t: ReturnType<typeof setTimeout>;
        const queuePhase = (nextPhase: Phase, delay = 0) =>
            setTimeout(() => setPhase(nextPhase), delay);

        switch (phase) {
            case "typing-left": {
                if (serverIdx >= SERVER_CODE.length) {
                    t = queuePhase("pause-between");
                    return;
                }
                const nl = charAt(SERVER_CODE, serverIdx) === "\n";
                t = setTimeout(() => setServerIdx((i) => i + 1), nl ? NEWLINE_MS : CHAR_MS);
                break;
            }
            case "pause-between":
                t = setTimeout(() => setPhase("typing-right-1"), PANE_PAUSE_MS);
                break;

            case "typing-right-1": {
                if (clientStartIdx >= CLIENT_START.length) {
                    t = setTimeout(() => {
                        setAcVisible("agent");
                        setPhase("autocomplete-agent");
                    }, 0);
                    return;
                }
                const nl = charAt(CLIENT_START, clientStartIdx) === "\n";
                t = setTimeout(() => setClientStartIdx((i) => i + 1), nl ? NEWLINE_MS : CHAR_MS);
                break;
            }

            case "autocomplete-agent":
                t = setTimeout(() => {
                    setAcVisible(null);
                    setPhase("typing-right-2");
                }, AUTOCOMPLETE_MS);
                break;

            case "typing-right-2": {
                if (inlineArgIdx >= CLIENT_INLINE_ARG.length) {
                    t = queuePhase("enter-key");
                    return;
                }
                const nl = charAt(CLIENT_INLINE_ARG, inlineArgIdx) === "\n";
                t = setTimeout(
                    () => setInlineArgIdx((i) => i + 1),
                    inlineArgIdx === 0 ? AUTOCOMPLETE_SETTLE_MS : nl ? NEWLINE_MS : CHAR_MS,
                );
                break;
            }

            case "enter-key":
                t = setTimeout(() => setPhase("show-error"), ENTER_KEY_MS);
                break;

            case "show-error":
                t = setTimeout(() => setPhase("typing-right-3"), ERROR_FADE_IN_MS + ERROR_READ_MS);
                break;

            case "typing-right-3": {
                if (bodyInputIdx >= CLIENT_BODY_INPUT.length) {
                    t = setTimeout(() => {
                        setAcVisible("context");
                        setPhase("autocomplete-context");
                    }, 0);
                    return;
                }
                const nl = charAt(CLIENT_BODY_INPUT, bodyInputIdx) === "\n";
                t = setTimeout(() => setBodyInputIdx((i) => i + 1), nl ? NEWLINE_MS : CHAR_MS);
                break;
            }

            case "autocomplete-context":
                t = setTimeout(() => {
                    setAcVisible(null);
                    setPhase("typing-right-4");
                }, AUTOCOMPLETE_MS);
                break;

            case "typing-right-4": {
                if (contextOpenIdx >= CLIENT_CONTEXT_OPEN.length) {
                    t = setTimeout(() => {
                        setAcVisible("userId");
                        setPhase("autocomplete-userid");
                    }, 0);
                    return;
                }
                const nl = charAt(CLIENT_CONTEXT_OPEN, contextOpenIdx) === "\n";
                t = setTimeout(
                    () => setContextOpenIdx((i) => i + 1),
                    contextOpenIdx === 0 ? AUTOCOMPLETE_SETTLE_MS : nl ? NEWLINE_MS : CHAR_MS,
                );
                break;
            }

            case "autocomplete-userid":
                t = setTimeout(() => {
                    setAcVisible(null);
                    setPhase("typing-right-5");
                }, AUTOCOMPLETE_MS);
                break;

            case "typing-right-5": {
                if (userIdValueIdx >= CLIENT_USER_ID_VALUE.length) {
                    t = queuePhase("error-resolve");
                    return;
                }
                const nl = charAt(CLIENT_USER_ID_VALUE, userIdValueIdx) === "\n";
                t = setTimeout(
                    () => setUserIdValueIdx((i) => i + 1),
                    userIdValueIdx === 0 ? AUTOCOMPLETE_SETTLE_MS : nl ? NEWLINE_MS : CHAR_MS,
                );
                break;
            }

            case "error-resolve":
                t = setTimeout(() => setPhase("typing-right-6"), ERROR_RESOLVE_MS);
                break;

            case "typing-right-6": {
                if (contextCloseIdx >= CLIENT_CONTEXT_CLOSE.length) {
                    t = queuePhase("done");
                    return;
                }
                const nl = charAt(CLIENT_CONTEXT_CLOSE, contextCloseIdx) === "\n";
                t = setTimeout(() => setContextCloseIdx((i) => i + 1), nl ? NEWLINE_MS : CHAR_MS);
                break;
            }

            case "done":
                t = setTimeout(() => setPhase("fade-out"), DONE_PAUSE_MS);
                break;
            case "fade-out":
                window.setTimeout(() => setOpacity(0), 0);
                t = setTimeout(() => setPhase("resetting"), FADE_MS);
                break;
            case "resetting":
                t = setTimeout(reset, RESET_MS);
                break;
        }

        return () => clearTimeout(t);
    }, [
        started,
        phase,
        serverIdx,
        clientStartIdx,
        inlineArgIdx,
        bodyInputIdx,
        contextOpenIdx,
        userIdValueIdx,
        contextCloseIdx,
        reset,
    ]);

    const serverLines = sliceHighlighted(serverHighlight, serverIdx);

    const buildClientLines = (): {
        cursorColumn: number;
        cursorLine: number;
        lines: RenderLine[];
    } => {
        if (!isAtOrPast("autocomplete-agent")) {
            const lines = sliceHighlighted(clientHighlight, clientStartIdx);
            return {
                lines,
                cursorLine: lines.length - 1,
                cursorColumn: lineLength(lines[lines.length - 1]),
            };
        }

        let prefix = sliceHighlighted(clientHighlight, CLIENT_START.length);

        if (phase === "autocomplete-agent") {
            return {
                lines: prefix,
                cursorLine: prefix.length - 1,
                cursorColumn: lineLength(prefix[prefix.length - 1]),
            };
        }

        prefix = sliceHighlighted(clientHighlight, CLIENT_AGENT_END);

        if (!isAtOrPast("enter-key")) {
            prefix = sliceHighlighted(clientInlineHighlight, CLIENT_AGENT_END);
            const inlineArg = sliceRange(
                clientInlineHighlight,
                CLIENT_AGENT_END,
                CLIENT_AGENT_END + inlineArgIdx,
            );
            const typedView = mergeRenderedLines(prefix, inlineArg);
            const lines = mergeRenderedLines(
                typedView,
                sliceRange(clientInlineHighlight, CLIENT_INLINE_ARG_END, CLIENT_INLINE_CODE.length),
            );
            return {
                lines,
                cursorLine: typedView.length - 1,
                cursorColumn: lineLength(typedView[typedView.length - 1]),
            };
        }

        prefix = sliceHighlighted(clientHighlight, CLIENT_BLOCK_ARG_END);
        let body: RenderLine[] = [];
        let cursorInBody = false;

        if (isAtOrPast("typing-right-3")) {
            body = sliceRange(
                clientHighlight,
                CLIENT_BLOCK_ARG_END,
                CLIENT_BLOCK_ARG_END + bodyInputIdx,
            );
            if (phase === "typing-right-3" || phase === "autocomplete-context") {
                cursorInBody = true;
            }
        }

        if (isAtOrPast("autocomplete-context") && phase !== "autocomplete-context") {
            body = sliceRange(clientHighlight, CLIENT_BLOCK_ARG_END, CLIENT_CONTEXT_END);
        }

        if (isAtOrPast("typing-right-4")) {
            body = sliceRange(
                clientHighlight,
                CLIENT_BLOCK_ARG_END,
                CLIENT_CONTEXT_END + contextOpenIdx,
            );
            if (phase === "typing-right-4" || phase === "autocomplete-userid") {
                cursorInBody = true;
            }
        }

        if (isAtOrPast("autocomplete-userid") && phase !== "autocomplete-userid") {
            body = sliceRange(clientHighlight, CLIENT_BLOCK_ARG_END, CLIENT_USER_ID_END);
        }

        if (isAtOrPast("typing-right-5")) {
            body = sliceRange(
                clientHighlight,
                CLIENT_BLOCK_ARG_END,
                CLIENT_USER_ID_END + userIdValueIdx,
            );
            if (
                phase === "typing-right-5" ||
                phase === "error-resolve" ||
                phase === "typing-right-6" ||
                phase === "done"
            ) {
                cursorInBody = true;
            }
        }

        if (isAtOrPast("typing-right-6")) {
            body = sliceRange(
                clientHighlight,
                CLIENT_BLOCK_ARG_END,
                CLIENT_USER_ID_VALUE_END + contextCloseIdx,
            );
            if (phase === "typing-right-6" || phase === "done") {
                cursorInBody = true;
            }
        }

        const prefixLen = prefix.length;
        if (body.length > 0) {
            prefix = mergeRenderedLines(prefix, body);
        }

        const lines = mergeRenderedLines(prefix, textToLines(CLIENT_BLOCK_SUFFIX));
        const cursorLine = cursorInBody ? prefix.length - 1 : prefixLen - 1;

        return {
            lines,
            cursorLine,
            cursorColumn: lineLength(prefix[cursorLine]),
        };
    };

    const {
        lines: clientLines,
        cursorLine: clientCursorLine,
        cursorColumn: clientCursorColumn,
    } = buildClientLines();

    const diagnosticVisible = ERROR_PHASES.has(phase);
    const diagnosticFading = phase === "error-resolve";

    const autocompleteItems =
        acVisible === "agent"
            ? [{ label: '"support"', detail: "agent" }]
            : acVisible === "context"
              ? [{ label: "context", detail: "object" }]
              : acVisible === "userId"
                ? [{ label: "userId", detail: "string" }]
                : [];

    const cursorLeft = phase === "typing-left" || phase === "pause-between";
    const cursorRight =
        isAtOrPast("typing-right-1") &&
        !isAtOrPast("fade-out") &&
        phase !== "idle" &&
        phase !== "typing-left" &&
        phase !== "pause-between";

    return (
        <section
            ref={sectionRef}
            className="relative mx-auto w-full max-w-[76rem] px-5 pt-8 pb-16 sm:px-8 sm:pt-12 sm:pb-20 md:pb-24"
        >
            <div className="mb-6 flex items-center gap-3 sm:mb-8">
                <p className="text-[11px] font-[360] tracking-[0.08em] text-[color:color-mix(in_srgb,var(--foreground)_36%,transparent)] uppercase">
                    The Best DX
                </p>
                <div className="h-px flex-1 bg-[color:color-mix(in_srgb,var(--foreground)_8%,transparent)]" />
            </div>

            <div
                className="grid gap-0 transition-opacity lg:grid-cols-2"
                style={{ opacity, transitionDuration: `${FADE_MS}ms` }}
            >
                <CodePane filename="server.ts">
                    <PaneContent
                        autocompleteItems={[]}
                        autocompleteVisible={false}
                        cursorColumn={undefined}
                        cursorLine={serverLines.length - 1}
                        diagnosticFading={false}
                        diagnosticVisible={false}
                        isTyping={phase === "typing-left"}
                        lines={serverLines}
                        showCursor={cursorLeft}
                        totalLineCount={serverTotalLines}
                    />
                </CodePane>

                <CodePane filename="client.ts" joinLeft>
                    <PaneContent
                        autocompleteItems={autocompleteItems}
                        autocompleteVisible={acVisible !== null}
                        cursorColumn={clientCursorColumn}
                        cursorLine={clientCursorLine}
                        diagnosticFading={diagnosticFading}
                        diagnosticVisible={diagnosticVisible}
                        isTyping={
                            phase === "typing-right-1" ||
                            phase === "typing-right-2" ||
                            phase === "typing-right-3" ||
                            phase === "typing-right-4" ||
                            phase === "typing-right-5" ||
                            phase === "typing-right-6"
                        }
                        lines={clientLines}
                        showCursor={cursorRight}
                        totalLineCount={clientTotalLines}
                    />
                </CodePane>
            </div>
        </section>
    );
}
