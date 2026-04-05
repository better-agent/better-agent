import { createValidationError } from "../shared/validation";
import type { SandboxPluginConfig } from "./types";

/** Validates `sandboxPlugin` configuration. */
export function validateSandboxPluginConfig(config: SandboxPluginConfig): void {
    const client = config.client ?? config.driver;

    if (!client || typeof client !== "object") {
        throw createValidationError(
            "`sandboxPlugin` requires a `client`.",
            "plugins.sandboxPlugin",
        );
    }

    if (config.prefix !== undefined && config.prefix.trim().length === 0) {
        throw createValidationError(
            "`sandboxPlugin` requires `prefix` to be a non-empty string when provided.",
            "plugins.sandboxPlugin",
        );
    }
}
