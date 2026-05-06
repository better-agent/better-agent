import { BetterAgentError } from "@better-agent/shared/errors";
import { createAbortMethod } from "./abort";
import { createAppContext } from "./create-app-context";
import { createBetterAgentHandler } from "./handler";
import { resolvedAgentRunId } from "./helpers";
import { createResumeStreamMethod } from "./resume-stream";
import { createRunMethod } from "./run";
import { createStreamMethod } from "./stream";
import type {
    AgentByName,
    AgentHandle,
    BaseAgentHandle,
    BetterAgentApp,
    BetterAgentConfig,
} from "./types";

export function betterAgent<const TConfig extends BetterAgentConfig>(
    config: TConfig,
): BetterAgentApp<TConfig["agents"], TConfig> {
    const context = createAppContext(config);
    const { abortRun } = createAbortMethod(context);
    const { resumeStream } = createResumeStreamMethod(context);

    type TAgents = TConfig["agents"];
    const { runResolved } = createRunMethod<TAgents>(context);
    const { streamResolved } = createStreamMethod<TAgents>(context);

    const getAgent = <TName extends TAgents[number]["name"]>(
        name: TName,
    ): AgentByName<TAgents, TName> => {
        const agent = config.agents.find(
            (candidate): candidate is AgentByName<TAgents, TName> => candidate.name === name,
        );

        if (!agent) {
            throw BetterAgentError.fromCode("NOT_FOUND", `Agent '${name}' not found.`, {
                context: {
                    agentName: name,
                    availableAgents: config.agents.map((candidate) => candidate.name),
                },
            });
        }

        return agent;
    };

    const agent = <TName extends TAgents[number]["name"]>(
        name: TName,
    ): AgentHandle<AgentByName<TAgents, TName>, TConfig> => {
        const definition = getAgent(name);
        const memory = context.getAgentMemory(definition);

        const baseHandle = {
            name: definition.name,
            definition,
            run(input) {
                return runResolved(definition, input);
            },
            stream(input) {
                return streamResolved(definition, input);
            },
            async abort(runId) {
                const resolvedRunId = await resolvedAgentRunId(
                    name,
                    context.config.storage,
                    runId,
                    undefined,
                    "abort request",
                );
                return abortRun(resolvedRunId);
            },
            resumeStream({ runId, afterSequence, signal }) {
                return (async function* () {
                    const resolvedRunId = await resolvedAgentRunId(
                        name,
                        context.config.storage,
                        runId,
                        undefined,
                        "resume stream",
                    );
                    yield* resumeStream({ runId: resolvedRunId, afterSequence, signal });
                })();
            },
        } as BaseAgentHandle<AgentByName<TAgents, TName>>;

        if (memory) {
            return {
                ...baseHandle,
                memory,
            } as unknown as AgentHandle<AgentByName<TAgents, TName>, TConfig>;
        }

        return baseHandle as AgentHandle<AgentByName<TAgents, TName>, TConfig>;
    };

    const app = {
        config,
        agent,
        runs: {
            abort: abortRun,
            resumeStream,
        },
    } as BetterAgentApp<TConfig["agents"], TConfig>;

    app.handler = createBetterAgentHandler(app);

    return app;
}
