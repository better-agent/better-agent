import { describe, expect, test } from "bun:test";
import { EventType } from "@ag-ui/core";
import { BetterAgentError } from "@better-agent/shared/errors";
import type { AgentEvent } from "../src/ag-ui/events";
import { createPluginRuntime, definePlugin } from "../src/plugins/runtime";
import type { Plugin, PluginEventContext, PluginGuardContext } from "../src/plugins/types";

const guardContext: PluginGuardContext = {
    agentName: "agent",
    input: {},
    request: new Request("https://example.com"),
    auth: null,
};

const eventContext: PluginEventContext = {
    runId: "run-1",
    agentName: "agent",
    control: {
        abortRun: async () => {},
    },
};

describe("plugin runtime", () => {
    test("definePlugin returns the exact plugin object", () => {
        const plugin = { id: "logging" };

        expect(definePlugin(plugin)).toBe(plugin);
    });

    test("validates plugin ids and endpoints", () => {
        expect(() => createPluginRuntime([{ id: " " }])).toThrow(BetterAgentError);
        expect(() => createPluginRuntime([{ id: "a" }, { id: "a" }])).toThrow(BetterAgentError);
        expect(() =>
            createPluginRuntime([
                {
                    id: "a",
                    endpoints: [
                        {
                            method: "GET",
                            path: "missing-slash",
                            handler: async () => new Response(),
                        },
                    ],
                },
            ]),
        ).toThrow(BetterAgentError);
        expect(() =>
            createPluginRuntime([
                {
                    id: "a",
                    endpoints: [
                        { method: "GET", path: "/health", handler: async () => new Response() },
                        { method: "GET", path: "/health", handler: async () => new Response() },
                    ],
                },
            ]),
        ).toThrow(BetterAgentError);
    });

    test("sets runtime flags and expands endpoint method arrays", () => {
        const runtime = createPluginRuntime([
            {
                id: "a",
                guards: [async () => null],
                endpoints: [
                    {
                        method: ["GET", "POST"],
                        path: "/health",
                        handler: async () => new Response(),
                    },
                ],
                events: { middleware: [async (event) => event] },
                onEvent: async () => {},
                tools: [{ name: "tool", target: "client", inputSchema: {} }],
                onStep: async () => {},
                onBeforeModelCall: async () => {},
                onBeforeToolCall: async () => undefined,
            },
        ]);

        expect(runtime.hasGuards).toBe(true);
        expect(runtime.hasEndpoints).toBe(true);
        expect(runtime.hasEventMiddleware).toBe(true);
        expect(runtime.hasOnEvent).toBe(true);
        expect(runtime.hasTools).toBe(true);
        expect(runtime.hasStepHooks).toBe(true);
        expect(runtime.hasModelHooks).toBe(true);
        expect(runtime.hasToolHooks).toBe(true);
        expect(runtime.endpoints.map((endpoint) => endpoint.method)).toEqual(["GET", "POST"]);
    });

    test("dispatchGuard stops on first response and wraps thrown errors", async () => {
        const calls: string[] = [];
        const response = new Response("denied", { status: 403 });
        const runtime = createPluginRuntime([
            {
                id: "a",
                guards: [
                    async () => {
                        calls.push("a");
                        return null;
                    },
                ],
            },
            {
                id: "b",
                guards: [
                    async () => {
                        calls.push("b");
                        return response;
                    },
                ],
            },
            {
                id: "c",
                guards: [
                    async () => {
                        calls.push("c");
                        return null;
                    },
                ],
            },
        ]);

        expect(await runtime.dispatchGuard(guardContext)).toBe(response);
        expect(calls).toEqual(["a", "b"]);

        const failing = createPluginRuntime([
            {
                id: "bad",
                guards: [
                    async () => {
                        throw new Error("boom");
                    },
                ],
            },
        ]);
        await expect(failing.dispatchGuard(guardContext)).rejects.toThrow(BetterAgentError);
    });

    test("dispatchEvent applies subscribed middleware in order", async () => {
        type MarkedEvent = AgentEvent & { a?: boolean; b?: boolean };
        const runtime = createPluginRuntime([
            {
                id: "a",
                events: {
                    subscribe: [EventType.RUN_STARTED],
                    middleware: [
                        async (event, _ctx, next) => {
                            const nextEvent: MarkedEvent = { ...event, a: true };
                            return next(nextEvent);
                        },
                    ],
                },
            },
            {
                id: "b",
                events: {
                    middleware: [async (event) => ({ ...event, b: true }) as MarkedEvent],
                },
            },
        ]);

        const result = await runtime.dispatchEvent(
            { type: EventType.RUN_STARTED, timestamp: 1 } as AgentEvent,
            eventContext,
        );

        expect(result).toMatchObject({ a: true, b: true });
    });

    test("resolves and dedupes plugin tools", async () => {
        const runtime = createPluginRuntime([
            { id: "a", tools: [{ name: "search", target: "client", inputSchema: {} }] },
            {
                id: "b",
                tools: () => [
                    { name: "search", target: "server", inputSchema: {}, execute: () => null },
                ],
            },
        ]);

        expect(
            (await runtime.resolveTools()).map((tool) =>
                "target" in tool ? tool.target : undefined,
            ),
        ).toEqual(["server"]);
    });

    test("runs hooks in order and returns skip decisions", async () => {
        const calls: string[] = [];
        const plugin = (id: string): Plugin => ({
            id,
            onStep: async () => {
                calls.push(`${id}:step`);
            },
            onStepFinish: async () => {
                calls.push(`${id}:stepFinish`);
            },
            onBeforeModelCall: async () => {
                calls.push(`${id}:beforeModel`);
            },
            onAfterModelCall: async () => {
                calls.push(`${id}:afterModel`);
            },
            onBeforeToolCall: async () => {
                calls.push(`${id}:beforeTool`);
                return id === "b" ? { skip: true, result: "skipped" } : undefined;
            },
            onAfterToolCall: async () => {
                calls.push(`${id}:afterTool`);
            },
        });
        const runtime = createPluginRuntime([plugin("a"), plugin("b")]);
        const ctx = { runId: "run-1", agentName: "agent" };

        await runtime.applyOnStep(ctx as unknown as Parameters<typeof runtime.applyOnStep>[0]);
        await runtime.applyOnStepFinish(
            ctx as unknown as Parameters<typeof runtime.applyOnStepFinish>[0],
        );
        await runtime.applyBeforeModelCall(
            ctx as unknown as Parameters<typeof runtime.applyBeforeModelCall>[0],
        );
        await runtime.applyAfterModelCall(
            ctx as unknown as Parameters<typeof runtime.applyAfterModelCall>[0],
        );
        expect(
            await runtime.applyBeforeToolCall(
                ctx as unknown as Parameters<typeof runtime.applyBeforeToolCall>[0],
            ),
        ).toEqual({ skip: true, result: "skipped" });
        await runtime.applyAfterToolCall(
            ctx as unknown as Parameters<typeof runtime.applyAfterToolCall>[0],
        );

        expect(calls).toEqual([
            "a:step",
            "b:step",
            "a:stepFinish",
            "b:stepFinish",
            "a:beforeModel",
            "b:beforeModel",
            "a:afterModel",
            "b:afterModel",
            "a:beforeTool",
            "b:beforeTool",
            "a:afterTool",
            "b:afterTool",
        ]);
    });
});
