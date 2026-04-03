import type { HostedToolDefinition } from "@better-agent/core";
import type { XAICreateResponseSchema } from "../responses/schemas";

type XAINativeToolByType<TType extends string> = NonNullable<
    XAICreateResponseSchema["tools"]
>[number] extends infer TTool
    ? TTool extends { type: infer ToolType extends string }
        ? TType extends ToolType
            ? TTool
            : never
        : never
    : never;

export type XAINativeToolConfig<TType extends string> = [XAINativeToolByType<TType>] extends [never]
    ? Record<string, unknown>
    : Omit<XAINativeToolByType<TType>, "type">;

export type XAINativeToolType =
    | "web_search"
    | "x_search"
    | "code_execution"
    | "code_interpreter"
    | "attachment_search"
    | "collections_search"
    | "file_search"
    | "mcp";

export type XAINativeToolDefinition<TType extends XAINativeToolType = XAINativeToolType> =
    HostedToolDefinition<"xai", TType, XAINativeToolConfig<TType>>;

export type XAINativeToolBuilders = ReturnType<typeof createXAINativeToolBuilders>;
type AnyXAINativeToolDefinition = {
    [K in XAINativeToolType]: XAINativeToolDefinition<K>;
}[XAINativeToolType];

export function createXAINativeToolBuilders() {
    return {
        webSearch: (config: XAINativeToolConfig<"web_search"> = {}) =>
            createNativeTool("web_search", config),
        xSearch: (config: XAINativeToolConfig<"x_search"> = {}) =>
            createNativeTool("x_search", config),
        codeExecution: (config: XAINativeToolConfig<"code_execution"> = {}) =>
            createNativeTool("code_execution", config),
        codeInterpreter: (config: XAINativeToolConfig<"code_interpreter"> = {}) =>
            createNativeTool("code_interpreter", config),
        attachmentSearch: (config: XAINativeToolConfig<"attachment_search"> = {}) =>
            createNativeTool("attachment_search", config),
        collectionsSearch: (config: XAINativeToolConfig<"collections_search"> = {}) =>
            createNativeTool("collections_search", config),
        fileSearch: (config: XAINativeToolConfig<"file_search"> = {}) =>
            createNativeTool("file_search", config),
        mcp: (config: XAINativeToolConfig<"mcp">) => createNativeTool("mcp", config),
    };
}

function createNativeTool<TType extends XAINativeToolType>(
    type: TType,
    config: XAINativeToolConfig<TType>,
): XAINativeToolDefinition<TType> {
    return {
        kind: "hosted",
        provider: "xai",
        type,
        config,
    };
}

export function isXAINativeToolDefinition(tool: unknown): tool is AnyXAINativeToolDefinition {
    if (!tool || typeof tool !== "object") return false;
    const t = tool as Record<string, unknown>;
    return t.kind === "hosted" && t.provider === "xai" && typeof t.type === "string";
}

export function mapXAINativeToolToRequest(
    tool: AnyXAINativeToolDefinition,
): NonNullable<XAICreateResponseSchema["tools"]>[number] {
    return {
        type: tool.type,
        ...tool.config,
    } as NonNullable<XAICreateResponseSchema["tools"]>[number];
}
