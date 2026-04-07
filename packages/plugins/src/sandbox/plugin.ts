import { type Plugin, type ToolRunContext, defineTool } from "@better-agent/core";
import { BetterAgentError } from "@better-agent/shared/errors";
import { createMemorySandboxSessionStore } from "./memory-store";
import type { SandboxCreateParams, SandboxPluginConfig } from "./types";
import { validateSandboxPluginConfig } from "./validate";

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

/**
 * Adds sandbox tools.
 *
 * By default, the plugin reuses one sandbox per `conversationId`.
 * Use `sessionKey` to customize reuse, or return `null`/`undefined`
 * to disable reuse for a specific tool call.
 *
 * Uses an in-memory store by default.
 *
 * @example
 * ```ts
 * import { sandboxPlugin, createE2BSandboxClient } from "@better-agent/plugins";
 *
 * const plugin = sandboxPlugin({
 *   client: createE2BSandboxClient({
 *     apiKey: process.env.E2B_API_KEY,
 *   }),
 *   defaults: {
 *     template: "base",
 *     timeoutMs: 10 * 60_000,
 *   },
 * });
 * ```
 */
export const sandboxPlugin = (config: SandboxPluginConfig): Plugin => {
    validateSandboxPluginConfig(config);

    const sandboxClient = config.client;
    const store = config.store ?? createMemorySandboxSessionStore();
    const prefix = trimToUndefined(config.prefix) ?? "sandbox";
    const nameFor = (suffix: string) => `${prefix}_${suffix}`;

    const getSessionPolicy = (ctx: ToolRunContext, toolName: string): SessionPolicy => {
        if (config.sessionKey) {
            const custom = trimToUndefined(
                config.sessionKey({
                    runId: ctx.runId,
                    agentName: ctx.agentName,
                    ...(ctx.conversationId !== undefined
                        ? { conversationId: ctx.conversationId }
                        : {}),
                    toolName,
                }) ?? undefined,
            );

            return custom !== undefined
                ? { kind: "managed", sessionKey: custom }
                : { kind: "disabled" };
        }

        return ctx.conversationId
            ? { kind: "managed", sessionKey: `conversation:${ctx.conversationId}` }
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
                "plugins.sandboxPlugin.sandboxId",
            );
        }

        return trimmed;
    };

    const createSandbox = async (
        params: SandboxCreateParams | undefined,
        ctx: ToolRunContext,
        toolName: string,
    ): Promise<ResolvedSandboxRef> => {
        const sessionPolicy = getSessionPolicy(ctx, toolName);
        const created = await sandboxClient.createSandbox({
            template: params?.template ?? config.defaults?.template,
            timeoutMs: params?.timeoutMs ?? config.defaults?.timeoutMs,
            envs: params?.envs ?? config.defaults?.envs,
            metadata: params?.metadata ?? config.defaults?.metadata,
        });

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
        ctx: ToolRunContext;
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
                `No sandbox is available for this ${params.ctx.conversationId ? "conversation" : "run"}. Create one first with '${nameFor("create")}' or pass a sandboxId explicitly.`,
                "plugins.sandboxPlugin.resolveSandbox.missing",
                {
                    runId: params.ctx.runId,
                    agentName: params.ctx.agentName,
                    conversationId: params.ctx.conversationId,
                    toolName: params.toolName,
                },
            );
        }

        return await createSandbox(params.createParams, params.ctx, params.toolName);
    };

    const clearManagedSessionIfMatches = async (
        ctx: ToolRunContext,
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
            timeoutMs: { type: "number", exclusiveMinimum: 0 },
            envs: {
                type: "object",
                additionalProperties: { type: "string" },
            },
            metadata: {
                type: "object",
                additionalProperties: { type: "string" },
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
            "Create a sandbox, or reuse the current conversation sandbox unless forceNew is true.",
        schema: createSchema,
    }).server(async (input, ctx) => {
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
                timeoutMs: input.timeoutMs,
                envs: input.envs,
                metadata: input.metadata,
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
    });

    const execTool = defineTool({
        name: nameFor("exec"),
        description:
            "Run one shell command inside a sandbox. Creates a sandbox automatically when none exists for the conversation.",
        schema: {
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
        approval: config.approvals?.exec,
    }).server(async (input, ctx) => {
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
    });

    const readFileTool = defineTool({
        name: nameFor("read_file"),
        description:
            "Read one text file from a sandbox. Creates a sandbox automatically when none exists for the conversation.",
        schema: {
            type: "object",
            properties: {
                sandboxId: sandboxIdSchema,
                path: pathSchema,
            },
            required: ["path"],
            additionalProperties: false,
        } as const,
    }).server(async (input, ctx) => {
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
    });

    const writeFileTool = defineTool({
        name: nameFor("write_file"),
        description:
            "Write one text file into a sandbox. Creates a sandbox automatically when none exists for the conversation.",
        schema: {
            type: "object",
            properties: {
                sandboxId: sandboxIdSchema,
                path: pathSchema,
                content: { type: "string" },
            },
            required: ["path", "content"],
            additionalProperties: false,
        } as const,
        approval: config.approvals?.writeFile,
    }).server(async (input, ctx) => {
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
    });

    const listFilesTool = defineTool({
        name: nameFor("list_files"),
        description:
            "List directory entries inside a sandbox. Creates a sandbox automatically when none exists for the conversation.",
        schema: {
            type: "object",
            properties: {
                sandboxId: sandboxIdSchema,
                path: pathSchema,
            },
            required: ["path"],
            additionalProperties: false,
        } as const,
    }).server(async (input, ctx) => {
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
    });

    const makeDirTool = defineTool({
        name: nameFor("make_dir"),
        description:
            "Create a directory inside a sandbox. Creates a sandbox automatically when none exists for the conversation.",
        schema: {
            type: "object",
            properties: {
                sandboxId: sandboxIdSchema,
                path: pathSchema,
            },
            required: ["path"],
            additionalProperties: false,
        } as const,
    }).server(async (input, ctx) => {
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
    });

    const removePathTool = defineTool({
        name: nameFor("remove_path"),
        description: "Remove a file or directory from a sandbox.",
        schema: {
            type: "object",
            properties: {
                sandboxId: sandboxIdSchema,
                path: pathSchema,
            },
            required: ["path"],
            additionalProperties: false,
        } as const,
        approval: config.approvals?.removePath,
    }).server(async (input, ctx) => {
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
    });

    const getHostTool = defineTool({
        name: nameFor("get_host"),
        description:
            "Expose one sandbox port as a host URL so callers can reach an app running inside the sandbox.",
        schema: {
            type: "object",
            properties: {
                sandboxId: sandboxIdSchema,
                port: { type: "number", minimum: 1, maximum: 65535 },
            },
            required: ["port"],
            additionalProperties: false,
        } as const,
    }).server(async (input, ctx) => {
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
        const host = normalizeHostUrl(typeof hostResult === "string" ? hostResult : hostResult.url);

        return {
            sandboxId: resolved.sandboxId,
            port: input.port,
            host,
            ...(preview?.token !== undefined ? { token: preview.token } : {}),
        };
    });

    const killTool = defineTool({
        name: nameFor("kill"),
        description:
            "Terminate a sandbox and clear the current conversation sandbox when applicable.",
        schema: {
            type: "object",
            properties: {
                sandboxId: sandboxIdSchema,
            },
            additionalProperties: false,
        } as const,
        approval: config.approvals?.killSandbox,
    }).server(async (input, ctx) => {
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
    });

    // @ts-ignore
    const tools = [
        createTool,
        execTool,
        readFileTool,
        writeFileTool,
        listFilesTool,
        makeDirTool,
        removePathTool,
        getHostTool,
        killTool,
    ];

    const plugin: Plugin = {
        id: config.id ?? "sandbox",
        tools,
    };

    return plugin;
};
