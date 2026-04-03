import { type HttpMethod, createRouter } from "../api";
import {
    jsonErrorResponse,
    methodNotAllowedResponse,
    notFoundResponse,
    toServerErrorResponse,
} from "./http";
import { createServerRoutes, runPluginGuards } from "./routes";
import type { BetterAgentServer, CreateServerConfig } from "./types";

/**
 * Creates a built-in HTTP server.
 *
 * When `secret` is set, non-public routes require `Authorization: Bearer <secret>`.
 *
 * @example
 * ```ts
 * const server = createServer({
 *   runtime,
 *   secret: "dev-secret",
 *   basePath: "/api",
 * });
 * ```
 */
export function createServer(config: CreateServerConfig): BetterAgentServer {
    const sseHeartbeatMs = config.advanced?.sseHeartbeatMs;
    const onRequestDisconnect =
        config.advanced?.onRequestDisconnect ??
        (config.runtime.streamLifecycle === "detached" ? "continue" : "abort");
    const basePath =
        typeof config.basePath === "string" && config.basePath.length > 0
            ? config.basePath.replace(/\/$/, "")
            : "";

    const deps = {
        runtime: config.runtime,
        pluginRuntime: config.pluginRuntime ?? null,
        sseHeartbeatMs,
        onRequestDisconnect,
    };
    const routes = createServerRoutes(deps);
    const router = createRouter(routes);

    // Normalize incoming request-like inputs (objects or path-only URLs) into a standard Fetch Request so downstream handling can rely on consistent Request semantics.
    const getHeader = (headers: unknown, name: string): string | null => {
        if (!headers || typeof headers !== "object") {
            return null;
        }

        if ("get" in headers && typeof headers.get === "function") {
            const value = headers.get(name);
            return typeof value === "string" ? value : null;
        }

        const record = headers as Record<string, unknown>;
        const direct = record[name] ?? record[name.toLowerCase()] ?? record[name.toUpperCase()];
        return typeof direct === "string" ? direct : null;
    };

    const toAbsoluteUrlString = (request: Request): string => {
        try {
            return new URL(request.url).toString();
        } catch {
            // Recover relative URLs by reconstructing an origin from forwarded or host headers.
            const host =
                getHeader(request.headers, "x-forwarded-host") ??
                getHeader(request.headers, "host") ??
                "localhost";
            const protocol =
                getHeader(request.headers, "x-forwarded-proto") === "https" ? "https" : "http";
            return new URL(request.url, `${protocol}://${host}`).toString();
        }
    };

    const normalizeRequest = (request: Request): Request => {
        const hasHeadersGet = typeof request.headers?.get === "function";
        const hasAbsoluteUrl = (() => {
            try {
                void new URL(request.url);
                return true;
            } catch {
                return false;
            }
        })();

        if (request instanceof Request && hasHeadersGet && hasAbsoluteUrl) {
            return request;
        }

        return new Request(toAbsoluteUrlString(request), {
            method: request.method,
            headers: request.headers as HeadersInit | undefined,
            body:
                request.method === "GET" || request.method === "HEAD"
                    ? undefined
                    : (request as { body?: BodyInit | null }).body,
            ...((request.method !== "GET" &&
            request.method !== "HEAD" &&
            (request as { body?: BodyInit | null }).body != null
                ? { duplex: "half" }
                : {}) as { duplex?: "half" }),
            signal: request.signal,
        });
    };

    return {
        async handle(request) {
            try {
                const normalizedRequest = normalizeRequest(request);
                const url = new URL(normalizedRequest.url);
                // Normalize pathname by removing basePath only if it’s a true path-segment prefix (not partial like "/app" vs "/apple")
                const path =
                    !basePath || !url.pathname.startsWith(basePath)
                        ? url.pathname
                        : url.pathname.length > basePath.length &&
                            url.pathname[basePath.length] !== "/"
                          ? url.pathname
                          : url.pathname.slice(basePath.length) || "/";

                const match = router.match(normalizedRequest.method as HttpMethod, path);
                if (!match) {
                    const pathMatch = router.matchPath(path);
                    if (pathMatch) {
                        return methodNotAllowedResponse(pathMatch.methods);
                    }

                    return notFoundResponse();
                }

                // Built-in bearer auth is skipped only for routes explicitly marked public.
                if (config.secret && match.route.public !== true) {
                    if (
                        normalizedRequest.headers.get("authorization") !== `Bearer ${config.secret}`
                    ) {
                        return jsonErrorResponse(
                            {
                                code: "UNAUTHORIZED",
                                message: "Missing or invalid bearer token.",
                                status: 401,
                            },
                            {
                                headers: {
                                    "www-authenticate": "Bearer",
                                },
                            },
                        );
                    }
                }

                const guardResult = await runPluginGuards({
                    pluginRuntime: deps.pluginRuntime,
                    match,
                    request: normalizedRequest,
                });
                if (guardResult) {
                    return guardResult;
                }

                return await match.route.handler({
                    request: normalizedRequest,
                    path,
                    params: match.params,
                    query: url.searchParams,
                });
            } catch (error) {
                return toServerErrorResponse(error);
            }
        },
    };
}
