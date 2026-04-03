import { describe, expect, test } from "bun:test";
import {
    normalizeInputToMessages,
    projectConversationItemsToInput,
    pruneInputByCapabilities,
} from "../../src/run/messages";

describe("messages helpers", () => {
    test("normalizeInputToMessages wraps string in user message for chat models", () => {
        expect(
            normalizeInputToMessages("hello", {
                inputShape: "chat",
                outputModalities: { text: true },
            }),
        ).toEqual([{ type: "message", role: "user", content: "hello" }]);
    });

    test("normalizeInputToMessages wraps string in prompt message for prompt models", () => {
        const messages = normalizeInputToMessages("hello", {
            inputShape: "prompt",
            outputModalities: { text: true },
        });

        expect(messages).toHaveLength(1);
        expect(messages[0]).toMatchObject({ type: "message", content: "hello" });
    });

    test("response output items can be appended without stripping assistant media", () => {
        const items = [
            { type: "message", role: "user", content: "start" },
            ...([
                {
                    type: "message",
                    role: "assistant",
                    content: [
                        { type: "text", text: "hello" },
                        {
                            type: "image",
                            source: { kind: "url", url: "https://example.com/a.png" },
                        },
                        { type: "embedding", embedding: [0.1, 0.2] },
                    ],
                },
            ] as const),
        ];

        expect(items as unknown[]).toEqual([
            { type: "message", role: "user", content: "start" },
            {
                type: "message",
                role: "assistant",
                content: [
                    { type: "text", text: "hello" },
                    {
                        type: "image",
                        source: { kind: "url", url: "https://example.com/a.png" },
                    },
                    { type: "embedding", embedding: [0.1, 0.2] },
                ],
            },
        ]);
    });

    test("projectConversationItemsToInput preserves provider tool results and all supported parts", () => {
        const messages = projectConversationItemsToInput(
            [
                { type: "message", role: "user", content: "start" },
                {
                    type: "message",
                    role: "user",
                    content: [
                        {
                            type: "image",
                            source: { kind: "url", url: "https://example.com/u.png" },
                        },
                    ],
                },
                {
                    type: "message",
                    role: "assistant",
                    content: [
                        { type: "text", text: "hello" },
                        {
                            type: "image",
                            source: { kind: "url", url: "https://example.com/a.png" },
                        },
                        { type: "embedding", embedding: [0.1, 0.2] },
                        { type: "transcript", text: "hello world" },
                        { type: "reasoning", text: "summary", visibility: "summary" },
                    ],
                },
                { type: "provider-tool-result", name: "search", callId: "call_1", result: {} },
            ],
            {
                inputShape: "prompt",
                outputModalities: { text: true },
            } as never,
        );

        expect(messages as unknown[]).toEqual([
            { type: "message", content: "start" },
            {
                type: "message",
                content: [
                    {
                        type: "image",
                        source: { kind: "url", url: "https://example.com/u.png" },
                    },
                ],
            },
            {
                type: "message",
                content: [
                    { type: "text", text: "hello" },
                    {
                        type: "image",
                        source: { kind: "url", url: "https://example.com/a.png" },
                    },
                    { type: "embedding", embedding: [0.1, 0.2] },
                    { type: "transcript", text: "hello world" },
                    { type: "reasoning", text: "summary", visibility: "summary" },
                ],
            },
            { type: "provider-tool-result", name: "search", callId: "call_1", result: {} },
        ]);
    });

    test("tool-call results can be appended after messages", () => {
        expect([
            { type: "message", role: "user", content: "hello" },
            ...([
                { type: "tool-call", callId: "call_1", name: "lookup", result: { ok: true } },
            ] as const),
        ]).toEqual([
            { type: "message", role: "user", content: "hello" },
            { type: "tool-call", callId: "call_1", name: "lookup", result: { ok: true } },
        ]);
    });

    test("pruneInputByCapabilities removes unsupported parts and drops empty messages", () => {
        const pruned = pruneInputByCapabilities(
            [
                {
                    type: "message",
                    role: "user",
                    content: [
                        { type: "text", text: "keep" },
                        {
                            type: "image",
                            source: { kind: "url", url: "https://example.com/a.png" },
                        },
                        { type: "embedding", embedding: [0.1, 0.2] },
                        { type: "transcript", text: "spoken" },
                        { type: "reasoning", text: "why", visibility: "summary" },
                    ],
                },
                {
                    type: "message",
                    role: "assistant",
                    content: [
                        {
                            type: "video",
                            source: { kind: "url", url: "https://example.com/a.mp4" },
                        },
                    ],
                },
                { type: "provider-tool-result", name: "search", callId: "call_1", result: {} },
            ] as unknown as Parameters<typeof pruneInputByCapabilities>[0],
            {
                inputShape: "chat",
                inputModalities: { text: true, image: false, video: false, embedding: false },
                outputModalities: { text: true },
            } as never,
        );

        expect(pruned as unknown[]).toEqual([
            {
                type: "message",
                role: "user",
                content: [
                    { type: "text", text: "keep" },
                    { type: "transcript", text: "spoken" },
                    { type: "reasoning", text: "why", visibility: "summary" },
                ],
            },
            { type: "provider-tool-result", name: "search", callId: "call_1", result: {} },
        ]);
    });

    test("pruneInputByCapabilities preserves providerMetadata on parts that remain", () => {
        const pruned = pruneInputByCapabilities(
            [
                {
                    type: "message",
                    role: "user",
                    content: [
                        {
                            type: "text",
                            text: "keep",
                            providerMetadata: {
                                anthropic: {
                                    citations: [{ start: 0, end: 4, document_id: "doc_1" }],
                                },
                            },
                        },
                        {
                            type: "image",
                            source: { kind: "url", url: "https://example.com/a.png" },
                            providerMetadata: {
                                anthropic: {
                                    cacheControl: { type: "ephemeral" },
                                },
                            },
                        },
                    ],
                },
            ] as unknown as Parameters<typeof pruneInputByCapabilities>[0],
            {
                inputShape: "chat",
                inputModalities: { text: true, image: false },
                outputModalities: { text: true },
            } as never,
        );

        expect(pruned as unknown[]).toEqual([
            {
                type: "message",
                role: "user",
                content: [
                    {
                        type: "text",
                        text: "keep",
                        providerMetadata: {
                            anthropic: {
                                citations: [{ start: 0, end: 4, document_id: "doc_1" }],
                            },
                        },
                    },
                ],
            },
        ]);
    });

    test("pruneInputByCapabilities preserves multimodal content when caps support it", () => {
        const pruned = pruneInputByCapabilities(
            [
                {
                    type: "message",
                    role: "assistant",
                    content: [
                        { type: "text", text: "hello" },
                        {
                            type: "image",
                            source: { kind: "url", url: "https://example.com/a.png" },
                        },
                        { type: "embedding", embedding: [0.1, 0.2] },
                    ],
                },
            ] as unknown as Parameters<typeof pruneInputByCapabilities>[0],
            {
                inputShape: "chat",
                inputModalities: { text: true, image: true, embedding: true },
                outputModalities: { text: true },
            } as never,
        );

        expect(pruned as unknown[]).toEqual([
            {
                type: "message",
                role: "assistant",
                content: [
                    { type: "text", text: "hello" },
                    {
                        type: "image",
                        source: { kind: "url", url: "https://example.com/a.png" },
                    },
                    { type: "embedding", embedding: [0.1, 0.2] },
                ],
            },
        ]);
    });
});
