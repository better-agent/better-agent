import { BetterAgentError } from "@better-agent/shared/errors";
import { type Result, err, ok } from "@better-agent/shared/neverthrow";
import { safeJsonParse } from "@better-agent/shared/utils";
import { baFetch } from "../../utils/fetch";
import type { OpenAICreateSpeechRequest } from "../audio-speech/schemas";
import type {
    OpenAICreateTranscriptionRequest,
    OpenAICreateTranscriptionResponse,
} from "../audio-transcription/schemas";
import type {
    OpenAICreateEmbeddingRequest,
    OpenAICreateEmbeddingResponse,
} from "../embeddings/schemas";
import type {
    OpenAICreateImage,
    OpenAICreateImageSchema,
    OpenAIEditImageSchema,
} from "../images/schemas";
import type {
    OpenAICreateResponse,
    OpenAICreateResponseSchema,
    OpenAIResponseStreamEvent,
} from "../responses/schemas";
import type {
    OpenAIDeleteFileResponse,
    OpenAIFileList,
    OpenAIFileObject,
    OpenAIImageStreamEvent,
    OpenAISpeechStreamEvent,
    OpenAITranscriptionStreamEvent,
} from "../shared/schemas";
import type { OpenAIConfig, OpenAIError, OpenAIFileUploadRequest } from "../types";
import type { OpenAICreateVideo, OpenAICreateVideoSchema } from "../videos/schemas";
import { buildOpenAIHeaders } from "./auth";
import { mapOpenAIHttpError } from "./errors";
import { unwrapOpenAIStreamJson } from "./stream";

type RequestOptions = {
    signal?: AbortSignal | null;
};

export const createOpenAIClient = (config: OpenAIConfig = {}) => {
    const baseUrl = (
        config.baseURL ??
        (typeof process !== "undefined" ? process.env?.OPENAI_BASE_URL : undefined) ??
        "https://api.openai.com"
    ).replace(/\/+$/, "");
    const headers = buildOpenAIHeaders(config);

    const post = async <TOutput>(
        path: string,
        body: unknown,
        at: string,
        options?: RequestOptions,
    ): Promise<Result<TOutput, BetterAgentError>> => {
        try {
            const isMultipart = typeof FormData !== "undefined" && body instanceof FormData;
            const postHeaders = isMultipart
                ? headers
                : {
                      ...headers,
                      "Content-Type": "application/json",
                  };
            const result = await baFetch<TOutput, OpenAIError>(`${baseUrl}${path}`, {
                method: "POST",
                body: isMultipart ? body : JSON.stringify(body),
                headers: postHeaders,
                signal: options?.signal ?? null,
                throw: false,
            });

            if (result.error) {
                return err(
                    mapOpenAIHttpError(result.error, {
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
                    BetterAgentError.fromCode("UPSTREAM_FAILED", "OpenAI returned no data", {
                        context: {
                            provider: "openai",
                        },
                    })
                        .at({
                            at,
                            data: {
                                path,
                            },
                        })
                        .at({
                            at: "openai.http.post.noData",
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
                    message: "OpenAI request failed",
                    opts: {
                        code: "UPSTREAM_FAILED",
                        context: {
                            provider: "openai",
                        },
                    },
                })
                    .at({
                        at,
                        data: {
                            path,
                        },
                    })
                    .at({
                        at: "openai.http.post.exception",
                        data: {
                            path,
                        },
                    }),
            );
        }
    };

    const streamSSE = async <
        TEvent extends {
            type: string;
        },
    >(
        path: string,
        body: unknown,
        at: string,
        options?: RequestOptions,
    ): Promise<Result<AsyncGenerator<Result<TEvent, BetterAgentError>>, BetterAgentError>> => {
        let response: Response;
        const isMultipart = typeof FormData !== "undefined" && body instanceof FormData;
        const streamHeaders: Record<string, string> = {
            ...headers,
            Accept: "text/event-stream",
        };
        if (!isMultipart) {
            streamHeaders["Content-Type"] = "application/json";
        }

        try {
            response = await fetch(`${baseUrl}${path}`, {
                method: "POST",
                headers: streamHeaders,
                body: isMultipart ? (body as FormData) : JSON.stringify(body),
                signal: options?.signal ?? null,
            });
        } catch (e) {
            return err(
                BetterAgentError.wrap({
                    err: e,
                    message: "OpenAI stream request failed",
                    opts: {
                        code: "UPSTREAM_FAILED",
                        context: {
                            provider: "openai",
                        },
                    },
                })
                    .at({
                        at,
                        data: {
                            path,
                        },
                    })
                    .at({
                        at: "openai.http.stream.fetch",
                        data: {
                            path,
                        },
                    }),
            );
        }

        if (!response.ok || !response.body) {
            let openaiError: OpenAIError | undefined;
            try {
                openaiError = (await response.json()) as OpenAIError;
            } catch (e) {
                return err(
                    BetterAgentError.wrap({
                        err: e,
                        message: "OpenAI stream returned non-OK response",
                        opts: {
                            code: "UPSTREAM_FAILED",
                            status: response.status,
                            context: {
                                provider: "openai",
                                upstreamCode: String(response.status),
                            },
                        },
                    })
                        .at({
                            at,
                            data: {
                                path,
                                status: response.status,
                            },
                        })
                        .at({
                            at: "openai.http.stream.notOk",
                            data: {
                                path,
                            },
                        }),
                );
            }

            return err(
                mapOpenAIHttpError(
                    {
                        status: response.status,
                        statusText: response.statusText,
                        error: openaiError?.error,
                    },
                    {
                        at: "openai.http.stream.notOk",
                        path,
                    },
                ).at({
                    at,
                    data: {
                        path,
                    },
                }),
            );
        }

        const streamBody = response.body;

        const stream = async function* (): AsyncGenerator<Result<TEvent, BetterAgentError>> {
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

                    buffer += decoder.decode(value, {
                        stream: true,
                    });
                    buffer = buffer.replace(/\r\n/g, "\n");

                    let separatorIndex = buffer.indexOf("\n\n");
                    while (separatorIndex !== -1) {
                        const rawEvent = buffer.slice(0, separatorIndex);
                        buffer = buffer.slice(separatorIndex + 2);

                        const eventType = rawEvent
                            .split("\n")
                            .find((line) => line.startsWith("event:"))
                            ?.replace(/^event:\s*/, "")
                            .trim();

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

                        if (dataPayload === "[DONE]") {
                            return;
                        }

                        const parsed = safeJsonParse(dataPayload);
                        let payload = unwrapOpenAIStreamJson(parsed);
                        if (
                            payload &&
                            typeof payload === "object" &&
                            !("type" in payload) &&
                            eventType
                        ) {
                            payload = {
                                type: eventType,
                                ...payload,
                            };
                        } else if ((!payload || typeof payload !== "object") && eventType) {
                            payload = {
                                type: eventType,
                            };
                        }

                        if (payload && typeof payload === "object" && "type" in payload) {
                            yield ok(payload as TEvent);
                        }

                        separatorIndex = buffer.indexOf("\n\n");
                    }
                }

                if (buffer.trim().length > 0) {
                    const eventType = buffer
                        .split("\n")
                        .find((line) => line.startsWith("event:"))
                        ?.replace(/^event:\s*/, "")
                        .trim();
                    const dataPayload = buffer
                        .split("\n")
                        .filter((line) => line.startsWith("data:"))
                        .map((line) => line.replace(/^data:\s*/, ""))
                        .join("\n")
                        .trim();

                    if (dataPayload && dataPayload !== "[DONE]") {
                        const parsed = safeJsonParse(dataPayload);
                        let payload = unwrapOpenAIStreamJson(parsed);
                        if (
                            payload &&
                            typeof payload === "object" &&
                            !("type" in payload) &&
                            eventType
                        ) {
                            payload = {
                                type: eventType,
                                ...payload,
                            };
                        } else if ((!payload || typeof payload !== "object") && eventType) {
                            payload = {
                                type: eventType,
                            };
                        }

                        if (payload && typeof payload === "object" && "type" in payload) {
                            yield ok(payload as TEvent);
                        }
                    }
                }
            } catch (e) {
                yield err(
                    BetterAgentError.wrap({
                        err: e,
                        message: "OpenAI stream decode failed",
                        opts: {
                            code: "UPSTREAM_FAILED",
                            context: {
                                provider: "openai",
                            },
                        },
                    })
                        .at({
                            at,
                            data: {
                                path,
                            },
                        })
                        .at({
                            at: "openai.http.stream.decode",
                            data: {
                                path,
                            },
                        }),
                );
                return;
            }
        };

        return ok(stream());
    };

    const streamBinary = async (
        path: string,
        body: unknown,
        at: string,
        options?: RequestOptions,
    ): Promise<Result<AsyncGenerator<Result<Uint8Array, BetterAgentError>>, BetterAgentError>> => {
        let response: Response;

        try {
            response = await fetch(`${baseUrl}${path}`, {
                method: "POST",
                headers: {
                    ...headers,
                    Accept: "application/octet-stream",
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(body),
                signal: options?.signal ?? null,
            });
        } catch (e) {
            return err(
                BetterAgentError.wrap({
                    err: e,
                    message: "OpenAI stream request failed",
                    opts: {
                        code: "UPSTREAM_FAILED",
                        context: {
                            provider: "openai",
                        },
                    },
                })
                    .at({
                        at,
                        data: {
                            path,
                        },
                    })
                    .at({
                        at: "openai.http.stream.fetch",
                        data: {
                            path,
                        },
                    }),
            );
        }

        if (!response.ok || !response.body) {
            let openaiError: OpenAIError | undefined;
            try {
                openaiError = (await response.json()) as OpenAIError;
            } catch (e) {
                return err(
                    BetterAgentError.wrap({
                        err: e,
                        message: "OpenAI stream returned non-OK response",
                        opts: {
                            code: "UPSTREAM_FAILED",
                            status: response.status,
                            context: {
                                provider: "openai",
                                upstreamCode: String(response.status),
                            },
                        },
                    })
                        .at({
                            at,
                            data: {
                                path,
                                status: response.status,
                            },
                        })
                        .at({
                            at: "openai.http.stream.notOk",
                            data: {
                                path,
                            },
                        }),
                );
            }

            return err(
                mapOpenAIHttpError(
                    {
                        status: response.status,
                        statusText: response.statusText,
                        error: openaiError?.error,
                    },
                    {
                        at: "openai.http.stream.notOk",
                        path,
                    },
                ).at({
                    at,
                    data: {
                        path,
                    },
                }),
            );
        }

        const streamBody = response.body;

        const stream = async function* (): AsyncGenerator<Result<Uint8Array, BetterAgentError>> {
            try {
                const reader = streamBody.getReader();

                while (true) {
                    const { value, done } = await reader.read();
                    if (done) return;
                    if (value) yield ok(value);
                }
            } catch (e) {
                yield err(
                    BetterAgentError.wrap({
                        err: e,
                        message: "OpenAI stream decode failed",
                        opts: {
                            code: "UPSTREAM_FAILED",
                            context: {
                                provider: "openai",
                            },
                        },
                    })
                        .at({
                            at,
                            data: {
                                path,
                            },
                        })
                        .at({
                            at: "openai.http.stream.decode",
                            data: {
                                path,
                            },
                        }),
                );
                return;
            }
        };

        return ok(stream());
    };

    const buildTranscriptionFormData = (
        body: OpenAICreateTranscriptionRequest,
        path: string,
    ): Result<FormData, BetterAgentError> => {
        const formData = new FormData();

        let audioBlob: Blob;
        if (body.file.startsWith("data:")) {
            const matches = body.file.match(/^data:([^;]+);base64,(.+)$/);
            if (!matches || !matches[1] || !matches[2]) {
                return err(
                    BetterAgentError.fromCode(
                        "VALIDATION_FAILED",
                        "Invalid data URL format for audio file",
                        {
                            context: {
                                provider: "openai",
                            },
                        },
                    ).at({
                        at: "openai.audio.transcriptions.invalidDataUrl",
                        data: {
                            path,
                        },
                    }),
                );
            }
            const mimeType = matches[1];
            const base64Data = matches[2];
            const binaryString = atob(base64Data);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            audioBlob = new Blob([bytes], {
                type: mimeType,
            });
        } else {
            const binaryString = atob(body.file);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            audioBlob = new Blob([bytes], {
                type: "audio/mpeg",
            });
        }

        formData.append("file", audioBlob, "audio.mp3");

        formData.append("model", body.model);

        if (body.language) formData.append("language", body.language);
        if (body.prompt) formData.append("prompt", body.prompt);
        if (body.response_format) formData.append("response_format", body.response_format);
        if (body.temperature !== undefined)
            formData.append("temperature", String(body.temperature));
        if (body.timestamp_granularities) {
            for (const tg of body.timestamp_granularities) {
                formData.append("timestamp_granularities[]", tg);
            }
        }
        if (body.include) {
            for (const include of body.include) {
                formData.append("include[]", include);
            }
        }
        if (body.stream !== undefined) {
            formData.append("stream", String(body.stream));
        }
        if (body.chunking_strategy) {
            formData.append("chunking_strategy", JSON.stringify(body.chunking_strategy));
        }

        return ok(formData);
    };

    const files = {
        upload: async (
            body: OpenAIFileUploadRequest,
            options?: RequestOptions,
        ): Promise<Result<OpenAIFileObject, BetterAgentError>> => {
            const path = "/v1/files";
            try {
                const formData = new FormData();
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
                    let openaiError: OpenAIError | undefined;
                    try {
                        openaiError = (await response.json()) as OpenAIError;
                    } catch (_e) {
                        return err(
                            BetterAgentError.fromCode(
                                "UPSTREAM_FAILED",
                                "OpenAI file upload request failed",
                                {
                                    status: response.status,
                                    context: {
                                        provider: "openai",
                                        upstreamCode: String(response.status),
                                    },
                                },
                            ).at({
                                at: "openai.files.upload",
                                data: {
                                    path,
                                },
                            }),
                        );
                    }

                    return err(
                        mapOpenAIHttpError(
                            {
                                status: response.status,
                                statusText: response.statusText,
                                error: openaiError?.error,
                            },
                            { at: "openai.files.upload", path },
                        ),
                    );
                }

                return ok((await response.json()) as OpenAIFileObject);
            } catch (e) {
                return err(
                    BetterAgentError.wrap({
                        err: e,
                        message: "Failed to prepare OpenAI file upload request",
                        opts: {
                            code: "INTERNAL",
                            context: {
                                provider: "openai",
                            },
                        },
                    }).at({
                        at: "openai.files.upload.prepare",
                        data: {
                            path,
                        },
                    }),
                );
            }
        },
        list: async (
            options?: RequestOptions,
        ): Promise<Result<OpenAIFileList, BetterAgentError>> => {
            const path = "/v1/files";
            try {
                const response = await fetch(`${baseUrl}${path}`, {
                    method: "GET",
                    headers,
                    signal: options?.signal ?? null,
                });

                if (!response.ok) {
                    let openaiError: OpenAIError | undefined;
                    try {
                        openaiError = (await response.json()) as OpenAIError;
                    } catch (_e) {
                        return err(
                            BetterAgentError.fromCode(
                                "UPSTREAM_FAILED",
                                "OpenAI files list request failed",
                                {
                                    status: response.status,
                                    context: {
                                        provider: "openai",
                                        upstreamCode: String(response.status),
                                    },
                                },
                            ).at({
                                at: "openai.files.list",
                                data: {
                                    path,
                                },
                            }),
                        );
                    }

                    return err(
                        mapOpenAIHttpError(
                            {
                                status: response.status,
                                statusText: response.statusText,
                                error: openaiError?.error,
                            },
                            { at: "openai.files.list", path },
                        ),
                    );
                }

                return ok((await response.json()) as OpenAIFileList);
            } catch (e) {
                return err(
                    BetterAgentError.wrap({
                        err: e,
                        message: "OpenAI files list request failed",
                        opts: {
                            code: "UPSTREAM_FAILED",
                            context: {
                                provider: "openai",
                            },
                        },
                    }).at({
                        at: "openai.files.list",
                        data: {
                            path,
                        },
                    }),
                );
            }
        },
        retrieve: async (
            fileId: string,
            options?: RequestOptions,
        ): Promise<Result<OpenAIFileObject, BetterAgentError>> => {
            const path = `/v1/files/${encodeURIComponent(fileId)}`;
            try {
                const response = await fetch(`${baseUrl}${path}`, {
                    method: "GET",
                    headers,
                    signal: options?.signal ?? null,
                });

                if (!response.ok) {
                    let openaiError: OpenAIError | undefined;
                    try {
                        openaiError = (await response.json()) as OpenAIError;
                    } catch (_e) {
                        return err(
                            BetterAgentError.fromCode(
                                "UPSTREAM_FAILED",
                                "OpenAI file retrieval request failed",
                                {
                                    status: response.status,
                                    context: {
                                        provider: "openai",
                                        upstreamCode: String(response.status),
                                    },
                                },
                            ).at({
                                at: "openai.files.retrieve",
                                data: {
                                    path,
                                },
                            }),
                        );
                    }

                    return err(
                        mapOpenAIHttpError(
                            {
                                status: response.status,
                                statusText: response.statusText,
                                error: openaiError?.error,
                            },
                            { at: "openai.files.retrieve", path },
                        ),
                    );
                }

                return ok((await response.json()) as OpenAIFileObject);
            } catch (e) {
                return err(
                    BetterAgentError.wrap({
                        err: e,
                        message: "OpenAI file retrieval request failed",
                        opts: {
                            code: "UPSTREAM_FAILED",
                            context: {
                                provider: "openai",
                            },
                        },
                    }).at({
                        at: "openai.files.retrieve",
                        data: {
                            path,
                        },
                    }),
                );
            }
        },
        delete: async (
            fileId: string,
            options?: RequestOptions,
        ): Promise<Result<OpenAIDeleteFileResponse, BetterAgentError>> => {
            const path = `/v1/files/${encodeURIComponent(fileId)}`;
            try {
                const response = await fetch(`${baseUrl}${path}`, {
                    method: "DELETE",
                    headers,
                    signal: options?.signal ?? null,
                });

                if (!response.ok) {
                    let openaiError: OpenAIError | undefined;
                    try {
                        openaiError = (await response.json()) as OpenAIError;
                    } catch (_e) {
                        return err(
                            BetterAgentError.fromCode(
                                "UPSTREAM_FAILED",
                                "OpenAI file delete request failed",
                                {
                                    status: response.status,
                                    context: {
                                        provider: "openai",
                                        upstreamCode: String(response.status),
                                    },
                                },
                            ).at({
                                at: "openai.files.delete",
                                data: {
                                    path,
                                },
                            }),
                        );
                    }

                    return err(
                        mapOpenAIHttpError(
                            {
                                status: response.status,
                                statusText: response.statusText,
                                error: openaiError?.error,
                            },
                            { at: "openai.files.delete", path },
                        ),
                    );
                }

                return ok((await response.json()) as OpenAIDeleteFileResponse);
            } catch (e) {
                return err(
                    BetterAgentError.wrap({
                        err: e,
                        message: "OpenAI file delete request failed",
                        opts: {
                            code: "UPSTREAM_FAILED",
                            context: {
                                provider: "openai",
                            },
                        },
                    }).at({
                        at: "openai.files.delete",
                        data: {
                            path,
                        },
                    }),
                );
            }
        },
        content: async (
            fileId: string,
            options?: RequestOptions,
        ): Promise<Result<{ data: ArrayBuffer; mimeType: string }, BetterAgentError>> => {
            const path = `/v1/files/${encodeURIComponent(fileId)}/content`;

            try {
                const response = await fetch(`${baseUrl}${path}`, {
                    method: "GET",
                    headers,
                    signal: options?.signal ?? null,
                });

                if (!response.ok) {
                    let openaiError: OpenAIError | undefined;
                    try {
                        openaiError = (await response.json()) as OpenAIError;
                    } catch (_e) {
                        return err(
                            BetterAgentError.fromCode(
                                "UPSTREAM_FAILED",
                                "OpenAI file content retrieval request failed",
                                {
                                    status: response.status,
                                    context: {
                                        provider: "openai",
                                        upstreamCode: String(response.status),
                                    },
                                },
                            ).at({
                                at: "openai.files.content",
                                data: {
                                    path,
                                },
                            }),
                        );
                    }

                    return err(
                        mapOpenAIHttpError(
                            {
                                status: response.status,
                                statusText: response.statusText,
                                error: openaiError?.error,
                            },
                            { at: "openai.files.content", path },
                        ),
                    );
                }

                const mimeType = response.headers.get("content-type") ?? "application/octet-stream";
                const data = await response.arrayBuffer();
                return ok({ data, mimeType });
            } catch (e) {
                return err(
                    BetterAgentError.wrap({
                        err: e,
                        message: "OpenAI file content retrieval request failed",
                        opts: {
                            code: "UPSTREAM_FAILED",
                            context: {
                                provider: "openai",
                            },
                        },
                    }).at({
                        at: "openai.files.content",
                        data: {
                            path,
                        },
                    }),
                );
            }
        },
    };

    const responses = {
        create: async (
            body: OpenAICreateResponseSchema,
            options?: RequestOptions,
        ): Promise<Result<OpenAICreateResponse, BetterAgentError>> => {
            const path = "/v1/responses";
            const r = await post<OpenAICreateResponse>(
                path,
                body,
                "openai.http.responses.create",
                options,
            );
            return r.mapErr((e) =>
                e.at({
                    at: "openai.responses.create",
                    data: {
                        path,
                    },
                }),
            );
        },

        stream: async (
            body: OpenAICreateResponseSchema,
            options?: RequestOptions,
        ): Promise<
            Result<
                AsyncGenerator<Result<OpenAIResponseStreamEvent, BetterAgentError>>,
                BetterAgentError
            >
        > => {
            const path = "/v1/responses";

            const requestBody = {
                ...body,
                stream: true,
                stream_options: body.stream_options,
            };

            const r = await streamSSE<OpenAIResponseStreamEvent>(
                path,
                requestBody,
                "openai.http.responses.stream",
                options,
            );

            return r.mapErr((e) =>
                e.at({
                    at: "openai.responses.stream",
                    data: {
                        path,
                    },
                }),
            );
        },
    };

    const images = {
        create: async (
            body: OpenAICreateImageSchema,
            options?: RequestOptions,
        ): Promise<Result<OpenAICreateImage, BetterAgentError>> => {
            const path = "/v1/images/generations";
            const r = await post<OpenAICreateImage>(
                path,
                body,
                "openai.http.images.create",
                options,
            );
            return r.mapErr((e) =>
                e.at({
                    at: "openai.images.create",
                    data: {
                        path,
                    },
                }),
            );
        },

        edit: async (
            body: OpenAIEditImageSchema,
            options?: RequestOptions,
        ): Promise<Result<OpenAICreateImage, BetterAgentError>> => {
            const path = "/v1/images/edits";
            const r = await post<OpenAICreateImage>(path, body, "openai.http.images.edit", options);
            return r.mapErr((e) =>
                e.at({
                    at: "openai.images.edit",
                    data: {
                        path,
                    },
                }),
            );
        },

        stream: async (
            body: OpenAICreateImageSchema,
            options?: RequestOptions,
        ): Promise<
            Result<
                AsyncGenerator<Result<OpenAIImageStreamEvent, BetterAgentError>>,
                BetterAgentError
            >
        > => {
            const path = "/v1/images/generations";

            const requestBody = {
                ...body,
                stream: true,
            };

            const r = await streamSSE<OpenAIImageStreamEvent>(
                path,
                requestBody,
                "openai.http.images.stream",
                options,
            );

            return r.mapErr((e) =>
                e.at({
                    at: "openai.images.stream",
                    data: {
                        path,
                    },
                }),
            );
        },

        streamEdit: async (
            body: OpenAIEditImageSchema,
            options?: RequestOptions,
        ): Promise<
            Result<
                AsyncGenerator<Result<OpenAIImageStreamEvent, BetterAgentError>>,
                BetterAgentError
            >
        > => {
            const path = "/v1/images/edits";

            const requestBody = {
                ...body,
                stream: true,
            };

            const r = await streamSSE<OpenAIImageStreamEvent>(
                path,
                requestBody,
                "openai.http.images.streamEdit",
                options,
            );

            return r.mapErr((e) =>
                e.at({
                    at: "openai.images.streamEdit",
                    data: {
                        path,
                    },
                }),
            );
        },
    };

    const videos = {
        create: async (
            body: OpenAICreateVideoSchema,
            options?: RequestOptions,
        ): Promise<Result<OpenAICreateVideo, BetterAgentError>> => {
            const path = "/v1/videos";
            const r = await post<OpenAICreateVideo>(
                path,
                body,
                "openai.http.videos.create",
                options,
            );
            return r.mapErr((e) =>
                e.at({
                    at: "openai.videos.create",
                    data: {
                        path,
                    },
                }),
            );
        },

        get: async (
            videoId: string,
            options?: RequestOptions,
        ): Promise<Result<OpenAICreateVideo, BetterAgentError>> => {
            const path = `/v1/videos/${encodeURIComponent(videoId)}`;

            try {
                const response = await fetch(`${baseUrl}${path}`, {
                    method: "GET",
                    headers,
                    signal: options?.signal ?? null,
                });

                if (!response.ok) {
                    let openaiError: OpenAIError | undefined;
                    try {
                        openaiError = (await response.json()) as OpenAIError;
                    } catch (_e) {
                        return err(
                            BetterAgentError.fromCode(
                                "UPSTREAM_FAILED",
                                "OpenAI video retrieval request failed",
                                {
                                    status: response.status,
                                    context: {
                                        provider: "openai",
                                        upstreamCode: String(response.status),
                                    },
                                },
                            ).at({
                                at: "openai.http.videos.get",
                                data: {
                                    path,
                                },
                            }),
                        );
                    }

                    return err(
                        mapOpenAIHttpError(
                            {
                                status: response.status,
                                statusText: response.statusText,
                                error: openaiError?.error,
                            },
                            {
                                at: "openai.http.videos.get",
                                path,
                            },
                        ),
                    );
                }

                return ok((await response.json()) as OpenAICreateVideo);
            } catch (e) {
                return err(
                    BetterAgentError.wrap({
                        err: e,
                        message: "OpenAI video retrieval request failed",
                        opts: {
                            code: "UPSTREAM_FAILED",
                            context: {
                                provider: "openai",
                            },
                        },
                    }).at({
                        at: "openai.http.videos.get",
                        data: {
                            path,
                        },
                    }),
                );
            }
        },

        content: async (
            videoId: string,
            options?: RequestOptions,
        ): Promise<Result<{ data: ArrayBuffer; mimeType: string }, BetterAgentError>> => {
            const path = `/v1/videos/${encodeURIComponent(videoId)}/content`;

            try {
                const response = await fetch(`${baseUrl}${path}`, {
                    method: "GET",
                    headers,
                    signal: options?.signal ?? null,
                });

                if (!response.ok) {
                    let openaiError: OpenAIError | undefined;
                    try {
                        openaiError = (await response.json()) as OpenAIError;
                    } catch (_e) {
                        return err(
                            BetterAgentError.fromCode(
                                "UPSTREAM_FAILED",
                                "OpenAI video content retrieval request failed",
                                {
                                    status: response.status,
                                    context: {
                                        provider: "openai",
                                        upstreamCode: String(response.status),
                                    },
                                },
                            ).at({
                                at: "openai.http.videos.content",
                                data: {
                                    path,
                                },
                            }),
                        );
                    }

                    return err(
                        mapOpenAIHttpError(
                            {
                                status: response.status,
                                statusText: response.statusText,
                                error: openaiError?.error,
                            },
                            {
                                at: "openai.http.videos.content",
                                path,
                            },
                        ),
                    );
                }

                const contentType = response.headers.get("content-type") ?? "video/mp4";
                const data = await response.arrayBuffer();

                return ok({
                    data,
                    mimeType: contentType,
                });
            } catch (e) {
                return err(
                    BetterAgentError.wrap({
                        err: e,
                        message: "OpenAI video content retrieval request failed",
                        opts: {
                            code: "UPSTREAM_FAILED",
                            context: {
                                provider: "openai",
                            },
                        },
                    }).at({
                        at: "openai.http.videos.content",
                        data: {
                            path,
                        },
                    }),
                );
            }
        },
    };

    const audio = {
        speech: async (
            body: OpenAICreateSpeechRequest,
            options?: RequestOptions,
        ): Promise<Result<ArrayBuffer, BetterAgentError>> => {
            const path = "/v1/audio/speech";
            try {
                const response = await fetch(`${baseUrl}${path}`, {
                    method: "POST",
                    body: JSON.stringify(body),
                    headers: {
                        ...headers,
                        "Content-Type": "application/json",
                    },
                    signal: options?.signal ?? null,
                });

                if (!response.ok) {
                    let openaiError: OpenAIError | undefined;
                    try {
                        openaiError = (await response.json()) as OpenAIError;
                    } catch (_e) {
                        return err(
                            BetterAgentError.fromCode(
                                "UPSTREAM_FAILED",
                                "OpenAI audio speech request failed",
                                {
                                    status: response.status,
                                    context: {
                                        provider: "openai",
                                        upstreamCode: String(response.status),
                                    },
                                },
                            ).at({
                                at: "openai.http.audio.speech",
                                data: {
                                    path,
                                },
                            }),
                        );
                    }

                    return err(
                        mapOpenAIHttpError(
                            {
                                status: response.status,
                                statusText: response.statusText,
                                error: openaiError?.error,
                            },
                            {
                                at: "openai.http.audio.speech",
                                path,
                            },
                        ),
                    );
                }

                const audioData = await response.arrayBuffer();
                return ok(audioData);
            } catch (e) {
                return err(
                    BetterAgentError.wrap({
                        err: e,
                        message: "OpenAI audio speech request failed",
                        opts: {
                            code: "UPSTREAM_FAILED",
                            context: {
                                provider: "openai",
                            },
                        },
                    }).at({
                        at: "openai.http.audio.speech",
                        data: {
                            path,
                        },
                    }),
                );
            }
        },
        speechStream: async (
            body: OpenAICreateSpeechRequest,
            options?: RequestOptions,
        ): Promise<
            Result<
                AsyncGenerator<Result<OpenAISpeechStreamEvent, BetterAgentError>>,
                BetterAgentError
            >
        > => {
            const path = "/v1/audio/speech";
            const r = await streamSSE<OpenAISpeechStreamEvent>(
                path,
                body,
                "openai.http.audio.speech.stream",
                options,
            );
            return r.mapErr((e) =>
                e.at({
                    at: "openai.audio.speech.stream",
                    data: {
                        path,
                    },
                }),
            );
        },
        speechStreamAudio: async (
            body: OpenAICreateSpeechRequest,
            options?: RequestOptions,
        ): Promise<
            Result<AsyncGenerator<Result<Uint8Array, BetterAgentError>>, BetterAgentError>
        > => {
            const path = "/v1/audio/speech";
            const r = await streamBinary(path, body, "openai.http.audio.speech.stream", options);
            return r.mapErr((e) =>
                e.at({
                    at: "openai.audio.speech.stream",
                    data: {
                        path,
                    },
                }),
            );
        },

        transcriptions: async (
            body: OpenAICreateTranscriptionRequest,
            options?: RequestOptions,
        ): Promise<Result<OpenAICreateTranscriptionResponse, BetterAgentError>> => {
            const path = "/v1/audio/transcriptions";

            try {
                const formData = buildTranscriptionFormData(body, path);
                if (formData.isErr()) return err(formData.error);

                const r = await post<OpenAICreateTranscriptionResponse>(
                    path,
                    formData.value,
                    "openai.http.audio.transcriptions",
                    options,
                );

                return r.mapErr((e) =>
                    e.at({
                        at: "openai.audio.transcriptions",
                        data: {
                            path,
                        },
                    }),
                );
            } catch (e) {
                return err(
                    BetterAgentError.wrap({
                        err: e,
                        message: "Failed to prepare audio transcription request",
                        opts: {
                            code: "INTERNAL",
                            context: {
                                provider: "openai",
                            },
                        },
                    }).at({
                        at: "openai.audio.transcriptions.prepare",
                        data: {
                            path,
                        },
                    }),
                );
            }
        },
        transcriptionsStream: async (
            body: OpenAICreateTranscriptionRequest,
            options?: RequestOptions,
        ): Promise<
            Result<
                AsyncGenerator<Result<OpenAITranscriptionStreamEvent, BetterAgentError>>,
                BetterAgentError
            >
        > => {
            const path = "/v1/audio/transcriptions";
            try {
                const formData = buildTranscriptionFormData(body, path);
                if (formData.isErr()) return err(formData.error);
                const r = await streamSSE<OpenAITranscriptionStreamEvent>(
                    path,
                    formData.value,
                    "openai.http.audio.transcriptions.stream",
                    options,
                );
                return r.mapErr((e) =>
                    e.at({
                        at: "openai.audio.transcriptions.stream",
                        data: {
                            path,
                        },
                    }),
                );
            } catch (e) {
                return err(
                    BetterAgentError.wrap({
                        err: e,
                        message: "Failed to prepare audio transcription stream request",
                        opts: {
                            code: "INTERNAL",
                            context: {
                                provider: "openai",
                            },
                        },
                    }).at({
                        at: "openai.audio.transcriptions.stream.prepare",
                        data: {
                            path,
                        },
                    }),
                );
            }
        },
    };

    const embeddings = {
        create: async (
            body: OpenAICreateEmbeddingRequest,
            options?: RequestOptions,
        ): Promise<Result<OpenAICreateEmbeddingResponse, BetterAgentError>> => {
            const path = "/v1/embeddings";
            const r = await post<OpenAICreateEmbeddingResponse>(
                path,
                body,
                "openai.http.embeddings.create",
                options,
            );
            return r.mapErr((e) =>
                e.at({
                    at: "openai.embeddings.create",
                    data: {
                        path,
                    },
                }),
            );
        },
    };

    return {
        post,
        responses,
        images,
        videos,
        audio,
        embeddings,
        files,
    };
};
