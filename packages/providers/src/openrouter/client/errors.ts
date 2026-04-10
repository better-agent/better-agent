import { BetterAgentError } from "@better-agent/shared/errors";
import type { OpenRouterError } from "../types";

export type OpenRouterHttpError = {
    status: number;
    statusText: string;
    error?: OpenRouterError["error"];
};

export const mapOpenRouterHttpError = (
    httpError: OpenRouterHttpError | undefined,
    ctx: {
        at: string;
        path: string;
    },
): BetterAgentError => {
    if (!httpError) {
        return BetterAgentError.fromCode("UPSTREAM_FAILED", "OpenRouter request failed", {
            context: {
                provider: "openrouter",
            },
        }).at({
            at: ctx.at,
            data: {
                path: ctx.path,
            },
        });
    }

    const { status, statusText, error } = httpError;
    const message = error?.message ?? statusText ?? "OpenRouter request failed";
    const code = String(error?.code ?? error?.type ?? status);

    return BetterAgentError.fromCode("UPSTREAM_FAILED", message, {
        status,
        context: {
            provider: "openrouter",
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
