import type { AgentMessageContent, GeneratedFile } from "@better-agent/core";

export type AiSdkGeneratedFile = {
    data?: string | Uint8Array;
    uint8Array?: Uint8Array;
    base64?: string;
    url?: string;
    mediaType?: string;
    providerMetadata?: unknown;
};

export function aiSdkFileToBase64(file: AiSdkGeneratedFile): string | undefined {
    if (file.base64) {
        return file.base64;
    }

    if (typeof file.data === "string") {
        return file.data.startsWith("data:") ? file.data.split(",", 2)[1] : file.data;
    }

    const bytes = file.uint8Array ?? (file.data instanceof Uint8Array ? file.data : undefined);
    return bytes ? Buffer.from(bytes).toString("base64") : undefined;
}

export function aiSdkFileToBytes(file: AiSdkGeneratedFile): Uint8Array {
    if (file.uint8Array) {
        return file.uint8Array;
    }

    if (file.data instanceof Uint8Array) {
        return file.data;
    }

    const base64 = aiSdkFileToBase64(file) ?? "";
    return new Uint8Array(Buffer.from(base64, "base64"));
}

export function aiSdkFileToGeneratedFile(file: AiSdkGeneratedFile): GeneratedFile {
    const url =
        file.url ??
        (typeof file.data === "string" && file.data.startsWith("http") ? file.data : undefined);

    if (url) {
        return {
            sourceType: "url",
            url,
            mediaType: file.mediaType,
            providerMetadata: file.providerMetadata,
        };
    }

    return {
        sourceType: "data",
        data: aiSdkFileToBytes(file),
        mediaType: file.mediaType,
        providerMetadata: file.providerMetadata,
    };
}

export function filesFromResult(result: {
    files?: readonly AiSdkGeneratedFile[];
}): GeneratedFile[] {
    return result.files?.map(aiSdkFileToGeneratedFile) ?? [];
}

function contentTypeFor(mediaType: string | undefined): "image" | "audio" | "video" | "document" {
    if (mediaType?.startsWith("image/")) {
        return "image";
    }

    if (mediaType?.startsWith("audio/")) {
        return "audio";
    }

    if (mediaType?.startsWith("video/")) {
        return "video";
    }

    return "document";
}

export function filesToContentParts(
    files: readonly AiSdkGeneratedFile[] | undefined,
): Extract<AgentMessageContent, unknown[]> {
    return (
        files?.flatMap((file) => {
            const value = aiSdkFileToBase64(file);
            if (!value) {
                return [];
            }

            return [
                {
                    type: contentTypeFor(file.mediaType),
                    source: {
                        type: "data" as const,
                        value,
                        mimeType: file.mediaType ?? "application/octet-stream",
                    },
                    providerMetadata: file.providerMetadata,
                },
            ];
        }) ?? []
    );
}
