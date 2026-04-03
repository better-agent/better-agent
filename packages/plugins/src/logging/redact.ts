const DEFAULT_REDACT_HEADERS = ["authorization", "cookie", "set-cookie", "x-api-key"] as const;

/** Redacts sensitive headers. */
export function redactHeaders(
    headers: Headers,
    extraHeaders?: readonly string[],
): Record<string, string> {
    const redactSet = new Set(
        [...DEFAULT_REDACT_HEADERS, ...(extraHeaders ?? [])].map((value) => value.toLowerCase()),
    );
    const result: Record<string, string> = {};

    headers.forEach((value, key) => {
        result[key] = redactSet.has(key.toLowerCase()) ? "[REDACTED]" : value;
    });

    return result;
}
