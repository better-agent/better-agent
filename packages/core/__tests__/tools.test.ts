import { describe, expect, test } from "bun:test";
import { defineTool } from "../src/tools/define-tool";
import {
    dedupeToolsByName,
    isClientTool,
    isDefinedTool,
    isProviderTool,
    isServerTool,
    resolveTools,
    toModelToolDefinitions,
    toProviderToolSet,
} from "../src/tools/resolve-tools";
import type { AnyDefinedTool, ProviderToolDefinition } from "../src/tools/types";

const objectSchema = {
    type: "object",
    properties: {
        value: { type: "string" },
    },
    required: ["value"],
};

const serverTool = (name: string): AnyDefinedTool => ({
    name,
    target: "server",
    description: `${name} description`,
    inputSchema: objectSchema,
    strict: true,
    execute: () => ({ ok: true }),
});

describe("tools", () => {
    test("defineTool returns the exact config", () => {
        const tool = serverTool("search");

        expect(defineTool(tool)).toBe(tool);
    });

    test("resolveTools resolves empty, static, and function sources", async () => {
        const tool = serverTool("search");

        expect(await resolveTools(undefined, { userId: "user-1" })).toEqual([]);

        const staticResult = await resolveTools([tool], { userId: "user-1" });
        expect(staticResult).toEqual([tool]);
        expect(staticResult).not.toBe([tool]);

        const dynamicResult = await resolveTools(
            (ctx: { userId: string }) => {
                expect(ctx.userId).toBe("user-1");
                return [tool];
            },
            { userId: "user-1" },
        );

        expect(dynamicResult).toEqual([tool]);
    });

    test("dedupeToolsByName keeps anonymous tools and lets the last named tool win", () => {
        const first = serverTool("search");
        const last = { ...serverTool("search"), description: "last one wins" };
        const anonymous = { id: "provider.tool" } as ProviderToolDefinition;

        expect(dedupeToolsByName([first, anonymous, last])).toEqual([anonymous, last]);
    });

    test("converts defined tools to model tool definitions", () => {
        expect(toModelToolDefinitions([serverTool("search")])).toEqual([
            {
                name: "search",
                description: "search description",
                parameters: objectSchema,
                strict: true,
            },
        ]);
    });

    test("normalizes provider tool sets from names and dotted ids", () => {
        expect(
            toProviderToolSet([
                { name: "web_search", config: true },
                { id: "provider.file_search", config: true },
                { id: "unnamed" },
            ]),
        ).toEqual({
            web_search: { name: "web_search", config: true },
            file_search: { id: "provider.file_search", name: "file_search", config: true },
        });
    });

    test("classifies provider, client, and server tools", () => {
        const providerTool = { type: "provider-tool" };
        const clientTool: AnyDefinedTool = {
            name: "confirm",
            target: "client",
            inputSchema: objectSchema,
        };
        const tool = serverTool("search");

        expect(isProviderTool(providerTool)).toBe(true);
        expect(isDefinedTool(providerTool)).toBe(false);
        expect(isDefinedTool(tool)).toBe(true);
        expect(isServerTool(tool)).toBe(true);
        expect(isClientTool(clientTool)).toBe(true);
    });
});
