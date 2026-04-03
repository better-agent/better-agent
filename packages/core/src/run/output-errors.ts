import type { Awaitable } from "../internal/types";

/**
 * Default handling mode for structured output finalization failures.
 */
export type OutputErrorMode = "repair" | "throw";

/**
 * Shared context for structured output finalization failures.
 */
export interface OutputErrorBase {
    error: unknown;
}

/**
 * The model did not return any non-empty text to parse as structured output.
 */
export interface MissingTextOutputError extends OutputErrorBase {
    errorKind: "missing_text";
}

/**
 * The model returned text, but it could not be parsed as valid JSON.
 */
export interface ParseOutputError extends OutputErrorBase {
    errorKind: "parse";
    text: string;
}

/**
 * The model returned valid JSON text, but the parsed value failed schema validation.
 */
export interface ValidationOutputError extends OutputErrorBase {
    errorKind: "validation";
    text: string;
    value: unknown;
}

/**
 * Union of all recoverable structured output finalization failures.
 */
export type OutputErrorContext = MissingTextOutputError | ParseOutputError | ValidationOutputError;

/**
 * Skips custom recovery and uses the runtime default behavior.
 */
export interface SkipOutputAction {
    action: "skip";
}

/**
 * Re-throws the original structured output finalization error.
 */
export interface ThrowOutputAction {
    action: "throw";
}

/**
 * Provides replacement JSON text to parse and validate again.
 */
export interface RepairTextOutputAction {
    action: "repair_text";
    text: string;
}

/**
 * Provides a replacement parsed value to validate directly.
 */
export interface RepairValueOutputAction {
    action: "repair_value";
    value: unknown;
}

/**
 * Actions that can be returned from {@link OnOutputError}.
 */
export type OutputErrorResult =
    | SkipOutputAction
    | ThrowOutputAction
    | RepairTextOutputAction
    | RepairValueOutputAction
    | undefined;

/**
 * Hook for customizing structured output finalization failures.
 */
export type OnOutputError = (context: OutputErrorContext) => Awaitable<OutputErrorResult>;
