import { describe, expect, test } from "bun:test";
import { defineAgent } from "../../src";
import type { AnyAgentDefinition } from "../../src";
import { Events } from "../../src/events";
import type { Event } from "../../src/events";
import type { ConversationStore } from "../../src/persistence";
import { createPluginRuntime, definePlugin } from "../../src/plugins";
import type { BetterAgentRuntime } from "../../src/run";
import { createRuntime } from "../../src/run";
import { createServer } from "../../src/server";
import { defineTool } from "../../src/tools";
import { TOOL_JSON_SCHEMA } from "../../src/tools";
import type { AgentToolDefinition } from "../../src/tools";
import { createTextAgent, createTextModel, createTextResponse } from "../helpers/mock-model";

describe("plugin runtime integration", () => {
    test("mounts plugin endpoints on the server", async () => {
        const pluginRuntime = createPluginRuntime([
            definePlugin({
                id: "health",
                endpoints: [
                    { method: "GET", path: "/health", handler: () => Response.json({ ok: true }) },
                ],
            }),
        ]);

        const runtime = createRuntime({ agents: [] as const, pluginRuntime });
        const server = createServer({ runtime, pluginRuntime });
        const response = await server.handle(new Request("https://example.com/health"));

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({ ok: true });
    });

    test("applies model hooks, event middleware, and save hooks during run execution", async () => {
        const seenModelInputs: Array<Record<string, unknown>> = [];
        const observedPluginEvents: string[] = [];
        const observedUserEvents: string[] = [];
        let sawAfterModelCall = false;
        let savedItems: unknown[] = [];

        const pluginRuntime = createPluginRuntime([
            definePlugin({
                id: "runtime-hooks",
                events: { subscribe: [Events.STEP_START], middleware: [async () => null] },
                onEvent: async (event) => {
                    observedPluginEvents.push(event.type);
                },
                onBeforeModelCall: async (ctx) => {
                    ctx.setInput([
                        ...ctx.input,
                        { type: "message", role: "user", content: "plugin-added-message" },
                    ]);
                },
                onAfterModelCall: async () => {
                    sawAfterModelCall = true;
                },
                onBeforeSave: async (ctx) => {
                    ctx.setItems([{ type: "message", role: "user", content: "saved-by-plugin" }]);
                },
            }),
        ]);

        const agent = defineAgent({
            name: "assistant",
            model: {
                ...createTextModel((options) => seenModelInputs.push(options)),
                caps: {
                    ...createTextModel().caps,
                    supportsInstruction: true,
                },
            },
            instruction: "Be helpful.",
        });

        const conversations: ConversationStore = {
            async load() {
                return null;
            },
            async save(params) {
                savedItems = params.items;
                return { cursor: "cursor_1" };
            },
        };

        const runtime = createRuntime({
            agents: [agent] as const,
            pluginRuntime,
            conversations,
        });

        const result = await runtime.run(agent.name, {
            input: [{ type: "message", role: "user", content: "hello" }],
            conversationId: "conv_1",
            onEvent: async (event: Event) => {
                observedUserEvents.push(event.type);
            },
        });

        expect(result.response.output).toEqual(createTextResponse("hello").output);
        expect(seenModelInputs[0]?.input).toContainEqual({
            type: "message",
            role: "user",
            content: "plugin-added-message",
        });
        expect(sawAfterModelCall).toBeTrue();
        expect(observedUserEvents).not.toContain(Events.STEP_START);
        expect(observedPluginEvents).toContain(Events.RUN_STARTED);
        expect(observedPluginEvents).toContain(Events.RUN_FINISHED);
        expect(savedItems).toEqual([{ type: "message", role: "user", content: "saved-by-plugin" }]);
    });

    test("keeps base tools ahead of plugin tools and lets later plugins win duplicate tool names", async () => {
        const schema = { type: "object", properties: {} } as const;
        const sharedPluginFirst: AgentToolDefinition = {
            kind: "server",
            name: "shared",
            description: "plugin-first",
            schema,
            [TOOL_JSON_SCHEMA]: schema,
            handler: async () => "plugin-first",
        };
        const sharedPluginSecond: AgentToolDefinition = {
            kind: "server",
            name: "shared",
            description: "plugin-second",
            schema,
            [TOOL_JSON_SCHEMA]: schema,
            handler: async () => "plugin-second",
        };
        const sharedAgentTool: AgentToolDefinition = {
            kind: "server",
            name: "shared",
            description: "agent-tool",
            schema,
            [TOOL_JSON_SCHEMA]: schema,
            handler: async () => "agent",
        };

        const pluginRuntime = createPluginRuntime([
            definePlugin({ id: "first", tools: [sharedPluginFirst] }),
            definePlugin({ id: "second", tools: [sharedPluginSecond] }),
        ]);

        const resolvedPluginTools = await pluginRuntime.resolveTools();
        expect(resolvedPluginTools.tools).toHaveLength(1);
        expect(resolvedPluginTools.tools[0]?.description).toBe("plugin-second");
        await resolvedPluginTools.runCleanup();

        const seenModelTools: Array<{ name: string; description?: string }[]> = [];
        const agent = {
            name: "assistant",
            model: {
                ...createTextModel((options) => {
                    const tools =
                        (
                            options as {
                                tools?: ReadonlyArray<{ name: string; description?: string }>;
                            }
                        ).tools ?? [];
                    seenModelTools.push([...tools]);
                }),
                caps: {
                    ...createTextModel().caps,
                    tools: true,
                    supportsInstruction: true,
                },
            },
            instruction: "Be helpful.",
            tools: [sharedAgentTool],
        } as unknown as AnyAgentDefinition;

        const runtime = createRuntime({
            agents: [agent] as const,
            pluginRuntime,
        } as Parameters<typeof createRuntime>[0]) as unknown as BetterAgentRuntime;

        await runtime.run(agent.name, {
            input: [{ type: "message", role: "user", content: "hello" }],
        });

        expect(seenModelTools[0]?.find((tool) => tool.name === "shared")?.description).toBe(
            "agent-tool",
        );
    });

    test("plugin abortRun aborts runs even when an external signal is provided", async () => {
        const pluginRuntime = createPluginRuntime([
            definePlugin({
                id: "abort-on-start",
                events: {
                    middleware: [
                        async (event, ctx) => {
                            if (event.type === Events.RUN_STARTED) {
                                await ctx.control.abortRun();
                            }
                            return event;
                        },
                    ],
                },
            }),
        ]);

        const agent = createTextAgent();
        const runtime = createRuntime({
            agents: [agent] as const,
            pluginRuntime,
        }) as unknown as BetterAgentRuntime;
        const controller = new AbortController();

        expect(
            runtime.run(agent.name, { input: "hello", signal: controller.signal }),
        ).rejects.toMatchObject({
            code: "ABORTED",
        });
    });

    test("onBeforeModelCall only exposes tool controls for tool-capable models", async () => {
        const seen: Array<{
            agentName: string;
            hasTools: boolean;
            hasSetTools: boolean;
            hasSetToolChoice: boolean;
        }> = [];

        const pluginRuntime = createPluginRuntime([
            definePlugin({
                id: "model-call-cap-gating",
                onBeforeModelCall(ctx) {
                    seen.push({
                        agentName: ctx.agentName,
                        hasTools: "tools" in ctx,
                        hasSetTools: "setTools" in ctx,
                        hasSetToolChoice: "setToolChoice" in ctx,
                    });

                    if ("tools" in ctx && "setTools" in ctx) {
                        ctx.setTools([...ctx.tools]);
                    }

                    if ("setToolChoice" in ctx) {
                        ctx.setToolChoice({ type: "auto" });
                    }
                },
            }),
        ]);

        const noToolsAgent = createTextAgent({ name: "no_tools" });
        const toolModel = createTextModel();
        const toolCapableAgent = createTextAgent({
            name: "with_tools",
            model: {
                ...toolModel,
                caps: {
                    ...toolModel.caps,
                    tools: true,
                },
            },
            tools: [
                defineTool({
                    name: "lookup",
                    schema: {
                        type: "object",
                        properties: {},
                        additionalProperties: false,
                    } as const,
                }).server(async () => "ok"),
            ] as never,
        });

        const runtime = createRuntime({
            agents: [noToolsAgent, toolCapableAgent] as const,
            pluginRuntime,
        }) as unknown as BetterAgentRuntime;

        await runtime.run(noToolsAgent.name, { input: "hello" });
        await runtime.run(toolCapableAgent.name, { input: "hello" });

        expect(seen).toEqual([
            {
                agentName: "no_tools",
                hasTools: false,
                hasSetTools: false,
                hasSetToolChoice: false,
            },
            {
                agentName: "with_tools",
                hasTools: true,
                hasSetTools: true,
                hasSetToolChoice: true,
            },
        ]);
    });
});
