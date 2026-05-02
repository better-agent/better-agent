/** Configuration for `ipAllowlist`. */
export type IpAllowlistConfig = {
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
        /** Incoming request. */
        request: Request;
    }) => string | null | undefined | Promise<string | null | undefined>;
    /** Overrides the denied response. */
    onDenied?: (ctx: {
        /** Resolved IP. */
        ip: string | null;
        /** Agent name. */
        agentName: string;
        /** Incoming request. */
        request: Request;
    }) => Response | Promise<Response>;
};
