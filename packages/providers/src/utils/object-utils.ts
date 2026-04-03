export const omitNullish = <T extends Record<string, unknown>>(input: T): Partial<T> => {
    const out: Partial<T> = {};

    for (const key in input) {
        const typedKey = key as keyof T;
        const value = input[typedKey];

        if (value != null) {
            out[typedKey] = value;
        }
    }

    return out;
};

/**
 * Extracts keys from `options` that are not in the `knownKeys` set.
 */
export const extractPassthroughOptions = (
    options: Record<string, unknown>,
    knownKeys: ReadonlySet<string>,
): Record<string, unknown> => {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(options)) {
        if (!knownKeys.has(key)) {
            const value = options[key];
            if (value !== undefined) {
                out[key] = value;
            }
        }
    }
    return out;
};
