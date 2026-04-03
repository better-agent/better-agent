import type { PluginGuardMode } from "@better-agent/core";

/** Configuration for `authPlugin`. */
export type AuthPluginConfig = {
    /** Plugin id. */
    id?: string;
    /** Header used when `getKey` is not provided. */
    header?: string;
    /** Allowed API keys for the default validator. */
    apiKeys?: readonly string[];
    /** Resolves the request API key. */
    getKey?: (ctx: {
        /** Agent name. */
        agentName: string;
        /** Guard mode. */
        mode: PluginGuardMode;
        /** Incoming request. */
        request: Request;
    }) => string | null | undefined | Promise<string | null | undefined>;
    /** Validates one API key. */
    validate?: (ctx: {
        /** Resolved API key. */
        key: string | null;
        /** Agent name. */
        agentName: string;
        /** Guard mode. */
        mode: PluginGuardMode;
        /** Incoming request. */
        request: Request;
    }) => boolean | Promise<boolean>;
    /** Overrides the unauthorized response. */
    onUnauthorized?: (ctx: {
        /** Resolved API key. */
        key: string | null;
        /** Agent name. */
        agentName: string;
        /** Guard mode. */
        mode: PluginGuardMode;
        /** Incoming request. */
        request: Request;
    }) => Response | Promise<Response>;
};
