/** Creates a JSON response with a default content type. */
export function jsonResponse(body: unknown, init?: ResponseInit): Response {
    const headers = new Headers(init?.headers);
    if (!headers.has("content-type")) {
        headers.set("content-type", "application/json");
    }

    return new Response(JSON.stringify(body), {
        ...init,
        headers,
    });
}
