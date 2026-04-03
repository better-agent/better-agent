import { BetterAgentError, type BetterAgentErrorContext } from "@better-agent/shared/errors";

/**
 * MCP client error.
 */
export class MCPClientError extends BetterAgentError {
    /** Additional error data from the MCP server. */
    readonly data?: unknown;

    /** JSON-RPC error code, when present. */
    readonly jsonRpcCode: number | undefined;

    constructor({
        message,
        cause,
        data,
        jsonRpcCode,
        context,
        trace,
    }: {
        message: string;
        cause?: unknown;
        data?: unknown;
        jsonRpcCode?: number;
        context?: BetterAgentErrorContext;
        trace?: Array<{ at: string }>;
    }) {
        super(message, {
            code: "INTERNAL",
            context,
            trace,
            cause: cause instanceof Error ? cause : undefined,
        });

        this.data = data;
        this.jsonRpcCode = jsonRpcCode;
        this.name = "MCPClientError";
    }

    /**
     * Type guard for `MCPClientError`.
     */
    static isInstance(error: unknown): error is MCPClientError {
        return error instanceof MCPClientError;
    }
}
