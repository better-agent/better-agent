import { createValidationError } from "../shared/validation";
import type { SandboxConfig, SandboxCreateParams } from "./types";

const hasLifecycleValues = (lifecycle: SandboxCreateParams["lifecycle"] | undefined): boolean =>
    Boolean(
        lifecycle?.ttlMs !== undefined ||
            lifecycle?.idleStopMs !== undefined ||
            lifecycle?.archiveAfterMs !== undefined ||
            lifecycle?.deleteAfterMs !== undefined,
    );

export function validateSandboxCreateParams(
    clientProvider: string | undefined,
    params: SandboxCreateParams,
): void {
    const provider = clientProvider?.trim().toLowerCase();
    if (!provider) {
        return;
    }

    if (provider === "daytona") {
        if (params.lifecycle?.ttlMs !== undefined) {
            throw createValidationError(
                "`lifecycle.ttlMs` is not supported by the Daytona sandbox client. Use `startupTimeoutMs` for creation readiness and Daytona lifecycle fields like `idleStopMs`, `archiveAfterMs`, or `deleteAfterMs` instead.",
                "plugins.sandbox.createConfig.lifecycle.ttlMs",
            );
        }

        return;
    }

    if (provider === "e2b") {
        if (params.startupTimeoutMs !== undefined) {
            throw createValidationError(
                "`startupTimeoutMs` is not supported by the E2B sandbox client. Use `lifecycle.ttlMs` to control sandbox lifetime.",
                "plugins.sandbox.createConfig.startupTimeoutMs",
            );
        }

        if (
            params.lifecycle?.idleStopMs !== undefined ||
            params.lifecycle?.archiveAfterMs !== undefined ||
            params.lifecycle?.deleteAfterMs !== undefined
        ) {
            throw createValidationError(
                "`lifecycle.idleStopMs`, `lifecycle.archiveAfterMs`, and `lifecycle.deleteAfterMs` are not supported by the E2B sandbox client.",
                "plugins.sandbox.createConfig.lifecycle",
            );
        }

        return;
    }

    if (hasLifecycleValues(params.lifecycle) || params.startupTimeoutMs !== undefined) {
        return;
    }
}

/** Validates `sandbox` configuration. */
export function validateSandboxConfig(config: SandboxConfig): void {
    const client = config.client;

    if (!client || typeof client !== "object") {
        throw createValidationError("`sandbox` requires a `client`.", "plugins.sandbox");
    }

    if (config.prefix !== undefined && config.prefix.trim().length === 0) {
        throw createValidationError(
            "`sandbox` requires `prefix` to be a non-empty string when provided.",
            "plugins.sandbox",
        );
    }

    if (config.createConfig) {
        validateSandboxCreateParams(config.client.provider, config.createConfig);
    }

    if (config.createDefaults) {
        validateSandboxCreateParams(config.client.provider, config.createDefaults);
    }
}
