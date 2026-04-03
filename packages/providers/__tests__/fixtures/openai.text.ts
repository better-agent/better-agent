import type { ServerToolDefinition } from "@better-agent/core";
import type { OpenAIResponseStreamEvent } from "../../src/openai/responses/schemas";

const TOOL_JSON_SCHEMA = Symbol.for("better-agent.tool.json_schema");

export const OPENAI_TEXT_FIXTURE = {
    prompts: {
        multimodal: "Describe this image in one sentence.",
        useTool: "Use weather tool.",
        noTool: "Do not use tools.",
        coexistence: "Use tools if needed.",
        hello: "hello",
        returnJson: "Return JSON",
    },
    imageUrl: "https://example.com/test.png",
    unknownToolName: "missing_tool",
    modelIds: {
        mini: "gpt-4.1-mini" as const,
        latest: "gpt-5.1" as const,
    },
    statusDataPartCases: [
        { type: "response.web_search_call.searching", tool: "web_search", status: "searching" },
        { type: "response.file_search_call.completed", tool: "file_search", status: "completed" },
        {
            type: "response.code_interpreter_call.interpreting",
            tool: "code_interpreter",
            status: "interpreting",
        },
        {
            type: "response.image_generation_call.generating",
            tool: "image_generation",
            status: "generating",
        },
        { type: "response.mcp_call.failed", tool: "mcp", status: "failed" },
        { type: "response.computer_call.in_progress", tool: "computer", status: "in_progress" },
    ] as Array<{ type: OpenAIResponseStreamEvent["type"]; tool: string; status: string }>,
    standardSchema: {
        "~standard": {
            version: 1 as const,
            vendor: "test",
            jsonSchema: {
                input: () => ({
                    type: "object",
                    properties: {
                        greeting: { type: "string" },
                    },
                    required: ["greeting"],
                    additionalProperties: false,
                }),
                output: () => ({
                    type: "object",
                }),
            },
        },
    },
    ids: {
        message1: "msg_1",
        message2: "msg_2",
        functionCall: "fc_1",
        nativeCall: "ws_1",
    },
};

export const WEATHER_TOOL = {
    kind: "server",
    name: "get_weather",
    description: "Get weather by location",
    schema: {
        type: "object",
        properties: {
            location: { type: "string" },
        },
        required: ["location"],
        additionalProperties: false,
    },
    handler: async () => ({ ok: true }),
    [TOOL_JSON_SCHEMA]: {
        type: "object",
        properties: {
            location: { type: "string" },
        },
        required: ["location"],
        additionalProperties: false,
    },
} as unknown as ServerToolDefinition & { [TOOL_JSON_SCHEMA]: Record<string, unknown> };
