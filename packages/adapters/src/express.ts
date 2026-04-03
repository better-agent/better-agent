import type { BetterAgentApp } from "@better-agent/core";
import { sendNodeResponse } from "./shared/from-node-response";
import { createNodeRequest } from "./shared/to-node-request";
import type { NodeRequestAdapterOptions, NodeRequestLike, NodeResponseLike } from "./shared/types";

type ExpressRequestLike = NodeRequestLike & { body?: unknown };

export type ExpressHandler = (
    request: NodeRequestLike,
    response: NodeResponseLike,
    next?: (error?: unknown) => void,
) => Promise<void>;

export const toExpressHandler = (
    app: BetterAgentApp,
    options?: NodeRequestAdapterOptions,
): ExpressHandler => {
    return async (request, response, next) => {
        try {
            const expressRequest = request as ExpressRequestLike;
            const body =
                expressRequest.body === undefined || expressRequest.body === null
                    ? undefined
                    : typeof expressRequest.body === "string" ||
                        expressRequest.body instanceof Uint8Array
                      ? expressRequest.body
                      : JSON.stringify(expressRequest.body);

            const webRequest = createNodeRequest(request, response, {
                ...options,
                body: options?.body ?? body,
            });
            const webResponse = await app.handler(webRequest);
            await sendNodeResponse(response, webResponse);
        } catch (error) {
            if (next) {
                next(error);
                return;
            }

            throw error;
        }
    };
};
