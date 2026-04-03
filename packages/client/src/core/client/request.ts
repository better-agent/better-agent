import type { ClientConfig, HttpMethod, PrepareRequestContext } from "../../types/client";

export const mergeHeaders = (
    ...parts: Array<Headers | Record<string, string> | undefined>
): Headers => {
    const merged = new Headers();
    for (const part of parts) {
        if (!part) continue;
        new Headers(part).forEach((value, key) => merged.set(key, value));
    }
    return merged;
};

export const prepareRequest = async (
    advanced: ClientConfig["advanced"] | undefined,
    context: PrepareRequestContext,
): Promise<{
    url: string;
    method: HttpMethod;
    headers: Headers | Record<string, string>;
    body?: BodyInit | null;
}> => {
    if (!advanced?.prepareRequest) {
        return {
            url: context.url,
            method: context.method,
            headers: context.headers,
            body: context.body,
        };
    }

    const prepared = await advanced.prepareRequest(context);
    if (!prepared) {
        return {
            url: context.url,
            method: context.method,
            headers: context.headers,
            body: context.body,
        };
    }

    return {
        url: prepared.url ?? context.url,
        method: prepared.method ?? context.method,
        headers: prepared.headers ?? context.headers,
        ...(prepared.body !== undefined
            ? { body: prepared.body }
            : context.body !== undefined
              ? { body: context.body }
              : {}),
    };
};
