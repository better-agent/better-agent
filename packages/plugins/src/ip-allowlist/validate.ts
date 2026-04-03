import { createValidationError, requireNonEmptyArray } from "../shared/validation";
import { parseAllowEntry } from "./cidr";
import type { IpAllowlistPluginConfig } from "./types";

/** Validates `ipAllowlistPlugin` configuration. */
export function validateIpAllowlistPluginConfig(config: IpAllowlistPluginConfig): void {
    requireNonEmptyArray(config.allow, "allow", "plugins.ipAllowlistPlugin");

    for (const entry of config.allow) {
        if (typeof entry !== "string" || !parseAllowEntry(entry)) {
            throw createValidationError(
                `\`ipAllowlistPlugin\` received an invalid allow entry: '${String(entry)}'.`,
                "plugins.ipAllowlistPlugin",
            );
        }
    }
}
