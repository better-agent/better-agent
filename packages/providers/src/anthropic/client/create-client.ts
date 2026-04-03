import { BetterAgentError } from "@better-agent/shared/errors";
import { type Result, err, ok } from "@better-agent/shared/neverthrow";
import { safeJsonParse } from "@better-agent/shared/utils";
import { baFetch } from "../../utils/fetch";
import type {
    AnthropicMessagesRequestSchema,
    AnthropicMessagesResponse,
    AnthropicResponseStreamEvent,
} from "../responses/schemas";
import type { AnthropicConfig, AnthropicError } from "../types";
import { buildAnthropicHeaders } from "./auth";
import { mapAnthropicHttpError } from "./errors";
import { parseAnthropicSSEStream } from "./stream";

type RequestOptions = {
    signal?: AbortSignal | null;
    beta?: string[];
    headers?: Record<string, string>;
};

export const createAnthropicClient = (config: AnthropicConfig = {}) => {
    const baseUrl = (config.baseURL ?? "https://api.anthropic.com/v1").replace(/\/+$/, "");

    const post = async <TOutput>(
        path: string,
        body: unknown,
        at: string,
        options?: RequestOptions,
    ): Promise<Result<TOutput, BetterAgentError>> => {
        try {
            const result = await baFetch<TOutput, AnthropicError>(`${baseUrl}${path}`, {
                method: "POST",
                body: JSON.stringify(body),
                headers: {
                    ...buildAnthropicHeaders(config, options),
                    "Content-Type": "application/json",
                },
                signal: options?.signal ?? null,
                throw: false,
            });

            if (result.error) {
                return err(
                    mapAnthropicHttpError(result.error, {
                        at,
                        path,
                    }),
                );
            }

            if (!result.data) {
                return err(
                    BetterAgentError.fromCode("UPSTREAM_FAILED", "Anthropic returned no data", {
                        context: {
                            provider: "anthropic",
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
                    message: "Anthropic request failed",
                    opts: {
                        code: "UPSTREAM_FAILED",
                        context: {
                            provider: "anthropic",
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
            AsyncGenerator<Result<AnthropicResponseStreamEvent, BetterAgentError>>,
            BetterAgentError
        >
    > => {
        try {
            const response = await fetch(`${baseUrl}${path}`, {
                method: "POST",
                body: JSON.stringify(body),
                headers: {
                    ...buildAnthropicHeaders(config, options),
                    Accept: "text/event-stream",
                    "Content-Type": "application/json",
                },
                signal: options?.signal ?? null,
            });

            if (!response.ok) {
                const text = await response.text();
                const parsed = safeJsonParse(text);
                const error =
                    parsed.isOk() && parsed.value && typeof parsed.value === "object"
                        ? (parsed.value as AnthropicError).error
                            ? (parsed.value as AnthropicError)
                            : { error: parsed.value as AnthropicError["error"] }
                        : undefined;

                return err(
                    mapAnthropicHttpError(
                        {
                            status: response.status,
                            statusText: response.statusText,
                            error: error?.error,
                        },
                        {
                            at,
                            path,
                        },
                    ),
                );
            }

            if (!response.body) {
                return err(
                    BetterAgentError.fromCode(
                        "UPSTREAM_FAILED",
                        "Anthropic stream response did not include a body",
                        {
                            context: {
                                provider: "anthropic",
                            },
                        },
                    ).at({
                        at,
                        data: {
                            path,
                        },
                    }),
                );
            }

            return ok(parseAnthropicSSEStream(response.body));
        } catch (e) {
            return err(
                BetterAgentError.wrap({
                    err: e,
                    message: "Anthropic streaming request failed",
                    opts: {
                        code: "UPSTREAM_FAILED",
                        context: {
                            provider: "anthropic",
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

    return {
        messages: {
            create: (
                body: AnthropicMessagesRequestSchema,
                options?: RequestOptions,
            ): Promise<Result<AnthropicMessagesResponse, BetterAgentError>> =>
                post("/messages", body, "anthropic.messages.create", options),
            stream: (
                body: AnthropicMessagesRequestSchema,
                options?: RequestOptions,
            ): Promise<
                Result<
                    AsyncGenerator<Result<AnthropicResponseStreamEvent, BetterAgentError>>,
                    BetterAgentError
                >
            > => stream("/messages", body, "anthropic.messages.stream", options),
        },
    };
};
