import type { Awaitable } from "../internal/types";
import type { AgentToolDefinition, LazyToolSource, LazyToolSourceResult } from "./types";

type AnyLazyToolLoader = (...args: readonly unknown[]) => Awaitable<unknown>;

type InferLazyToolContext<TLoader extends AnyLazyToolLoader> = Parameters<TLoader> extends []
    ? unknown
    : Exclude<Parameters<TLoader>[0], undefined>;

/**
 * Creates a lifecycle-aware tool source that loads once, caches successes, and can be explicitly disposed.
 *
 * Useful for remote or expensive tool providers such as MCP servers where you want
 * to reuse a client across runs instead of reconnecting every time.
 *
 * @example
 * ```ts
 * import { defineAgent, lazyTools } from "@better-agent/core";
 * import { convertMCPTools, createMCPClient } from "@better-agent/core/mcp";
 *
 * const context7Tools = lazyTools(async () => {
 *   const client = await createMCPClient({
 *     transport: {
 *       type: "http",
 *       url: process.env.CONTEXT7_MCP_URL ?? "https://mcp.context7.com/mcp",
 *     },
 *   });
 *
 *   const listed = await client.listTools();
 *
 *   return {
 *     tools: convertMCPTools(client, listed.tools, { prefix: "context7" }),
 *     dispose: async () => {
 *       await client.close?.();
 *     },
 *   };
 * });
 *
 * const agent = defineAgent({
 *   name: "docs",
 *   model: openai.text("gpt-5.4-mini"),
 *   tools: context7Tools,
 * });
 * ```
 *
 * Call `source.dispose()` when cached provider resources should be released, or
 * `source.reload(...)` to force a refresh.
 */
export const lazyTools = <TLoader extends AnyLazyToolLoader>(
    loader: TLoader,
): LazyToolSource<InferLazyToolContext<TLoader>> => {
    type TContext = InferLazyToolContext<TLoader>;

    let loadedPromise: Promise<LazyToolSourceResult> | undefined;
    let loadedDispose: (() => Awaitable<void>) | undefined;

    const load = async (context: TContext | undefined): Promise<LazyToolSourceResult> => {
        if (!loadedPromise) {
            loadedPromise = (async (): Promise<LazyToolSourceResult> => {
                try {
                    const value = await (
                        loader as (context: TContext | undefined) => Awaitable<unknown>
                    )(context);
                    const resolved =
                        typeof value === "object" && value !== null && "tools" in value
                            ? (() => {
                                  const result = value as LazyToolSourceResult;
                                  const tools = Array.isArray(result.tools)
                                      ? [...result.tools]
                                      : [result.tools];

                                  return {
                                      tools,
                                      dispose: result.dispose,
                                  };
                              })()
                            : {
                                  tools: Array.isArray(value)
                                      ? [...(value as readonly AgentToolDefinition<unknown>[])]
                                      : [value as AgentToolDefinition<unknown>],
                                  dispose: undefined,
                              };
                    loadedDispose = resolved.dispose;
                    return resolved;
                } catch (error) {
                    loadedPromise = undefined;
                    loadedDispose = undefined;
                    throw error;
                }
            })();
        }

        return await loadedPromise;
    };

    const dispose = async () => {
        const disposer = loadedDispose;
        loadedPromise = undefined;
        loadedDispose = undefined;
        await disposer?.();
    };

    return {
        kind: "lazy",
        resolve: load,
        dispose,
        reload: async (context) => {
            await dispose();
            return await load(context);
        },
    };
};
