import { BetterAgentError } from "@better-agent/shared/errors";
import type { Awaitable } from "../internal/types";
import type { PluginRuntime } from "../plugins";
import type {
    Capabilities,
    GenerativeModelInputItem,
    GenerativeModelInputMessageContent,
    GenerativeModelResponse,
    ToolChoice,
} from "../providers";
import type { AgentToolDefinition } from "../tools";
import type {
    OnStepContext,
    OnStepContextBase,
    OnStepFinishContext,
    OnStepFinishContextBase,
    PreviousStepResult,
} from "./types";

/** Applies `onStep` hooks. */
export const applyOnStep = async <TContext, TModelCaps extends Capabilities = Capabilities>(
    params: {
        runId: string;
        agentName: string;
        conversationId?: string;
        stepIndex: number;
        maxSteps: number | undefined;
        context?: TContext;
        pluginRuntime?: PluginRuntime | null;
        /** Model caps for plugin controls. */
        modelCaps?: TModelCaps;
    } & {
        messages: GenerativeModelInputItem<TModelCaps>[];
        previousStep?: PreviousStepResult;
        onStep?: (context: OnStepContext<undefined, TContext, TModelCaps>) => Awaitable<void>;
    },
): Promise<{
    messages: GenerativeModelInputItem<TModelCaps>[];
    toolChoice?: ToolChoice;
    activeTools?: string[];
    systemInstruction?: GenerativeModelInputMessageContent<TModelCaps>;
}> => {
    const prepared: {
        messages: GenerativeModelInputItem<TModelCaps>[];
        toolChoice?: ToolChoice;
        activeTools?: string[];
        systemInstruction?: GenerativeModelInputMessageContent<TModelCaps>;
    } = {
        messages: [...params.messages],
    };

    if (params.pluginRuntime?.hasOnStep) {
        const pluginPrepared = await params.pluginRuntime.applyOnStep({
            runId: params.runId,
            agentName: params.agentName,
            stepIndex: params.stepIndex,
            maxSteps: params.maxSteps,
            messages: prepared.messages,
            conversationId: params.conversationId,
            context: params.context,
            previousStep: params.previousStep,
            modelCaps: params.modelCaps,
        });

        prepared.messages = pluginPrepared.messages;
        if (pluginPrepared.toolChoice !== undefined) {
            prepared.toolChoice = pluginPrepared.toolChoice;
        }
        if (pluginPrepared.activeTools !== undefined) {
            prepared.activeTools = pluginPrepared.activeTools;
        }
        if (pluginPrepared.systemInstruction !== undefined) {
            prepared.systemInstruction = pluginPrepared.systemInstruction;
        }
    }

    if (!params.onStep) return prepared;

    const baseContext: OnStepContextBase<TModelCaps> = {
        runId: params.runId,
        agentName: params.agentName,
        stepIndex: params.stepIndex,
        maxSteps: params.maxSteps,
        messages: prepared.messages,
        conversationId: params.conversationId,
        previousStep: params.previousStep,
        updateMessages: (updater) => {
            prepared.messages = updater([...prepared.messages]);
            (baseContext as typeof hookContext).messages = prepared.messages;
        },
    };

    const supportsTools = params.modelCaps?.tools === true;
    const canSetInstruction =
        params.modelCaps === undefined
            ? true
            : params.modelCaps.inputShape !== "prompt" &&
              params.modelCaps.supportsInstruction === true;
    const withInstructionControl = canSetInstruction
        ? {
              ...baseContext,
              setSystemInstruction: (
                  instruction: GenerativeModelInputMessageContent<TModelCaps>,
              ) => {
                  prepared.systemInstruction = instruction;
              },
          }
        : baseContext;
    const contextWithControls = supportsTools
        ? {
              ...withInstructionControl,
              setToolChoice: (choice: ToolChoice) => {
                  prepared.toolChoice = choice;
              },
              setActiveTools: (names: readonly string[]) => {
                  prepared.activeTools = [...names];
              },
          }
        : withInstructionControl;

    // Add `context` only when present.
    const hookContext =
        params.context !== undefined
            ? { ...contextWithControls, context: params.context }
            : contextWithControls;

    try {
        await params.onStep(hookContext as OnStepContext<undefined, TContext, TModelCaps>);
    } catch (error) {
        throw BetterAgentError.fromCode("HOOK_FAILED", "Agent onStep hook threw.", {
            cause: error,
            trace: [{ at: "core.run.applyOnStep" }],
        });
    }
    return prepared;
};

/** Applies `onBeforeModelCall` hooks. */
export const applyBeforeModelCall = async (params: {
    runId: string;
    agentName: string;
    conversationId?: string;
    stepIndex: number;
    modelCaps?: Capabilities;
    input: GenerativeModelInputItem[];
    tools: AgentToolDefinition[];
    toolChoice?: ToolChoice;
    pluginRuntime?: PluginRuntime | null;
}): Promise<{
    input: GenerativeModelInputItem[];
    tools: AgentToolDefinition[];
    toolChoice?: ToolChoice;
}> => {
    if (!params.pluginRuntime?.hasModelHooks) {
        return {
            input: [...params.input],
            tools: [...params.tools],
            toolChoice: params.toolChoice,
        };
    }

    return await params.pluginRuntime.applyBeforeModelCall({
        runId: params.runId,
        agentName: params.agentName,
        stepIndex: params.stepIndex,
        input: params.input,
        tools: params.tools,
        conversationId: params.conversationId,
        toolChoice: params.toolChoice,
        modelCaps: params.modelCaps,
    });
};

/** Applies `onAfterModelCall` hooks. */
export const applyAfterModelCall = async (params: {
    runId: string;
    agentName: string;
    conversationId?: string;
    stepIndex: number;
    response: GenerativeModelResponse;
    pluginRuntime?: PluginRuntime | null;
}): Promise<void> => {
    if (!params.pluginRuntime?.hasModelHooks) {
        return;
    }

    await params.pluginRuntime.applyAfterModelCall({
        runId: params.runId,
        agentName: params.agentName,
        stepIndex: params.stepIndex,
        response: params.response,
        conversationId: params.conversationId,
    });
};

/** Applies `onStepFinish`. */
export const applyOnStepFinish = async <TContext>(
    params: {
        runId: string;
        agentName: string;
        conversationId?: string;
        stepIndex: number;
        maxSteps: number | undefined;
        context?: TContext;
    } & {
        result: PreviousStepResult;
        onStepFinish?: (context: OnStepFinishContext<undefined, TContext>) => Awaitable<void>;
    },
): Promise<void> => {
    if (!params.onStepFinish) return;

    const baseContext: OnStepFinishContextBase = {
        runId: params.runId,
        agentName: params.agentName,
        stepIndex: params.stepIndex,
        maxSteps: params.maxSteps,
        result: params.result,
        conversationId: params.conversationId,
    };

    // Add `context` only when present.
    const hookContext =
        params.context !== undefined ? { ...baseContext, context: params.context } : baseContext;

    try {
        await params.onStepFinish(hookContext as OnStepFinishContext<undefined, TContext>);
    } catch (error) {
        throw BetterAgentError.fromCode("HOOK_FAILED", "Agent onStepFinish hook threw.", {
            cause: error,
            trace: [{ at: "core.run.applyOnStepFinish" }],
        });
    }
};
