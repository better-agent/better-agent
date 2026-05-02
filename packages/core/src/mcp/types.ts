import type {
    AuthProvider,
    CallToolResult,
    Client,
    ClientOptions,
    OAuthClientProvider,
    RequestOptions,
    Tool,
    Transport,
} from "@modelcontextprotocol/client";
import type { ToolList } from "../tools";

export type MCPClient = Pick<Client, "callTool" | "close" | "getInstructions" | "listTools">;

export type MCPTool = Tool;
export type MCPCallToolResult = CallToolResult;
export type MCPRequestOptions = RequestOptions;

export interface MCPClientInfo {
    name?: string;
    version?: string;
}

export interface MCPHttpTransportConfig {
    type: "http";
    url: string | URL;
    fallbackToSse?: boolean;
    authProvider?: AuthProvider | OAuthClientProvider;
    requestInit?: RequestInit;
    fetch?: typeof fetch;
    sessionId?: string;
}

export interface MCPSseTransportConfig {
    type: "sse";
    url: string | URL;
    authProvider?: AuthProvider | OAuthClientProvider;
    requestInit?: RequestInit;
    fetch?: typeof fetch;
}

export interface MCPStdioTransportConfig {
    type: "stdio";
    command: string;
    args?: string[];
    env?: Record<string, string>;
    cwd?: string;
    stderr?: "pipe" | "ignore" | "inherit";
}

export interface MCPCustomTransportConfig {
    type: "custom";
    transport: Transport;
}

export type MCPTransportConfig =
    | MCPHttpTransportConfig
    | MCPSseTransportConfig
    | MCPStdioTransportConfig
    | MCPCustomTransportConfig;

export interface CreateMCPClientOptions {
    transport: MCPTransportConfig;
    client?: MCPClientInfo;
    clientOptions?: ClientOptions;
    requestOptions?: RequestOptions;
}

export interface CreatedMCPClient {
    client: MCPClient;
    transport: Transport;
    close(): Promise<void>;
}

export type MCPToolNameMapper = (input: {
    serverName: string;
    tool: MCPTool;
    prefix?: string;
}) => string;

export interface MCPServerConfig {
    transport?: MCPTransportConfig;
    client?: MCPClient;
    clientOptions?: ClientOptions;
    requestOptions?: RequestOptions;
    prefix?: string;
    mapToolName?: MCPToolNameMapper;
}

export interface MCPToolsConfig {
    servers: Record<string, MCPServerConfig>;
}

export type MCPToolSource = ((context?: unknown) => Promise<ToolList>) & {
    dispose: () => Promise<void>;
    reload: (context?: unknown) => Promise<ToolList>;
};
