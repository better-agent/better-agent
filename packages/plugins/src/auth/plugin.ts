import type { Plugin } from "@better-agent/core";
import { createUnauthorizedResponse } from "./responses";
import type { AuthPluginConfig } from "./types";
import { validateAuthPluginConfig } from "./validate";

/**
 * Creates an API-key auth plugin.
 *
 * Provide either `apiKeys` or `validate`.
 *
 * @example
 * ```ts
 * const plugin = authPlugin({
 *   apiKeys: ["dev-key"],
 * });
 * ```
 */
export const authPlugin = (config: AuthPluginConfig): Plugin => {
    validateAuthPluginConfig(config);

    const header = config.header?.trim() || "x-api-key";
    const apiKeys = new Set((config.apiKeys ?? []).map((key) => key.trim()).filter(Boolean));

    return {
        id: config.id ?? "auth",
        guards: [
            async (ctx) => {
                const keyValue = config.getKey
                    ? await config.getKey({
                          agentName: ctx.agentName,
                          mode: ctx.mode,
                          request: ctx.request,
                      })
                    : ctx.request.headers.get(header);

                const key =
                    typeof keyValue === "string" && keyValue.trim().length > 0 ? keyValue : null;

                const valid = config.validate
                    ? await config.validate({
                          key,
                          agentName: ctx.agentName,
                          mode: ctx.mode,
                          request: ctx.request,
                      })
                    : key !== null && apiKeys.has(key);

                if (valid) {
                    return null;
                }

                return config.onUnauthorized
                    ? await config.onUnauthorized({
                          key,
                          agentName: ctx.agentName,
                          mode: ctx.mode,
                          request: ctx.request,
                      })
                    : createUnauthorizedResponse();
            },
        ],
    };
};
