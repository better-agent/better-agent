import type { RateLimitBucket } from "./types";

/** Creates a rate-limit bucket for the current window. */
export function createBucket(params: {
    key: string;
    now: Date;
    windowMs: number;
}): RateLimitBucket {
    const nowMs = params.now.getTime();
    const windowStartMs = Math.floor(nowMs / params.windowMs) * params.windowMs;

    return {
        id: `${windowStartMs}:${params.key}`,
        key: params.key,
        now: params.now,
        windowStart: new Date(windowStartMs),
        windowEnd: new Date(windowStartMs + params.windowMs),
    };
}
