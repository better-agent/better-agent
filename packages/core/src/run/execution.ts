import { BetterAgentError } from "@better-agent/shared/errors";
import { isPlainRecord } from "@better-agent/shared/utils";
import type { Event } from "../events";
import type { PluginRuntime } from "../plugins";
import type {
    Capabilities,
    ConversationItem,
    ModalitiesParam,
    OutputSchemaDefinition,
} from "../providers";
import { runAgentLoop } from "./agent-loop";
import {
    finalizeRunResult,
    prepareConversationReplayInput,
    toStructuredOutputRequest,
    validateRunInputCapabilities,
    validateRunModalities,
} from "./helpers";
import { createRunModelCallStrategy, createStreamModelCallStrategy } from "./model-strategy";
import type { PendingToolRuntime } from "./pending-tools";
import type { ContextBoundAgent, RunAdvancedOptions, RunOptions, RunResult } from "./types";

/** Internal run options. */
export interface InternalRunOptions<TContext = unknown>
    extends RunOptions<
        TContext,
        OutputSchemaDefinition | undefined,
        Capabilities,
        Record<string, unknown>,
        ModalitiesParam<Capabilities> | undefined
    > {
    runId: string;
    signal: AbortSignal;
    emit: (event: Event) => Promise<void>;
    generateMessageId: () => string;
    mode: "run" | "stream";
    pendingToolRuntime: PendingToolRuntime;
    advancedDefaults?: RunAdvancedOptions;
    initialItems: ConversationItem[];
    replayStartIndex?: number;
    conversationReplayActive?: boolean;
    pluginRuntime?: PluginRuntime | null;
}

/** Executes a run. */
export async function executeRun<TContext>(params: {
    agent: ContextBoundAgent<TContext>;
    options: InternalRunOptions<TContext>;
}): Promise<RunResult & { items: ConversationItem[] }> {
    const { agent: currentAgent, options } = params;

    const modelCaps = currentAgent.model.caps;
    const items = options.initialItems;

    const projectedInput =
        options.conversationId !== undefined && options.conversationReplayActive
            ? await prepareConversationReplayInput({
                  items,
                  caps: modelCaps,
                  agentName: currentAgent.name,
                  conversationId: options.conversationId,
                  conversationReplay: options.conversationReplay,
              })
            : options.input;
    validateRunInputCapabilities({
        agent: currentAgent,
        input: projectedInput,
        traceAt: `core.run.executeRun.validateInputCapabilities.${options.mode}`,
    });
    const effectiveModalities = options.modalities ?? currentAgent.defaultModalities;
    const outputSchema = options.output ?? currentAgent.outputSchema;
    validateRunModalities({
        agent: currentAgent,
        modalities: effectiveModalities,
        output: outputSchema,
        traceAt: `core.run.executeRun.validateModalities.${options.mode}`,
    });
    const structuredOutput = toStructuredOutputRequest(currentAgent, outputSchema);

    // Merge agent and run model options.
    const modelOptions = (() => {
        const {
            input: _input,
            context: _context,
            output: _output,
            modelOptions: nestedModelOptions,
            conversationId: _conversationId,
            conversationReplay: _conversationReplay,
            signal: _signal,
            onEvent: _onEvent,
            maxSteps: _maxSteps,
            persistence: _persistence,
        } = options;

        const merged = {};
        const mergeInto = (target: Record<string, unknown>, source: Record<string, unknown>) => {
            for (const [key, value] of Object.entries(source)) {
                const existing = target[key];
                if (isPlainRecord(existing) && isPlainRecord(value)) {
                    target[key] = mergeInto({ ...existing }, value);
                } else {
                    target[key] = value;
                }
            }

            return target;
        };

        if (currentAgent.defaultModelOptions) {
            mergeInto(merged, currentAgent.defaultModelOptions);
        }
        if (isPlainRecord(nestedModelOptions)) {
            mergeInto(merged, nestedModelOptions);
        }

        return merged;
    })();

    const advanced: RunAdvancedOptions | undefined =
        options.advanced !== undefined ||
        currentAgent.advanced !== undefined ||
        options.advancedDefaults !== undefined
            ? {
                  ...(options.advancedDefaults ?? {}),
                  ...(currentAgent.advanced ?? {}),
                  ...(options.advanced ?? {}),
              }
            : undefined;

    const baseOptions = {
        agent: currentAgent,
        items,
        replayStartIndex: options.replayStartIndex ?? 0,
        conversationReplayActive: options.conversationReplayActive,
        conversationReplay: options.conversationReplay,
        modelOptions: Object.keys(modelOptions).length > 0 ? modelOptions : undefined,
        modalities: effectiveModalities,
        runId: options.runId,
        signal: options.signal,
        emit: options.emit,
        generateMessageId: options.generateMessageId,
        conversationId: options.conversationId,
        context: options.context,
        structuredOutput,
        maxSteps: options.maxSteps ?? currentAgent.maxSteps,
        advanced,
        pendingToolRuntime: options.pendingToolRuntime,
        pluginRuntime: options.pluginRuntime,
    };

    // Validate merged overrides.
    if (baseOptions.maxSteps !== undefined && baseOptions.maxSteps <= 0) {
        throw BetterAgentError.fromCode(
            "VALIDATION_FAILED",
            `maxSteps must be a positive integer or undefined, got ${baseOptions.maxSteps}.`,
            {
                context: { maxSteps: baseOptions.maxSteps },
                trace: [{ at: "core.run.executeRun.validateMaxSteps" }],
            },
        );
    }

    if (
        advanced?.clientToolResultTimeoutMs !== undefined &&
        (!Number.isFinite(advanced.clientToolResultTimeoutMs) ||
            advanced.clientToolResultTimeoutMs <= 0)
    ) {
        throw BetterAgentError.fromCode(
            "VALIDATION_FAILED",
            "clientToolResultTimeoutMs must be a positive number.",
            {
                context: { clientToolResultTimeoutMs: advanced.clientToolResultTimeoutMs },
                trace: [{ at: "core.run.executeRun.validateAdvanced.clientToolResultTimeoutMs" }],
            },
        );
    }
    if (
        advanced?.toolApprovalTimeoutMs !== undefined &&
        (!Number.isFinite(advanced.toolApprovalTimeoutMs) || advanced.toolApprovalTimeoutMs <= 0)
    ) {
        throw BetterAgentError.fromCode(
            "VALIDATION_FAILED",
            "toolApprovalTimeoutMs must be a positive number.",
            {
                context: { toolApprovalTimeoutMs: advanced.toolApprovalTimeoutMs },
                trace: [{ at: "core.run.executeRun.validateAdvanced.toolApprovalTimeoutMs" }],
            },
        );
    }

    const loopResult =
        options.mode === "stream"
            ? await runAgentLoop(baseOptions, createStreamModelCallStrategy<TContext>())
            : await runAgentLoop(baseOptions, createRunModelCallStrategy<TContext>());

    return await finalizeRunResult(loopResult, outputSchema, {
        outputErrorMode: currentAgent.outputErrorMode,
        onOutputError: currentAgent.onOutputError,
    });
}
