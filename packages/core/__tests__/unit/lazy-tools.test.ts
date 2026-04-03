import { describe, expect, test } from "bun:test";
import { TOOL_CLEANUP } from "../../src/tools/constants";
import { defineTool } from "../../src/tools/define-tool";
import { lazyTools } from "../../src/tools/lazy-tools";
import { resolveToolsForRun } from "../../src/tools/resolve-tools";

describe("lazyTools", () => {
    test("shares one in-flight load and caches the resolved tools", async () => {
        let loads = 0;
        const lookup = defineTool({
            name: "lookup",
            schema: { type: "object", properties: {}, additionalProperties: false } as const,
        }).server(async () => "ok");
        const source = lazyTools(async () => {
            loads += 1;
            return { tools: [lookup] };
        });

        const [first, second] = await Promise.all([
            resolveToolsForRun({ agentTools: source }),
            resolveToolsForRun({ agentTools: source }),
        ]);

        expect(loads).toBe(1);
        expect(first.tools.map((tool) => tool.name)).toEqual(["lookup"]);
        expect(second.tools.map((tool) => tool.name)).toEqual(["lookup"]);

        await resolveToolsForRun({ agentTools: source });
        expect(loads).toBe(1);
    });

    test("clears the cache after a failed load so the next resolve retries", async () => {
        let attempts = 0;
        const lookup = defineTool({
            name: "lookup",
            schema: { type: "object", properties: {}, additionalProperties: false } as const,
        }).server(async () => "ok");
        const source = lazyTools(async () => {
            attempts += 1;
            if (attempts === 1) {
                throw new Error("boom");
            }

            return { tools: [lookup] };
        });

        await expect(resolveToolsForRun({ agentTools: source })).rejects.toThrow("boom");

        const resolved = await resolveToolsForRun({ agentTools: source });

        expect(attempts).toBe(2);
        expect(resolved.tools.map((tool) => tool.name)).toEqual(["lookup"]);
    });

    test("dispose clears the cache and runs the provider disposer once", async () => {
        let loads = 0;
        let disposed = 0;
        const lookup = defineTool({
            name: "lookup",
            schema: { type: "object", properties: {}, additionalProperties: false } as const,
        }).server(async () => "ok");
        const source = lazyTools(async () => {
            loads += 1;
            return {
                tools: [lookup],
                dispose: async () => {
                    disposed += 1;
                },
            };
        });

        await resolveToolsForRun({ agentTools: source });
        await source.dispose();
        await resolveToolsForRun({ agentTools: source });

        expect(loads).toBe(2);
        expect(disposed).toBe(1);
    });

    test("run cleanup still only executes per-tool cleanup", async () => {
        let runCleanupCalls = 0;
        let providerDisposeCalls = 0;
        const toolCleanup = () => {
            runCleanupCalls += 1;
        };
        const lookup = defineTool({
            name: "lookup",
            schema: { type: "object", properties: {}, additionalProperties: false } as const,
        }).server(async () => "ok");
        lookup[TOOL_CLEANUP] = toolCleanup;

        const source = lazyTools(async () => ({
            tools: [lookup],
            dispose: async () => {
                providerDisposeCalls += 1;
            },
        }));

        const resolved = await resolveToolsForRun({ agentTools: source });
        await resolved.runCleanup();

        expect(runCleanupCalls).toBe(1);
        expect(providerDisposeCalls).toBe(0);
    });
});
