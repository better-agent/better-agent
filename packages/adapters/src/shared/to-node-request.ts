import { Readable } from "node:stream";
import { createDisconnectSignal } from "./disconnect";
import type { NodeRequestAdapterOptions, NodeRequestLike } from "./types";

const bodylessMethods = new Set(["GET", "HEAD"]);

const resolveHeader = (value: string | string[] | undefined): string | null => {
    if (Array.isArray(value)) {
        return value.join(", ");
    }

    return typeof value === "string" ? value : null;
};

const resolveOrigin = (request: NodeRequestLike, options?: NodeRequestAdapterOptions): string => {
    if (options?.origin) {
        return options.origin;
    }

    const forwardedProto = resolveHeader(request.headers["x-forwarded-proto"]);
    const protocol = forwardedProto ?? request.protocol ?? "http";
    const host = resolveHeader(request.headers.host) ?? "localhost";
    return `${protocol}://${host}`;
};

export const createNodeRequest = (
    request: NodeRequestLike,
    response?: { once(event: "close", listener: () => void): unknown; writableEnded?: boolean },
    options?: NodeRequestAdapterOptions,
): Request => {
    const method = request.method ?? "GET";
    const url = options?.url ?? request.originalUrl ?? request.url ?? "/";
    const signal = createDisconnectSignal(request, response as never);

    const headers = new Headers();
    for (const [name, value] of Object.entries(request.headers)) {
        if (Array.isArray(value)) {
            for (const item of value) {
                headers.append(name, item);
            }
            continue;
        }

        if (typeof value === "string") {
            headers.set(name, value);
        }
    }

    const requestInit: RequestInit & { duplex?: "half" } = {
        method,
        headers,
        signal,
    };

    if (!bodylessMethods.has(method.toUpperCase())) {
        requestInit.body = options?.body ?? (Readable.toWeb(request) as unknown as BodyInit);
        requestInit.duplex = "half";
    }

    return new Request(new URL(url, resolveOrigin(request, options)), requestInit);
};
