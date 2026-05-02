import { requirePositiveNumber } from "../shared/validation";
import type { RateLimitConfig } from "./types";

/** Validates `rateLimit` configuration. */
export function validateRateLimitConfig(config: RateLimitConfig): void {
    requirePositiveNumber(config.windowMs, "windowMs", "plugins.rateLimit");
    requirePositiveNumber(config.max, "max", "plugins.rateLimit");
    requirePositiveNumber(config.casRetries ?? 8, "casRetries", "plugins.rateLimit");
}
