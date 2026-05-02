import type { Plugin } from "@better-agent/core";
import { createBucket } from "./bucket";
import { createMemoryStore } from "./memory-store";
import {
    createCasRetriesExceededError,
    createRateLimitStorageUnavailableResponse,
    createRateLimitedResponse,
} from "./responses";
import type { RateLimitConfig, RateLimitStorageState } from "./types";
import { validateRateLimitConfig } from "./validate";

/**
 * Creates a rate-limit plugin.
 *
 * Uses an in-memory store by default.
 *
 * @example
 * ```ts
 * const plugin = rateLimit({
 *   windowMs: 60_000,
 *   max: 30,
 * });
 * ```
 */
export const rateLimit = (config: RateLimitConfig): Plugin => {
    validateRateLimitConfig(config);

    const casRetries = config.casRetries ?? 8;
    const storage = config.storage ?? createMemoryStore();

    return {
        id: config.id ?? "rate-limit",
        guards: [
            async (ctx) => {
                const request = {
                    agentName: ctx.agentName,
                    request: ctx.request,
                    auth: ctx.auth,
                };

                const now = new Date();
                const nowMs = now.getTime();
                const keyFromConfig = config.key
                    ? await config.key(request)
                    : `${ctx.agentName}:global`;
                const key =
                    typeof keyFromConfig === "string" && keyFromConfig.trim().length > 0
                        ? keyFromConfig.trim()
                        : `${ctx.agentName}:global`;
                const bucket = createBucket({
                    key,
                    now,
                    windowMs: config.windowMs,
                });

                const handleStoreError = async (error: unknown): Promise<Response | null> => {
                    const action = config.onStoreError
                        ? await config.onStoreError({ error, bucket, request })
                        : "allow";

                    if (action instanceof Response) return action;
                    if (action === "deny") {
                        return createRateLimitStorageUnavailableResponse();
                    }

                    return null;
                };

                for (let attempt = 0; attempt < casRetries; attempt += 1) {
                    let state: RateLimitStorageState | null = null;
                    try {
                        state = await storage.read({ bucket, request });
                    } catch (error) {
                        return handleStoreError(error);
                    }

                    if (state && state.count >= config.max) {
                        return createRateLimitedResponse({
                            bucket,
                            nowMs,
                            key,
                            max: config.max,
                        });
                    }

                    try {
                        const written = await storage.write({
                            bucket,
                            request,
                            prevVersion: state?.version ?? null,
                            next: {
                                count: (state?.count ?? 0) + 1,
                                version: (state?.version ?? 0) + 1,
                            },
                        });

                        if (written) return null;
                    } catch (error) {
                        return handleStoreError(error);
                    }
                }

                return handleStoreError(createCasRetriesExceededError());
            },
        ],
    };
};
