export { MCPClientError } from "./error/mcp-client-error";

// Tool exports.
export { createMCPClient } from "./tool/mcp-client";
export type { MCPClient, MCPClientConfig } from "./tool/mcp-client";
export { HttpMCPTransport } from "./tool/mcp-http-transport";
export { convertMCPTools } from "./tool/mcp-tools";
export type {
    MCPTransport,
    MCPTransportConfig,
    MCPTransportAdvancedConfig,
    MCPHttpTransportConfig,
    MCPSseTransportConfig,
} from "./tool/mcp-transport";
export { isCustomMCPTransport } from "./tool/mcp-transport";

// JSON-RPC protocol types.
export type {
    JSONRPCMessage,
    JSONRPCRequest,
    JSONRPCResponse,
    JSONRPCError,
    JSONRPCNotification,
} from "./tool/json-rpc-message";
export {
    isJSONRPCRequest,
    isJSONRPCResponse,
    isJSONRPCError,
    isJSONRPCNotification,
    JSONRPC_VERSION,
} from "./tool/json-rpc-message";

// MCP protocol types.
export type {
    MCPTool,
    MCPResource,
    MCPResourceTemplate,
    MCPPrompt,
    ListToolsResult,
    MCPCallToolParams,
    MCPCallToolResult,
    ListResourcesResult,
    ListResourceTemplatesResult,
    MCPReadResourceParams,
    MCPReadResourceResult,
    ListPromptsResult,
    MCPGetPromptParams,
    MCPGetPromptResult,
    InitializeParams,
    InitializeResult,
    ClientCapabilities,
    ServerCapabilities,
    MCPImplementationInfo,
    RequestOptions,
    PaginatedRequest,
    PaginatedResult,
    ToolResultContent,
    PromptMessage,
} from "./tool/types";
export {
    LATEST_PROTOCOL_VERSION,
    SUPPORTED_PROTOCOL_VERSIONS,
} from "./tool/types";
