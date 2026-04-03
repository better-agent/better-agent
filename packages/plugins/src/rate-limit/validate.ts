import { requirePositiveNumber } from "../shared/validation";
import type { RateLimitPluginConfig } from "./types";

/** Validates `rateLimitPlugin` configuration. */
export function validateRateLimitPluginConfig(config: RateLimitPluginConfig): void {
    requirePositiveNumber(config.windowMs, "windowMs", "plugins.rateLimitPlugin");
    requirePositiveNumber(config.max, "max", "plugins.rateLimitPlugin");
    requirePositiveNumber(config.casRetries ?? 8, "casRetries", "plugins.rateLimitPlugin");
}
