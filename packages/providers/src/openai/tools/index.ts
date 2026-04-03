import type { HostedToolDefinition } from "@better-agent/core";
import type { OpenAICreateResponseSchema } from "../responses/schemas";

type OpenAINativeToolByType<TType extends string> = TType extends "tool_search"
    ? {
          type: "tool_search";
          execution?: "server" | "client";
          description?: string;
          parameters?: Record<string, unknown>;
      }
    : NonNullable<OpenAICreateResponseSchema["tools"]>[number] extends infer TTool
      ? TTool extends { type: infer ToolType extends string }
          ? TType extends ToolType
              ? TTool
              : never
          : never
      : never;

export type OpenAINativeToolConfig<TType extends string> = Omit<
    OpenAINativeToolByType<TType>,
    "type"
>;

export type OpenAINativeToolType =
    | "web_search"
    | "web_search_preview"
    | "file_search"
    | "code_interpreter"
    | "image_generation"
    | "computer_use_preview"
    | "mcp"
    | "shell"
    | "local_shell"
    | "apply_patch"
    | "tool_search"
    | "custom";

export type OpenAINativeToolDefinition<TType extends OpenAINativeToolType = OpenAINativeToolType> =
    HostedToolDefinition<"openai", TType, OpenAINativeToolConfig<TType>>;

export type OpenAINativeToolBuilders = ReturnType<typeof createOpenAINativeToolBuilders>;
type AnyOpenAINativeToolDefinition = {
    [K in OpenAINativeToolType]: OpenAINativeToolDefinition<K>;
}[OpenAINativeToolType];

export function createOpenAINativeToolBuilders() {
    return {
        webSearch: (config: OpenAINativeToolConfig<"web_search">) =>
            createNativeTool("web_search", config),
        webSearchPreview: (config: OpenAINativeToolConfig<"web_search_preview">) =>
            createNativeTool("web_search_preview", config),
        fileSearch: (config: OpenAINativeToolConfig<"file_search">) =>
            createNativeTool("file_search", config),
        codeInterpreter: (config: OpenAINativeToolConfig<"code_interpreter">) =>
            createNativeTool("code_interpreter", config),
        imageGeneration: (config: OpenAINativeToolConfig<"image_generation">) =>
            createNativeTool("image_generation", config),
        computerUsePreview: (config: OpenAINativeToolConfig<"computer_use_preview">) =>
            createNativeTool("computer_use_preview", config),
        mcp: (config: OpenAINativeToolConfig<"mcp">) => createNativeTool("mcp", config),
        shell: (config = {}) => createNativeTool("shell", config),
        localShell: (config = {}) => createNativeTool("local_shell", config),
        applyPatch: (config = {}) => createNativeTool("apply_patch", config),
        toolSearch: (config: OpenAINativeToolConfig<"tool_search"> = {}) =>
            createNativeTool("tool_search", config),
        custom: (config: OpenAINativeToolConfig<"custom">) => createNativeTool("custom", config),
    };
}

function createNativeTool<TType extends OpenAINativeToolType>(
    type: TType,
    config: OpenAINativeToolConfig<TType>,
): OpenAINativeToolDefinition<TType> {
    return {
        kind: "hosted",
        provider: "openai",
        type,
        config,
    };
}

export function isOpenAINativeToolDefinition(tool: unknown): tool is AnyOpenAINativeToolDefinition {
    if (!tool || typeof tool !== "object") return false;
    const t = tool as Record<string, unknown>;
    return t.kind === "hosted" && t.provider === "openai" && typeof t.type === "string";
}

/**
 * Converts a hosted OpenAI tool definition to Responses API `tools[]` payload shape.
 */
export function mapOpenAINativeToolToRequest(
    tool: AnyOpenAINativeToolDefinition,
): NonNullable<OpenAICreateResponseSchema["tools"]>[number] {
    switch (tool.type) {
        case "web_search":
            return { type: "web_search", ...tool.config };
        case "web_search_preview":
            return { type: "web_search_preview", ...tool.config };
        case "file_search":
            return { type: "file_search", ...tool.config };
        case "code_interpreter":
            return { type: "code_interpreter", ...tool.config };
        case "image_generation":
            return { type: "image_generation", ...tool.config };
        case "computer_use_preview":
            return { type: "computer_use_preview", ...tool.config };
        case "mcp":
            return { type: "mcp", ...tool.config };
        case "shell":
            return { type: "shell", ...tool.config };
        case "local_shell":
            return { type: "local_shell", ...tool.config };
        case "apply_patch":
            return { type: "apply_patch", ...tool.config };
        case "tool_search":
            return { type: "tool_search", ...tool.config } as unknown as NonNullable<
                OpenAICreateResponseSchema["tools"]
            >[number];
        case "custom":
            return { type: "custom", ...tool.config };
    }
}
