import type { XAIConfig } from "../types";

export const buildXAIHeaders = (config: XAIConfig): Record<string, string> => {
    const headers: Record<string, string> = {
        ...(config.headers ?? {}),
    };

    if (config.apiKey) headers.Authorization = `Bearer ${config.apiKey}`;

    return headers;
};
