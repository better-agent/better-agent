"use client";

import { Geist_Mono } from "next/font/google";
import { useCallback, useEffect, useRef, useState } from "react";

const geistMono = Geist_Mono({ subsets: ["latin"], weight: ["400", "500", "700"] });

const K = "var(--code-token-keyword)";
const P = "var(--code-token-primary)";
const X = "var(--code-token-punct)";
const F = "var(--code-token-fn)";
const PR = "var(--code-token-property)";
const S = "var(--code-token-string)";

type Tok = { t: string; c: string };

const leftTokens: (Tok | null)[] = [
    { t: "export", c: K },
    { t: " ", c: X },
    { t: "const", c: K },
    { t: " supportAgent ", c: P },
    { t: "= ", c: X },
    { t: "defineAgent", c: F },
    { t: "({", c: X },
    null,
    { t: "  name", c: PR },
    { t: ": ", c: X },
    { t: '"supportAgent"', c: S },
    { t: ",", c: X },
    null,
    { t: "  model", c: PR },
    { t: ": ", c: X },
    { t: "openai", c: P },
    { t: ".", c: X },
    { t: "model", c: F },
    { t: "(", c: X },
    { t: '"gpt-4o"', c: S },
    { t: ")", c: X },
    { t: ",", c: X },
    null,
    { t: "  tools", c: PR },
    { t: ": [", c: X },
    { t: "searchDocsTool", c: F },
    { t: "],", c: X },
    null,
    { t: "  contextSchema", c: PR },
    { t: ": ", c: X },
    { t: "z", c: F },
    { t: ".", c: X },
    { t: "object", c: F },
    { t: "({ ", c: X },
    { t: "userId", c: PR },
    { t: ": ", c: X },
    { t: '"string"', c: S },
    { t: " }),", c: X },
    null,
    { t: "  instruction", c: PR },
    { t: ": ", c: X },
    { t: '"You are helpful"', c: S },
    { t: ",", c: X },
    null,
    { t: "});", c: X },
    null,
    null,
    { t: "const", c: K },
    { t: " ba ", c: P },
    { t: "= ", c: X },
    { t: "betterAgent", c: F },
    { t: "({", c: X },
    null,
    { t: "  agents", c: PR },
    { t: ": [", c: X },
    { t: "supportAgent", c: P },
    { t: "],", c: X },
    null,
    { t: "  plugins", c: PR },
    { t: ": [", c: X },
    { t: "rateLimitPlugin", c: F },
    { t: "({ ", c: X },
    { t: "windowMs", c: PR },
    { t: ': "1m", ', c: X },
    { t: "max", c: PR },
    { t: ": 20", c: X },
    { t: " })],", c: X },
    null,
    { t: "  baseURL", c: PR },
    { t: ": ", c: X },
    { t: '"/api"', c: S },
    { t: ",", c: X },
    null,
    { t: "});", c: X },
    null,
    null,
    { t: "export", c: K },
    { t: " ", c: X },
    { t: "default", c: K },
    { t: " ba", c: P },
    { t: ";", c: X },
];

// Right pane phases.
const rightPhase1: (Tok | null)[] = [
    { t: "export", c: K },
    { t: " ", c: X },
    { t: "const", c: K },
    { t: " client ", c: P },
    { t: "= ", c: X },
    { t: "createClient", c: F },
    { t: "<", c: X },
    { t: "typeof", c: K },
    { t: " ba", c: P },
    { t: ">({", c: X },
    null,
    { t: "  baseURL", c: PR },
    { t: ": ", c: X },
    { t: '"/api"', c: S },
    { t: ",", c: X },
    null,
    { t: "});", c: X },
    null,
    null,
    { t: "const", c: K },
    { t: " result ", c: P },
    { t: "= ", c: X },
    { t: "await", c: K },
    { t: " client", c: P },
    { t: ".", c: X },
    { t: "run", c: F },
    { t: "(", c: X },
    { t: '"su', c: S },
];

const rightPhase2: (Tok | null)[] = [{ t: 'pportAgent"', c: S }];

const rightPhase3: (Tok | null)[] = [
    { t: ",", c: X },
    { t: " ", c: X },
    { t: "{", c: X },
    { t: "}", c: X },
];

const rightPhase4: (Tok | null)[] = [
    null,
    { t: "  input", c: PR },
    { t: ": ", c: X },
    { t: '"How do I get started?"', c: S },
    { t: ",", c: X },
    null,
    { t: "  co", c: PR },
];

const rightPhase5: (Tok | null)[] = [{ t: "ntext", c: PR }];

const rightPhase6: (Tok | null)[] = [
    { t: ": ", c: X },
    { t: "{", c: X },
    null,
    { t: "    u", c: PR },
];

const rightPhase7: (Tok | null)[] = [{ t: "serId", c: PR }];

const rightPhase8: (Tok | null)[] = [
    { t: ": ", c: X },
    { t: '"user_123"', c: S },
];

const rightPhase9: (Tok | null)[] = [null, { t: "  },", c: X }];

const inlineSuffixTokens: (Tok | null)[] = [{ t: ");", c: X }];

const blockSuffixTokens: (Tok | null)[] = [null, { t: "});", c: X }];

type CharEntry = { char: string; color: string };

function flattenTokens(tokens: (Tok | null)[]): CharEntry[] {
    const result: CharEntry[] = [];
    for (const tok of tokens) {
        if (tok === null) {
            result.push({ char: "\n", color: "" });
        } else {
            for (const ch of tok.t) {
                result.push({ char: ch, color: tok.c });
            }
        }
    }
    return result;
}

const leftChars = flattenTokens(leftTokens);
const rp1Chars = flattenTokens(rightPhase1);
const rp2Chars = flattenTokens(rightPhase2);
const rp3Chars = flattenTokens(rightPhase3);
const rp4Chars = flattenTokens(rightPhase4);
const rp5Chars = flattenTokens(rightPhase5);
const rp6Chars = flattenTokens(rightPhase6);
const rp7Chars = flattenTokens(rightPhase7);
const rp8Chars = flattenTokens(rightPhase8);
const rp9Chars = flattenTokens(rightPhase9);
const inlineSuffixChars = flattenTokens(inlineSuffixTokens);
const blockSuffixChars = flattenTokens(blockSuffixTokens);

type RenderToken = { text: string; color: string };
type RenderLine = RenderToken[];

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

function charsToLines(chars: CharEntry[], upTo: number): RenderLine[] {
    const lines: RenderLine[] = [[]];
    for (let i = 0; i < upTo && i < chars.length; i++) {
        const ch = chars[i];
        if (ch.char === "\n") {
            lines.push([]);
            continue;
        }
        const currentLine = lines[lines.length - 1];
        const lastToken = currentLine[currentLine.length - 1];
        if (lastToken && lastToken.color === ch.color) {
            lastToken.text += ch.char;
        } else {
            currentLine.push({ text: ch.char, color: ch.color });
        }
    }
    return lines;
}

const allChars = (chars: CharEntry[]) => charsToLines(chars, chars.length);

const leftTotalLines = charsToLines(leftChars, leftChars.length).length;

function mergeRenderedLines(base: RenderLine[], extra: RenderLine[]): RenderLine[] {
    if (base.length === 0) return [...extra];
    if (extra.length === 0) return [...base];
    const merged = [...base];
    merged[merged.length - 1] = [...merged[merged.length - 1], ...extra[0]];
    for (let i = 1; i < extra.length; i++) merged.push(extra[i]);
    return merged;
}

/** Merge line groups. */
function mergeAll(...parts: RenderLine[][]): RenderLine[] {
    let result: RenderLine[] = [];
    for (const p of parts) {
        result = mergeRenderedLines(result, p);
    }
    return result;
}

const rightFullLines = mergeAll(
    allChars(rp1Chars),
    allChars(rp2Chars),
    charsToLines(rp3Chars, 3),
    allChars(rp4Chars),
    allChars(rp5Chars),
    allChars(rp6Chars),
    allChars(rp7Chars),
    allChars(rp8Chars),
    allChars(rp9Chars),
    allChars(blockSuffixChars),
).length;

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

type Suggestion = {
    detail: string;
    label: string;
};

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
                background: "var(--showcase-code-bg)",
                opacity: visible ? 1 : 0,
                transform: visible ? "translateY(0)" : "translateY(-3px)",
            }}
        >
            <div
                className="flex items-center gap-2 px-2.5 py-[5px]"
                style={{ background: "var(--accent)" }}
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
                <span className="text-[11.5px]" style={{ color: "var(--code-token-primary)" }}>
                    {items[0]?.label}
                </span>
                <span className="ml-auto text-[10px]" style={{ color: "var(--code-token-punct)" }}>
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
                    <span className="text-[11.5px]" style={{ color: "var(--code-token-primary)" }}>
                        {items[1].label}
                    </span>
                    <span
                        className="ml-auto text-[10px]"
                        style={{ color: "var(--code-token-punct)" }}
                    >
                        {items[1].detail}
                    </span>
                </div>
            )}
        </div>
    );
}

const DIAGNOSTIC_TEXT = "context is missing required property 'userId'";

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
                className={`${geistMono.className} m-0 text-[11.5px] leading-[1.75] sm:text-[12.5px]`}
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
                                    before.map((token, index) => {
                                        const key = `${token.color}:before:${index}:${token.text}`;
                                        return (
                                            <span key={key} style={{ color: token.color }}>
                                                {token.text}
                                            </span>
                                        );
                                    })}
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
                                    after.map((token, index) => {
                                        const key = `${token.color}:after:${index}:${token.text}`;
                                        return (
                                            <span key={key} style={{ color: token.color }}>
                                                {token.text}
                                            </span>
                                        );
                                    })}
                            </span>
                        </div>
                    );
                })}
                <div
                    className="grid grid-cols-[1.5rem_minmax(0,1fr)] transition-all duration-300 ease-out"
                    style={{
                        background:
                            showDiagnosticDom && !diagnosticFading
                                ? "rgba(220, 90, 90, 0.06)"
                                : "transparent",
                        borderLeft:
                            showDiagnosticDom && !diagnosticFading
                                ? "2px solid rgba(220, 90, 90, 0.5)"
                                : "2px solid transparent",
                        marginLeft: "-2px",
                        opacity: diagnosticVisible && !diagnosticFading ? 1 : 0,
                        maxHeight: showDiagnosticDom ? "2rem" : "0",
                        overflow: "hidden",
                    }}
                >
                    <span
                        className="flex select-none items-center justify-end"
                        style={{ color: "#dc5a5a", opacity: 0.8 }}
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
                        style={{ color: "#dc5a5a" }}
                    >
                        {DIAGNOSTIC_TEXT}
                    </span>
                </div>
            </pre>
        </div>
    );
}

export default function CodeDemo() {
    const sectionRef = useRef<HTMLDivElement>(null);
    const [started, setStarted] = useState(false);
    const [phase, setPhase] = useState<Phase>("idle");
    const [leftIdx, setLeftIdx] = useState(0);
    const [idx1, setIdx1] = useState(0); // phase 1 char index
    const [idx3, setIdx3] = useState(0); // phase 3 char index (, {})
    const [idx4, setIdx4] = useState(0); // phase 4 char index (input + "co")
    const [idx6, setIdx6] = useState(0); // phase 6 char index (": {\n    u")
    const [idx8, setIdx8] = useState(0); // phase 8 char index (': "user_123"')
    const [idx9, setIdx9] = useState(0); // phase 9 char index ("\n  },")
    const [acVisible, setAcVisible] = useState<"agent" | "context" | "userId" | null>(null);
    const [opacity, setOpacity] = useState(1);

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
        setLeftIdx(0);
        setIdx1(0);
        setIdx3(0);
        setIdx4(0);
        setIdx6(0);
        setIdx8(0);
        setIdx9(0);
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
                if (leftIdx >= leftChars.length) {
                    t = queuePhase("pause-between");
                    return;
                }
                const nl = leftChars[leftIdx]?.char === "\n";
                t = setTimeout(() => setLeftIdx((i) => i + 1), nl ? NEWLINE_MS : CHAR_MS);
                break;
            }
            case "pause-between":
                t = setTimeout(() => setPhase("typing-right-1"), PANE_PAUSE_MS);
                break;

            case "typing-right-1": {
                if (idx1 >= rp1Chars.length) {
                    t = setTimeout(() => {
                        setAcVisible("agent");
                        setPhase("autocomplete-agent");
                    }, 0);
                    return;
                }
                const nl = rp1Chars[idx1]?.char === "\n";
                t = setTimeout(() => setIdx1((i) => i + 1), nl ? NEWLINE_MS : CHAR_MS);
                break;
            }

            case "autocomplete-agent":
                t = setTimeout(() => {
                    setAcVisible(null);
                    setPhase("typing-right-2");
                }, AUTOCOMPLETE_MS);
                break;

            case "typing-right-2": {
                if (idx3 >= rp3Chars.length) {
                    t = queuePhase("enter-key");
                    return;
                }
                const nl = rp3Chars[idx3]?.char === "\n";
                t = setTimeout(
                    () => setIdx3((i) => i + 1),
                    idx3 === 0 ? AUTOCOMPLETE_SETTLE_MS : nl ? NEWLINE_MS : CHAR_MS,
                );
                break;
            }

            case "enter-key":
                t = setTimeout(() => {
                    setPhase("show-error");
                }, ENTER_KEY_MS);
                break;

            case "show-error":
                t = setTimeout(() => {
                    setPhase("typing-right-3");
                }, ERROR_FADE_IN_MS + ERROR_READ_MS);
                break;

            case "typing-right-3": {
                if (idx4 >= rp4Chars.length) {
                    t = setTimeout(() => {
                        setAcVisible("context");
                        setPhase("autocomplete-context");
                    }, 0);
                    return;
                }
                const nl = rp4Chars[idx4]?.char === "\n";
                t = setTimeout(() => setIdx4((i) => i + 1), nl ? NEWLINE_MS : CHAR_MS);
                break;
            }

            case "autocomplete-context":
                t = setTimeout(() => {
                    setAcVisible(null);
                    setPhase("typing-right-4");
                }, AUTOCOMPLETE_MS);
                break;

            case "typing-right-4": {
                if (idx6 >= rp6Chars.length) {
                    t = setTimeout(() => {
                        setAcVisible("userId");
                        setPhase("autocomplete-userid");
                    }, 0);
                    return;
                }
                const nl = rp6Chars[idx6]?.char === "\n";
                t = setTimeout(
                    () => setIdx6((i) => i + 1),
                    idx6 === 0 ? AUTOCOMPLETE_SETTLE_MS : nl ? NEWLINE_MS : CHAR_MS,
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
                if (idx8 >= rp8Chars.length) {
                    t = queuePhase("error-resolve");
                    return;
                }
                const nl = rp8Chars[idx8]?.char === "\n";
                t = setTimeout(
                    () => setIdx8((i) => i + 1),
                    idx8 === 0 ? AUTOCOMPLETE_SETTLE_MS : nl ? NEWLINE_MS : CHAR_MS,
                );
                break;
            }

            case "error-resolve":
                t = setTimeout(() => {
                    setPhase("typing-right-6");
                }, ERROR_RESOLVE_MS);
                break;

            case "typing-right-6": {
                if (idx9 >= rp9Chars.length) {
                    t = queuePhase("done");
                    return;
                }
                const nl = rp9Chars[idx9]?.char === "\n";
                t = setTimeout(() => setIdx9((i) => i + 1), nl ? NEWLINE_MS : CHAR_MS);
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
    }, [started, phase, leftIdx, idx1, idx3, idx4, idx6, idx8, idx9, reset]);

    const leftLines = charsToLines(leftChars, leftIdx);

    const buildRightLines = (): {
        lines: RenderLine[];
        cursorColumn: number;
        cursorLine: number;
    } => {
        if (!isAtOrPast("autocomplete-agent")) {
            const lines = charsToLines(rp1Chars, idx1);
            return {
                lines,
                cursorLine: lines.length - 1,
                cursorColumn: lineLength(lines[lines.length - 1]),
            };
        }

        let prefix = allChars(rp1Chars);

        if (phase === "autocomplete-agent") {
            return {
                lines: prefix,
                cursorLine: prefix.length - 1,
                cursorColumn: lineLength(prefix[prefix.length - 1]),
            };
        }

        prefix = mergeRenderedLines(prefix, allChars(rp2Chars));

        if (!isAtOrPast("enter-key")) {
            const p3 = charsToLines(rp3Chars, idx3);
            const typedView = mergeRenderedLines(prefix, p3);
            let result = typedView;
            result = mergeRenderedLines(result, allChars(inlineSuffixChars));
            return {
                lines: result,
                cursorLine: result.length - 1,
                cursorColumn: lineLength(typedView[typedView.length - 1]),
            };
        }

        const openBrace = charsToLines(rp3Chars, 3);
        prefix = mergeRenderedLines(prefix, openBrace);

        let body: RenderLine[] = [];
        let cursorInBody = false;

        if (isAtOrPast("typing-right-3")) {
            const p4 = charsToLines(rp4Chars, phase === "typing-right-3" ? idx4 : rp4Chars.length);
            body = mergeRenderedLines(body, p4);
            if (phase === "typing-right-3" || phase === "autocomplete-context") {
                cursorInBody = true;
            }
        }

        if (isAtOrPast("autocomplete-context") && phase !== "autocomplete-context") {
            body = mergeRenderedLines(body, allChars(rp5Chars));
        }

        if (isAtOrPast("typing-right-4")) {
            const p6 = charsToLines(rp6Chars, phase === "typing-right-4" ? idx6 : rp6Chars.length);
            body = mergeRenderedLines(body, p6);
            if (phase === "typing-right-4" || phase === "autocomplete-userid") {
                cursorInBody = true;
            }
        }

        if (isAtOrPast("autocomplete-userid") && phase !== "autocomplete-userid") {
            body = mergeRenderedLines(body, allChars(rp7Chars));
        }

        if (isAtOrPast("typing-right-5")) {
            const p8 = charsToLines(rp8Chars, phase === "typing-right-5" ? idx8 : rp8Chars.length);
            body = mergeRenderedLines(body, p8);
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
            const p9 = charsToLines(rp9Chars, phase === "typing-right-6" ? idx9 : rp9Chars.length);
            body = mergeRenderedLines(body, p9);
            if (phase === "typing-right-6" || phase === "done") {
                cursorInBody = true;
            }
        }

        const prefixLen = prefix.length;
        if (body.length > 0) {
            prefix = mergeRenderedLines(prefix, body);
        }

        const lines = mergeRenderedLines(prefix, allChars(blockSuffixChars));

        let cursorLine: number;
        let cursorColumn: number;
        if (cursorInBody) {
            cursorLine = prefix.length - 1;
            cursorColumn = lineLength(prefix[cursorLine]);
        } else {
            cursorLine = prefixLen - 1;
            cursorColumn = lineLength(prefix[cursorLine]);
        }

        return { lines, cursorLine, cursorColumn };
    };

    const {
        lines: rightLines,
        cursorLine: rightCursorLine,
        cursorColumn: rightCursorColumn,
    } = buildRightLines();

    const diagnosticVisible = ERROR_PHASES.has(phase);
    const diagnosticFading = phase === "error-resolve";

    const autocompleteItems =
        acVisible === "agent"
            ? [{ label: '"supportAgent"', detail: "agent" }]
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
                <p className="text-[11px] font-medium tracking-[0.08em] text-[color:color-mix(in_srgb,var(--foreground)_40%,transparent)] uppercase">
                    The Best DX
                </p>
                <div className="h-px flex-1 bg-[color:color-mix(in_srgb,var(--foreground)_8%,transparent)]" />
            </div>

            <div
                className="grid gap-px transition-opacity lg:grid-cols-2"
                style={{ opacity, transitionDuration: `${FADE_MS}ms` }}
            >
                <div
                    className="flex min-h-0 flex-col overflow-hidden border border-[color:var(--showcase-shell-border)]"
                    style={{ background: "var(--showcase-code-bg)" }}
                >
                    <div
                        className="flex h-9 items-center border-b px-4"
                        style={{ borderColor: "var(--showcase-shell-border)" }}
                    >
                        <span
                            className="text-[11px] tracking-[0.02em]"
                            style={{ color: "var(--showcase-tab-idle)" }}
                        >
                            server.ts
                        </span>
                    </div>
                    <PaneContent
                        autocompleteItems={[]}
                        autocompleteVisible={false}
                        cursorColumn={undefined}
                        cursorLine={leftLines.length - 1}
                        diagnosticFading={false}
                        diagnosticVisible={false}
                        isTyping={phase === "typing-left"}
                        lines={leftLines}
                        showCursor={cursorLeft}
                        totalLineCount={leftTotalLines}
                    />
                </div>

                <div
                    className="flex min-h-0 flex-col overflow-hidden border border-[color:var(--showcase-shell-border)]"
                    style={{ background: "var(--showcase-code-bg)" }}
                >
                    <div
                        className="flex h-9 items-center border-b px-4"
                        style={{ borderColor: "var(--showcase-shell-border)" }}
                    >
                        <span
                            className="text-[11px] tracking-[0.02em]"
                            style={{ color: "var(--showcase-tab-idle)" }}
                        >
                            client.ts
                        </span>
                    </div>
                    <PaneContent
                        autocompleteItems={autocompleteItems}
                        autocompleteVisible={acVisible !== null}
                        cursorColumn={rightCursorColumn}
                        cursorLine={rightCursorLine}
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
                        lines={rightLines}
                        showCursor={cursorRight}
                        totalLineCount={rightFullLines}
                    />
                </div>
            </div>
        </section>
    );
}
