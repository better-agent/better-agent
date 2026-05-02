import type { BetterAgentClientConfig, PreparedRequest, RequestOptions } from "../types";
import { BetterAgentClientError } from "./errors";
import { parseSse } from "./sse";
import { resolveRequestURL } from "./url";

export function joinURL(baseURL: string, path: string): string {
    return `${baseURL.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
}

export async function resolveHeaders(
    configHeaders?: BetterAgentClientConfig["headers"],
    requestHeaders?: HeadersInit,
): Promise<Headers> {
    const headers = new Headers(
        typeof configHeaders === "function" ? await configHeaders() : configHeaders,
    );

    if (requestHeaders) {
        for (const [key, value] of new Headers(requestHeaders)) {
            headers.set(key, value);
        }
    }

    return headers;
}

export async function prepareRequest(
    config: BetterAgentClientConfig,
    request: PreparedRequest,
): Promise<PreparedRequest> {
    const prepared = await config.prepareRequest?.(request);
    return prepared ?? request;
}

async function throwRequestError(response: Response): Promise<never> {
    let details: unknown;
    let code: string | undefined;
    let message = `Better Agent request failed with ${response.status}.`;

    try {
        const body = await response.json();
        details = body;

        if (body && typeof body === "object") {
            if ("message" in body && typeof body.message === "string") {
                message = body.message;
            } else if ("detail" in body && typeof body.detail === "string") {
                message = body.detail;
            }

            if ("code" in body && typeof body.code === "string") {
                code = body.code;
            }
        }
    } catch {}

    throw new BetterAgentClientError(message, {
        status: response.status,
        code,
        details,
    });
}

export async function requestJson<T = unknown>(
    config: BetterAgentClientConfig,
    request: {
        url: string;
        method: string;
        body?: unknown;
    },
    options?: RequestOptions,
): Promise<T> {
    const headers = await resolveHeaders(config.headers, options?.headers);
    if (!headers.has("content-type") && request.body !== undefined) {
        headers.set("content-type", "application/json");
    }

    const prepared = await prepareRequest(config, {
        url: request.url,
        method: request.method,
        headers,
        body: request.body === undefined ? undefined : JSON.stringify(request.body),
    });
    const url = await resolveRequestURL(prepared.url);

    const doFetch = config.fetch ?? fetch;
    const response = await doFetch(url, {
        method: prepared.method,
        headers: prepared.headers,
        body: prepared.body,
        credentials: config.credentials,
        signal: options?.signal ?? null,
    });

    if (!response.ok) {
        await throwRequestError(response);
    }

    if (response.status === 204) {
        return undefined as T;
    }

    return response.json() as Promise<T>;
}

export async function requestSse(
    config: BetterAgentClientConfig,
    request: {
        url: string;
        method: string;
        body?: unknown;
    },
    options?: RequestOptions,
) {
    const headers = await resolveHeaders(config.headers, options?.headers);
    headers.set("accept", "text/event-stream");
    if (!headers.has("content-type") && request.body !== undefined) {
        headers.set("content-type", "application/json");
    }

    const prepared = await prepareRequest(config, {
        url: request.url,
        method: request.method,
        headers,
        body: request.body === undefined ? undefined : JSON.stringify(request.body),
    });
    const url = await resolveRequestURL(prepared.url);

    const doFetch = config.fetch ?? fetch;
    const response = await doFetch(url, {
        method: prepared.method,
        headers: prepared.headers,
        body: prepared.body,
        credentials: config.credentials,
        signal: options?.signal ?? null,
    });

    if (!response.ok) {
        await throwRequestError(response);
    }

    if (!response.body) {
        return (async function* () {})();
    }

    return parseSse(response.body);
}
