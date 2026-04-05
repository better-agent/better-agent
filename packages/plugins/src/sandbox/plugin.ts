import { type Plugin, type ToolRunContext, defineTool } from "@better-agent/core";
import { BetterAgentError } from "@better-agent/shared/errors";
import { createMemorySandboxSessionStore } from "./memory-store";
import type {
    SandboxClient,
    SandboxCreateParams,
    SandboxPluginConfig,
    SandboxPreviewInfo,
    SandboxSessionStore,
} from "./types";
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

/** Creates a plugin that adds first-class sandbox tools to every agent. */
export const sandboxPlugin = (config: SandboxPluginConfig): Plugin => {
    validateSandboxPluginConfig(config);

    const client = config.client ?? config.driver;
    if (!client) {
        throw createValidationError(
            "`sandboxPlugin` requires a `client`.",
            "plugins.sandboxPlugin",
        );
    }

    const sandboxClient: SandboxClient = client;
    const store: SandboxSessionStore = config.store ?? createMemorySandboxSessionStore();
    const prefix = trimToUndefined(config.prefix) ?? "sandbox";
    const nameFor = (suffix: string) => `${prefix}_${suffix}`;

    const resolveSessionKey = (ctx: ToolRunContext, toolName: string): string | undefined => {
        const custom = config.sessionKey?.({
            runId: ctx.runId,
            agentName: ctx.agentName,
            ...(ctx.conversationId !== undefined ? { conversationId: ctx.conversationId } : {}),
            toolName,
        });
        const trimmedCustom = trimToUndefined(custom ?? undefined);
        if (trimmedCustom !== undefined) {
            return trimmedCustom;
        }

        return ctx.conversationId ? `conversation:${ctx.conversationId}` : undefined;
    };

    const createSandbox = async (
        params: SandboxCreateParams | undefined,
        ctx: ToolRunContext,
        toolName: string,
    ): Promise<ResolvedSandboxRef> => {
        const sessionKey = resolveSessionKey(ctx, toolName);
        const created = await sandboxClient.createSandbox({
            template: params?.template ?? config.defaults?.template,
            timeoutMs: params?.timeoutMs ?? config.defaults?.timeoutMs,
            envs: params?.envs ?? config.defaults?.envs,
            metadata: params?.metadata ?? config.defaults?.metadata,
        });

        if (sessionKey) {
            await store.set(sessionKey, created.sandboxId);
        }

        return {
            sandboxId: created.sandboxId,
            ...(sessionKey !== undefined ? { sessionKey } : {}),
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
        const explicitSandboxId = trimToUndefined(params.sandboxId);
        if (explicitSandboxId) {
            return { sandboxId: explicitSandboxId, created: false };
        }

        const sessionKey = resolveSessionKey(params.ctx, params.toolName);
        if (sessionKey) {
            const existing = trimToUndefined((await store.get(sessionKey)) ?? undefined);
            if (existing) {
                return {
                    sandboxId: existing,
                    sessionKey,
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

    const tools = [
        defineTool({
            name: nameFor("create"),
            description:
                "Create a sandbox, or reuse the current conversation sandbox unless forceNew is true.",
            schema: createSchema,
        }).server(async (input, ctx) => {
            if (!input.forceNew) {
                const sessionKey = resolveSessionKey(ctx, nameFor("create"));
                if (sessionKey) {
                    const existing = trimToUndefined((await store.get(sessionKey)) ?? undefined);
                    if (existing) {
                        return {
                            sandboxId: existing,
                            reused: true,
                            created: false,
                            sessionKey,
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
        }),

        defineTool({
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
        }),

        defineTool({
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
        }),

        defineTool({
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
        }),

        defineTool({
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
        }),

        defineTool({
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
        }),

        defineTool({
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
        }),

        defineTool({
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
            const preview: SandboxPreviewInfo | undefined =
                typeof hostResult === "string" ? undefined : hostResult;
            const host = normalizeHostUrl(
                typeof hostResult === "string" ? hostResult : hostResult.url,
            );

            return {
                sandboxId: resolved.sandboxId,
                port: input.port,
                host,
                ...(preview?.token !== undefined ? { token: preview.token } : {}),
            };
        }),

        defineTool({
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

            if (resolved.sessionKey) {
                const current = await store.get(resolved.sessionKey);
                if (current === resolved.sandboxId) {
                    await store.delete(resolved.sessionKey);
                }
            }

            return {
                sandboxId: resolved.sandboxId,
                killed: true,
                ...(resolved.sessionKey !== undefined
                    ? { clearedSessionKey: resolved.sessionKey }
                    : {}),
            };
        }),
    ];

    return {
        id: config.id ?? "sandbox",
        tools,
    };
};
