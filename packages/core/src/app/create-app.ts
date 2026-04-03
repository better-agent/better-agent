import { BetterAgentError } from "@better-agent/shared/errors";
import type { AnyAgentDefinition } from "../agent";
import { validateAgentDefinition } from "../agent/validation";
import type { Plugin } from "../plugins";
import { createPluginRuntime } from "../plugins";
import { type BetterAgentRuntime, createRuntime } from "../run";
import { createServer } from "../server";
import type { AgentToolDefinition } from "../tools";
import { validateConfig } from "./config";
import { buildRegistryFromConfig } from "./registry";
import type { AgentByName, BetterAgentApp, BetterAgentConfig, BetterAgentHandler } from "./types";

/**
 * Creates a Better Agent app.
 *
 * Register agents, shared tools, plugins, and optional advanced settings.
 *
 * @param config App configuration.
 * @returns An app with `run`, `stream`, and `handler`.
 *
 * @example
 * ```ts
 * const app = betterAgent({
 *   agents: [supportAgent],
 *   secret: "dev-secret",
 * });
 *
 * const result = await app.run("support", {
 *   input: "Hello!",
 * });
 * ```
 */
export function betterAgent<
    const TAgents extends readonly AnyAgentDefinition[],
    const TPlugins extends readonly Plugin[] = readonly Plugin[],
    const TTools extends readonly AgentToolDefinition[] = readonly AgentToolDefinition[],
>(
    config: BetterAgentConfig<TAgents, TPlugins, TTools>,
): BetterAgentApp<TAgents, TPlugins> & {
    handler: BetterAgentHandler;
    readonly __appTypes?: {
        readonly agents: TAgents;
        readonly tools: TTools;
    };
} {
    // Validate once up front so runtime and server setup can assume a stable config shape.
    const normalizedConfig = validateConfig(config);
    const advanced = normalizedConfig.advanced;
    for (const agent of normalizedConfig.agents) {
        validateAgentDefinition(agent);
    }

    // Build a registry used for duplicate checks and agent lookup errors.
    const registry = buildRegistryFromConfig({
        agents: normalizedConfig.agents,
        tools: normalizedConfig.tools,
        plugins: normalizedConfig.plugins,
    });

    // Plugin runtime is shared by both the direct runtime and the HTTP server runtime.
    const pluginRuntime = normalizedConfig.plugins
        ? createPluginRuntime(normalizedConfig.plugins)
        : null;

    let cachedRuntime: BetterAgentRuntime<TAgents> | null = null;
    let cachedServerRuntime: BetterAgentRuntime<TAgents> | null = null;
    let cachedServer: ReturnType<typeof createServer> | null = null;

    const getRuntime = () => {
        if (!cachedRuntime) {
            const runtimeOptions = {
                agents: normalizedConfig.agents,
                pluginRuntime,
                stream: normalizedConfig.persistence?.stream,
                conversations: normalizedConfig.persistence?.conversations,
                runtimeState: normalizedConfig.persistence?.runtimeState,
                advanced,
            };

            cachedRuntime = createRuntime(runtimeOptions);
        }
        return cachedRuntime;
    };

    const getServerRuntime = () => {
        if (!cachedServerRuntime) {
            const runtimeOptions = {
                agents: normalizedConfig.agents,
                pluginRuntime,
                stream: normalizedConfig.persistence?.stream,
                conversations: normalizedConfig.persistence?.conversations,
                runtimeState: normalizedConfig.persistence?.runtimeState,
                streamLifecycle:
                    advanced?.onRequestDisconnect === "continue"
                        ? ("detached" as const)
                        : undefined,
                advanced,
            };

            cachedServerRuntime = createRuntime(runtimeOptions);
        }
        return cachedServerRuntime;
    };

    const normalizeBasePath = (baseURL: string): string => {
        try {
            return new URL(baseURL).pathname;
        } catch {
            return new URL(baseURL, "http://better-agent.local").pathname;
        }
    };

    const getServer = () => {
        if (!cachedServer) {
            const runtime = getServerRuntime();
            const serverOptions: Parameters<typeof createServer>[0] = {
                runtime,
                pluginRuntime,
                secret: normalizedConfig.secret,
                basePath:
                    normalizedConfig.baseURL !== undefined
                        ? normalizeBasePath(normalizedConfig.baseURL)
                        : undefined,
                advanced,
            };

            cachedServer = createServer(serverOptions);
        }
        return cachedServer;
    };

    const getRegisteredAgent = <TName extends TAgents[number]["name"]>(
        agentName: TName,
        traceAt: string,
    ): AgentByName<TAgents, TName> => {
        const agent = normalizedConfig.agents.find((candidate) => candidate.name === agentName);
        if (!agent) {
            throw BetterAgentError.fromCode(
                "NOT_FOUND",
                `Agent '${agentName}' not found in app registry.`,
                {
                    context: { agentName, availableAgents: Array.from(registry.agents.keys()) },
                    trace: [{ at: traceAt }],
                },
            );
        }

        return agent as AgentByName<TAgents, TName>;
    };

    const base: BetterAgentApp<TAgents, TPlugins> & { handler: BetterAgentHandler } = {
        config: normalizedConfig,
        run: (agentName, input) => {
            getRegisteredAgent(agentName, "core.app.betterAgent.run");
            const runtime = getRuntime();
            return runtime.run(agentName, input);
        },
        stream: (agentName, input) => {
            getRegisteredAgent(agentName, "core.app.betterAgent.stream");
            const runtime = getRuntime();
            return runtime.stream(agentName, input);
        },
        resumeStream: async (params) => {
            const runtime = getRuntime();
            return runtime.resumeStream(params);
        },
        resumeConversation: async (agentName, params) => {
            getRegisteredAgent(agentName, "core.app.betterAgent.resumeConversation");
            const runtime = getRuntime();
            return runtime.resumeConversation(agentName, params);
        },
        abortRun: async (runId: string) => {
            const runtime = getRuntime();
            return runtime.abortRun(runId);
        },
        loadConversation: async (agentName, conversationId) => {
            getRegisteredAgent(agentName, "core.app.betterAgent.loadConversation");
            const runtime = getRuntime();
            return runtime.loadConversation(agentName, conversationId);
        },
        submitToolResult: async (params) => {
            const runtime = getRuntime();
            return runtime.submitToolResult(params);
        },
        submitToolApproval: async (params) => {
            const runtime = getRuntime();
            return runtime.submitToolApproval(params);
        },
        handler: (request) => {
            const server = getServer();
            return server.handle(request);
        },
    };

    return base as typeof base & {
        readonly __appTypes?: {
            readonly agents: TAgents;
            readonly tools: TTools;
        };
    };
}
