import { describe, expect, test } from "bun:test";
import { BetterAgentError } from "@better-agent/shared/errors";
import type { AgentMessage } from "../src/ag-ui/messages";
import {
    supportsInputModality,
    supportsOutputModality,
    supportsStructuredOutput,
    supportsTextOutput,
    supportsToolCalls,
} from "../src/capabilities/guards";
import { prepareMessagesForCapabilities } from "../src/capabilities/modalities";
import type { AgentCapabilities } from "../src/capabilities/types";

const capabilities: AgentCapabilities = {
    output: {
        supportedMimeTypes: ["text/plain"],
        structuredOutput: true,
    },
    multimodal: {
        input: { image: true, pdf: true },
        output: { image: true },
    },
    tools: { supported: true },
};

describe("capabilities", () => {
    test("capability guards only pass explicitly supported features", () => {
        expect(supportsTextOutput(capabilities)).toBe(true);
        expect(supportsStructuredOutput(capabilities)).toBe(true);
        expect(supportsToolCalls(capabilities)).toBe(true);
        expect(supportsInputModality(capabilities, "image")).toBe(true);
        expect(supportsInputModality(capabilities, "audio")).toBe(false);
        expect(supportsOutputModality(capabilities, "image")).toBe(true);
        expect(supportsOutputModality({}, "image")).toBe(false);
    });

    test("prepareMessagesForCapabilities keeps supported parts", () => {
        const messages = [
            {
                id: "message-1",
                role: "user",
                content: [
                    { type: "text", text: "hello" },
                    { type: "image", image: "data:image/png;base64,abc" },
                    {
                        type: "document",
                        source: {
                            type: "url",
                            url: "https://example.com/a.pdf",
                            mimeType: "application/pdf",
                        },
                    },
                ],
            },
        ] as unknown as AgentMessage[];

        expect(prepareMessagesForCapabilities({ messages, capabilities })).toEqual(messages);
    });

    test("prepareMessagesForCapabilities throws for unsupported parts", () => {
        const messages = [
            {
                id: "message-1",
                role: "user",
                content: [{ type: "audio", audio: "data:audio/wav;base64,abc" }],
            },
        ] as unknown as AgentMessage[];

        expect(() => prepareMessagesForCapabilities({ messages, capabilities })).toThrow(
            BetterAgentError,
        );
    });

    test("prepareMessagesForCapabilities leaves irrelevant messages unchanged", () => {
        const messages = [
            { id: "system-1", role: "system", content: "hello" },
            { id: "user-1", role: "user", content: "plain text" },
        ] as AgentMessage[];

        expect(prepareMessagesForCapabilities({ messages, capabilities: {} })).toEqual(messages);
    });
});
