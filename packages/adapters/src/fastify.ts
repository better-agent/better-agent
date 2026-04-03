import type { BetterAgentApp } from "@better-agent/core";
import { sendNodeResponse } from "./shared/from-node-response";
import { createNodeRequest } from "./shared/to-node-request";
import type {
    FastifyLikeReply,
    FastifyLikeRequest,
    NodeRequestAdapterOptions,
} from "./shared/types";

export type FastifyHandler = (
    request: FastifyLikeRequest,
    reply: FastifyLikeReply,
) => Promise<void>;

export const toFastifyHandler = (
    app: BetterAgentApp,
    options?: NodeRequestAdapterOptions,
): FastifyHandler => {
    return async (request, reply) => {
        reply.hijack?.();

        const body =
            request.body === undefined || request.body === null
                ? undefined
                : typeof request.body === "string" || request.body instanceof Uint8Array
                  ? request.body
                  : JSON.stringify(request.body);

        const webRequest = createNodeRequest(request.raw, reply.raw, {
            ...options,
            body,
            origin:
                options?.origin ??
                (request.protocol
                    ? `${request.protocol}://${request.raw.headers.host ?? "localhost"}`
                    : undefined),
        });
        const webResponse = await app.handler(webRequest);
        await sendNodeResponse(reply.raw, webResponse);
    };
};
