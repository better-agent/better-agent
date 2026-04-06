import app from "@/lib/better-agent/server";

export const dynamic = "force-dynamic";

const COOKIE_NAME = "ask_ai_session";

const handle = async (request: Request): Promise<Response> => {
    const cookie = request.headers.get("cookie") ?? "";
    const session =
        cookie.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]+)`))?.[1] ?? crypto.randomUUID();

    const headers = new Headers(request.headers);
    headers.set(
        "cookie",
        cookie ? `${cookie}; ${COOKIE_NAME}=${session}` : `${COOKIE_NAME}=${session}`,
    );

    const response = await app.handler(new Request(request, { headers }));
    if (!cookie.includes(`${COOKIE_NAME}=`)) {
        response.headers.append(
            "set-cookie",
            `${COOKIE_NAME}=${session}; Path=/; Max-Age=2592000; SameSite=Lax${
                process.env.NODE_ENV === "production" ? "; Secure" : ""
            }`,
        );
    }
    return response;
};

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
export const OPTIONS = handle;
export const HEAD = handle;
