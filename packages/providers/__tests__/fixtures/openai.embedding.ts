export const EMBEDDING_FIXTURE = {
    requestOptions: {
        model: "text-embedding-3-small" as const,
        input: "Embed me.",
        encoding_format: "float" as const,
        dimensions: 64,
        user: "test-user-1",
    },
    response: {
        object: "list" as const,
        model: "text-embedding-3-small",
        data: [
            {
                object: "embedding" as const,
                index: 0,
                embedding: [0.12, 0.34, 0.56],
            },
        ],
        usage: {
            prompt_tokens: 3,
            total_tokens: 3,
        },
    },
};
