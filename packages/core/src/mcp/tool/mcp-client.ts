import { MCPClientError } from "../error/mcp-client-error";
import type {
    JSONRPCError,
    JSONRPCMessage,
    JSONRPCRequest,
    JSONRPCResponse,
} from "./json-rpc-message";
import { isJSONRPCError, isJSONRPCResponse } from "./json-rpc-message";
import { HttpMCPTransport } from "./mcp-http-transport";
import type { MCPTransport, MCPTransportConfig } from "./mcp-transport";
import { isCustomMCPTransport } from "./mcp-transport";
import type {
    ClientCapabilities,
    InitializeParams,
    InitializeResult,
    ListPromptsResult,
    ListResourceTemplatesResult,
    ListResourcesResult,
    ListToolsResult,
    MCPCallToolParams,
    MCPCallToolResult,
    MCPGetPromptParams,
    MCPGetPromptResult,
    MCPImplementationInfo,
    MCPReadResourceParams,
    MCPReadResourceResult,
    PaginatedRequest,
    RequestOptions,
    ServerCapabilities,
} from "./types";
import { LATEST_PROTOCOL_VERSION, SUPPORTED_PROTOCOL_VERSIONS } from "./types";

/**
 * MCP client configuration.
 */
export interface MCPClientConfig {
    /** Transport config or a custom transport instance. */
    transport: MCPTransportConfig | MCPTransport;

    /** Optional client name. Defaults to `"better-agent-mcp-client"`. */
    name?: string;

    /** Optional client version. Defaults to `"1.0.0"`. */
    version?: string;

    /** Optional callback for uncaught errors. */
    onUncaughtError?: (error: MCPClientError) => void;

    /** Optional client capabilities to advertise. */
    capabilities?: ClientCapabilities;
}

/**
 * MCP client interface.
 */
export interface MCPClient {
    /** Lists available tools from the server. */
    listTools(options?: {
        params?: PaginatedRequest;
        options?: RequestOptions;
    }): Promise<ListToolsResult>;

    /** Calls a tool on the server. */
    callTool(params: MCPCallToolParams, options?: RequestOptions): Promise<MCPCallToolResult>;

    /** Lists available resources. */
    listResources(options?: {
        params?: PaginatedRequest;
        options?: RequestOptions;
    }): Promise<ListResourcesResult>;

    /** Lists resource templates. */
    listResourceTemplates(options?: {
        options?: RequestOptions;
    }): Promise<ListResourceTemplatesResult>;

    /** Reads a resource. */
    readResource(
        params: MCPReadResourceParams,
        options?: RequestOptions,
    ): Promise<MCPReadResourceResult>;

    /** Lists available prompts. */
    listPrompts(options?: {
        params?: PaginatedRequest;
        options?: RequestOptions;
    }): Promise<ListPromptsResult>;

    /** Gets a prompt. */
    getPrompt(params: MCPGetPromptParams, options?: RequestOptions): Promise<MCPGetPromptResult>;

    /** Closes the connection. */
    close(): Promise<void>;
}

/**
 * Creates and initializes an MCP client.
 *
 * @param config MCP client configuration.
 * @returns An initialized MCP client.
 *
 * @example
 * ```ts
 * const client = await createMCPClient({
 *   transport: { type: "http", url: "http://localhost:3000/mcp" },
 * });
 *
 * const tools = await client.listTools();
 * ```
 */
export async function createMCPClient(config: MCPClientConfig): Promise<MCPClient> {
    const client = new DefaultMCPClient(config);
    await client.init();
    return client;
}

/**
 * Default MCP client implementation.
 */
class DefaultMCPClient implements MCPClient {
    private transport: MCPTransport;
    private onUncaughtError: ((error: MCPClientError) => void) | undefined;
    private clientInfo: MCPImplementationInfo;
    private clientCapabilities: ClientCapabilities;
    private requestMessageId = 0;
    private responseHandlers: Map<
        number,
        (response: JSONRPCResponse | JSONRPCError | MCPClientError) => void
    > = new Map();
    private serverCapabilities: ServerCapabilities = {};
    private isClosed = true;

    constructor({
        transport: transportConfig,
        name = "better-agent-mcp-client",
        version = "1.0.0",
        onUncaughtError,
        capabilities,
    }: MCPClientConfig) {
        this.onUncaughtError = onUncaughtError;
        this.clientCapabilities = capabilities ?? {};

        // Reuse a custom transport when one is provided.
        if (isCustomMCPTransport(transportConfig)) {
            this.transport = transportConfig;
        } else {
            this.transport = this.createTransport(transportConfig);
        }

        // Map transport lifecycle into the client's request/response bookkeeping.
        this.transport.onclose = () => this.onClose();
        this.transport.onerror = (error: MCPClientError) => this.onError(error);
        this.transport.onmessage = (message: JSONRPCMessage) => {
            // Handle requests vs responses/notifications
            if ("id" in message) {
                if ("error" in message || "result" in message) {
                    this.onResponse(message as JSONRPCResponse | JSONRPCError);
                } else {
                    // Server-initiated requests are not supported yet.
                    this.onError(new Error("Server requests not supported") as MCPClientError);
                }
            } else {
                // Notifications are ignored for now.
            }
        };

        this.clientInfo = { name, version };
    }

    /**
     * Creates a transport from config.
     */
    private createTransport(config: MCPTransportConfig): MCPTransport {
        switch (config.type) {
            case "http":
                return new HttpMCPTransport({
                    url: config.url,
                    headers: config.headers,
                    redirect: config.redirect,
                    sessionId: config.sessionId,
                    advanced: config.advanced,
                });
            case "sse":
                // SSE uses the same transport implementation with an inbound SSE channel.
                return new HttpMCPTransport({
                    url: config.url,
                    headers: config.headers,
                    redirect: config.redirect,
                    sessionId: undefined,
                    advanced: config.advanced,
                });
            default:
                throw new Error(`Unsupported transport type: ${(config as { type: string }).type}`);
        }
    }

    /**
     * Initializes the client and completes the MCP handshake.
     */
    async init(): Promise<this> {
        try {
            await this.transport.start();
            this.isClosed = false;

            const result = await this.request<InitializeResult>({
                method: "initialize",
                params: {
                    protocolVersion: LATEST_PROTOCOL_VERSION,
                    capabilities: this.clientCapabilities,
                    clientInfo: this.clientInfo,
                } as InitializeParams,
                options: undefined,
            });

            // Fail fast on unsupported protocol versions.
            const supportedVersions: readonly string[] = SUPPORTED_PROTOCOL_VERSIONS;
            if (!supportedVersions.includes(result.protocolVersion)) {
                throw new Error(
                    `Server's protocol version is not supported: ${result.protocolVersion}`,
                );
            }

            this.serverCapabilities = result.capabilities;

            // Finish the required post-initialize notification.
            await this.notification({ method: "notifications/initialized" });

            return this;
        } catch (error) {
            await this.close();
            throw error;
        }
    }

    /**
     * Closes the connection and cleans up.
     */
    async close(): Promise<void> {
        if (this.isClosed) return;
        await this.transport.close();
        this.onClose();
    }

    /**
     * Checks whether the server supports a capability.
     */
    private assertCapability(method: string): void {
        switch (method) {
            case "initialize":
                break;
            case "tools/list":
            case "tools/call":
                if (!this.serverCapabilities.tools) {
                    throw new Error("Server does not support tools");
                }
                break;
            case "resources/list":
            case "resources/read":
            case "resources/templates/list":
                if (!this.serverCapabilities.resources) {
                    throw new Error("Server does not support resources");
                }
                break;
            case "prompts/list":
            case "prompts/get":
                if (!this.serverCapabilities.prompts) {
                    throw new Error("Server does not support prompts");
                }
                break;
            default:
                throw new Error(`Unsupported method: ${method}`);
        }
    }

    /**
     * Send a JSON-RPC request and wait for response.
     */
    private async request<T>({
        method,
        params,
        options,
    }: {
        method: string;
        params: unknown | undefined;
        options: RequestOptions | undefined;
    }): Promise<T> {
        return new Promise((resolve, reject) => {
            if (this.isClosed) {
                return reject(new Error("Attempted to send a request from a closed client"));
            }

            this.assertCapability(method);

            const signal = options?.signal;
            signal?.throwIfAborted();

            const messageId = this.requestMessageId++;

            const jsonrpcRequest: JSONRPCRequest = {
                jsonrpc: "2.0",
                id: messageId,
                method,
                params: params as Record<string, unknown> | undefined,
            };

            const cleanup = () => {
                this.responseHandlers.delete(messageId);
            };

            // Set up timeout if specified
            let timeoutId: NodeJS.Timeout | undefined;
            if (options?.timeout !== undefined) {
                timeoutId = setTimeout(() => {
                    cleanup();
                    reject(new Error(`Request timed out after ${options.timeout}ms`));
                }, options.timeout);
            }

            const cleanupWithTimeout = () => {
                cleanup();
                if (timeoutId !== undefined) {
                    clearTimeout(timeoutId);
                }
            };

            // Add abort signal listener for cancellation
            const abortHandler = () => {
                cleanupWithTimeout();
                reject(new Error(`Request was aborted: ${signal?.reason || "Unknown reason"}`));
            };

            signal?.addEventListener("abort", abortHandler);

            this.responseHandlers.set(messageId, (response) => {
                signal?.removeEventListener("abort", abortHandler);

                if (signal?.aborted) {
                    cleanupWithTimeout();
                    return reject(new Error(`Request was aborted: ${signal.reason}`));
                }

                // Check if it's an MCPClientError
                if (response instanceof MCPClientError) {
                    cleanupWithTimeout();
                    return reject(response);
                }

                // Check if it's a JSON-RPC error
                if (isJSONRPCError(response)) {
                    cleanupWithTimeout();
                    const error = new Error(String(response.error.message)) as MCPClientError;
                    // Use Object.assign to set the jsonRpcCode since it's readonly
                    Object.assign(error, { jsonRpcCode: response.error.code });
                    return reject(error);
                }

                if (!isJSONRPCResponse(response)) {
                    cleanupWithTimeout();
                    return reject(
                        new MCPClientError({
                            message: "Received invalid JSON-RPC response shape.",
                        }),
                    );
                }

                cleanupWithTimeout();
                resolve(response.result as T);
            });

            this.transport.send(jsonrpcRequest).catch((error) => {
                signal?.removeEventListener("abort", abortHandler);
                cleanupWithTimeout();
                reject(error);
            });
        });
    }

    /**
     * Send a JSON-RPC notification (no response expected).
     */
    private async notification({
        method,
        params,
    }: {
        method: string;
        params?: unknown;
    }): Promise<void> {
        if (this.isClosed) {
            throw new Error("Attempted to send a notification from a closed client");
        }

        const jsonrpcNotification = {
            jsonrpc: "2.0" as const,
            method,
            params: params as Record<string, unknown> | undefined,
        };
        await this.transport.send(jsonrpcNotification);
    }

    /**
     * Handle transport closure.
     */
    private onClose(): void {
        if (this.isClosed) return;

        this.isClosed = true;
        const error = new Error("Connection closed") as MCPClientError;

        // Reject all pending requests
        for (const handler of this.responseHandlers.values()) {
            handler({
                jsonrpc: "2.0",
                id: -1,
                error: { code: -32000, message: error.message },
            } as JSONRPCError);
        }

        this.responseHandlers.clear();
        this.onUncaughtError?.(error);
    }

    /**
     * Handle transport errors.
     */
    private onError(error: MCPClientError): void {
        this.onUncaughtError?.(error);
    }

    /**
     * Handle incoming JSON-RPC responses.
     */
    private onResponse(response: JSONRPCResponse | JSONRPCError): void {
        const messageId = Number(response.id);
        const handler = this.responseHandlers.get(messageId);

        if (handler === undefined) {
            this.onError(
                new MCPClientError({
                    message: `Protocol error: Received a response for an unknown message ID: ${JSON.stringify(response)}`,
                    context: { messageId, response },
                }),
            );
            return;
        }

        this.responseHandlers.delete(messageId);
        handler(response);
    }

    // Public API implementations

    async listTools({
        params,
        options,
    }: {
        params?: PaginatedRequest;
        options?: RequestOptions;
    } = {}): Promise<ListToolsResult> {
        return this.request<ListToolsResult>({
            method: "tools/list",
            params,
            options,
        });
    }

    async callTool(
        params: MCPCallToolParams,
        options?: RequestOptions,
    ): Promise<MCPCallToolResult> {
        return this.request<MCPCallToolResult>({
            method: "tools/call",
            params,
            options,
        });
    }

    async listResources({
        params,
        options,
    }: {
        params?: PaginatedRequest;
        options?: RequestOptions;
    } = {}): Promise<ListResourcesResult> {
        return this.request<ListResourcesResult>({
            method: "resources/list",
            params,
            options,
        });
    }

    async listResourceTemplates({
        options,
    }: {
        options?: RequestOptions;
    } = {}): Promise<ListResourceTemplatesResult> {
        return this.request<ListResourceTemplatesResult>({
            method: "resources/templates/list",
            params: undefined,
            options,
        });
    }

    async readResource(
        params: MCPReadResourceParams,
        options?: RequestOptions,
    ): Promise<MCPReadResourceResult> {
        return this.request<MCPReadResourceResult>({
            method: "resources/read",
            params,
            options,
        });
    }

    async listPrompts({
        params,
        options,
    }: {
        params?: PaginatedRequest;
        options?: RequestOptions;
    } = {}): Promise<ListPromptsResult> {
        return this.request<ListPromptsResult>({
            method: "prompts/list",
            params,
            options,
        });
    }

    async getPrompt(
        params: MCPGetPromptParams,
        options?: RequestOptions,
    ): Promise<MCPGetPromptResult> {
        return this.request<MCPGetPromptResult>({
            method: "prompts/get",
            params,
            options,
        });
    }
}
