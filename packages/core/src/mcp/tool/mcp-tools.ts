import type { Event } from "../../events";
import type { Awaitable } from "../../internal/types";
import { TOOL_JSON_SCHEMA } from "../../tools/constants";
import type { ServerToolDefinition, ToolHandler } from "../../tools/types";
import type { MCPClient } from "./mcp-client";
import type { MCPCallToolResult, MCPTool } from "./types";

// biome-ignore lint/suspicious/noExplicitAny:
type MCPServerToolDefinition = ServerToolDefinition<any, string, unknown>;

/**
 * Converts MCP tools into Better Agent server tool definitions.
 *
 * @param client MCP client used for tool calls.
 * @param tools MCP tool definitions from the server.
 * @param options Optional prefix for tool names.
 * @returns Server tool definitions with working handlers.
 */
export function convertMCPTools(
    client: MCPClient,
    tools: MCPTool[],
    options?: {
        /** Optional prefix to add to tool names. */
        prefix?: string;
    },
): MCPServerToolDefinition[] {
    return tools.map((tool) => convertMCPTool(client, tool, options?.prefix));
}

/**
 * Converts one MCP tool into a Better Agent server tool definition.
 */
function convertMCPTool(
    client: MCPClient,
    tool: MCPTool,
    prefix?: string,
): MCPServerToolDefinition {
    const name = prefix ? `${prefix}_${tool.name}` : tool.name;

    // The generated handler proxies execution back to the MCP server.
    const handler: ToolHandler<unknown, unknown> = async (
        input: unknown,
        _ctx: { signal: AbortSignal; emit: (event: Event) => Awaitable<void> },
    ) => {
        const result = await client.callTool({
            name: tool.name,
            arguments: input as Record<string, unknown>,
        });

        // Normalize the MCP result into a Better Agent-friendly value.
        return convertToolResult(result);
    };

    // Build a JSON Schema payload that matches Better Agent's tool expectations.
    const jsonSchema: Record<string, unknown> = {
        type: "object",
        properties: tool.inputSchema.properties ?? {},
        required: tool.inputSchema.required ?? [],
        ...(tool.inputSchema.$schema ? { $schema: tool.inputSchema.$schema } : {}),
    };

    return {
        kind: "server",
        name,
        description: tool.description ?? `MCP tool: ${tool.name}`,
        // MCP schemas are discovered at runtime, so the public tool type is intentionally erased.
        schema: tool.inputSchema as Record<string, unknown>,
        handler,
        [TOOL_JSON_SCHEMA]: jsonSchema,
    };
}

/**
 * Converts an MCP tool result into a Better Agent tool result value.
 */
function convertToolResult(result: MCPCallToolResult): unknown {
    // Text content is used to build a readable thrown error when MCP marks the call as failed.
    if (result.isError === true) {
        const errorMessage = result.content
            ? result.content
                  .filter((item) => item.type === "text")
                  .map((item) => item.text)
                  .join("\n")
            : "Tool execution failed";

        throw new Error(errorMessage);
    }

    // Prefer structured content when the server provides it.
    if (result.structuredContent !== undefined) {
        return result.structuredContent;
    }

    if (result.content === undefined || result.content.length === 0) {
        return { success: true };
    }

    // Collapse one text item into a plain string for convenience.
    const firstItem = result.content[0];
    if (result.content.length === 1 && firstItem !== undefined && firstItem.type === "text") {
        return firstItem.text;
    }

    // Preserve multi-item results in a simple array form.
    return result.content.map((item) => {
        switch (item.type) {
            case "text":
                return item.text;
            case "image":
                return {
                    type: "image",
                    data: item.data,
                    mimeType: item.mimeType,
                };
            case "resource":
                return {
                    type: "resource",
                    uri: item.resource.uri,
                    content: item.resource.text ?? item.resource.blob,
                };
            default:
                return item;
        }
    });
}
