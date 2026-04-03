import type { HostedToolDefinition } from "@better-agent/core";
import type { AnthropicMessagesRequestSchema } from "../responses/schemas";

type AnthropicNativeToolByType<TType extends string> = NonNullable<
    AnthropicMessagesRequestSchema["tools"]
>[number] extends infer TTool
    ? TTool extends { type: infer ToolType extends string }
        ? TType extends ToolType
            ? TTool
            : never
        : never
    : never;

export type AnthropicNativeToolConfig<TType extends string> = Omit<
    AnthropicNativeToolByType<TType>,
    "type" | "name" | "cache_control"
>;

export type AnthropicNativeToolType =
    | "code_execution_20250522"
    | "code_execution_20250825"
    | "code_execution_20260120"
    | "computer_20241022"
    | "computer_20250124"
    | "computer_20251124"
    | "text_editor_20241022"
    | "text_editor_20250124"
    | "text_editor_20250429"
    | "text_editor_20250728"
    | "bash_20241022"
    | "bash_20250124"
    | "memory_20250818"
    | "web_search_20250305"
    | "web_search_20260209"
    | "web_fetch_20250910"
    | "web_fetch_20260209"
    | "tool_search_tool_regex_20251119"
    | "tool_search_tool_bm25_20251119";

export type AnthropicNativeToolDefinition<
    TType extends AnthropicNativeToolType = AnthropicNativeToolType,
> = HostedToolDefinition<"anthropic", TType, AnthropicNativeToolConfig<TType>>;

export type AnthropicNativeToolBuilders = ReturnType<typeof createAnthropicNativeToolBuilders>;
type AnyAnthropicNativeToolDefinition = {
    [K in AnthropicNativeToolType]: AnthropicNativeToolDefinition<K>;
}[AnthropicNativeToolType];

export function createAnthropicNativeToolBuilders() {
    return {
        codeExecution_20250522: (
            config: AnthropicNativeToolConfig<"code_execution_20250522"> = {},
        ) => createNativeTool("code_execution_20250522", config),
        codeExecution_20250825: (
            config: AnthropicNativeToolConfig<"code_execution_20250825"> = {},
        ) => createNativeTool("code_execution_20250825", config),
        codeExecution_20260120: (
            config: AnthropicNativeToolConfig<"code_execution_20260120"> = {},
        ) => createNativeTool("code_execution_20260120", config),
        computer_20241022: (config: AnthropicNativeToolConfig<"computer_20241022">) =>
            createNativeTool("computer_20241022", config),
        computer_20250124: (config: AnthropicNativeToolConfig<"computer_20250124">) =>
            createNativeTool("computer_20250124", config),
        computer_20251124: (config: AnthropicNativeToolConfig<"computer_20251124">) =>
            createNativeTool("computer_20251124", config),
        textEditor_20241022: (config: AnthropicNativeToolConfig<"text_editor_20241022"> = {}) =>
            createNativeTool("text_editor_20241022", config),
        textEditor_20250124: (config: AnthropicNativeToolConfig<"text_editor_20250124"> = {}) =>
            createNativeTool("text_editor_20250124", config),
        textEditor_20250429: (config: AnthropicNativeToolConfig<"text_editor_20250429"> = {}) =>
            createNativeTool("text_editor_20250429", config),
        textEditor_20250728: (config: AnthropicNativeToolConfig<"text_editor_20250728"> = {}) =>
            createNativeTool("text_editor_20250728", config),
        bash_20241022: (config: AnthropicNativeToolConfig<"bash_20241022"> = {}) =>
            createNativeTool("bash_20241022", config),
        bash_20250124: (config: AnthropicNativeToolConfig<"bash_20250124"> = {}) =>
            createNativeTool("bash_20250124", config),
        memory_20250818: (config: AnthropicNativeToolConfig<"memory_20250818"> = {}) =>
            createNativeTool("memory_20250818", config),
        webSearch_20250305: (config: AnthropicNativeToolConfig<"web_search_20250305"> = {}) =>
            createNativeTool("web_search_20250305", config),
        webSearch_20260209: (config: AnthropicNativeToolConfig<"web_search_20260209"> = {}) =>
            createNativeTool("web_search_20260209", config),
        webFetch_20250910: (config: AnthropicNativeToolConfig<"web_fetch_20250910"> = {}) =>
            createNativeTool("web_fetch_20250910", config),
        webFetch_20260209: (config: AnthropicNativeToolConfig<"web_fetch_20260209"> = {}) =>
            createNativeTool("web_fetch_20260209", config),
        toolSearchRegex_20251119: (
            config: AnthropicNativeToolConfig<"tool_search_tool_regex_20251119"> = {},
        ) => createNativeTool("tool_search_tool_regex_20251119", config),
        toolSearchBm25_20251119: (
            config: AnthropicNativeToolConfig<"tool_search_tool_bm25_20251119"> = {},
        ) => createNativeTool("tool_search_tool_bm25_20251119", config),
    };
}

function createNativeTool<TType extends AnthropicNativeToolType>(
    type: TType,
    config: AnthropicNativeToolConfig<TType>,
): AnthropicNativeToolDefinition<TType> {
    return {
        kind: "hosted",
        provider: "anthropic",
        type,
        config,
    };
}

export function isAnthropicNativeToolDefinition(
    tool: unknown,
): tool is AnyAnthropicNativeToolDefinition {
    if (!tool || typeof tool !== "object") return false;
    const t = tool as Record<string, unknown>;
    return t.kind === "hosted" && t.provider === "anthropic" && typeof t.type === "string";
}

export function mapAnthropicNativeToolToRequest(
    tool: AnyAnthropicNativeToolDefinition,
): NonNullable<AnthropicMessagesRequestSchema["tools"]>[number] {
    switch (tool.type) {
        case "code_execution_20250522":
            return { type: "code_execution_20250522", name: "code_execution", ...tool.config };
        case "code_execution_20250825":
            return { type: "code_execution_20250825", name: "code_execution", ...tool.config };
        case "code_execution_20260120":
            return { type: "code_execution_20260120", name: "code_execution", ...tool.config };
        case "computer_20241022":
            return { type: "computer_20241022", name: "computer", ...tool.config };
        case "computer_20250124":
            return { type: "computer_20250124", name: "computer", ...tool.config };
        case "computer_20251124":
            return { type: "computer_20251124", name: "computer", ...tool.config };
        case "text_editor_20241022":
            return { type: "text_editor_20241022", name: "str_replace_editor", ...tool.config };
        case "text_editor_20250124":
            return { type: "text_editor_20250124", name: "str_replace_editor", ...tool.config };
        case "text_editor_20250429":
            return {
                type: "text_editor_20250429",
                name: "str_replace_based_edit_tool",
                ...tool.config,
            };
        case "text_editor_20250728":
            return {
                type: "text_editor_20250728",
                name: "str_replace_based_edit_tool",
                ...tool.config,
            };
        case "bash_20241022":
            return { type: "bash_20241022", name: "bash", ...tool.config };
        case "bash_20250124":
            return { type: "bash_20250124", name: "bash", ...tool.config };
        case "memory_20250818":
            return { type: "memory_20250818", name: "memory", ...tool.config };
        case "web_search_20250305":
            return { type: "web_search_20250305", name: "web_search", ...tool.config };
        case "web_search_20260209":
            return { type: "web_search_20260209", name: "web_search", ...tool.config };
        case "web_fetch_20250910":
            return { type: "web_fetch_20250910", name: "web_fetch", ...tool.config };
        case "web_fetch_20260209":
            return { type: "web_fetch_20260209", name: "web_fetch", ...tool.config };
        case "tool_search_tool_regex_20251119":
            return {
                type: "tool_search_tool_regex_20251119",
                name: "tool_search_tool_regex",
                ...tool.config,
            };
        case "tool_search_tool_bm25_20251119":
            return {
                type: "tool_search_tool_bm25_20251119",
                name: "tool_search_tool_bm25",
                ...tool.config,
            };
    }
}
