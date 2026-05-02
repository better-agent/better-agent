import { describe, expect, test } from "bun:test";
import type { AgentModelToolDefinition } from "@better-agent/core";
import { mergeAiSdkTools, toAiSdkTools } from "../src/tools";

const tools: AgentModelToolDefinition[] = [
    {
        name: "search",
        description: "Search docs",
        parameters: {
            type: "object",
            properties: { query: { type: "string" } },
            required: ["query"],
        },
        strict: true,
    },
];

describe("tools", () => {
    test("returns undefined for empty tool sets", () => {
        expect(toAiSdkTools(undefined)).toBeUndefined();
        expect(toAiSdkTools([])).toBeUndefined();
        expect(mergeAiSdkTools(undefined, undefined)).toBeUndefined();
    });

    test("converts Better Agent tool definitions to AI SDK tool sets", () => {
        const result = toAiSdkTools(tools);

        expect(result).toBeDefined();
        expect(Object.keys(result ?? {})).toEqual(["search"]);
    });

    test("merges converted tools with provider tools", () => {
        const providerTool = { type: "provider-tool" };
        const result = mergeAiSdkTools(tools, { native_search: providerTool });

        expect(Object.keys(result ?? {}).sort()).toEqual(["native_search", "search"]);
        expect((result as unknown as Record<string, unknown>).native_search).toBe(providerTool);
    });
});
