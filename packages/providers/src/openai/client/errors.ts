import { BetterAgentError } from "@better-agent/shared/errors";

import type { OpenAIError } from "../types";

export type OpenAIHttpError = {
    status: number;
    statusText: string;
    error?: OpenAIError["error"];
};

export const mapOpenAIHttpError = (
    httpError: OpenAIHttpError | undefined,
    ctx: {
        at: string;
        path: string;
    },
): BetterAgentError => {
    if (!httpError) {
        return BetterAgentError.fromCode("UPSTREAM_FAILED", "OpenAI request failed", {
            context: {
                provider: "openai",
            },
        }).at({
            at: ctx.at,
            data: {
                path: ctx.path,
            },
        });
    }

    const { status, statusText, error } = httpError;
    const message = error?.message ?? statusText ?? "OpenAI request failed";
    const code = String(error?.code ?? error?.type ?? status);

    return BetterAgentError.fromCode("UPSTREAM_FAILED", message, {
        status,
        context: {
            provider: "openai",
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
