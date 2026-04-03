import type { PluginGuardMode } from "@better-agent/core";

/** Configuration for `ipAllowlistPlugin`. */
export type IpAllowlistPluginConfig = {
    /** Plugin id. */
    id?: string;
    /** Allowed IPs or CIDR ranges. */
    allow: readonly string[];
    /** Whether to trust `x-forwarded-for`. */
    trustProxy?: boolean;
    /** Resolves the request IP. */
    getIp?: (ctx: {
        /** Agent name. */
        agentName: string;
        /** Guard mode. */
        mode: PluginGuardMode;
        /** Incoming request. */
        request: Request;
    }) => string | null | undefined | Promise<string | null | undefined>;
    /** Overrides the denied response. */
    onDenied?: (ctx: {
        /** Resolved IP. */
        ip: string | null;
        /** Agent name. */
        agentName: string;
        /** Guard mode. */
        mode: PluginGuardMode;
        /** Incoming request. */
        request: Request;
    }) => Response | Promise<Response>;
};
