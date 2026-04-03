import process from "node:process";
import { Box, Text, render, useApp, useInput } from "ink";
import type React from "react";
import { useMemo, useState } from "react";

const CANCEL = Symbol("better-agent-cancel");

type ChoiceOption<T extends string> = {
    label: string;
    value: T;
    hint?: string;
};

type SelectOptions<T extends string> = {
    title?: string;
    message?: string;
    options: ChoiceOption<T>[];
    initialValue?: T;
};

type MultiSelectOptions<T extends string> = {
    title?: string;
    message?: string;
    options: ChoiceOption<T>[];
    required?: boolean;
};

type ConfirmOptions = {
    title?: string;
    message?: string;
    initialValue?: boolean;
};

type TextOptions = {
    title?: string;
    message?: string;
    placeholder?: string;
    validate?: (value: string) => string | undefined;
};

type IntroOptions = {
    version: string;
    mode: string;
    directory: string;
};

type PromptFrameProps = {
    title: string;
    help: string;
    children?: React.ReactNode;
    error?: string | null;
    showHelp?: boolean;
};

type InputKey = {
    ctrl: boolean;
    meta: boolean;
    escape: boolean;
    leftArrow: boolean;
    rightArrow: boolean;
    upArrow: boolean;
    downArrow: boolean;
    return: boolean;
    backspace: boolean;
    delete: boolean;
};

let interactivePromptsEnabled = false;
const FRAME_WIDTH = Math.max(64, Math.min(process.stdout.columns || 80, 92));
let promptCount = 0;
let hasRenderedSection = false;
const ACCENT = "#F2994A";
const MUTED = "#7B8190";
const SUBTLE = "#E8E1D6";
const ERROR = "#E29A9A";

const ensureInteractivePrompting = () => {
    if (!interactivePromptsEnabled || !process.stdin.isTTY || !process.stdout.isTTY) {
        throw new Error("Interactive prompts require a TTY. Re-run with flags or use --yes.");
    }
};

const printLine = (message = "") => {
    process.stdout.write(`${message}\n`);
};

const COLOR_ENABLED = Boolean(process.stdout.isTTY);
const paint =
    (open: string, close = "\u001b[0m") =>
    (value: string) =>
        COLOR_ENABLED ? `${open}${value}${close}` : value;

const accentText = paint("\u001b[38;5;215m");
const mutedText = paint("\u001b[38;5;244m");
const subtleText = paint("\u001b[38;5;252m");
const successText = paint("\u001b[38;5;114m");
const errorText = paint("\u001b[38;5;174m");
const dimText = paint("\u001b[2m");
const boldText = paint("\u001b[1m");
// biome-ignore lint/suspicious/noControlCharactersInRegex:
const ANSI_PATTERN = /\u001b\[[0-9;]*m/g;

const nextPromptCount = () => {
    promptCount += 1;
    return promptCount;
};

const Accent = ({ children }: { children?: React.ReactNode }) => (
    <Text color={ACCENT}>{children}</Text>
);

const Muted = ({ children }: { children?: React.ReactNode }) => (
    <Text color={MUTED}>{children}</Text>
);

const Subtle = ({ children, bold = false }: { children?: React.ReactNode; bold?: boolean }) => (
    <Text color={SUBTLE} bold={bold}>
        {children}
    </Text>
);

const PromptFrame = ({ title, help, children, error, showHelp = true }: PromptFrameProps) => (
    <Box flexDirection="column" width={FRAME_WIDTH} marginBottom={1}>
        <Box>
            <Muted>{title}</Muted>
        </Box>
        <Box paddingLeft={2} flexDirection="column">
            {children}
        </Box>
        {error ? (
            <Box paddingLeft={2}>
                <Text color={ERROR}>!</Text>
                <Text> </Text>
                <Text>{error}</Text>
            </Box>
        ) : null}
        {showHelp ? (
            <Box marginTop={1}>
                <Muted>{help}</Muted>
            </Box>
        ) : null}
    </Box>
);

const finalizePrompt =
    <T,>(setFinalized: (value: boolean) => void, onSubmit: (value: T) => void) =>
    (value: T) => {
        setFinalized(true);
        setTimeout(() => onSubmit(value), 0);
    };

const Glyph = ({ active, value }: { active: boolean; value: string }) =>
    active ? <Accent>{value}</Accent> : <Muted>{value}</Muted>;

const shouldRenderMessage = (title: string | undefined, message: string | undefined) =>
    Boolean(message && message.trim().length > 0 && message.trim() !== (title ?? "").trim());

const SelectPrompt = <T extends string>({
    title,
    message,
    options,
    initialValue,
    onSubmit,
    onCancel,
}: SelectOptions<T> & { onSubmit: (value: T) => void; onCancel: () => void }) => {
    const promptIndex = useMemo(() => nextPromptCount(), []);
    const initialIndex = Math.max(
        0,
        initialValue ? options.findIndex((option) => option.value === initialValue) : 0,
    );
    const [index, setIndex] = useState(initialIndex);
    const [finalized, setFinalized] = useState(false);
    const submit = useMemo(() => finalizePrompt(setFinalized, onSubmit), [onSubmit]);
    const showMessage = shouldRenderMessage(title, message);

    useInput((input: string, key: InputKey) => {
        if (key.ctrl && input === "c") {
            onCancel();
            return;
        }
        if (key.escape) {
            onCancel();
            return;
        }
        if (key.upArrow) {
            setIndex((current: number) => (current === 0 ? options.length - 1 : current - 1));
            return;
        }
        if (key.downArrow) {
            setIndex((current: number) => (current === options.length - 1 ? 0 : current + 1));
            return;
        }
        if (key.return) {
            const option = options[index];
            if (option) {
                submit(option.value);
            }
        }
    });

    return (
        <PromptFrame
            title={`${promptIndex}. ${title ?? "Choose"}`}
            help="up/down move  enter confirm  esc cancel"
            showHelp={!finalized}
        >
            {showMessage ? (
                <Box>
                    <Muted>›</Muted>
                    <Text> </Text>
                    <Text bold>{message}</Text>
                </Box>
            ) : null}
            {options.map((option, optionIndex) => {
                const selected = optionIndex === index;
                return (
                    <Box key={option.value}>
                        <Glyph active={selected} value={selected ? "›" : " "} />
                        <Text> </Text>
                        {selected ? (
                            <Accent>{option.label}</Accent>
                        ) : (
                            <Subtle>{option.label}</Subtle>
                        )}
                        {option.hint ? (
                            <>
                                <Text> </Text>
                                <Muted>{`// ${option.hint}`}</Muted>
                            </>
                        ) : null}
                    </Box>
                );
            })}
        </PromptFrame>
    );
};

const MultiSelectPrompt = <T extends string>({
    title,
    message,
    options,
    required,
    onSubmit,
    onCancel,
}: MultiSelectOptions<T> & { onSubmit: (value: T[]) => void; onCancel: () => void }) => {
    const promptIndex = useMemo(() => nextPromptCount(), []);
    const [index, setIndex] = useState(0);
    const [selected, setSelected] = useState<Set<T>>(new Set());
    const [error, setError] = useState<string | null>(null);
    const [finalized, setFinalized] = useState(false);
    const submit = useMemo(() => finalizePrompt(setFinalized, onSubmit), [onSubmit]);
    const showMessage = shouldRenderMessage(title, message);

    const values = useMemo(() => [...selected], [selected]);

    useInput((input: string, key: InputKey) => {
        if (key.ctrl && input === "c") {
            onCancel();
            return;
        }
        if (key.escape) {
            onCancel();
            return;
        }
        if (key.upArrow) {
            setIndex((current: number) => (current === 0 ? options.length - 1 : current - 1));
            return;
        }
        if (key.downArrow) {
            setIndex((current: number) => (current === options.length - 1 ? 0 : current + 1));
            return;
        }
        if (key.return) {
            if (required && values.length === 0) {
                setError("Select at least one option.");
                return;
            }
            submit(values);
            return;
        }
        if (input === " ") {
            const option = options[index];
            if (!option) {
                return;
            }
            setSelected((current: Set<T>) => {
                const next = new Set(current);
                if (next.has(option.value)) {
                    next.delete(option.value);
                } else {
                    next.add(option.value);
                }
                return next;
            });
            setError(null);
        }
    });

    return (
        <PromptFrame
            title={`${promptIndex}. ${title ?? "Choose"}`}
            help="up/down move  space toggle  enter confirm  esc cancel"
            error={error}
            showHelp={!finalized}
        >
            {showMessage ? (
                <Box>
                    <Muted>›</Muted>
                    <Text> </Text>
                    <Text bold>{message}</Text>
                </Box>
            ) : null}
            {options.map((option, optionIndex) => {
                const active = optionIndex === index;
                const checked = selected.has(option.value);
                const emphasized = finalized ? checked : active;
                return (
                    <Box key={option.value}>
                        <Glyph active={emphasized} value={emphasized ? "›" : " "} />
                        <Text> </Text>
                        <Glyph active={checked} value={`[${checked ? "x" : " "}]`} />
                        <Text> </Text>
                        {emphasized ? (
                            <Accent>{option.label}</Accent>
                        ) : (
                            <Subtle>{option.label}</Subtle>
                        )}
                        {option.hint ? (
                            <>
                                <Text> </Text>
                                <Muted>{`// ${option.hint}`}</Muted>
                            </>
                        ) : null}
                    </Box>
                );
            })}
        </PromptFrame>
    );
};

const TextPrompt = ({
    title,
    message,
    placeholder,
    validate,
    onSubmit,
    onCancel,
}: TextOptions & { onSubmit: (value: string) => void; onCancel: () => void }) => {
    const promptIndex = useMemo(() => nextPromptCount(), []);
    const [value, setValue] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [finalized, setFinalized] = useState(false);
    const submit = useMemo(() => finalizePrompt(setFinalized, onSubmit), [onSubmit]);
    const showMessage = shouldRenderMessage(title, message);

    useInput((input: string, key: InputKey) => {
        if (key.ctrl && input === "c") {
            onCancel();
            return;
        }
        if (key.escape) {
            onCancel();
            return;
        }
        if (key.return) {
            const next = value.trimEnd();
            const validationError = validate?.(next);
            if (validationError) {
                setError(validationError);
                return;
            }
            submit(next);
            return;
        }
        if (key.backspace || key.delete) {
            setValue((current: string) => current.slice(0, -1));
            setError(null);
            return;
        }
        if (!key.ctrl && !key.meta && input) {
            setValue((current: string) => current + input);
            setError(null);
        }
    });

    return (
        <PromptFrame
            title={`${promptIndex}. ${title ?? "Input"}`}
            help="type value  enter confirm  esc cancel"
            error={error}
            showHelp={!finalized}
        >
            <Text>
                <Muted>›</Muted>
                <Text> </Text>
                {showMessage ? (
                    <>
                        <Text bold>{message}</Text>
                        <Text> </Text>
                    </>
                ) : null}
                {value.length > 0 ? value : <Muted>{placeholder ?? ""}</Muted>}
                {!finalized ? <Text inverse> </Text> : null}
            </Text>
        </PromptFrame>
    );
};

const ConfirmPrompt = ({
    title,
    message,
    initialValue = true,
    onSubmit,
    onCancel,
}: ConfirmOptions & { onSubmit: (value: boolean) => void; onCancel: () => void }) => {
    const promptIndex = useMemo(() => nextPromptCount(), []);
    const [value, setValue] = useState<"yes" | "no">(initialValue ? "yes" : "no");
    const [finalized, setFinalized] = useState(false);
    const submit = useMemo(() => finalizePrompt(setFinalized, onSubmit), [onSubmit]);
    const showMessage = shouldRenderMessage(title, message);

    useInput((input: string, key: InputKey) => {
        if (key.ctrl && input === "c") {
            onCancel();
            return;
        }
        if (key.escape) {
            onCancel();
            return;
        }
        if (
            key.leftArrow ||
            key.rightArrow ||
            input === "y" ||
            input === "Y" ||
            input === "n" ||
            input === "N"
        ) {
            if (input === "y" || input === "Y") {
                setValue("yes");
                submit(true);
                return;
            }
            if (input === "n" || input === "N") {
                setValue("no");
                submit(false);
                return;
            }
            setValue((current) => (current === "yes" ? "no" : "yes"));
            return;
        }
        if (key.return) {
            submit(value === "yes");
        }
    });

    return (
        <PromptFrame
            title={`${promptIndex}. ${title ?? "Confirm"}`}
            help="y/n switch  enter confirm  esc cancel"
            showHelp={!finalized}
        >
            <Text>
                {message ? (
                    showMessage ? (
                        <>
                            <Muted>›</Muted>
                            <Text> </Text>
                            <Text bold>{message}</Text>
                            <Text> </Text>
                        </>
                    ) : null
                ) : null}
                <Subtle bold>{value === "yes" ? "Yes" : "No"}</Subtle>
                <Text> </Text>
                <Muted>{value === "yes" ? "(Y/n)" : "(y/N)"}</Muted>
            </Text>
        </PromptFrame>
    );
};

const InkPrompt = ({
    children,
    onCancel,
}: {
    children?: React.ReactNode;
    onCancel: () => void;
}) => {
    const app = useApp();

    const close = () => {
        app.exit();
        onCancel();
    };

    useInput((input: string, key: InputKey) => {
        if (key.ctrl && input === "c") {
            close();
        }
    });

    return <>{children}</>;
};

const runInkPrompt = <T,>(
    element: (resolve: (value: T | symbol) => void) => React.ReactElement,
) => {
    ensureInteractivePrompting();

    return new Promise<T | symbol>((resolve) => {
        let settled = false;
        const app = { current: undefined as ReturnType<typeof render> | undefined };

        const settle = (value: T | symbol) => {
            if (settled) return;
            settled = true;
            app.current?.unmount();
            resolve(value);
        };

        app.current = render(
            <InkPrompt onCancel={() => settle(CANCEL)}>{element(settle)}</InkPrompt>,
        );
    });
};

export const enableInteractivePrompts = () => {
    interactivePromptsEnabled = true;
};

export const isCancel = (value: unknown): value is symbol => value === CANCEL;

export const format = {
    accent: accentText,
    muted: mutedText,
    subtle: subtleText,
    success: successText,
    error: errorText,
    dim: dimText,
    bold: boldText,
};

export const cancel = (message: string) => {
    printLine(`${mutedText("[cancelled]")} ${message}`);
};

const HEADER_WIDTH = Math.max(56, Math.min(process.stdout.columns || 80, 64));

const visibleLength = (value: string) => value.replace(ANSI_PATTERN, "").length;

const padRight = (value: string, width: number) =>
    visibleLength(value) >= width ? value : `${value}${" ".repeat(width - visibleLength(value))}`;

const truncateRight = (value: string, width: number) =>
    visibleLength(value) <= width ? value : `${value.slice(0, Math.max(0, width - 1))}…`;

const shortenPath = (value: string, width: number) => {
    if (visibleLength(value) <= width) {
        return value;
    }

    const segments = value.split("/");
    if (segments.length <= 3) {
        return truncateRight(value, width);
    }

    const shortened = `${segments[0] ?? ""}/.../${segments.at(-1) ?? ""}`;
    return visibleLength(shortened) <= width ? shortened : truncateRight(value, width);
};

export const shortenDisplayPath = (value: string, width = 44) => shortenPath(value, width);

const frameLine = (content = "") => `│ ${padRight(content, HEADER_WIDTH - 4)} │`;

const renderHeaderLines = ({ version, mode, directory }: IntroOptions) => {
    const innerWidth = HEADER_WIDTH - 4;
    const modeWidth = 20;
    const directoryWidth = Math.max(0, innerWidth - modeWidth - 2);
    const titleRow = `${mutedText(">_")} ${subtleText("BETTER-AGENT.")} ${mutedText(`(v${version})`)}`;
    const metaRow = `${mutedText("mode:")} ${subtleText(mode)}`;
    const combinedMetaRow = `${padRight(metaRow, modeWidth)}  ${mutedText("directory:")} ${subtleText(shortenPath(directory, Math.max(0, directoryWidth - visibleLength("directory: ") - 1)))}`;

    return [
        "",
        `┌${"─".repeat(HEADER_WIDTH - 2)}┐`,
        frameLine(titleRow),
        frameLine(),
        frameLine(combinedMetaRow),
        `└${"─".repeat(HEADER_WIDTH - 2)}┘`,
    ];
};

export const intro = ({ version, mode, directory }: IntroOptions) => {
    promptCount = 0;
    hasRenderedSection = false;
    for (const line of renderHeaderLines({ version, mode, directory })) {
        printLine(line);
    }
    printLine();
};

export const outro = (message: string) => {
    printLine();
    printLine(message === "Done." ? successText("All set 🎉") : message);
};

export const confirm = async ({ message, initialValue = true }: ConfirmOptions) => {
    const result = await runInkPrompt<boolean>((resolve) => (
        <ConfirmPrompt
            message={message}
            initialValue={initialValue}
            onSubmit={(value) => resolve(value)}
            onCancel={() => resolve(CANCEL)}
        />
    ));
    return result;
};

export const select = <T extends string>(options: SelectOptions<T>) =>
    runInkPrompt<T>((resolve) => (
        <SelectPrompt
            {...options}
            onSubmit={(value) => resolve(value)}
            onCancel={() => resolve(CANCEL)}
        />
    ));

export const multiselect = <T extends string>(options: MultiSelectOptions<T>) =>
    runInkPrompt<T[]>((resolve) => (
        <MultiSelectPrompt
            {...options}
            onSubmit={(value) => resolve(value)}
            onCancel={() => resolve(CANCEL)}
        />
    ));

export const text = (options: TextOptions) =>
    runInkPrompt<string>((resolve) => (
        <TextPrompt
            {...options}
            onSubmit={(value) => resolve(value)}
            onCancel={() => resolve(CANCEL)}
        />
    ));

export const log = {
    error(message: string) {
        printLine(`${errorText("[error]")} ${message}`);
    },
    success(message: string) {
        printLine(successText(message));
    },
    message(message: string) {
        printLine(message);
    },
    step(message: string) {
        if (hasRenderedSection) {
            printLine();
        }
        hasRenderedSection = true;
        printLine(`${accentText("■")} ${boldText(message)}`);
    },
};
