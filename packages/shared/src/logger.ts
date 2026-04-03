export type LogLevel = "debug" | "info" | "success" | "warn" | "error";

export type LogMethod = (message?: unknown, ...args: unknown[]) => void;

export type InternalLogger = {
    [K in LogLevel]: LogMethod;
};

declare const process:
    | {
          env?: Record<string, string | undefined>;
          stdout?: { isTTY?: boolean };
      }
    | undefined;

const levels: readonly LogLevel[] = ["debug", "info", "success", "warn", "error"];

const colors = {
    reset: "\x1b[0m",
    dim: "\x1b[2m",
    bright: "\x1b[1m",
    blue: "\x1b[34m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    red: "\x1b[31m",
    magenta: "\x1b[35m",
};

const levelColors: Record<LogLevel, string> = {
    debug: colors.magenta,
    info: colors.blue,
    success: colors.green,
    warn: colors.yellow,
    error: colors.red,
};

function shouldPublishLog(currentLogLevel: LogLevel, logLevel: LogLevel): boolean {
    const currentIndex = levels.indexOf(currentLogLevel);
    const incomingIndex = levels.indexOf(logLevel);
    return incomingIndex >= currentIndex;
}

function canUseColors(): boolean {
    if (typeof process === "undefined") return false;
    if (process.env?.NO_COLOR) return false;
    if (process.env?.FORCE_COLOR) return true;
    return Boolean(process.stdout?.isTTY);
}

function serializeMessage(message: unknown): string {
    if (message instanceof Error) {
        return message.stack || message.message;
    }
    if (typeof message === "string") {
        return message;
    }
    try {
        return JSON.stringify(message, null, 2);
    } catch {
        return String(message);
    }
}

function formatMessage(level: LogLevel, message: unknown): string {
    const timestamp = new Date().toISOString();
    const text = serializeMessage(message);

    if (canUseColors()) {
        const color = levelColors[level];
        const levelUpper = level.toUpperCase();
        return `${colors.dim}${timestamp}${colors.reset} ${color}${levelUpper}${colors.reset} ${colors.bright}[Better Agent]:${colors.reset} ${text}`;
    }

    return `${timestamp} ${level.toUpperCase()} [Better-Agent]: ${text}`;
}

class LoggerImpl implements InternalLogger {
    private readonly logLevel: LogLevel = "info";

    private log(level: LogLevel, message?: unknown, ...args: unknown[]) {
        if (!shouldPublishLog(this.logLevel, level)) {
            return;
        }

        console.log(formatMessage(level, message), ...args);
    }

    debug: LogMethod = (message, ...args) => this.log("debug", message, ...args);
    info: LogMethod = (message, ...args) => this.log("info", message, ...args);
    success: LogMethod = (message, ...args) => this.log("success", message, ...args);
    warn: LogMethod = (message, ...args) => this.log("warn", message, ...args);
    error: LogMethod = (message, ...args) => this.log("error", message, ...args);
}

export const logger: InternalLogger = new LoggerImpl();
