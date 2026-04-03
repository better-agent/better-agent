import { describe, expect, test } from "bun:test";
import { createXAI } from "../../src/xai";
import { mapToXAIResponsesRequest } from "../../src/xai/responses";

describe("xai hosted tools", () => {
    test("provider exposes native tool builders", () => {
        const xai = createXAI({});
        const tool = xai.tools.webSearch();
        expect(tool.kind).toBe("hosted");
        expect(tool.provider).toBe("xai");
        expect(tool.type).toBe("web_search");
    });

    test("request mapping includes hosted xAI tools", () => {
        const xai = createXAI({});
        const mapped = mapToXAIResponsesRequest({
            modelId: "grok-4",
            options: {
                input: "Search the web for the latest xAI release notes.",
                tools: [xai.tools.webSearch(), xai.tools.xSearch()],
            },
        });
        if (mapped.isErr()) throw mapped.error;

        const tools = mapped.value.tools as Array<Record<string, unknown>> | undefined;
        expect(tools?.some((tool) => tool.type === "web_search")).toBe(true);
        expect(tools?.some((tool) => tool.type === "x_search")).toBe(true);
    });
});
