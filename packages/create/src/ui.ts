import os from "node:os";
import process from "node:process";
import { type Framework, getFramework } from "./frameworks";
import type { Plugin, Provider } from "./schema";

type HeaderOptions = {
    version: string;
    mode: string;
    directory: string;
};

type SummaryOptions = {
    name: string;
    targetDir: string;
    framework: Framework;
    providers: Provider[];
    plugins: Plugin[];
    shouldInstall: boolean;
    packageManager: string;
    devCommand: string;
};

const COLOR_ENABLED = Boolean(process.stdout.isTTY);
const HEADER_WIDTH = Math.max(56, Math.min(process.stdout.columns || 80, 64));
// biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI escape sequence matcher
const ANSI_PATTERN = /\x1b\[[0-9;]*m/g;

const paint =
    (open: string, close = "\u001b[0m") =>
    (value: string) =>
        COLOR_ENABLED ? `${open}${value}${close}` : value;

const accent = paint("\u001b[38;5;215m");
const muted = paint("\u001b[38;5;244m");
const subtle = paint("\u001b[38;5;252m");
const success = paint("\u001b[38;5;114m");
const dim = paint("\u001b[2m");
const bold = paint("\u001b[1m");

const visibleLength = (value: string) => value.replace(ANSI_PATTERN, "").length;

const padRight = (value: string, width: number) =>
    visibleLength(value) >= width ? value : `${value}${" ".repeat(width - visibleLength(value))}`;

const truncateRight = (value: string, width: number) =>
    visibleLength(value) <= width ? value : `${value.slice(0, Math.max(0, width - 1))}…`;

const formatDisplayPath = (value: string, width: number) => {
    const homeDirectory = os.homedir();
    const normalizedValue =
        value === homeDirectory || value.startsWith(`${homeDirectory}/`)
            ? value.replace(homeDirectory, "~")
            : value;

    if (visibleLength(normalizedValue) <= width) {
        return normalizedValue;
    }

    const segments = normalizedValue.split("/");
    if (segments.length <= 3) {
        return truncateRight(normalizedValue, width);
    }

    const head = segments[0] === "" ? "/" : segments[0];
    const tail = segments.at(-1) ?? "";
    const parent = segments.at(-2);
    const withParent = parent ? `${head}/.../${parent}/${tail}` : `${head}/.../${tail}`;
    if (visibleLength(withParent) <= width) {
        return withParent;
    }

    const shortened = `${head}/.../${tail}`;
    if (visibleLength(shortened) <= width) {
        return shortened;
    }

    return truncateRight(normalizedValue, width);
};

const printLine = (message = "") => {
    process.stdout.write(`${message}\n`);
};

const frameLine = (content = "") => `│ ${padRight(content, HEADER_WIDTH - 4)} │`;

export const renderHeader = ({ version, mode, directory }: HeaderOptions) => {
    const innerWidth = HEADER_WIDTH - 4;
    const modeWidth = 20;
    const directoryWidth = Math.max(0, innerWidth - modeWidth - 2);
    const titleRow = `${muted(">_")} ${dim(muted("BETTER-AGENT."))} ${muted(`(v${version})`)}`;
    const metaRow = `${muted("mode:")} ${subtle(mode)}`;
    const directoryLabel = `${muted("directory:")} ${subtle(
        formatDisplayPath(
            directory,
            Math.max(0, directoryWidth - visibleLength("directory: ") - 1),
        ),
    )}`;

    printLine();
    printLine(muted(`┌${"─".repeat(HEADER_WIDTH - 2)}┐`));
    printLine(frameLine(titleRow));
    printLine(frameLine());
    printLine(frameLine(`${padRight(metaRow, modeWidth)}  ${directoryLabel}`));
    printLine(muted(`└${"─".repeat(HEADER_WIDTH - 2)}┘`));
    printLine();
};

const summaryRow = (label: string, value: string) =>
    `${accent("›")} ${muted(label.padEnd(10, " "))} ${subtle(value)}`;

export const renderSummary = ({
    name,
    targetDir,
    framework,
    providers,
    plugins,
    shouldInstall,
    packageManager,
    devCommand,
}: SummaryOptions) => {
    const frameworkConfig = getFramework(framework);
    const lines = [
        `${success("■")} ${bold(success(`Created ${name}`))}`,
        "",
        summaryRow("Framework", framework),
        summaryRow("Providers", providers.join(", ")),
        summaryRow("Plugins", plugins.length > 0 ? plugins.join(", ") : "none"),
        summaryRow("Location", targetDir),
        ...(plugins.includes("sandbox")
            ? [
                  "",
                  `${accent("!")} ${muted("Sandbox")} ${dim(
                      `included as a commented E2B example in ${frameworkConfig.serverFile}`,
                  )}`,
              ]
            : []),
        "",
        `${accent("›")} ${bold(subtle("Next steps"))}`,
        `${muted("  1.")} ${subtle(`cd ${name}`)}`,
        `${muted("  2.")} ${subtle(
            shouldInstall ? devCommand : `${packageManager} install && ${devCommand}`,
        )}`,
    ];

    return lines.join("\n");
};
