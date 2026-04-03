import { BetterAgentError } from "@better-agent/shared/errors";

import type { XAIError } from "../types";

export type XAIHttpError = {
    status: number;
    statusText: string;
    error?: XAIError["error"];
};

export const mapXAIHttpError = (
    httpError: XAIHttpError | undefined,
    ctx: {
        at: string;
        path: string;
    },
): BetterAgentError => {
    if (!httpError) {
        return BetterAgentError.fromCode("UPSTREAM_FAILED", "xAI request failed", {
            context: {
                provider: "xai",
            },
        }).at({
            at: ctx.at,
            data: {
                path: ctx.path,
            },
        });
    }

    const { status, statusText, error } = httpError;
    const message = error?.message ?? statusText ?? "xAI request failed";
    const code = String(error?.code ?? error?.type ?? status);

    return BetterAgentError.fromCode("UPSTREAM_FAILED", message, {
        status,
        context: {
            provider: "xai",
            upstreamCode: code,
            raw: error,
        },
    }).at({
        at: ctx.at,
        data: {
            path: ctx.path,
            status,
        },
    });
};
