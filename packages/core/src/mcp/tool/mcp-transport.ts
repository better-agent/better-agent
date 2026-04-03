import type { MCPClientError } from "../error/mcp-client-error";
import type { JSONRPCMessage } from "./json-rpc-message";

/**
 * Transport interface for MCP communication.
 */
export interface MCPTransport {
    /**
     * Starts the transport.
     */
    start(): Promise<void>;

    /**
     * Sends a JSON-RPC message.
     */
    send(message: JSONRPCMessage): Promise<void>;

    /**
     * Closes the transport and releases resources.
     */
    close(): Promise<void>;

    /** Called when the transport closes. */
    onclose: (() => void) | undefined;

    /** Called when a transport error occurs. */
    onerror: ((error: MCPClientError) => void) | undefined;

    /** Called when a message is received from the server. */
    onmessage: ((message: JSONRPCMessage) => void) | undefined;
}

/**
 * Configuration for MCP HTTP transport.
 */
export interface MCPTransportAdvancedConfig {
    /** Initial delay before the first reconnect attempt. */
    reconnectInitialDelayMs?: number;
    /** Maximum reconnect delay after backoff is applied. */
    reconnectMaxDelayMs?: number;
    /** Exponential backoff multiplier for reconnect attempts. */
    reconnectBackoffFactor?: number;
    /** Maximum number of reconnect attempts. */
    reconnectMaxRetries?: number;
}

/**
 * HTTP transport config.
 */
export interface MCPHttpTransportConfig {
    type: "http";

    /** MCP server URL. */
    url: string;

    /** Additional HTTP headers. */
    headers?: Record<string, string>;

    /** How to handle HTTP redirects. */
    redirect?: "follow" | "error";

    /** Session id for resumable connections. */
    sessionId?: string;

    /** Advanced transport controls. */
    advanced?: MCPTransportAdvancedConfig;
}

/**
 * SSE transport config.
 */
export interface MCPSseTransportConfig {
    type: "sse";

    /** MCP server SSE endpoint URL. */
    url: string;

    /** Additional HTTP headers. */
    headers?: Record<string, string>;

    /** How to handle HTTP redirects. */
    redirect?: "follow" | "error";

    /** Advanced transport controls. */
    advanced?: MCPTransportAdvancedConfig;
}

/**
 * MCP transport config.
 */
export type MCPTransportConfig = MCPHttpTransportConfig | MCPSseTransportConfig;

/**
 * Checks whether a transport is a custom implementation.
 */
export function isCustomMCPTransport(
    transport: MCPTransportConfig | MCPTransport,
): transport is MCPTransport {
    return (
        "start" in transport &&
        typeof transport.start === "function" &&
        "send" in transport &&
        typeof transport.send === "function" &&
        "close" in transport &&
        typeof transport.close === "function"
    );
}
