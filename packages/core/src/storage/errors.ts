import { BetterAgentError } from "@better-agent/shared/errors";

export function unsupportedStorageTableError(
    table: string,
    adapterName?: string,
): BetterAgentError {
    const owner = adapterName ? ` by ${adapterName}` : "";

    return BetterAgentError.fromCode(
        "VALIDATION_FAILED",
        `Storage table '${table}' is not supported${owner}.`,
        {
            context: {
                table,
                ...(adapterName ? { adapterName } : {}),
            },
        },
    );
}

export function throwUnsupportedStorageTable(table: string, adapterName?: string): never {
    throw unsupportedStorageTableError(table, adapterName);
}

export function isUnsupportedStorageTableError(error: unknown): error is BetterAgentError {
    return (
        error instanceof BetterAgentError &&
        error.code === "VALIDATION_FAILED" &&
        error.context !== undefined &&
        typeof error.context === "object" &&
        error.context !== null &&
        "table" in error.context
    );
}
