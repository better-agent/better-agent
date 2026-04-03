import type { OpenAIConfig } from "../types";

const getEnv = (name: string): string | undefined =>
    typeof process !== "undefined" ? process.env?.[name] : undefined;

export const buildOpenAIHeaders = (config: OpenAIConfig): Record<string, string> => {
    const headers: Record<string, string> = {
        ...(config.headers ?? {}),
    };

    const apiKey = config.apiKey ?? getEnv("OPENAI_API_KEY");
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
    if (config.organization) headers["OpenAI-Organization"] = config.organization;
    if (config.project) headers["OpenAI-Project"] = config.project;

    return headers;
};
