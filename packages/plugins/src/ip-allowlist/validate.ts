import { createValidationError, requireNonEmptyArray } from "../shared/validation";
import { parseAllowEntry } from "./cidr";
import type { IpAllowlistConfig } from "./types";

/** Validates `ipAllowlist` configuration. */
export function validateIpAllowlistConfig(config: IpAllowlistConfig): void {
    requireNonEmptyArray(config.allow, "allow", "plugins.ipAllowlist");

    for (const entry of config.allow) {
        if (typeof entry !== "string" || !parseAllowEntry(entry)) {
            throw createValidationError(
                `\`ipAllowlist\` received an invalid allow entry: '${String(entry)}'.`,
                "plugins.ipAllowlist",
            );
        }
    }
}
