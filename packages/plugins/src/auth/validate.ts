import { createValidationError } from "../shared/validation";
import type { AuthPluginConfig } from "./types";

/** Validates `authPlugin` configuration. */
export function validateAuthPluginConfig(config: AuthPluginConfig): void {
    if (!config.validate && (!config.apiKeys || config.apiKeys.length === 0)) {
        throw createValidationError(
            "`authPlugin` requires either `apiKeys` or `validate`.",
            "plugins.authPlugin",
        );
    }

    if (config.header !== undefined && config.header.trim().length === 0) {
        throw createValidationError(
            "`authPlugin` requires `header` to be a non-empty string when provided.",
            "plugins.authPlugin",
        );
    }

    if (config.apiKeys) {
        const normalized = config.apiKeys
            .filter((key): key is string => typeof key === "string")
            .map((key) => key.trim())
            .filter((key) => key.length > 0);

        if (normalized.length === 0 && !config.validate) {
            throw createValidationError(
                "`authPlugin` requires `apiKeys` to contain at least one non-empty key.",
                "plugins.authPlugin",
            );
        }
    }
}
