import { BetterAgentError } from "@better-agent/shared/errors";
import { type Result, err, ok } from "@better-agent/shared/neverthrow";
import { safeJsonParse } from "@better-agent/shared/utils";
import { baFetch } from "../../utils/fetch";
import type {
    XAICreateImageSchema as XAICreateImageRequestSchema,
    XAICreateImageResponse,
    XAIEditImageSchema as XAIEditImageRequestSchema,
} from "../images/schemas";
import type { XAICreateResponse, XAICreateResponseSchema } from "../responses/schemas";
import type {
    XAIDeleteFileResponseSchema,
    XAIFileListSchema,
    XAIFileObjectSchema,
} from "../shared/schemas";
import type { XAIResponseStreamEvent } from "../shared/schemas";
import type { XAIConfig, XAIError, XAIFileUploadRequest } from "../types";
import { buildXAIHeaders } from "./auth";
import { mapXAIHttpError } from "./errors";
import { unwrapXAIStreamJson } from "./stream";

type RequestOptions = {
    signal?: AbortSignal | null;
};

export const createXAIClient = (config: XAIConfig = {}) => {
    const baseUrl = (config.baseURL ?? "https://api.x.ai").replace(/\/+$/, "");
    const headers = buildXAIHeaders(config);

    const post = async <TOutput>(
        path: string,
        body: unknown,
        at: string,
        options?: RequestOptions,
    ): Promise<Result<TOutput, BetterAgentError>> => {
        try {
            const result = await baFetch<TOutput, XAIError>(`${baseUrl}${path}`, {
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
                    mapXAIHttpError(result.error, {
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
                    BetterAgentError.fromCode("UPSTREAM_FAILED", "xAI returned no data", {
                        context: {
                            provider: "xai",
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
                    message: "xAI request failed",
                    opts: {
                        code: "UPSTREAM_FAILED",
                        context: {
                            provider: "xai",
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

    const get = async <TOutput>(
        path: string,
        at: string,
        options?: RequestOptions,
    ): Promise<Result<TOutput, BetterAgentError>> => {
        try {
            const result = await baFetch<TOutput, XAIError>(`${baseUrl}${path}`, {
                method: "GET",
                headers,
                signal: options?.signal ?? null,
                throw: false,
            });

            if (result.error) {
                return err(
                    mapXAIHttpError(result.error, {
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
                    BetterAgentError.fromCode("UPSTREAM_FAILED", "xAI returned no data", {
                        context: {
                            provider: "xai",
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
                    message: "xAI request failed",
                    opts: {
                        code: "UPSTREAM_FAILED",
                        context: {
                            provider: "xai",
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

    const del = async <TOutput>(
        path: string,
        at: string,
        options?: RequestOptions,
    ): Promise<Result<TOutput, BetterAgentError>> => {
        try {
            const result = await baFetch<TOutput, XAIError>(`${baseUrl}${path}`, {
                method: "DELETE",
                headers,
                signal: options?.signal ?? null,
                throw: false,
            });

            if (result.error) {
                return err(
                    mapXAIHttpError(result.error, {
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
                    BetterAgentError.fromCode("UPSTREAM_FAILED", "xAI returned no data", {
                        context: {
                            provider: "xai",
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
                    message: "xAI request failed",
                    opts: {
                        code: "UPSTREAM_FAILED",
                        context: {
                            provider: "xai",
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

    const uploadFile = async (
        path: string,
        body: XAIFileUploadRequest,
        at: string,
        options?: RequestOptions,
    ): Promise<Result<XAIFileObjectSchema, BetterAgentError>> => {
        const formData = new FormData();

        try {
            const filename =
                body.filename ??
                (typeof File !== "undefined" && body.file instanceof File
                    ? body.file.name
                    : "file");
            const blob =
                body.file instanceof Blob
                    ? body.file
                    : new Blob([new Uint8Array(body.file)], {
                          type: body.mimeType ?? "application/octet-stream",
                      });

            formData.append("purpose", body.purpose ?? "assistants");
            formData.append("file", blob, filename);
            const response = await fetch(`${baseUrl}${path}`, {
                method: "POST",
                body: formData,
                headers,
                signal: options?.signal ?? null,
            });

            if (!response.ok) {
                let xaiError: XAIError | undefined;
                try {
                    xaiError = (await response.json()) as XAIError;
                } catch {
                    // ignore parse failure
                }

                return err(
                    mapXAIHttpError(
                        {
                            status: response.status,
                            statusText: response.statusText,
                            error: xaiError?.error,
                        },
                        { at, path },
                    ),
                );
            }

            const data = (await response.json()) as XAIFileObjectSchema | null;
            if (!data) {
                return err(
                    BetterAgentError.fromCode("UPSTREAM_FAILED", "xAI returned no data", {
                        context: {
                            provider: "xai",
                        },
                    }).at({
                        at,
                        data: {
                            path,
                        },
                    }),
                );
            }

            return ok(data);
        } catch (e) {
            return err(
                BetterAgentError.wrap({
                    err: e,
                    message: "xAI file upload failed",
                    opts: {
                        code: "UPSTREAM_FAILED",
                        context: {
                            provider: "xai",
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

    const getBinary = async (
        path: string,
        at: string,
        options?: RequestOptions,
    ): Promise<Result<Uint8Array, BetterAgentError>> => {
        let response: Response;

        try {
            response = await fetch(`${baseUrl}${path}`, {
                method: "GET",
                headers,
                signal: options?.signal ?? null,
            });
        } catch (e) {
            return err(
                BetterAgentError.wrap({
                    err: e,
                    message: "xAI request failed",
                    opts: {
                        code: "UPSTREAM_FAILED",
                        context: {
                            provider: "xai",
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

        if (!response.ok) {
            let xaiError: XAIError | undefined;
            try {
                xaiError = (await response.json()) as XAIError;
            } catch {
                // ignore parse failure
            }

            return err(
                mapXAIHttpError(
                    {
                        status: response.status,
                        statusText: response.statusText,
                        error: xaiError?.error,
                    },
                    { at, path },
                ),
            );
        }

        return ok(new Uint8Array(await response.arrayBuffer()));
    };

    const streamSSE = async (
        path: string,
        body: unknown,
        at: string,
        options?: RequestOptions,
    ): Promise<
        Result<AsyncGenerator<Result<XAIResponseStreamEvent, BetterAgentError>>, BetterAgentError>
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
                    message: "xAI stream request failed",
                    opts: {
                        code: "UPSTREAM_FAILED",
                        context: {
                            provider: "xai",
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
            let xaiError: XAIError | undefined;
            try {
                xaiError = (await response.json()) as XAIError;
            } catch {
                // ignore parse failure
            }

            return err(
                mapXAIHttpError(
                    {
                        status: response.status,
                        statusText: response.statusText,
                        error: xaiError?.error,
                    },
                    { at, path },
                ),
            );
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        const events = (async function* (): AsyncGenerator<
            Result<XAIResponseStreamEvent, BetterAgentError>
        > {
            let buffer = "";

            try {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    buffer += decoder.decode(value, { stream: true });
                    const chunks = buffer.split("\n\n");
                    buffer = chunks.pop() ?? "";

                    for (const chunk of chunks) {
                        const lines = chunk
                            .split("\n")
                            .map((line) => line.trim())
                            .filter(Boolean);
                        const dataLines = lines
                            .filter((line) => line.startsWith("data:"))
                            .map((line) => line.slice(5).trim());

                        for (const data of dataLines) {
                            if (!data || data === "[DONE]") continue;

                            const parsed = safeJsonParse(String(unwrapXAIStreamJson(data)));
                            if (
                                parsed.isErr() ||
                                !parsed.value ||
                                typeof parsed.value !== "object"
                            ) {
                                yield err(
                                    BetterAgentError.fromCode(
                                        "UPSTREAM_FAILED",
                                        "xAI returned an invalid stream event",
                                        {
                                            context: { provider: "xai", raw: data },
                                        },
                                    ).at({
                                        at,
                                        data: {
                                            path,
                                        },
                                    }),
                                );
                                return;
                            }

                            yield ok(parsed.value as XAIResponseStreamEvent);
                        }
                    }
                }
            } catch (e) {
                yield err(
                    BetterAgentError.wrap({
                        err: e,
                        message: "xAI stream read failed",
                        opts: {
                            code: "UPSTREAM_FAILED",
                            context: {
                                provider: "xai",
                            },
                        },
                    }).at({
                        at,
                        data: {
                            path,
                        },
                    }),
                );
            } finally {
                reader.releaseLock();
            }
        })();

        return ok(events);
    };

    return {
        responses: {
            create: (
                body: XAICreateResponseSchema,
                options?: RequestOptions,
            ): Promise<Result<XAICreateResponse, BetterAgentError>> =>
                post("/v1/responses", body, "xai.http.responses.create", options),
            stream: (body: XAICreateResponseSchema, options?: RequestOptions) =>
                streamSSE(
                    "/v1/responses",
                    {
                        ...body,
                        stream: true,
                    },
                    "xai.http.responses.stream",
                    options,
                ),
        },
        images: {
            create: (
                body: XAICreateImageRequestSchema,
                options?: RequestOptions,
            ): Promise<Result<XAICreateImageResponse, BetterAgentError>> =>
                post("/v1/images/generations", body, "xai.http.images.create", options),
            edit: (
                body: XAIEditImageRequestSchema,
                options?: RequestOptions,
            ): Promise<Result<XAICreateImageResponse, BetterAgentError>> =>
                post("/v1/images/edits", body, "xai.http.images.edit", options),
        },
        files: {
            upload: (body: XAIFileUploadRequest, options?: RequestOptions) =>
                uploadFile("/v1/files", body, "xai.http.files.upload", options),
            list: (
                options?: RequestOptions,
            ): Promise<Result<XAIFileListSchema, BetterAgentError>> =>
                get("/v1/files", "xai.http.files.list", options),
            retrieve: (
                fileId: string,
                options?: RequestOptions,
            ): Promise<Result<XAIFileObjectSchema, BetterAgentError>> =>
                get(`/v1/files/${encodeURIComponent(fileId)}`, "xai.http.files.retrieve", options),
            delete: (
                fileId: string,
                options?: RequestOptions,
            ): Promise<Result<XAIDeleteFileResponseSchema, BetterAgentError>> =>
                del(`/v1/files/${encodeURIComponent(fileId)}`, "xai.http.files.delete", options),
            content: (fileId: string, options?: RequestOptions) =>
                getBinary(
                    `/v1/files/${encodeURIComponent(fileId)}/content`,
                    "xai.http.files.content",
                    options,
                ),
        },
    };
};
