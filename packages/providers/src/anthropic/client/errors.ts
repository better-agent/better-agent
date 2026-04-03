import { BetterAgentError } from "@better-agent/shared/errors";

import type { AnthropicError } from "../types";

export type AnthropicHttpError = {
    status: number;
    statusText: string;
    error?: AnthropicError["error"];
};

export const mapAnthropicHttpError = (
    httpError: AnthropicHttpError | undefined,
    ctx: {
        at: string;
        path: string;
    },
): BetterAgentError => {
    if (!httpError) {
        return BetterAgentError.fromCode("UPSTREAM_FAILED", "Anthropic request failed", {
            context: {
                provider: "anthropic",
            },
        }).at({
            at: ctx.at,
            data: {
                path: ctx.path,
            },
        });
    }

    const { status, statusText, error } = httpError;
    const message = error?.message ?? statusText ?? "Anthropic request failed";
    const code = String(error?.type ?? status);

    return BetterAgentError.fromCode("UPSTREAM_FAILED", message, {
        status,
        context: {
            provider: "anthropic",
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
