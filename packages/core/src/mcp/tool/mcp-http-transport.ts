import { MCPClientError } from "../error/mcp-client-error";
import {
    type JSONRPCMessage,
    parseJSONRPCMessage,
    parseJSONRPCMessageArray,
} from "./json-rpc-message";
import type { MCPTransport, MCPTransportAdvancedConfig } from "./mcp-transport";
import { LATEST_PROTOCOL_VERSION } from "./types";

/**
 * HTTP transport for MCP using the Streamable HTTP transport pattern.
 */
export class HttpMCPTransport implements MCPTransport {
    private url: URL;
    private abortController?: AbortController;
    private headers: Record<string, string> | undefined;
    private redirect: RequestRedirect | undefined;
    private sessionId: string | undefined;
    private inboundSseConnection?: { close: () => void };

    // Reconnection state for the inbound SSE channel.
    private lastInboundEventId?: string;
    private inboundReconnectAttempts = 0;
    private readonly reconnectionOptions: {
        initialReconnectionDelay: number;
        maxReconnectionDelay: number;
        reconnectionDelayGrowFactor: number;
        maxRetries: number;
    };

    onclose: (() => void) | undefined;
    onerror: ((error: MCPClientError) => void) | undefined;
    onmessage: ((message: JSONRPCMessage) => void) | undefined;

    private validateAdvancedNumber(
        value: number | undefined,
        field: keyof MCPTransportAdvancedConfig,
    ): number | undefined {
        if (value === undefined) {
            return undefined;
        }

        if (!Number.isFinite(value) || value < 0) {
            throw new Error(`MCP HTTP Transport Error: '${field}' must be a non-negative number.`);
        }

        return value;
    }

    constructor({
        url,
        headers,
        redirect,
        sessionId,
        advanced,
    }: {
        url: string;
        headers: Record<string, string> | undefined;
        redirect?: RequestRedirect;
        sessionId: string | undefined;
        advanced?: MCPTransportAdvancedConfig;
    }) {
        this.url = new URL(url);
        this.headers = headers;
        this.redirect = redirect;
        this.sessionId = sessionId;
        const reconnectInitialDelayMs = this.validateAdvancedNumber(
            advanced?.reconnectInitialDelayMs,
            "reconnectInitialDelayMs",
        );
        const reconnectMaxDelayMs = this.validateAdvancedNumber(
            advanced?.reconnectMaxDelayMs,
            "reconnectMaxDelayMs",
        );
        const reconnectBackoffFactor = this.validateAdvancedNumber(
            advanced?.reconnectBackoffFactor,
            "reconnectBackoffFactor",
        );
        const reconnectMaxRetries = this.validateAdvancedNumber(
            advanced?.reconnectMaxRetries,
            "reconnectMaxRetries",
        );
        this.reconnectionOptions = {
            initialReconnectionDelay: reconnectInitialDelayMs ?? 1000,
            maxReconnectionDelay: reconnectMaxDelayMs ?? 30000,
            reconnectionDelayGrowFactor: reconnectBackoffFactor ?? 1.5,
            maxRetries: reconnectMaxRetries ?? 2,
        };
    }

    /**
     * Builds common headers for requests.
     */
    private async commonHeaders(base: Record<string, string>): Promise<Record<string, string>> {
        const headers: Record<string, string> = {
            ...this.headers,
            ...base,
            "mcp-protocol-version": LATEST_PROTOCOL_VERSION,
        };

        if (this.sessionId) {
            headers["mcp-session-id"] = this.sessionId;
        }

        return headers;
    }

    async start(): Promise<void> {
        if (this.abortController) {
            throw new Error("MCP HTTP Transport Error: Transport already started.");
        }

        this.abortController = new AbortController();

        // Start listening for inbound server messages on the side channel.
        void this.openInboundSse();
    }

    async close(): Promise<void> {
        this.inboundSseConnection?.close();

        try {
            if (this.sessionId && this.abortController && !this.abortController.signal.aborted) {
                const headers = await this.commonHeaders({});
                await fetch(this.url, {
                    method: "DELETE",
                    headers,
                    ...(this.redirect ? { redirect: this.redirect } : {}),
                    signal: this.abortController.signal,
                }).catch(() => undefined);
            }
        } catch {}

        this.abortController?.abort();
        this.onclose?.();
    }

    async send(message: JSONRPCMessage): Promise<void> {
        const attempt = async (_triedAuth = false): Promise<void> => {
            try {
                const headers = await this.commonHeaders({
                    "Content-Type": "application/json",
                    Accept: "application/json, text/event-stream",
                });

                const init: RequestInit = {
                    method: "POST",
                    headers,
                    body: JSON.stringify(message),
                    ...(this.redirect ? { redirect: this.redirect } : {}),
                    signal: this.abortController?.signal ?? null,
                };

                const response = await fetch(this.url, init);

                // Track session id for resumable sessions when the server provides one.
                const sessionId = response.headers.get("mcp-session-id");
                if (sessionId) {
                    this.sessionId = sessionId;
                }

                // Server accepted the message without an immediate payload.
                if (response.status === 202) {
                    // If inbound SSE was not available earlier, try again now.
                    if (!this.inboundSseConnection) {
                        void this.openInboundSse();
                    }
                    return;
                }

                if (!response.ok) {
                    const text = await response.text().catch(() => null);
                    let errorMessage = `MCP HTTP Transport Error: POSTing to endpoint (HTTP ${response.status})`;
                    if (text) {
                        errorMessage += `: ${text}`;
                    }

                    if (response.status === 404) {
                        errorMessage +=
                            ". This server does not support HTTP transport. Try using `sse` transport instead";
                    }

                    const error = new MCPClientError({
                        message: errorMessage,
                        context: { status: response.status, url: this.url.href },
                    });
                    this.onerror?.(error);
                    throw error;
                }

                // Only requests with ids expect a direct response payload.
                if ("id" in message) {
                    const contentType = response.headers.get("content-type") || "";

                    if (contentType.includes("application/json")) {
                        const data = await response.json();
                        const messages = parseJSONRPCMessageArray(data);
                        for (const msg of messages) {
                            this.onmessage?.(msg);
                        }
                        return;
                    }

                    if (contentType.includes("text/event-stream")) {
                        if (!response.body) {
                            const error = new MCPClientError({
                                message:
                                    "MCP HTTP Transport Error: text/event-stream response without body",
                            });
                            this.onerror?.(error);
                            throw error;
                        }

                        await this.processEventStream(
                            response.body as ReadableStream<BufferSource>,
                        );
                        return;
                    }
                } else {
                    // Notifications still drain the body so connections are not leaked.
                    const contentType = response.headers.get("content-type") || "";
                    if (contentType.includes("application/json")) {
                        await response.json().catch(() => {}); // Drain JSON response
                    } else {
                        await response.text().catch(() => {}); // Drain text response
                    }
                }
            } catch (error) {
                const mcpError =
                    error instanceof MCPClientError
                        ? error
                        : new MCPClientError({
                              message:
                                  error instanceof Error
                                      ? error.message
                                      : "Unknown transport error",
                              cause: error,
                          });
                this.onerror?.(mcpError);
                throw mcpError;
            }
        };

        await attempt();
    }

    /**
     * Processes an SSE event stream.
     */
    private async processEventStream(body: ReadableStream<BufferSource>): Promise<void> {
        const reader = body
            .pipeThrough(new TextDecoderStream())
            .pipeThrough(new EventSourceParserStream())
            .getReader();

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) return;

                const { event, data, id } = value as {
                    event?: string;
                    data: string;
                    id?: string;
                };

                if (id) {
                    this.lastInboundEventId = id;
                }

                if (event === "message") {
                    try {
                        const msg = parseJSONRPCMessage(JSON.parse(data));
                        this.onmessage?.(msg);
                    } catch (_error) {
                        const e = new MCPClientError({
                            message: "MCP HTTP Transport Error: Failed to parse message",
                        });
                        this.onerror?.(e);
                    }
                }
            }
        } catch (error) {
            if (error instanceof Error && error.name === "AbortError") {
                return;
            }
            const mcpError =
                error instanceof MCPClientError
                    ? error
                    : new MCPClientError({
                          message:
                              error instanceof Error ? error.message : "Stream processing error",
                          cause: error,
                      });
            this.onerror?.(mcpError);
        }
    }

    /**
     * Calculate next reconnection delay using exponential backoff.
     */
    private getNextReconnectionDelay(attempt: number): number {
        const { initialReconnectionDelay, reconnectionDelayGrowFactor, maxReconnectionDelay } =
            this.reconnectionOptions;
        return Math.min(
            initialReconnectionDelay * reconnectionDelayGrowFactor ** attempt,
            maxReconnectionDelay,
        );
    }

    /**
     * Schedule SSE reconnection attempt.
     */
    private scheduleInboundSseReconnection(): void {
        const { maxRetries } = this.reconnectionOptions;
        if (maxRetries > 0 && this.inboundReconnectAttempts >= maxRetries) {
            this.onerror?.(
                new MCPClientError({
                    message: `MCP HTTP Transport Error: Maximum reconnection attempts (${maxRetries}) exceeded.`,
                }),
            );
            return;
        }

        const delay = this.getNextReconnectionDelay(this.inboundReconnectAttempts);
        this.inboundReconnectAttempts += 1;

        setTimeout(async () => {
            if (this.abortController?.signal.aborted) return;
            await this.openInboundSse(false, this.lastInboundEventId);
        }, delay);
    }

    /**
     * Open inbound SSE connection for receiving messages.
     */
    private async openInboundSse(_triedAuth = false, resumeToken?: string): Promise<void> {
        try {
            const headers = await this.commonHeaders({
                Accept: "text/event-stream",
            });

            if (resumeToken) {
                headers["last-event-id"] = resumeToken;
            }

            const response = await fetch(this.url.href, {
                method: "GET",
                headers,
                ...(this.redirect ? { redirect: this.redirect } : {}),
                signal: this.abortController?.signal ?? null,
            });

            // Track session ID
            const sessionId = response.headers.get("mcp-session-id");
            if (sessionId) {
                this.sessionId = sessionId;
            }

            // 405 = method not allowed, SSE might not be supported
            if (response.status === 405) {
                return;
            }

            if (!response.ok || !response.body) {
                const error = new MCPClientError({
                    message: `MCP HTTP Transport Error: GET SSE failed: ${response.status} ${response.statusText}`,
                    context: { status: response.status, statusText: response.statusText },
                });
                this.onerror?.(error);
                return;
            }

            const reader = (response.body as ReadableStream<BufferSource>)
                .pipeThrough(new TextDecoderStream())
                .pipeThrough(new EventSourceParserStream())
                .getReader();

            this.inboundSseConnection = {
                close: () => reader.cancel(),
            };
            this.inboundReconnectAttempts = 0;

            // Process events
            try {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) {
                        // Connection closed cleanly - attempt reconnection
                        if (!this.abortController?.signal.aborted) {
                            this.scheduleInboundSseReconnection();
                        }
                        return;
                    }

                    const { event, data, id } = value as {
                        event?: string;
                        data: string;
                        id?: string;
                    };

                    if (id) {
                        this.lastInboundEventId = id;
                    }

                    if (event === "message") {
                        try {
                            const msg = parseJSONRPCMessage(JSON.parse(data));
                            this.onmessage?.(msg);
                        } catch (_error) {
                            const e = new MCPClientError({
                                message: "MCP HTTP Transport Error: Failed to parse message",
                            });
                            this.onerror?.(e);
                        }
                    }
                }
            } catch (error) {
                if (error instanceof Error && error.name === "AbortError") {
                    return;
                }
                const mcpError =
                    error instanceof MCPClientError
                        ? error
                        : new MCPClientError({
                              message:
                                  error instanceof Error ? error.message : "SSE connection error",
                              cause: error,
                          });
                this.onerror?.(mcpError);
                if (!this.abortController?.signal.aborted) {
                    this.scheduleInboundSseReconnection();
                }
            }
        } catch (error) {
            if (error instanceof Error && error.name === "AbortError") {
                return;
            }
            const mcpError =
                error instanceof MCPClientError
                    ? error
                    : new MCPClientError({
                          message:
                              error instanceof Error ? error.message : "SSE connection setup error",
                          cause: error,
                      });
            this.onerror?.(mcpError);
            if (!this.abortController?.signal.aborted) {
                this.scheduleInboundSseReconnection();
            }
        }
    }
}

/**
 * Parse SSE events from a stream.
 *
 * Implements the EventSource parsing algorithm.
 */
class EventSourceParserStream extends TransformStream<
    string,
    { event: string | undefined; data: string; id: string | undefined }
> {
    constructor() {
        let buffer = "";
        let data = ""; // Move data to constructor scope for cross-chunk events
        let lastEventId = "";
        let eventName = "";

        super({
            transform(chunk, controller) {
                buffer += chunk;
                const lines = buffer.split("\n");
                buffer = lines.pop() || "";

                for (const line of lines) {
                    if (line === "") {
                        // Dispatch event
                        if (data !== "") {
                            controller.enqueue({
                                event: eventName || undefined,
                                data: data.slice(0, -1), // Remove trailing newline
                                id: lastEventId || undefined,
                            });
                        }
                        // Reset event state after dispatch
                        data = "";
                        eventName = "";
                        continue;
                    }

                    if (line.startsWith(":")) {
                        // Comment line, ignore
                        continue;
                    }

                    const colonIndex = line.indexOf(":");
                    const field = colonIndex === -1 ? line : line.slice(0, colonIndex);
                    const value =
                        colonIndex === -1
                            ? ""
                            : line.slice(colonIndex + 1).startsWith(" ")
                              ? line.slice(colonIndex + 2)
                              : line.slice(colonIndex + 1);

                    switch (field) {
                        case "event":
                            eventName = value;
                            break;
                        case "data":
                            data += `${value}\n`;
                            break;
                        case "id":
                            lastEventId = value;
                            break;
                        case "retry":
                            // Retry timing is handled by the transport
                            break;
                    }
                }
            },
        });
    }
}
