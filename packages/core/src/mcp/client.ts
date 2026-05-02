import {
    Client,
    SSEClientTransport,
    StdioClientTransport,
    StreamableHTTPClientTransport,
} from "@modelcontextprotocol/client";
import type { Transport } from "@modelcontextprotocol/client";
import type { CreateMCPClientOptions, CreatedMCPClient, MCPTransportConfig } from "./types";

function createSDKClient(options: CreateMCPClientOptions): Client {
    return new Client(
        {
            name: options.client?.name ?? "better-agent-mcp-client",
            version: options.client?.version ?? "1.0.0",
        },
        options.clientOptions,
    );
}

function createTransport(config: MCPTransportConfig): Transport {
    switch (config.type) {
        case "http":
            return new StreamableHTTPClientTransport(new URL(config.url), {
                authProvider: config.authProvider,
                requestInit: config.requestInit,
                fetch: config.fetch,
                sessionId: config.sessionId,
            });
        case "sse":
            return new SSEClientTransport(new URL(config.url), {
                authProvider: config.authProvider,
                requestInit: config.requestInit,
                fetch: config.fetch,
            });
        case "stdio":
            return new StdioClientTransport({
                command: config.command,
                args: config.args,
                env: config.env,
                cwd: config.cwd,
                stderr: config.stderr,
            });
        case "custom":
            return config.transport;
    }
}

export async function createMCPClient(options: CreateMCPClientOptions): Promise<CreatedMCPClient> {
    const client = createSDKClient(options);

    if (options.transport.type === "http" && options.transport.fallbackToSse) {
        try {
            const transport = createTransport(options.transport);
            await client.connect(transport, options.requestOptions);

            return {
                client,
                transport,
                close: () => client.close(),
            };
        } catch {
            await client.close().catch(() => undefined);

            const fallbackClient = createSDKClient(options);
            const fallbackTransport = createTransport({
                type: "sse",
                url: options.transport.url,
                authProvider: options.transport.authProvider,
                requestInit: options.transport.requestInit,
                fetch: options.transport.fetch,
            });

            try {
                await fallbackClient.connect(fallbackTransport, options.requestOptions);
            } catch (fallbackError) {
                await fallbackClient.close().catch(() => undefined);
                throw fallbackError;
            }

            return {
                client: fallbackClient,
                transport: fallbackTransport,
                close: () => fallbackClient.close(),
            };
        }
    }

    const transport = createTransport(options.transport);

    try {
        await client.connect(transport, options.requestOptions);
    } catch (error) {
        await client.close().catch(() => undefined);
        throw error;
    }

    return {
        client,
        transport,
        close: () => client.close(),
    };
}
