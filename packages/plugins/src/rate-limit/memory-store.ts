import type { RateLimitPluginConfig, RateLimitStorageState } from "./types";

/** Creates an in-memory CAS store for rate limiting. */
export function createMemoryStore(): NonNullable<RateLimitPluginConfig["storage"]> {
    const rows = new Map<string, RateLimitStorageState>();

    return {
        read: async ({ bucket }) => rows.get(bucket.id) ?? null,
        write: async ({ bucket, prevVersion, next }) => {
            const current = rows.get(bucket.id) ?? null;
            if (prevVersion === null) {
                if (current) return false;
                rows.set(bucket.id, next);
                return true;
            }

            if (!current || current.version !== prevVersion) {
                return false;
            }

            rows.set(bucket.id, next);
            return true;
        },
    };
}
