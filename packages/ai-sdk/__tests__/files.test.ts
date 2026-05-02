import { describe, expect, test } from "bun:test";
import {
    aiSdkFileToBase64,
    aiSdkFileToBytes,
    aiSdkFileToGeneratedFile,
    filesFromResult,
    filesToContentParts,
} from "../src/files";

describe("files", () => {
    test("extracts base64 from base64, data URL, string data, and bytes", () => {
        expect(aiSdkFileToBase64({ base64: "YWJj" })).toBe("YWJj");
        expect(aiSdkFileToBase64({ data: "data:text/plain;base64,YWJj" })).toBe("YWJj");
        expect(aiSdkFileToBase64({ data: "YWJj" })).toBe("YWJj");
        expect(aiSdkFileToBase64({ uint8Array: new Uint8Array([97, 98, 99]) })).toBe("YWJj");
    });

    test("converts files to bytes", () => {
        expect(Array.from(aiSdkFileToBytes({ base64: "YWJj" }))).toEqual([97, 98, 99]);
        expect(Array.from(aiSdkFileToBytes({ data: new Uint8Array([1, 2]) }))).toEqual([1, 2]);
    });

    test("converts AI SDK files to generated file records", () => {
        expect(
            aiSdkFileToGeneratedFile({
                url: "https://example.com/file.png",
                mediaType: "image/png",
                providerMetadata: { id: "file-1" },
            }),
        ).toEqual({
            sourceType: "url",
            url: "https://example.com/file.png",
            mediaType: "image/png",
            providerMetadata: { id: "file-1" },
        });

        const dataFile = aiSdkFileToGeneratedFile({ base64: "YWJj", mediaType: "text/plain" });
        expect(dataFile.sourceType).toBe("data");
        expect(
            Array.from(dataFile.sourceType === "data" ? dataFile.data : new Uint8Array()),
        ).toEqual([97, 98, 99]);
    });

    test("maps result files and content parts", () => {
        expect(filesFromResult({ files: [{ url: "https://example.com/file.txt" }] })).toEqual([
            { sourceType: "url", url: "https://example.com/file.txt" },
        ]);

        const parts = filesToContentParts([
            { base64: "YWJj", mediaType: "image/png", providerMetadata: { id: "image-1" } },
            { url: "https://example.com/no-base64.png", mediaType: "image/png" },
        ]) as unknown[];

        expect(parts).toEqual([
            {
                type: "image",
                source: {
                    type: "data",
                    value: "YWJj",
                    mimeType: "image/png",
                },
                providerMetadata: { id: "image-1" },
            },
        ]);
    });
});
