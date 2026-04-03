import { jsonResponse } from "../shared/json";

/** Creates the default unauthorized response. */
export function createUnauthorizedResponse(): Response {
    return jsonResponse(
        {
            error: "unauthorized",
            message: "Invalid API key.",
        },
        { status: 401 },
    );
}
