import { BetterAgentError } from "@better-agent/shared/errors";
import { createAbortMethod } from "./abort";
import { createAppContext } from "./create-app-context";
import { createBetterAgentHandler } from "./handler";
import { createResumeStreamMethod } from "./resume-stream";
import { createRunMethod } from "./run";
import { createStreamMethod } from "./stream";
import type { AgentByName, AgentHandle, BetterAgentApp, BetterAgentConfig } from "./types";

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

        return {
            name: definition.name,
            definition,
            ...(memory ? { memory } : {}),
            run(input) {
                return runResolved(definition, input);
            },
            stream(input) {
                return streamResolved(definition, input);
            },
        } as AgentHandle<AgentByName<TAgents, TName>, TConfig>;
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
