import type { PluginGuardMode } from "@better-agent/core";

/** One rate-limit window bucket. */
export type RateLimitBucket = {
    /** Stable bucket id. */
    id: string;
    /** Rate-limit key. */
    key: string;
    /** Window start time. */
    windowStart: Date;
    /** Window end time. */
    windowEnd: Date;
    /** Current request time. */
    now: Date;
};

/** Request data passed to rate-limit callbacks. */
export type RateLimitRequestContext = {
    /** Guard mode. */
    mode: PluginGuardMode;
    /** Agent name. */
    agentName: string;
    /** Incoming request. */
    request: Request;
};

/** Stored rate-limit row. */
export type RateLimitStorageState = { count: number; version: number };

/** Configuration for `rateLimitPlugin`. */
export type RateLimitPluginConfig = {
    /** Plugin id. */
    id?: string;
    /** Rate-limit window in milliseconds. */
    windowMs: number;
    /** Max requests per window. */
    max: number;
    /** Resolves the rate-limit key. */
    key?: (ctx: RateLimitRequestContext) => string | Promise<string>;
    /** Storage backend. */
    storage?: {
        /** Reads the current bucket state. */
        read: (params: {
            /** Rate-limit bucket. */
            bucket: RateLimitBucket;
            /** Request context. */
            request: RateLimitRequestContext;
        }) => Promise<RateLimitStorageState | null>;
        /** Writes the next bucket state with CAS semantics. */
        write: (params: {
            /** Rate-limit bucket. */
            bucket: RateLimitBucket;
            /** Request context. */
            request: RateLimitRequestContext;
            /** Previous version or `null` for first write. */
            prevVersion: number | null;
            /** Next state. */
            next: RateLimitStorageState;
        }) => Promise<boolean>;
    };
    /** Handles storage failures. */
    onStoreError?: (params: {
        /** Thrown storage error. */
        error: unknown;
        /** Rate-limit bucket. */
        bucket: RateLimitBucket;
        /** Request context. */
        request: RateLimitRequestContext;
    }) => "allow" | "deny" | Response | Promise<"allow" | "deny" | Response>;
    /** Max CAS retries before failing. */
    casRetries?: number;
};
