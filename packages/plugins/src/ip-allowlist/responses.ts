import { jsonResponse } from "../shared/json";

/** Creates the default IP denied response. */
export function createIpDeniedResponse(): Response {
    return jsonResponse(
        {
            error: "forbidden",
            message: "IP address is not allowed.",
        },
        { status: 403 },
    );
}
