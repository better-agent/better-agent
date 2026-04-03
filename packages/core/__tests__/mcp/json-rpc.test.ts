import { describe, expect, test } from "bun:test";
import { MCPClientError } from "../../src/mcp/error/mcp-client-error";
import { parseJSONRPCMessage, parseJSONRPCMessageArray } from "../../src/mcp/tool/json-rpc-message";

describe("MCP JSON-RPC parsing", () => {
    test("accepts valid JSON-RPC responses", () => {
        expect(
            parseJSONRPCMessage({
                jsonrpc: "2.0",
                id: 1,
                result: { ok: true },
            }),
        ).toEqual({
            jsonrpc: "2.0",
            id: 1,
            result: { ok: true },
        });
    });

    test("rejects malformed JSON-RPC messages", () => {
        expect(() =>
            parseJSONRPCMessage({
                jsonrpc: "2.0",
                id: 1,
                error: { code: "bad", message: 42 },
            }),
        ).toThrow(MCPClientError);
    });

    test("parses JSON-RPC message arrays", () => {
        expect(
            parseJSONRPCMessageArray([{ jsonrpc: "2.0", id: 1, result: { ok: true } }]),
        ).toHaveLength(1);
    });
});
