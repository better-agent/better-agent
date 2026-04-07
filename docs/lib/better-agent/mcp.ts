import { lazyTools } from "@better-agent/core";
import { convertMCPTools, createMCPClient } from "@better-agent/core/mcp";

export const context7Tools = lazyTools(async () => {
    const client = await createMCPClient({
        transport: {
            type: "http",
            url: "https://mcp.context7.com/mcp",
        },
    });

    const listed = await client.listTools();

    return {
        tools: convertMCPTools(client, listed.tools, { prefix: "context7" }),
        dispose: async () => {
            await client.close();
        },
    };
});
