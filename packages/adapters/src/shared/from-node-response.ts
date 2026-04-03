import { once } from "node:events";
import { Readable } from "node:stream";
import { isDisconnectError } from "./disconnect";
import type { NodeResponseLike } from "./types";

const waitForDrain = async (response: NodeResponseLike) => {
    await once(response, "drain");
};

const setResponseHeaders = (target: NodeResponseLike, source: Headers) => {
    const getSetCookie = (
        source as Headers & {
            getSetCookie?: () => string[];
        }
    ).getSetCookie;

    if (typeof getSetCookie === "function") {
        const cookies = getSetCookie.call(source);
        if (cookies.length > 0) {
            target.setHeader("set-cookie", cookies);
        }
    }

    source.forEach((value, name) => {
        if (name === "set-cookie" && target.hasHeader("set-cookie")) {
            return;
        }

        target.setHeader(name, value);
    });
};

export const sendNodeResponse = async (
    target: NodeResponseLike,
    response: Response,
): Promise<void> => {
    target.statusCode = response.status;
    setResponseHeaders(target, response.headers);

    if (!response.body) {
        target.end();
        return;
    }

    const body = Readable.fromWeb(response.body as never);

    try {
        for await (const chunk of body) {
            if (!target.write(chunk)) {
                await waitForDrain(target);
            }
        }
        target.end();
    } catch (error) {
        if (!isDisconnectError(error) && !target.destroyed) {
            throw error;
        }
    }
};
