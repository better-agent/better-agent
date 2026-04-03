import type { LogEntry, LoggingPluginConfig } from "./types";

const order: Record<LogEntry["level"], number> = {
    debug: 10,
    info: 20,
    warn: 30,
    error: 40,
};

/** Returns true when the entry should be logged at the current level. */
export function shouldLog(
    currentLevel: NonNullable<LoggingPluginConfig["level"]>,
    entry: LogEntry,
): boolean {
    return order[entry.level] >= order[currentLevel];
}
