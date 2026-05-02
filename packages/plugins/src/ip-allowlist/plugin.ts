import type { Plugin } from "@better-agent/core";
import { parseAllowEntry } from "./cidr";
import { normalizeIp, parseIp } from "./ip";
import { createIpDeniedResponse } from "./responses";
import type { IpAllowlistConfig } from "./types";
import { validateIpAllowlistConfig } from "./validate";

/** Reads the first valid forwarded IP. */
function getProxyIp(request: Request): string | null {
    const forwardedFor = request.headers.get("x-forwarded-for");
    if (!forwardedFor) return null;

    for (const part of forwardedFor.split(",")) {
        const normalized = normalizeIp(part.trim());
        if (normalized) {
            return normalized;
        }
    }

    return null;
}

/** Reads a direct client IP from common proxy headers. */
function getDirectIp(request: Request): string | null {
    const candidates = [
        request.headers.get("x-real-ip"),
        request.headers.get("cf-connecting-ip"),
        request.headers.get("fly-client-ip"),
        request.headers.get("fastly-client-ip"),
        request.headers.get("x-client-ip"),
    ];

    for (const candidate of candidates) {
        if (!candidate) continue;
        const normalized = normalizeIp(candidate);
        if (normalized) {
            return normalized;
        }
    }

    return null;
}

/**
 * Creates an IP allowlist plugin.
 *
 * @example
 * ```ts
 * const plugin = ipAllowlist({
 *   allow: ["127.0.0.1", "10.0.0.0/8"],
 * });
 * ```
 */
export const ipAllowlist = (config: IpAllowlistConfig): Plugin => {
    validateIpAllowlistConfig(config);

    const matchers = config.allow.map((entry) => {
        const matcher = parseAllowEntry(entry);
        if (!matcher) {
            throw new Error(`Invalid allowlist entry: ${entry}`);
        }
        return matcher;
    });

    return {
        id: config.id ?? "ip-allowlist",
        guards: [
            async (ctx) => {
                const resolvedIp = config.getIp
                    ? await config.getIp({
                          agentName: ctx.agentName,
                          request: ctx.request,
                      })
                    : config.trustProxy
                      ? getProxyIp(ctx.request)
                      : getDirectIp(ctx.request);

                const normalizedIp =
                    typeof resolvedIp === "string" && resolvedIp.trim().length > 0
                        ? normalizeIp(resolvedIp)
                        : null;
                const parsedIp = normalizedIp ? parseIp(normalizedIp) : null;

                if (parsedIp && matchers.some((matcher) => matcher.matches(parsedIp))) {
                    return null;
                }

                return config.onDenied
                    ? await config.onDenied({
                          ip: normalizedIp,
                          agentName: ctx.agentName,
                          request: ctx.request,
                      })
                    : createIpDeniedResponse();
            },
        ],
    };
};
