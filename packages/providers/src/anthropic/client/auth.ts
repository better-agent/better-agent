import type { AnthropicConfig } from "../types";

type BuildAnthropicHeadersOptions = {
    beta?: string[];
    headers?: Record<string, string>;
};

export const buildAnthropicHeaders = (
    config: AnthropicConfig,
    options: BuildAnthropicHeadersOptions = {},
): Record<string, string> => {
    const headers: Record<string, string> = {
        "anthropic-version": config.anthropicVersion ?? "2023-06-01",
        ...(config.headers ?? {}),
        ...(options.headers ?? {}),
    };

    if (config.authToken) {
        headers.Authorization = `Bearer ${config.authToken}`;
    } else if (config.apiKey) {
        headers["x-api-key"] = config.apiKey;
    }

    if (options.beta?.length) {
        headers["anthropic-beta"] = options.beta.join(",");
    }

    return headers;
};
