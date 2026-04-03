import { BetterAgentError } from "@better-agent/shared/errors";
import { jsonResponse } from "../shared/json";
import type { RateLimitBucket } from "./types";

/** Creates the default rate-limited response. */
export function createRateLimitedResponse(params: {
    bucket: RateLimitBucket;
    nowMs: number;
    key: string;
    max: number;
}): Response {
    const retryAfter = Math.max(
        1,
        Math.ceil((params.bucket.windowEnd.getTime() - params.nowMs) / 1000),
    );

    return jsonResponse(
        {
            error: "rate_limited",
            message: "Too many requests.",
            key: params.key,
            limit: params.max,
            remaining: 0,
            resetAt: params.bucket.windowEnd.toISOString(),
        },
        {
            status: 429,
            headers: {
                "retry-after": String(retryAfter),
                "x-ratelimit-limit": String(params.max),
                "x-ratelimit-remaining": "0",
                "x-ratelimit-reset": String(Math.floor(params.bucket.windowEnd.getTime() / 1000)),
            },
        },
    );
}

/** Creates the default storage unavailable response. */
export function createRateLimitStorageUnavailableResponse(): Response {
    return jsonResponse(
        {
            error: "service_unavailable",
            message: "Rate limit storage is unavailable.",
        },
        { status: 503 },
    );
}

/** Creates the CAS retries exceeded error. */
export function createCasRetriesExceededError(): BetterAgentError {
    return BetterAgentError.fromCode("INTERNAL", "Rate limit write failed after CAS retries.", {
        trace: [{ at: "plugins.rateLimitPlugin" }],
    });
}
