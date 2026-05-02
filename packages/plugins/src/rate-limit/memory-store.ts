import type { RateLimitBucket, RateLimitConfig, RateLimitStorageState } from "./types";

type MemoryRateLimitRow = RateLimitStorageState & {
    windowEndMs: number;
};

/** Creates an in-memory CAS store for rate limiting. */
export function createMemoryStore(): NonNullable<RateLimitConfig["storage"]> {
    const rows = new Map<string, MemoryRateLimitRow>();

    const pruneExpiredRows = (bucket: RateLimitBucket) => {
        const nowMs = bucket.now.getTime();
        for (const [id, row] of rows) {
            if (row.windowEndMs <= nowMs) {
                rows.delete(id);
            }
        }
    };

    const toStoredRow = (bucket: RateLimitBucket, state: RateLimitStorageState) => ({
        ...state,
        windowEndMs: bucket.windowEnd.getTime(),
    });

    return {
        read: async ({ bucket }) => {
            pruneExpiredRows(bucket);
            return rows.get(bucket.id) ?? null;
        },
        write: async ({ bucket, prevVersion, next }) => {
            pruneExpiredRows(bucket);
            const current = rows.get(bucket.id) ?? null;
            if (prevVersion === null) {
                if (current) return false;
                rows.set(bucket.id, toStoredRow(bucket, next));
                return true;
            }

            if (!current || current.version !== prevVersion) {
                return false;
            }

            rows.set(bucket.id, toStoredRow(bucket, next));
            return true;
        },
    };
}
