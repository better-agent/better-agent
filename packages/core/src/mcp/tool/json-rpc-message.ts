import { isPlainRecord } from "@better-agent/shared/utils";
import { MCPClientError } from "../error/mcp-client-error";

/**
 * JSON-RPC 2.0 message types for MCP communication.
 *
 * Follows the Model Context Protocol's JSON-RPC usage.
 */

/** JSON-RPC version. */
export const JSONRPC_VERSION = "2.0";

/** JSON-RPC request. */
export interface JSONRPCRequest {
    jsonrpc: "2.0";
    id: string | number;
    method: string;
    params: Record<string, unknown> | undefined;
}

/** JSON-RPC response with a result. */
export interface JSONRPCResponse {
    jsonrpc: "2.0";
    id: string | number;
    result: unknown;
}

/** JSON-RPC error response. */
export interface JSONRPCError {
    jsonrpc: "2.0";
    id: string | number;
    error: {
        code: number;
        message: string;
        data: unknown | undefined;
    };
}

/** JSON-RPC notification with no `id`. */
export interface JSONRPCNotification {
    jsonrpc: "2.0";
    method: string;
    params: Record<string, unknown> | undefined;
}

/** Any JSON-RPC message. */
export type JSONRPCMessage = JSONRPCRequest | JSONRPCResponse | JSONRPCError | JSONRPCNotification;

/** Checks whether a message is a JSON-RPC request. */
export function isJSONRPCRequest(message: JSONRPCMessage): message is JSONRPCRequest {
    return "id" in message && "method" in message && !("error" in message);
}

/** Checks whether a message is a JSON-RPC response. */
export function isJSONRPCResponse(message: JSONRPCMessage): message is JSONRPCResponse {
    return "id" in message && "result" in message && !("error" in message);
}

/** Checks whether a message is a JSON-RPC error. */
export function isJSONRPCError(message: JSONRPCMessage): message is JSONRPCError {
    return "id" in message && "error" in message;
}

/** Checks whether a message is a JSON-RPC notification. */
export function isJSONRPCNotification(message: JSONRPCMessage): message is JSONRPCNotification {
    return !("id" in message) && "method" in message;
}

const isJsonRpcId = (value: unknown): value is string | number =>
    typeof value === "string" || typeof value === "number";

const isJsonRpcParams = (value: unknown): value is Record<string, unknown> | undefined =>
    value === undefined || isPlainRecord(value);

/**
 * Parses one JSON-RPC message.
 */
export const parseJSONRPCMessage = (value: unknown): JSONRPCMessage => {
    if (!isPlainRecord(value)) {
        throw new MCPClientError({
            message: "Invalid JSON-RPC message: expected an object.",
        });
    }

    if (value.jsonrpc !== JSONRPC_VERSION) {
        throw new MCPClientError({
            message: `Invalid JSON-RPC message: expected jsonrpc="${JSONRPC_VERSION}".`,
        });
    }

    if ("method" in value) {
        if (typeof value.method !== "string") {
            throw new MCPClientError({
                message: "Invalid JSON-RPC message: method must be a string.",
            });
        }

        if (!isJsonRpcParams(value.params)) {
            throw new MCPClientError({
                message: "Invalid JSON-RPC message: params must be an object when present.",
            });
        }

        if ("id" in value) {
            if (!isJsonRpcId(value.id)) {
                throw new MCPClientError({
                    message: "Invalid JSON-RPC request: id must be a string or number.",
                });
            }

            return {
                jsonrpc: JSONRPC_VERSION,
                id: value.id,
                method: value.method,
                params: value.params,
            };
        }

        return {
            jsonrpc: JSONRPC_VERSION,
            method: value.method,
            params: value.params,
        };
    }

    if ("result" in value) {
        if (!("id" in value) || !isJsonRpcId(value.id)) {
            throw new MCPClientError({
                message: "Invalid JSON-RPC response: id must be a string or number.",
            });
        }

        return {
            jsonrpc: JSONRPC_VERSION,
            id: value.id,
            result: value.result,
        };
    }

    if ("error" in value) {
        if (!("id" in value) || !isJsonRpcId(value.id)) {
            throw new MCPClientError({
                message: "Invalid JSON-RPC error: id must be a string or number.",
            });
        }

        if (
            !isPlainRecord(value.error) ||
            typeof value.error.code !== "number" ||
            typeof value.error.message !== "string"
        ) {
            throw new MCPClientError({
                message:
                    "Invalid JSON-RPC error: error must include numeric code and string message.",
            });
        }

        return {
            jsonrpc: JSONRPC_VERSION,
            id: value.id,
            error: {
                code: value.error.code,
                message: value.error.message,
                data: value.error.data,
            },
        };
    }

    throw new MCPClientError({
        message: "Invalid JSON-RPC message: unrecognized shape.",
    });
};

/**
 * Parses either one JSON-RPC message or an array of messages.
 */
export const parseJSONRPCMessageArray = (value: unknown): JSONRPCMessage[] =>
    Array.isArray(value) ? value.map(parseJSONRPCMessage) : [parseJSONRPCMessage(value)];
