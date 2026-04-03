import { describe, expectTypeOf, test } from "bun:test";
import { defineAgent } from "../../src";
import type { AgentKnownToolName, AgentToolDefinition, GenerativeModel } from "../../src";
import { convertMCPTools } from "../../src/mcp";
import type { MCPClient } from "../../src/mcp";

type ToolSupportModel = GenerativeModel<
    Record<string, never>,
    "test",
    "tool-support",
    {
        inputModalities: { text: true };
        inputShape: "chat";
        outputModalities: { text: true };
        tools: true;
    }
>;

describe("MCP tools typing", () => {
    test("convertMCPTools stays agent-compatible without deep remote schema inference", () => {
        const client = {} as MCPClient;
        const remoteTools = [
            {
                name: "search_docs",
                description: "Searches remote docs.",
                inputSchema: {
                    type: "object" as const,
                    properties: {
                        query: { type: "string" },
                    },
                    required: ["query"],
                },
            },
        ];

        const tools = convertMCPTools(client, remoteTools, { prefix: "context7" });
        const agent = defineAgent({
            name: "docs",
            model: {} as ToolSupportModel,
            tools: async () => tools,
        });

        const knownToolName: AgentKnownToolName<typeof agent> = "context7_runtime_lookup";

        expectTypeOf(tools).toMatchTypeOf<readonly AgentToolDefinition[]>();
        expectTypeOf(knownToolName).toMatchTypeOf<string>();
    });
});
