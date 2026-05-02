import { describe, expect, test } from "bun:test";
import type { AgentMessage, AgentMessageContent } from "@better-agent/core";
import {
    textFromContent,
    toAiSdkMessages,
    toAiSdkPrompt,
    toAiSdkUserContent,
} from "../src/messages";

const richContent = [
    { type: "text", text: "hello " },
    {
        type: "image",
        source: { type: "data", value: "aW1hZ2U=", mimeType: "image/png" },
    },
    {
        type: "document",
        source: { type: "url", value: "https://example.com/doc.pdf", mimeType: "application/pdf" },
    },
] as unknown as AgentMessageContent;

describe("messages", () => {
    test("extracts text from string and rich content", () => {
        expect(textFromContent("hello")).toBe("hello");
        expect(textFromContent(richContent)).toBe("hello ");
        expect(textFromContent(undefined)).toBe("");
    });

    test("converts user content to AI SDK content", () => {
        expect(toAiSdkUserContent("hello")).toBe("hello");
        expect(toAiSdkUserContent(richContent)).toEqual([
            { type: "text", text: "hello " },
            {
                type: "image",
                image: "data:image/png;base64,aW1hZ2U=",
                mediaType: "image/png",
            },
            {
                type: "file",
                data: "https://example.com/doc.pdf",
                mediaType: "application/pdf",
            },
        ]);
    });

    test("converts Better Agent messages to AI SDK model messages", () => {
        const messages: AgentMessage[] = [
            { id: "system-1", role: "system", content: "system" },
            { id: "developer-1", role: "developer", content: "developer" },
            { id: "user-1", role: "user", content: richContent },
            {
                id: "assistant-1",
                role: "assistant",
                content: "answer",
                sources: [
                    {
                        id: "source-1",
                        sourceType: "url",
                        url: "https://example.com",
                        title: "Example",
                    },
                ],
                toolCalls: [
                    {
                        id: "call-1",
                        type: "function",
                        function: { name: "search", arguments: '{"query":"docs"}' },
                    },
                ],
            },
            { id: "tool-1", role: "tool", toolCallId: "call-1", content: { ok: true } },
        ] as unknown as AgentMessage[];

        expect(toAiSdkMessages(messages)).toEqual([
            { role: "system", content: "system" },
            { role: "system", content: "developer" },
            {
                role: "user",
                content: [
                    { type: "text", text: "hello " },
                    {
                        type: "image",
                        image: "data:image/png;base64,aW1hZ2U=",
                        mediaType: "image/png",
                    },
                    {
                        type: "file",
                        data: "https://example.com/doc.pdf",
                        mediaType: "application/pdf",
                    },
                ],
            },
            {
                role: "assistant",
                content: [
                    {
                        type: "text",
                        text: "answer\n\nSources:\n- Example: https://example.com",
                    },
                    {
                        type: "tool-call",
                        toolCallId: "call-1",
                        toolName: "search",
                        input: { query: "docs" },
                    },
                ],
            },
            {
                role: "tool",
                content: [
                    {
                        type: "tool-result",
                        toolCallId: "call-1",
                        toolName: "search",
                        output: { type: "json", value: { ok: true } },
                    },
                ],
            },
        ]);
    });

    test("falls back for invalid tool input and unknown tool result names", () => {
        const messages = [
            {
                id: "assistant-1",
                role: "assistant",
                toolCalls: [
                    {
                        id: "call-1",
                        type: "function",
                        function: { name: "search", arguments: "not-json" },
                    },
                ],
            },
            { id: "tool-1", role: "tool", toolCallId: "missing", content: "done" },
        ] as unknown as AgentMessage[];

        expect(toAiSdkMessages(messages)).toEqual([
            {
                role: "assistant",
                content: [
                    {
                        type: "tool-call",
                        toolCallId: "call-1",
                        toolName: "search",
                        input: "not-json",
                    },
                ],
            },
            {
                role: "tool",
                content: [
                    {
                        type: "tool-result",
                        toolCallId: "missing",
                        toolName: "unknown",
                        output: { type: "text", value: "done" },
                    },
                ],
            },
        ]);
    });

    test("splits system messages into the AI SDK system option", () => {
        const messages: AgentMessage[] = [
            { id: "system-1", role: "system", content: "system" },
            { id: "developer-1", role: "developer", content: "developer" },
            { id: "user-1", role: "user", content: "hello" },
        ] as unknown as AgentMessage[];

        expect(toAiSdkPrompt(messages)).toEqual({
            system: [
                { role: "system", content: "system" },
                { role: "system", content: "developer" },
            ],
            messages: [{ role: "user", content: "hello" }],
        });
    });
});
