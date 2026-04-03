import type { IncomingMessage, ServerResponse } from "node:http";

export interface NodeRequestAdapterOptions {
    origin?: string;
    url?: string;
    body?: BodyInit | null;
}

export type NodeRequestLike = IncomingMessage & {
    originalUrl?: string;
    protocol?: string;
};

export type NodeResponseLike = ServerResponse<IncomingMessage>;

export interface FastifyLikeRequest {
    body?: unknown;
    raw: NodeRequestLike;
    protocol?: string;
}

export interface FastifyLikeReply {
    raw: NodeResponseLike;
    hijack?(): void;
}
