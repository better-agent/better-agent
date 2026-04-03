import { BetterAgentError } from "@better-agent/shared/errors";

/** Creates a plugin validation error. */
export function createValidationError(message: string, at: string): BetterAgentError {
    return BetterAgentError.fromCode("VALIDATION_FAILED", message, {
        trace: [{ at }],
    });
}

/** Requires a positive finite number. */
export function requirePositiveNumber(value: number, name: string, at: string): void {
    if (!Number.isFinite(value) || value <= 0) {
        throw createValidationError(`\`${name}\` must be a positive number.`, at);
    }
}

/** Requires a non-empty array. */
export function requireNonEmptyArray<T>(
    value: readonly T[] | undefined,
    name: string,
    at: string,
): asserts value is readonly T[] {
    if (!value || value.length === 0) {
        throw createValidationError(`\`${name}\` must contain at least one value.`, at);
    }
}
