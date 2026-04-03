import { describe, expect, test } from "bun:test";
import type { RunContext } from "@better-agent/core";
import { Events } from "@better-agent/core/events";
import { createOpenAI } from "../../src/openai";
import {
    mapFromOpenAIVideosResponse,
    mapToOpenAIVideosRequest,
} from "../../src/openai/videos/mappers";
import { VIDEO_BASE_PAYLOAD, VIDEO_FIXTURE } from "../fixtures/openai.video";

describe("openai-video deterministic", () => {
    test("request maps prompt, image input_reference, and options", () => {
        const mapped = mapToOpenAIVideosRequest({
            modelId: VIDEO_FIXTURE.modelId,
            options: {
                input: VIDEO_FIXTURE.prompt,
                input_reference: "AQID",
                size: VIDEO_FIXTURE.size,
                seconds: VIDEO_FIXTURE.seconds,
            },
        });
        if (mapped.isErr()) throw mapped.error;

        expect(mapped.value.model).toBe(VIDEO_FIXTURE.modelId);
        expect(mapped.value.prompt).toBe(VIDEO_FIXTURE.prompt);
        expect(mapped.value.input_reference).toBe("AQID");
        expect(mapped.value.size).toBe(VIDEO_FIXTURE.size);
        expect(mapped.value.seconds).toBe(VIDEO_FIXTURE.seconds);
    });

    test("request rejects invalid video input shapes", () => {
        const inputLimit = mapToOpenAIVideosRequest({
            modelId: VIDEO_FIXTURE.modelId,
            options: {
                input: ["one", "two"],
            } as never,
        });
        expect(inputLimit.isErr()).toBe(true);
        if (inputLimit.isOk()) throw new Error("Expected input limit error");
        expect(inputLimit.error.message.toLowerCase()).toContain("single input item");

        const urlImageRef = mapToOpenAIVideosRequest({
            modelId: VIDEO_FIXTURE.modelId,
            options: {
                input: [
                    {
                        type: "message",
                        role: "user",
                        content: [
                            { type: "text", text: VIDEO_FIXTURE.prompt },
                            {
                                type: "image",
                                source: {
                                    kind: "url",
                                    url: "https://example.com/ref.png",
                                },
                            },
                        ],
                    },
                ],
            } as never,
        });
        expect(urlImageRef.isErr()).toBe(true);
        if (urlImageRef.isOk()) throw new Error("Expected URL input_reference error");
        expect(urlImageRef.error.message.toLowerCase()).toContain("requires base64 image data");
    });

    test("response maps completed video and failed state", () => {
        const completed = mapFromOpenAIVideosResponse({
            raw: {
                ...VIDEO_BASE_PAYLOAD,
                id: VIDEO_FIXTURE.videoId,
                status: "completed",
                progress: 100,
                completed_at: 1700000005,
            },
            video: {
                data: "AQID",
                mimeType: "video/mp4",
            },
        });
        expect(completed.finishReason).toBe("stop");
        const completedMessage = completed.output[0];
        expect(completedMessage?.type).toBe("message");
        if (
            !completedMessage ||
            completedMessage.type !== "message" ||
            typeof completedMessage.content === "string"
        ) {
            throw new Error("Expected completed video output message");
        }
        const completedVideo = completedMessage.content[0];
        expect(completedVideo?.type).toBe("video");
        if (
            !completedVideo ||
            completedVideo.type !== "video" ||
            completedVideo.source.kind !== "base64"
        ) {
            throw new Error("Expected completed video base64 part");
        }
        expect(completedVideo.source.data).toBe("AQID");
        expect(completedVideo.source.mimeType).toBe("video/mp4");

        const failed = mapFromOpenAIVideosResponse({
            raw: {
                ...VIDEO_BASE_PAYLOAD,
                id: VIDEO_FIXTURE.videoId,
                status: "failed",
                progress: 0,
                error: {
                    code: "mock_failed_job",
                    message: "mock failed job",
                },
            },
        });
        expect(failed.finishReason).toBe("other");
        expect(failed.output.length).toBe(0);
    });

    test("stream flow emits progress and video lifecycle events", async () => {
        const provider = createOpenAI({
            apiKey: "dummy",
            baseURL: "https://api.openai.com",
        });
        const model = provider.video(VIDEO_FIXTURE.modelId);
        if (!model.doGenerateStream) {
            throw new Error("OpenAI video model does not implement doGenerateStream");
        }

        const capturedEvents: Array<{ type: string }> = [];
        const originalFetch = globalThis.fetch;
        const mockFetchImpl = async (
            input: RequestInfo | URL,
            init?: RequestInit,
        ): Promise<Response> => {
            const url = new URL(typeof input === "string" ? input : input.toString());
            const method = (init?.method ?? "GET").toUpperCase();
            const encodedVideoId = encodeURIComponent(VIDEO_FIXTURE.videoId);

            if (method === "POST" && url.pathname === "/v1/videos") {
                return new Response(
                    JSON.stringify({
                        ...VIDEO_BASE_PAYLOAD,
                        id: VIDEO_FIXTURE.videoId,
                        status: "queued",
                        progress: 0,
                    }),
                    { status: 200, headers: { "content-type": "application/json" } },
                );
            }
            if (method === "GET" && url.pathname === `/v1/videos/${encodedVideoId}`) {
                return new Response(
                    JSON.stringify({
                        ...VIDEO_BASE_PAYLOAD,
                        id: VIDEO_FIXTURE.videoId,
                        status: "completed",
                        progress: 100,
                        completed_at: 1700000005,
                    }),
                    { status: 200, headers: { "content-type": "application/json" } },
                );
            }
            if (method === "GET" && url.pathname === `/v1/videos/${encodedVideoId}/content`) {
                return new Response(VIDEO_FIXTURE.videoBytes, {
                    status: 200,
                    headers: { "content-type": "video/mp4" },
                });
            }
            return originalFetch(input, init);
        };
        globalThis.fetch = mockFetchImpl as typeof fetch;

        try {
            const runContext: RunContext = {
                runId: "run_video_stream",
                agentName: "test-agent",
                providerId: "openai",
                modelId: VIDEO_FIXTURE.modelId,
                generateMessageId: () => "msg_video_stream",
                signal: new AbortController().signal,
            };

            const streamResult = await model.doGenerateStream(
                {
                    input: VIDEO_FIXTURE.prompt,
                    size: VIDEO_FIXTURE.size,
                    seconds: VIDEO_FIXTURE.seconds,
                    pollIntervalMs: 250,
                    pollTimeoutMs: 5_000,
                },
                runContext,
            );
            if (streamResult.isErr()) throw streamResult.error;

            for await (const event of streamResult.value.events) {
                if (event.isErr()) throw event.error;
                capturedEvents.push(event.value);
            }
            const final = await streamResult.value.final;

            expect(capturedEvents.some((e) => e.type === Events.DATA_PART)).toBe(true);
            expect(capturedEvents.some((e) => e.type === Events.VIDEO_MESSAGE_START)).toBe(true);
            expect(capturedEvents.some((e) => e.type === Events.VIDEO_MESSAGE_CONTENT)).toBe(true);
            expect(capturedEvents.some((e) => e.type === Events.VIDEO_MESSAGE_END)).toBe(true);

            const finalMessage = final.output[0];
            expect(finalMessage?.type).toBe("message");
            if (
                !finalMessage ||
                finalMessage.type !== "message" ||
                typeof finalMessage.content === "string"
            ) {
                throw new Error("Expected final stream video message");
            }
            const finalVideo = finalMessage.content[0];
            expect(finalVideo?.type).toBe("video");
            if (!finalVideo || finalVideo.type !== "video" || finalVideo.source.kind !== "base64") {
                throw new Error("Expected final stream video base64 part");
            }
            expect(finalVideo.source.data.length).toBeGreaterThan(0);
            expect(finalVideo.source.mimeType).toBe("video/mp4");
        } finally {
            globalThis.fetch = originalFetch;
        }
    });

    test("non-stream failed job maps to upstream error", async () => {
        const provider = createOpenAI({
            apiKey: "dummy",
            baseURL: "https://api.openai.com",
        });
        const model = provider.video(VIDEO_FIXTURE.modelId);
        if (!model.doGenerate) {
            throw new Error("OpenAI video model does not implement doGenerate");
        }

        const originalFetch = globalThis.fetch;
        const mockFetchImpl = async (
            input: RequestInfo | URL,
            init?: RequestInit,
        ): Promise<Response> => {
            const url = new URL(typeof input === "string" ? input : input.toString());
            const method = (init?.method ?? "GET").toUpperCase();
            if (method === "POST" && url.pathname === "/v1/videos") {
                return new Response(
                    JSON.stringify({
                        ...VIDEO_BASE_PAYLOAD,
                        id: VIDEO_FIXTURE.videoId,
                        status: "failed",
                        progress: 0,
                        error: {
                            code: "mock_failed_job",
                            message: "mock failed job",
                        },
                    }),
                    { status: 200, headers: { "content-type": "application/json" } },
                );
            }
            return originalFetch(input, init);
        };
        globalThis.fetch = mockFetchImpl as typeof fetch;

        try {
            const result = await model.doGenerate(
                {
                    input: VIDEO_FIXTURE.prompt,
                    size: VIDEO_FIXTURE.size,
                    seconds: VIDEO_FIXTURE.seconds,
                },
                {
                    runId: "run_video_failed",
                    agentName: "test-agent",
                    providerId: "openai",
                    modelId: VIDEO_FIXTURE.modelId,
                    generateMessageId: () => "msg_video_failed",
                    signal: new AbortController().signal,
                },
            );
            expect(result.isErr()).toBe(true);
            if (result.isOk()) throw new Error("Expected failed video job to return error");
            expect(result.error.code).toBe("UPSTREAM_FAILED");
            expect(result.error.context?.upstreamCode).toBe("mock_failed_job");
            expect(result.error.message.toLowerCase()).toContain("mock failed job");
        } finally {
            globalThis.fetch = originalFetch;
        }
    });
});
