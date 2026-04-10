import { BetterAgentError } from "@better-agent/shared/errors";
import { type Result, err, ok } from "@better-agent/shared/neverthrow";
import { safeJsonParse } from "@better-agent/shared/utils";
import { baFetch } from "../../utils/fetch";
import type {
    OpenRouterChatCompletionChunk,
    OpenRouterChatCompletionResponse,
    OpenRouterChatCompletionsRequestSchema,
} from "../responses/schemas";
import type { OpenRouterConfig, OpenRouterError } from "../types";
import { buildOpenRouterHeaders } from "./auth";
import { mapOpenRouterHttpError } from "./errors";
import { unwrapOpenRouterStreamJson } from "./stream";

type RequestOptions = {
    signal?: AbortSignal | null;
};

export const createOpenRouterClient = (config: OpenRouterConfig = {}) => {
    const baseUrl = (
        config.baseURL ??
        (typeof process !== "undefined" ? process.env?.OPENROUTER_BASE_URL : undefined) ??
        "https://openrouter.ai/api/v1"
    ).replace(/\/+$/, "");
    const headers = buildOpenRouterHeaders(config);

    const post = async <TOutput>(
        path: string,
        body: unknown,
        at: string,
        options?: RequestOptions,
    ): Promise<Result<TOutput, BetterAgentError>> => {
        try {
            const result = await baFetch<TOutput, OpenRouterError>(`${baseUrl}${path}`, {
                method: "POST",
                body: JSON.stringify(body),
                headers: {
                    ...headers,
                    "Content-Type": "application/json",
                },
                signal: options?.signal ?? null,
                throw: false,
            });

            if (result.error) {
                return err(
                    mapOpenRouterHttpError(result.error, {
                        at,
                        path,
                    }).at({
                        at,
                        data: {
                            path,
                        },
                    }),
                );
            }

            if (!result.data) {
                return err(
                    BetterAgentError.fromCode("UPSTREAM_FAILED", "OpenRouter returned no data", {
                        context: {
                            provider: "openrouter",
                        },
                    }).at({
                        at,
                        data: {
                            path,
                        },
                    }),
                );
            }

            return ok(result.data);
        } catch (e) {
            return err(
                BetterAgentError.wrap({
                    err: e,
                    message: "OpenRouter request failed",
                    opts: {
                        code: "UPSTREAM_FAILED",
                        context: {
                            provider: "openrouter",
                        },
                    },
                }).at({
                    at,
                    data: {
                        path,
                    },
                }),
            );
        }
    };

    const stream = async (
        path: string,
        body: unknown,
        at: string,
        options?: RequestOptions,
    ): Promise<
        Result<
            AsyncGenerator<Result<OpenRouterChatCompletionChunk, BetterAgentError>>,
            BetterAgentError
        >
    > => {
        let response: Response;

        try {
            response = await fetch(`${baseUrl}${path}`, {
                method: "POST",
                headers: {
                    ...headers,
                    Accept: "text/event-stream",
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(body),
                signal: options?.signal ?? null,
            });
        } catch (e) {
            return err(
                BetterAgentError.wrap({
                    err: e,
                    message: "OpenRouter stream request failed",
                    opts: {
                        code: "UPSTREAM_FAILED",
                        context: {
                            provider: "openrouter",
                        },
                    },
                }).at({
                    at,
                    data: {
                        path,
                    },
                }),
            );
        }

        if (!response.ok || !response.body) {
            let providerError: OpenRouterError | undefined;
            try {
                providerError = (await response.json()) as OpenRouterError;
            } catch {
                providerError = undefined;
            }

            return err(
                mapOpenRouterHttpError(
                    {
                        status: response.status,
                        statusText: response.statusText,
                        error: providerError?.error,
                    },
                    {
                        at,
                        path,
                    },
                ),
            );
        }

        const streamBody = response.body;
        const eventStream = async function* (): AsyncGenerator<
            Result<OpenRouterChatCompletionChunk, BetterAgentError>
        > {
            try {
                const reader = streamBody.getReader();
                const decoder = new TextDecoder("utf-8");
                let buffer = "";

                while (true) {
                    const { value, done } = await reader.read();
                    if (done) {
                        buffer += decoder.decode();
                        buffer = buffer.replace(/\r\n/g, "\n");
                        break;
                    }

                    buffer += decoder.decode(value, { stream: true });
                    buffer = buffer.replace(/\r\n/g, "\n");

                    let separatorIndex = buffer.indexOf("\n\n");
                    while (separatorIndex !== -1) {
                        const rawEvent = buffer.slice(0, separatorIndex);
                        buffer = buffer.slice(separatorIndex + 2);

                        const dataPayload = rawEvent
                            .split("\n")
                            .filter((line) => line.startsWith("data:"))
                            .map((line) => line.replace(/^data:\s*/, ""))
                            .join("\n")
                            .trim();

                        if (!dataPayload) {
                            separatorIndex = buffer.indexOf("\n\n");
                            continue;
                        }

                        if (dataPayload === "[DONE]") return;

                        const parsed = safeJsonParse(dataPayload);
                        const payload = unwrapOpenRouterStreamJson(parsed);
                        if (
                            payload &&
                            typeof payload === "object" &&
                            "choices" in payload &&
                            Array.isArray((payload as { choices?: unknown }).choices)
                        ) {
                            yield ok(payload as OpenRouterChatCompletionChunk);
                        }

                        separatorIndex = buffer.indexOf("\n\n");
                    }
                }
            } catch (e) {
                yield err(
                    BetterAgentError.wrap({
                        err: e,
                        message: "OpenRouter stream decode failed",
                        opts: {
                            code: "UPSTREAM_FAILED",
                            context: {
                                provider: "openrouter",
                            },
                        },
                    }).at({
                        at,
                        data: {
                            path,
                        },
                    }),
                );
            }
        };

        return ok(eventStream());
    };

    return {
        chat: {
            create: (
                body: OpenRouterChatCompletionsRequestSchema,
                options?: RequestOptions,
            ): Promise<Result<OpenRouterChatCompletionResponse, BetterAgentError>> =>
                post("/chat/completions", body, "openrouter.chat.create", options),
            stream: (
                body: OpenRouterChatCompletionsRequestSchema,
                options?: RequestOptions,
            ): Promise<
                Result<
                    AsyncGenerator<Result<OpenRouterChatCompletionChunk, BetterAgentError>>,
                    BetterAgentError
                >
            > =>
                stream("/chat/completions", { ...body, stream: true }, "openrouter.chat.stream", options),
        },
    };
};
