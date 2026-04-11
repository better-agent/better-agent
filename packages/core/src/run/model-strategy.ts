import { BetterAgentError } from "@better-agent/shared/errors";
import type { Event } from "../events";
import type { AgentToolDefinition, ToolTarget } from "../tools";
import type { ModelCallStrategy } from "./types";

const getAssistantMessageIdFromEvent = (event: Event): string | undefined => {
    if (
        "parentMessageId" in event &&
        typeof event.parentMessageId === "string" &&
        event.parentMessageId.length > 0
    ) {
        return event.parentMessageId;
    }

    if (
        "messageId" in event &&
        typeof event.messageId === "string" &&
        event.messageId.length > 0 &&
        "role" in event &&
        event.role === "assistant"
    ) {
        return event.messageId;
    }

    return undefined;
};

const resolveToolTarget = (
    tools: AgentToolDefinition[],
    toolCallName: string,
): ToolTarget | undefined => {
    const tool = tools.find((candidate) => {
        if (candidate.kind === "hosted") {
            return candidate.name === toolCallName || candidate.type === toolCallName;
        }

        return candidate.name === toolCallName;
    });

    if (!tool) {
        return undefined;
    }

    return tool.kind;
};

const enrichToolEvent = (
    event: Event,
    params: {
        runId: string;
        agentName: string;
        tools: AgentToolDefinition[];
    },
): Event => {
    switch (event.type) {
        case "TOOL_CALL_START":
        case "TOOL_CALL_ARGS":
        case "TOOL_CALL_END":
        case "TOOL_CALL_RESULT": {
            const toolTarget = resolveToolTarget(params.tools, event.toolCallName);
            return {
                ...event,
                runId: params.runId,
                agentName: params.agentName,
                ...(toolTarget !== undefined ? { toolTarget } : {}),
            };
        }
        default:
            return event;
    }
};

export const createRunModelCallStrategy = <TContext>(): ModelCallStrategy<TContext> => ({
    mode: "run",
    async call(params) {
        const { options } = params;
        let firstGeneratedMessageId: string | undefined;
        let assistantMessageId: string | undefined;
        const generateMessageId = () => {
            const id = options.generateMessageId();
            firstGeneratedMessageId ??= id;
            return id;
        };

        const modelContext = {
            runId: params.runId,
            agentName: params.agentName,
            providerId: options.agent.model.providerId,
            modelId: options.agent.model.modelId,
            signal: options.signal,
            generateMessageId,
            conversationId: params.conversationId,
        };

        if (!options.agent.model.doGenerate) {
            throw BetterAgentError.fromCode(
                "NOT_IMPLEMENTED",
                `Model '${options.agent.model.modelId}' does not implement doGenerate().`,
                {
                    context: {
                        agentName: params.agentName,
                        modelId: options.agent.model.modelId,
                    },
                    trace: [{ at: "core.run.runLoop.model.doGenerate" }],
                },
            );
        }

        const responseResult = await options.agent.model.doGenerate(
            {
                ...(options.modelOptions ?? {}),
                input: params.modelInput,
                modalities: options.modalities,
                tools: params.tools.length > 0 ? params.tools : undefined,
                toolChoice: params.toolChoice,
                structured_output: options.structuredOutput,
            },
            modelContext,
        );
        if (responseResult.isErr()) {
            throw responseResult.error;
        }

        const { response, events } = responseResult.value;
        for (const event of events ?? []) {
            const enrichedEvent = enrichToolEvent(event, {
                runId: params.runId,
                agentName: params.agentName,
                tools: params.tools,
            });
            assistantMessageId =
                getAssistantMessageIdFromEvent(enrichedEvent) ?? assistantMessageId;
            await options.emit({
                ...enrichedEvent,
            });
        }

        return {
            response,
            // Prefer the provider ID, then reuse or generate one.
            assistantMessageId:
                assistantMessageId ?? firstGeneratedMessageId ?? generateMessageId(),
        };
    },
});

export const createStreamModelCallStrategy = <TContext>(): ModelCallStrategy<TContext> => ({
    mode: "stream",
    async call(params) {
        const { options } = params;
        let firstGeneratedMessageId: string | undefined;
        let assistantMessageId: string | undefined;
        const generateMessageId = () => {
            const id = options.generateMessageId();
            firstGeneratedMessageId ??= id;
            return id;
        };

        const modelContext = {
            runId: params.runId,
            agentName: params.agentName,
            providerId: options.agent.model.providerId,
            modelId: options.agent.model.modelId,
            signal: options.signal,
            generateMessageId,
            conversationId: params.conversationId,
        };

        if (!options.agent.model.doGenerateStream) {
            throw BetterAgentError.fromCode(
                "NOT_IMPLEMENTED",
                `Model '${options.agent.model.modelId}' does not implement doGenerateStream().`,
                {
                    context: {
                        agentName: params.agentName,
                        modelId: options.agent.model.modelId,
                    },
                    trace: [{ at: "core.run.runStreamLoop.model.doGenerateStream" }],
                },
            );
        }

        const streamResult = await options.agent.model.doGenerateStream(
            {
                ...(options.modelOptions ?? {}),
                input: params.modelInput,
                modalities: options.modalities,
                tools: params.tools.length > 0 ? params.tools : undefined,
                toolChoice: params.toolChoice,
                structured_output: options.structuredOutput,
            },
            modelContext,
        );

        if (streamResult.isErr()) {
            throw streamResult.error;
        }

        for await (const eventResult of streamResult.value.events) {
            if (eventResult.isErr()) {
                throw eventResult.error;
            }

            const enrichedEvent = enrichToolEvent(eventResult.value, {
                runId: params.runId,
                agentName: params.agentName,
                tools: params.tools,
            });
            assistantMessageId =
                getAssistantMessageIdFromEvent(enrichedEvent) ?? assistantMessageId;
            await options.emit({
                ...enrichedEvent,
            });
        }

        return {
            response: await streamResult.value.final,
            // Prefer the provider ID, then reuse or generate one.
            assistantMessageId:
                assistantMessageId ?? firstGeneratedMessageId ?? generateMessageId(),
        };
    },
});
