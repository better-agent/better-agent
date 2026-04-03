import type { BetterAgentError } from "@better-agent/shared/errors";
import type { Result } from "@better-agent/shared/neverthrow";
import type { XAIImageGenerativeModel, XAIImageModelId } from "./images/types";
import type { XAIResponseGenerativeModel, XAIResponseModelId } from "./responses/types";
import type {
    XAIDeleteFileResponseSchema,
    XAIFileListSchema,
    XAIFileObjectSchema,
    XAIResponseStreamEvent,
} from "./shared/schemas";
import type { XAINativeToolBuilders } from "./tools";

export type XAIConfig = {
    apiKey?: string;
    baseURL?: string;
    headers?: Record<string, string>;
};

export type XAIError = {
    error?: {
        code?: string | number;
        message?: string;
        type?: string;
    };
};

export type XAIUploadableFile = Blob | File | Uint8Array | ArrayBuffer;

export type XAIFileUploadRequest = {
    file: XAIUploadableFile;
    filename?: string;
    mimeType?: string;
    purpose?: string;
};

export interface XAIFilesClient {
    /** Uploads a file and returns the provider-managed file object. */
    upload(
        body: XAIFileUploadRequest,
        options?: {
            signal?: AbortSignal | null;
        },
    ): Promise<Result<XAIFileObjectSchema, BetterAgentError>>;
    /** Lists files available to the current xAI project. */
    list(options?: {
        signal?: AbortSignal | null;
    }): Promise<Result<XAIFileListSchema, BetterAgentError>>;
    /** Retrieves metadata for a single xAI file id. */
    retrieve(
        fileId: string,
        options?: {
            signal?: AbortSignal | null;
        },
    ): Promise<Result<XAIFileObjectSchema, BetterAgentError>>;
    /** Deletes a provider-managed xAI file. */
    delete(
        fileId: string,
        options?: {
            signal?: AbortSignal | null;
        },
    ): Promise<Result<XAIDeleteFileResponseSchema, BetterAgentError>>;
    /** Downloads raw file content for a provider-managed xAI file. */
    content(
        fileId: string,
        options?: {
            signal?: AbortSignal | null;
        },
    ): Promise<Result<Uint8Array, BetterAgentError>>;
}

export type XAIModelId = XAIResponseModelId | XAIImageModelId;

export type XAIGenerativeModel<M extends XAIModelId = XAIModelId> = M extends XAIImageModelId
    ? XAIImageGenerativeModel<M>
    : XAIResponseGenerativeModel<M>;

export interface XAIProvider {
    readonly id: "xai";
    readonly tools: XAINativeToolBuilders;
    readonly files: XAIFilesClient;
    model<M extends XAIModelId>(modelId: M): XAIGenerativeModel<M>;
    text<M extends XAIResponseModelId>(modelId: M): XAIResponseGenerativeModel<M>;
    image<M extends XAIImageModelId>(modelId: M): XAIImageGenerativeModel<M>;
}

export type { XAIResponseStreamEvent };
export type {
    XAIImageCaps,
    XAIImageEndpointOptions,
    XAIImageGenerativeModel,
    XAIImageModelId,
} from "./images/types";
export type {
    XAIResponseCaps,
    XAIResponseEndpointOptions,
    XAIResponseGenerativeModel,
    XAIResponseModelId,
} from "./responses/types";
