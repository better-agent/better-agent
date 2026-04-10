import type { OpenRouterConfig } from "../types";

const getEnv = (name: string): string | undefined =>
    typeof process !== "undefined" ? process.env?.[name] : undefined;

export const buildOpenRouterHeaders = (config: OpenRouterConfig): Record<string, string> => {
    const headers: Record<string, string> = {
        ...(config.headers ?? {}),
    };

    const apiKey = config.apiKey ?? getEnv("OPENROUTER_API_KEY");
    const siteURL = config.siteURL ?? getEnv("OPENROUTER_SITE_URL");
    const appName = config.appName ?? getEnv("OPENROUTER_APP_NAME");

    if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
    if (siteURL) headers["HTTP-Referer"] = siteURL;
    if (appName) headers["X-Title"] = appName;

    return headers;
};
