export const IMAGE_FIXTURE = {
    prompt: "Generate image.",
    requestOptions: {
        input: "Generate image.",
        n: 1,
        quality: "low" as const,
        output_format: "webp" as const,
        output_compression: 80,
        stream: true,
        partial_images: 2,
        size: "1536x1024" as const,
        moderation: "low" as const,
        background: "transparent" as const,
        user: "test-user",
    },
    streamMessageId: "msg_1",
    urlResponse: {
        created: 1,
        data: [{ url: "https://example.com/image.png" }],
    },
    base64Response: {
        created: 1,
        output_format: "webp" as const,
        data: [{ b64_json: "AQID" }],
    },
};
