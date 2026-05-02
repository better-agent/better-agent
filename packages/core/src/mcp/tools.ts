import type { ResolvableSchema } from "../schema";
import type { ServerToolDefinition, ToolList } from "../tools";
import { createMCPClient } from "./client";
import type {
    MCPCallToolResult,
    MCPClient,
    MCPRequestOptions,
    MCPServerConfig,
    MCPTool,
    MCPToolSource,
    MCPToolsConfig,
} from "./types";

function defaultMapToolName(input: { tool: MCPTool; prefix?: string }): string {
    return input.prefix ? `${input.prefix}_${input.tool.name}` : input.tool.name;
}

function requestOptionsWithSignal(
    options: MCPRequestOptions | undefined,
    signal: AbortSignal,
): MCPRequestOptions {
    return {
        ...options,
        signal,
    } as MCPRequestOptions;
}

function createToolErrorMessage(result: MCPCallToolResult): string {
    const text = result.content
        .filter((item) => item.type === "text")
        .map((item) => item.text)
        .join("\n");

    return text || "MCP tool execution failed.";
}

export function normalizeMCPToolResult(result: MCPCallToolResult): unknown {
    if (result.isError) {
        throw new Error(createToolErrorMessage(result));
    }

    if (result.structuredContent !== undefined) {
        return result.structuredContent;
    }

    if (result.content.length === 0) {
        return { success: true };
    }

    const [firstItem] = result.content;
    if (result.content.length === 1 && firstItem?.type === "text") {
        return firstItem.text;
    }

    return result.content;
}

export async function listAllMCPTools(
    client: MCPClient,
    options?: MCPRequestOptions,
): Promise<MCPTool[]> {
    const tools: MCPTool[] = [];
    let cursor: string | undefined;

    do {
        const result = await client.listTools(cursor ? { cursor } : undefined, options);
        tools.push(...result.tools);
        cursor = result.nextCursor;
    } while (cursor);

    return tools;
}

export function convertMCPTools(input: {
    client: MCPClient;
    tools: readonly MCPTool[];
    serverName?: string;
    prefix?: string;
    mapToolName?: MCPServerConfig["mapToolName"];
    requestOptions?: MCPRequestOptions;
}): ServerToolDefinition<ResolvableSchema, ResolvableSchema | undefined>[] {
    return input.tools.map((tool) => {
        const name = input.mapToolName
            ? input.mapToolName({
                  serverName: input.serverName ?? "mcp",
                  tool,
                  prefix: input.prefix,
              })
            : defaultMapToolName({ tool, prefix: input.prefix });

        return {
            name,
            description: tool.description ?? `MCP tool: ${tool.name}`,
            target: "server",
            inputSchema: tool.inputSchema,
            outputSchema: tool.outputSchema,
            execute: async (toolInput, context) => {
                const result = await input.client.callTool(
                    {
                        name: tool.name,
                        arguments:
                            typeof toolInput === "object" && toolInput !== null
                                ? (toolInput as Record<string, unknown>)
                                : {},
                    },
                    requestOptionsWithSignal(input.requestOptions, context.signal),
                );

                return normalizeMCPToolResult(result);
            },
        } satisfies ServerToolDefinition<ResolvableSchema, ResolvableSchema | undefined>;
    });
}

async function resolveServerTools(input: {
    serverName: string;
    config: MCPServerConfig;
}): Promise<{
    tools: ToolList;
    close: () => Promise<void>;
}> {
    let client: MCPClient;
    let close: () => Promise<void>;

    if (input.config.client) {
        client = input.config.client;
        close = () => client.close();
    } else {
        if (!input.config.transport) {
            throw new Error(
                `MCP server '${input.serverName}' must provide either a client or transport.`,
            );
        }

        const createdClient = await createMCPClient({
            transport: input.config.transport,
            clientOptions: input.config.clientOptions,
            requestOptions: input.config.requestOptions,
        });
        client = createdClient.client;
        close = createdClient.close;
    }

    const remoteTools = await listAllMCPTools(client, input.config.requestOptions);
    const tools = convertMCPTools({
        client,
        tools: remoteTools,
        serverName: input.serverName,
        prefix: input.config.prefix,
        mapToolName: input.config.mapToolName,
        requestOptions: input.config.requestOptions,
    });

    return {
        tools,
        close,
    };
}

function assertUniqueToolNames(tools: ToolList): void {
    const seen = new Set<string>();

    for (const tool of tools) {
        if (!("name" in tool) || typeof tool.name !== "string") {
            continue;
        }

        if (seen.has(tool.name)) {
            throw new Error(`Duplicate MCP tool name '${tool.name}'. Use a prefix or mapToolName.`);
        }

        seen.add(tool.name);
    }
}

export function mcpTools(config: MCPToolsConfig): MCPToolSource {
    let cached:
        | Promise<{
              tools: ToolList;
              close: Array<() => Promise<void>>;
          }>
        | undefined;

    const load = async () => {
        const resolved = await Promise.all(
            Object.entries(config.servers).map(async ([serverName, serverConfig]) => {
                return resolveServerTools({ serverName, config: serverConfig });
            }),
        );
        const tools = resolved.flatMap((entry) => [...entry.tools]);

        assertUniqueToolNames(tools);

        return {
            tools,
            close: resolved.map((entry) => entry.close),
        };
    };

    const source = (async () => {
        cached ??= load();
        const resolved = await cached;

        return resolved.tools;
    }) as MCPToolSource;

    source.dispose = async () => {
        const resolved = await cached;
        cached = undefined;

        if (!resolved) {
            return;
        }

        await Promise.all(resolved.close.map((close) => close()));
    };

    source.reload = async () => {
        await source.dispose();

        return source();
    };

    return source;
}
