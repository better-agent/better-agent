import {
    type AnyDefinedTool,
    type Plugin,
    type ToolExecutionContext,
    defineTool,
} from "@better-agent/core";
import { BetterAgentError } from "@better-agent/shared/errors";
import { createMemorySandboxSessionStore } from "./memory-store";
import type { SandboxConfig, SandboxCreateParams } from "./types";
import { validateSandboxConfig, validateSandboxCreateParams } from "./validate";

const trimToUndefined = (value: string | undefined): string | undefined => {
    const trimmed = value?.trim();
    return trimmed ? trimmed : undefined;
};

const normalizeHostUrl = (value: string): string =>
    /^[a-z][a-z0-9+.-]*:\/\//i.test(value) ? value : `https://${value}`;

const createValidationError = (message: string, at: string, context?: Record<string, unknown>) =>
    BetterAgentError.fromCode("VALIDATION_FAILED", message, {
        ...(context !== undefined ? { context } : {}),
        trace: [{ at }],
    });

type ResolvedSandboxRef = {
    sandboxId: string;
    sessionKey?: string;
    created: boolean;
};

type SessionPolicy =
    | {
          kind: "managed";
          sessionKey: string;
      }
    | {
          kind: "disabled";
      };

type SandboxToolContext = ToolExecutionContext<unknown>;

const resolveCreateParams = (
    overrides: SandboxCreateParams | undefined,
    createConfig: SandboxCreateParams | undefined,
    createDefaults: SandboxCreateParams | undefined,
): SandboxCreateParams => ({
    template: createConfig?.template ?? overrides?.template ?? createDefaults?.template,
    startupTimeoutMs:
        createConfig?.startupTimeoutMs ??
        overrides?.startupTimeoutMs ??
        createDefaults?.startupTimeoutMs,
    envs:
        createDefaults?.envs || overrides?.envs || createConfig?.envs
            ? {
                  ...(createDefaults?.envs ?? {}),
                  ...(overrides?.envs ?? {}),
                  ...(createConfig?.envs ?? {}),
              }
            : undefined,
    metadata:
        createDefaults?.metadata || overrides?.metadata || createConfig?.metadata
            ? {
                  ...(createDefaults?.metadata ?? {}),
                  ...(overrides?.metadata ?? {}),
                  ...(createConfig?.metadata ?? {}),
              }
            : undefined,
    lifecycle:
        createDefaults?.lifecycle || overrides?.lifecycle || createConfig?.lifecycle
            ? {
                  ...(createDefaults?.lifecycle ?? {}),
                  ...(overrides?.lifecycle ?? {}),
                  ...(createConfig?.lifecycle ?? {}),
              }
            : undefined,
});

/**
 * Adds sandbox tools.
 *
 * By default, the plugin reuses one sandbox per `threadId`.
 * Use `sessionKey` to customize reuse, or return `null`/`undefined`
 * to disable reuse for a specific tool call.
 *
 * Uses an in-memory store by default.
 *
 * @example
 * ```ts
 * import { sandbox, createE2BSandboxClient } from "@better-agent/plugins";
 *
 * const plugin = sandbox({
 *   client: createE2BSandboxClient({
 *     apiKey: process.env.E2B_API_KEY,
 *   }),
 *   createConfig: {
 *     template: "base",
 *   },
 *   createDefaults: {
 *     startupTimeoutMs: 90_000,
 *   },
 * });
 * ```
 */
export const sandbox = (pluginConfig: SandboxConfig): Plugin => {
    validateSandboxConfig(pluginConfig);

    const sandboxClient = pluginConfig.client;
    const store = pluginConfig.store ?? createMemorySandboxSessionStore();
    const prefix = trimToUndefined(pluginConfig.prefix) ?? "sandbox";
    const nameFor = (suffix: string) => `${prefix}_${suffix}`;

    const getSessionPolicy = (ctx: SandboxToolContext, toolName: string): SessionPolicy => {
        if (pluginConfig.sessionKey) {
            const custom = trimToUndefined(
                pluginConfig.sessionKey({
                    runId: ctx.runId,
                    agentName: ctx.agentName ?? "",
                    ...(ctx.threadId !== undefined ? { threadId: ctx.threadId } : {}),
                    toolName,
                }) ?? undefined,
            );

            return custom !== undefined
                ? { kind: "managed", sessionKey: custom }
                : { kind: "disabled" };
        }

        return ctx.threadId
            ? { kind: "managed", sessionKey: `thread:${ctx.threadId}` }
            : { kind: "disabled" };
    };

    const getExplicitSandboxId = (value: string | undefined): string | undefined => {
        if (value === undefined) {
            return undefined;
        }

        const trimmed = value.trim();
        if (!trimmed) {
            throw createValidationError(
                "`sandboxId` must be a non-empty string when provided.",
                "plugins.sandbox.sandboxId",
            );
        }

        return trimmed;
    };

    const createSandbox = async (
        params: SandboxCreateParams | undefined,
        ctx: SandboxToolContext,
        toolName: string,
    ): Promise<ResolvedSandboxRef> => {
        const sessionPolicy = getSessionPolicy(ctx, toolName);
        const resolvedParams = resolveCreateParams(
            params,
            pluginConfig.createConfig,
            pluginConfig.createDefaults,
        );
        validateSandboxCreateParams(sandboxClient.provider, resolvedParams);
        const created = await sandboxClient.createSandbox(resolvedParams);

        if (sessionPolicy.kind === "managed") {
            await store.set(sessionPolicy.sessionKey, created.sandboxId);
        }

        return {
            sandboxId: created.sandboxId,
            ...(sessionPolicy.kind === "managed" ? { sessionKey: sessionPolicy.sessionKey } : {}),
            created: true,
        };
    };

    const resolveSandbox = async (params: {
        sandboxId?: string;
        createIfMissing: boolean;
        createParams?: SandboxCreateParams;
        ctx: SandboxToolContext;
        toolName: string;
    }): Promise<ResolvedSandboxRef> => {
        const explicitSandboxId = getExplicitSandboxId(params.sandboxId);
        if (explicitSandboxId) {
            return { sandboxId: explicitSandboxId, created: false };
        }

        const sessionPolicy = getSessionPolicy(params.ctx, params.toolName);
        if (sessionPolicy.kind === "managed") {
            const existing = trimToUndefined(
                (await store.get(sessionPolicy.sessionKey)) ?? undefined,
            );
            if (existing) {
                return {
                    sandboxId: existing,
                    sessionKey: sessionPolicy.sessionKey,
                    created: false,
                };
            }
        }

        if (!params.createIfMissing) {
            throw createValidationError(
                `No sandbox is available for this ${params.ctx.threadId ? "thread" : "run"}. Create one first with '${nameFor("create")}' or pass a sandboxId explicitly.`,
                "plugins.sandbox.resolveSandbox.missing",
                {
                    runId: params.ctx.runId,
                    threadId: params.ctx.threadId,
                    toolName: params.toolName,
                },
            );
        }

        return await createSandbox(params.createParams, params.ctx, params.toolName);
    };

    const clearManagedSessionIfMatches = async (
        ctx: SandboxToolContext,
        toolName: string,
        sandboxId: string,
    ): Promise<string | undefined> => {
        const sessionPolicy = getSessionPolicy(ctx, toolName);
        if (sessionPolicy.kind !== "managed") {
            return undefined;
        }

        const current = await store.get(sessionPolicy.sessionKey);
        if (current === sandboxId) {
            await store.delete(sessionPolicy.sessionKey);
            return sessionPolicy.sessionKey;
        }

        return undefined;
    };

    const createSchema = {
        type: "object",
        properties: {
            forceNew: { type: "boolean" },
            template: { type: "string" },
            startupTimeoutMs: { type: "number", exclusiveMinimum: 0 },
            envs: {
                type: "object",
                additionalProperties: { type: "string" },
            },
            metadata: {
                type: "object",
                additionalProperties: { type: "string" },
            },
            lifecycle: {
                type: "object",
                properties: {
                    ttlMs: { type: "number", exclusiveMinimum: 0 },
                    idleStopMs: { type: "number", exclusiveMinimum: 0 },
                    archiveAfterMs: { type: "number", exclusiveMinimum: 0 },
                    deleteAfterMs: { type: "number", exclusiveMinimum: 0 },
                },
                additionalProperties: false,
            },
        },
        additionalProperties: false,
    } as const;

    const sandboxIdSchema = {
        type: "string",
    } as const;

    const pathSchema = {
        type: "string",
        minLength: 1,
    } as const;

    const envsSchema = {
        type: "object",
        additionalProperties: { type: "string" },
    } as const;

    const createTool = defineTool({
        name: nameFor("create"),
        description:
            "Create a sandbox, or reuse the current thread sandbox unless forceNew is true.",
        target: "server",
        inputSchema: createSchema,
        execute: async (input, ctx) => {
            if (!input.forceNew) {
                const sessionPolicy = getSessionPolicy(ctx, nameFor("create"));
                if (sessionPolicy.kind === "managed") {
                    const existing = trimToUndefined(
                        (await store.get(sessionPolicy.sessionKey)) ?? undefined,
                    );
                    if (existing) {
                        return {
                            sandboxId: existing,
                            reused: true,
                            created: false,
                            sessionKey: sessionPolicy.sessionKey,
                        };
                    }
                }
            }

            const resolved = await createSandbox(
                {
                    template: input.template,
                    startupTimeoutMs: input.startupTimeoutMs,
                    envs: input.envs,
                    metadata: input.metadata,
                    lifecycle: input.lifecycle,
                },
                ctx,
                nameFor("create"),
            );

            return {
                sandboxId: resolved.sandboxId,
                reused: false,
                created: true,
                ...(resolved.sessionKey !== undefined ? { sessionKey: resolved.sessionKey } : {}),
            };
        },
    });

    const execTool = defineTool({
        name: nameFor("exec"),
        description:
            "Run one shell command inside a sandbox. Creates a sandbox automatically when none exists for the thread.",
        target: "server",
        inputSchema: {
            type: "object",
            properties: {
                sandboxId: sandboxIdSchema,
                cmd: { type: "string", minLength: 1 },
                cwd: { type: "string" },
                timeoutMs: { type: "number", exclusiveMinimum: 0 },
                envs: envsSchema,
            },
            required: ["cmd"],
            additionalProperties: false,
        } as const,
        approval: pluginConfig.approvals?.exec,
        execute: async (input, ctx) => {
            const resolved = await resolveSandbox({
                sandboxId: input.sandboxId,
                createIfMissing: true,
                ctx,
                toolName: nameFor("exec"),
            });
            const result = await sandboxClient.runCommand({
                sandboxId: resolved.sandboxId,
                cmd: input.cmd,
                cwd: input.cwd,
                timeoutMs: input.timeoutMs,
                envs: input.envs,
            });

            return {
                sandboxId: resolved.sandboxId,
                createdSandbox: resolved.created,
                ...result,
            };
        },
    });

    const readFileTool = defineTool({
        name: nameFor("read_file"),
        description:
            "Read one text file from a sandbox. Creates a sandbox automatically when none exists for the thread.",
        target: "server",
        inputSchema: {
            type: "object",
            properties: {
                sandboxId: sandboxIdSchema,
                path: pathSchema,
            },
            required: ["path"],
            additionalProperties: false,
        } as const,
        execute: async (input, ctx) => {
            const resolved = await resolveSandbox({
                sandboxId: input.sandboxId,
                createIfMissing: true,
                ctx,
                toolName: nameFor("read_file"),
            });

            return {
                sandboxId: resolved.sandboxId,
                path: input.path,
                content: await sandboxClient.readFile({
                    sandboxId: resolved.sandboxId,
                    path: input.path,
                }),
            };
        },
    });

    const writeFileTool = defineTool({
        name: nameFor("write_file"),
        description:
            "Write one text file into a sandbox. Creates a sandbox automatically when none exists for the thread.",
        target: "server",
        inputSchema: {
            type: "object",
            properties: {
                sandboxId: sandboxIdSchema,
                path: pathSchema,
                content: { type: "string" },
            },
            required: ["path", "content"],
            additionalProperties: false,
        } as const,
        approval: pluginConfig.approvals?.writeFile,
        execute: async (input, ctx) => {
            const resolved = await resolveSandbox({
                sandboxId: input.sandboxId,
                createIfMissing: true,
                ctx,
                toolName: nameFor("write_file"),
            });
            const result = await sandboxClient.writeFile({
                sandboxId: resolved.sandboxId,
                path: input.path,
                content: input.content,
            });

            return {
                sandboxId: resolved.sandboxId,
                createdSandbox: resolved.created,
                path: result.path,
            };
        },
    });

    const listFilesTool = defineTool({
        name: nameFor("list_files"),
        description:
            "List directory entries inside a sandbox. Creates a sandbox automatically when none exists for the thread.",
        target: "server",
        inputSchema: {
            type: "object",
            properties: {
                sandboxId: sandboxIdSchema,
                path: pathSchema,
            },
            required: ["path"],
            additionalProperties: false,
        } as const,
        execute: async (input, ctx) => {
            const resolved = await resolveSandbox({
                sandboxId: input.sandboxId,
                createIfMissing: true,
                ctx,
                toolName: nameFor("list_files"),
            });

            return {
                sandboxId: resolved.sandboxId,
                path: input.path,
                entries: await sandboxClient.listFiles({
                    sandboxId: resolved.sandboxId,
                    path: input.path,
                }),
            };
        },
    });

    const makeDirTool = defineTool({
        name: nameFor("make_dir"),
        description:
            "Create a directory inside a sandbox. Creates a sandbox automatically when none exists for the thread.",
        target: "server",
        inputSchema: {
            type: "object",
            properties: {
                sandboxId: sandboxIdSchema,
                path: pathSchema,
            },
            required: ["path"],
            additionalProperties: false,
        } as const,
        execute: async (input, ctx) => {
            const resolved = await resolveSandbox({
                sandboxId: input.sandboxId,
                createIfMissing: true,
                ctx,
                toolName: nameFor("make_dir"),
            });
            const result = await sandboxClient.makeDir({
                sandboxId: resolved.sandboxId,
                path: input.path,
            });

            return {
                sandboxId: resolved.sandboxId,
                path: input.path,
                created: result.created,
            };
        },
    });

    const removePathTool = defineTool({
        name: nameFor("remove_path"),
        description: "Remove a file or directory from a sandbox.",
        target: "server",
        inputSchema: {
            type: "object",
            properties: {
                sandboxId: sandboxIdSchema,
                path: pathSchema,
            },
            required: ["path"],
            additionalProperties: false,
        } as const,
        approval: pluginConfig.approvals?.removePath,
        execute: async (input, ctx) => {
            const resolved = await resolveSandbox({
                sandboxId: input.sandboxId,
                createIfMissing: false,
                ctx,
                toolName: nameFor("remove_path"),
            });
            await sandboxClient.removePath({
                sandboxId: resolved.sandboxId,
                path: input.path,
            });

            return {
                sandboxId: resolved.sandboxId,
                removed: true,
                path: input.path,
            };
        },
    });

    const getHostTool = defineTool({
        name: nameFor("get_host"),
        description:
            "Expose one sandbox port as a host URL so callers can reach an app running inside the sandbox.",
        target: "server",
        inputSchema: {
            type: "object",
            properties: {
                sandboxId: sandboxIdSchema,
                port: { type: "number", minimum: 1, maximum: 65535 },
            },
            required: ["port"],
            additionalProperties: false,
        } as const,
        execute: async (input, ctx) => {
            const resolved = await resolveSandbox({
                sandboxId: input.sandboxId,
                createIfMissing: false,
                ctx,
                toolName: nameFor("get_host"),
            });
            const hostResult = await sandboxClient.getHost({
                sandboxId: resolved.sandboxId,
                port: input.port,
            });
            const preview = typeof hostResult === "string" ? undefined : hostResult;
            const host = normalizeHostUrl(
                typeof hostResult === "string" ? hostResult : hostResult.url,
            );

            return {
                sandboxId: resolved.sandboxId,
                port: input.port,
                host,
                ...(preview?.token !== undefined ? { token: preview.token } : {}),
            };
        },
    });

    const killTool = defineTool({
        name: nameFor("kill"),
        description: "Terminate a sandbox and clear the current thread sandbox when applicable.",
        target: "server",
        inputSchema: {
            type: "object",
            properties: {
                sandboxId: sandboxIdSchema,
            },
            additionalProperties: false,
        } as const,
        approval: pluginConfig.approvals?.killSandbox,
        execute: async (input, ctx) => {
            const resolved = await resolveSandbox({
                sandboxId: input.sandboxId,
                createIfMissing: false,
                ctx,
                toolName: nameFor("kill"),
            });

            await sandboxClient.killSandbox({
                sandboxId: resolved.sandboxId,
            });

            const clearedSessionKey = await clearManagedSessionIfMatches(
                ctx,
                nameFor("kill"),
                resolved.sandboxId,
            );

            return {
                sandboxId: resolved.sandboxId,
                killed: true,
                ...(clearedSessionKey !== undefined ? { clearedSessionKey } : {}),
            };
        },
    });

    const toAnyTool = (tool: unknown): AnyDefinedTool => tool as AnyDefinedTool;
    const tools: AnyDefinedTool[] = [
        toAnyTool(createTool),
        toAnyTool(execTool),
        toAnyTool(readFileTool),
        toAnyTool(writeFileTool),
        toAnyTool(listFilesTool),
        toAnyTool(makeDirTool),
        toAnyTool(removePathTool),
        toAnyTool(getHostTool),
        toAnyTool(killTool),
    ];

    const plugin: Plugin = {
        id: pluginConfig.id ?? "sandbox",
        tools,
    };

    return plugin;
};
