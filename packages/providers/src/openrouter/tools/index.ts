import type { HostedToolDefinition } from "@better-agent/core";

export type OpenRouterNativeToolType = "web_search" | "datetime";

export type OpenRouterNativeToolConfig<TType extends string> = TType extends "web_search"
    ? {
          engine?: "auto" | "native" | "exa" | "firecrawl" | "parallel";
          max_results?: number;
          max_total_results?: number;
          search_context_size?: "low" | "medium" | "high";
          allowed_domains?: string[];
          excluded_domains?: string[];
          user_location?: {
              type: "approximate";
              city?: string;
              region?: string;
              country?: string;
              timezone?: string;
          };
      }
    : TType extends "datetime"
      ? {
            timezone?: string;
        }
    : never;

export type OpenRouterNativeToolDefinition<
    TType extends OpenRouterNativeToolType = OpenRouterNativeToolType,
> = HostedToolDefinition<"openrouter", TType, OpenRouterNativeToolConfig<TType>>;

export type OpenRouterNativeToolBuilders = ReturnType<typeof createOpenRouterNativeToolBuilders>;
type AnyOpenRouterNativeToolDefinition = {
    [K in OpenRouterNativeToolType]: OpenRouterNativeToolDefinition<K>;
}[OpenRouterNativeToolType];

export function createOpenRouterNativeToolBuilders() {
    return {
        webSearch: (config: OpenRouterNativeToolConfig<"web_search"> = {}) =>
            createNativeTool("web_search", config),
        datetime: (config: OpenRouterNativeToolConfig<"datetime"> = {}) =>
            createNativeTool("datetime", config),
    };
}

function createNativeTool<TType extends OpenRouterNativeToolType>(
    type: TType,
    config: OpenRouterNativeToolConfig<TType>,
): OpenRouterNativeToolDefinition<TType> {
    return {
        kind: "hosted",
        provider: "openrouter",
        type,
        config,
    };
}

export function isOpenRouterNativeToolDefinition(
    tool: unknown,
): tool is AnyOpenRouterNativeToolDefinition {
    if (!tool || typeof tool !== "object") return false;
    const t = tool as Record<string, unknown>;
    return t.kind === "hosted" && t.provider === "openrouter" && typeof t.type === "string";
}
