import { EventType } from "@ag-ui/core";
import { BetterAgentError } from "@better-agent/shared/errors";
import type { BivariantFn } from "@better-agent/shared/types";
import type { AgentEvent, AgentStateDeltaEvent, AgentStateSnapshotEvent } from "../ag-ui/events";
import type { AgentMessage } from "../ag-ui/messages";
import type { AgentStateHandle } from "../ag-ui/state";
import type { AnyDefinedTool } from "../tools/types";
import type { RuntimeInterrupt } from "./interrupts";
import type { FinishReason, TokenUsage } from "./results";
import { type RuntimeStateControl, createRuntimeStateControl } from "./state";

export interface RuntimeStepContext<TState = unknown, TContext = unknown> {
    runId: string;
    threadId?: string;
    stepIndex: number;
    maxSteps?: number;
    context: TContext;
    signal: AbortSignal;
    messages: readonly AgentMessage[];
    registeredTools: readonly AnyDefinedTool[];
    activeTools: readonly string[] | undefined;
    state: AgentStateHandle<TState>;
    updateMessages(updater: (messages: readonly AgentMessage[]) => AgentMessage[]): void;
    setActiveTools(toolNames: readonly string[]): void;
}

export interface RuntimeStepFinishContext<TState = unknown, TContext = unknown> {
    runId: string;
    threadId?: string;
    stepIndex: number;
    maxSteps?: number;
    context: TContext;
    signal: AbortSignal;
    messages: readonly AgentMessage[];
    state: AgentStateHandle<TState>;
    result: {
        outcome: "continue" | "success" | "interrupt";
        interrupts?: RuntimeInterrupt[];
        usage?: TokenUsage;
        finishReason?: FinishReason;
        toolCallCount: number;
    };
}

export interface RuntimeStopWhenContext<TState = unknown, TContext = unknown> {
    runId: string;
    threadId?: string;
    stepIndex: number;
    maxSteps?: number;
    context: TContext;
    messages: readonly AgentMessage[];
    state: TState | undefined;
    usage?: TokenUsage;
    finishReason?: FinishReason;
    toolCallCount: number;
}

export interface RuntimeStateChangeContext<TState = unknown> {
    state: TState | undefined;
}

export interface RuntimeHooks<TState = unknown, TContext = unknown> {
    onStep?: RuntimeOnStep<TState, TContext>;
    onStepFinish?: RuntimeOnStepFinish<TState, TContext>;
    onState?: RuntimeOnState<TState>;
    stopWhen?: RuntimeStopWhen<TState, TContext>;
}

export type RuntimeOnStep<TState = unknown, TContext = unknown> = BivariantFn<
    [RuntimeStepContext<TState, TContext>],
    void | Promise<void>
>;
export type RuntimeOnStepFinish<TState = unknown, TContext = unknown> = BivariantFn<
    [RuntimeStepFinishContext<TState, TContext>],
    void | Promise<void>
>;
export type RuntimeOnState<TState = unknown> = BivariantFn<
    [RuntimeStateChangeContext<TState>],
    void | Promise<void>
>;
export type RuntimeStopWhen<TState = unknown, TContext = unknown> = BivariantFn<
    [RuntimeStopWhenContext<TState, TContext>],
    boolean | Promise<boolean>
>;

function createHookState<TState>(input: {
    state: RuntimeStateControl<TState>;
    emitEvent?: (event: AgentEvent) => void;
    onStateEvent?:
        | ((event: AgentStateSnapshotEvent | AgentStateDeltaEvent) => void | Promise<void>)
        | undefined;
}): AgentStateHandle<TState> {
    return {
        get: () => input.state.get(),
        set: (snapshot) => {
            const event = input.state.set(snapshot);
            input.emitEvent?.(event);
            void input.onStateEvent?.(event);
        },
        patch: (delta) => {
            const event = input.state.patch(delta);
            input.emitEvent?.(event);
            void input.onStateEvent?.(event);
        },
    };
}

function isStateEvent(event: AgentEvent): event is AgentStateSnapshotEvent | AgentStateDeltaEvent {
    return event.type === EventType.STATE_SNAPSHOT || event.type === EventType.STATE_DELTA;
}

export async function notifyRuntimeStateChange<TState, TContext>(input: {
    hooks?: RuntimeHooks<TState, TContext>;
    state: RuntimeStateControl<TState>;
    event: AgentEvent;
}): Promise<void> {
    if (!input.hooks?.onState || !isStateEvent(input.event)) {
        return;
    }

    await input.hooks.onState({
        state: input.state.get(),
    });
}

export async function prepareRuntimeStep<TState, TContext>(input: {
    hooks?: RuntimeHooks<TState, TContext>;
    runId: string;
    threadId?: string;
    stepIndex: number;
    maxSteps?: number;
    context: TContext;
    signal: AbortSignal;
    messages: AgentMessage[];
    modelMessages: AgentMessage[];
    tools: AnyDefinedTool[];
    state: RuntimeStateControl<TState>;
    emitEvent?: (event: AgentEvent) => void;
}): Promise<{
    messages: AgentMessage[];
    modelMessages: AgentMessage[];
    tools: AnyDefinedTool[];
}> {
    if (!input.hooks?.onStep) {
        return {
            messages: input.messages,
            modelMessages: input.modelMessages,
            tools: input.tools,
        };
    }

    let messages = [...input.messages];
    let tools = [...input.tools];
    let messagesChanged = false;
    let activeTools: readonly string[] | undefined;
    const availableToolNames = new Set(input.tools.map((tool) => tool.name));
    const stagedState = createRuntimeStateControl(input.state.get());
    const stagedStateEvents: AgentEvent[] = [];

    const hookContext: RuntimeStepContext<TState, TContext> = {
        runId: input.runId,
        threadId: input.threadId,
        stepIndex: input.stepIndex,
        maxSteps: input.maxSteps,
        context: input.context,
        signal: input.signal,
        messages,
        registeredTools: input.tools,
        activeTools,
        state: createHookState({
            state: stagedState,
            emitEvent: (event) => {
                stagedStateEvents.push(event);
            },
        }),
        updateMessages(updater) {
            messages = updater([...messages]);
            messagesChanged = true;
            hookContext.messages = messages;
        },
        setActiveTools(toolNames) {
            const nextActiveTools = [...new Set(toolNames)];

            for (const toolName of nextActiveTools) {
                if (!availableToolNames.has(toolName)) {
                    throw BetterAgentError.fromCode(
                        "HOOK_FAILED",
                        `Agent onStep hook selected unknown tool '${toolName}'.`,
                        {
                            context: {
                                runId: input.runId,
                                stepIndex: input.stepIndex,
                                toolName,
                            },
                        },
                    );
                }
            }

            activeTools = nextActiveTools;
            hookContext.activeTools = activeTools;
        },
    };

    try {
        await input.hooks.onStep(hookContext);
    } catch (error) {
        throw BetterAgentError.fromCode("HOOK_FAILED", "Agent onStep hook threw.", {
            cause: error,
            context: {
                runId: input.runId,
                stepIndex: input.stepIndex,
            },
        });
    }

    if (activeTools !== undefined) {
        const activeToolNames = new Set(activeTools);
        tools = input.tools.filter((tool) => activeToolNames.has(tool.name));
    }

    for (const event of stagedStateEvents) {
        input.state.apply(event);
        input.emitEvent?.(event);
        await notifyRuntimeStateChange({
            hooks: input.hooks,
            state: input.state,
            event,
        });
    }

    return {
        messages: messagesChanged ? messages : input.messages,
        modelMessages: messagesChanged ? messages : input.modelMessages,
        tools,
    };
}

export async function finishRuntimeStep<TState, TContext>(input: {
    hooks?: RuntimeHooks<TState, TContext>;
    runId: string;
    threadId?: string;
    stepIndex: number;
    maxSteps?: number;
    context: TContext;
    signal: AbortSignal;
    messages: AgentMessage[];
    state: RuntimeStateControl<TState>;
    emitEvent?: (event: AgentEvent) => void;
    result: RuntimeStepFinishContext<TState, TContext>["result"];
}): Promise<void> {
    if (!input.hooks?.onStepFinish) {
        return;
    }

    try {
        await input.hooks.onStepFinish({
            runId: input.runId,
            threadId: input.threadId,
            stepIndex: input.stepIndex,
            maxSteps: input.maxSteps,
            context: input.context,
            signal: input.signal,
            messages: input.messages,
            state: createHookState({
                state: input.state,
                emitEvent: input.emitEvent,
                onStateEvent: (event) =>
                    notifyRuntimeStateChange({
                        hooks: input.hooks,
                        state: input.state,
                        event,
                    }),
            }),
            result: input.result,
        });
    } catch (error) {
        throw BetterAgentError.fromCode("HOOK_FAILED", "Agent onStepFinish hook threw.", {
            cause: error,
            context: {
                runId: input.runId,
                stepIndex: input.stepIndex,
            },
        });
    }
}

export async function shouldStopAfterStep<TState, TContext>(input: {
    hooks?: RuntimeHooks<TState, TContext>;
    runId: string;
    threadId?: string;
    stepIndex: number;
    maxSteps?: number;
    context: TContext;
    messages: AgentMessage[];
    state: RuntimeStateControl<TState>;
    usage?: TokenUsage;
    finishReason?: FinishReason;
    toolCallCount: number;
}): Promise<boolean> {
    if (input.toolCallCount === 0) {
        return true;
    }

    if (input.maxSteps !== undefined && input.stepIndex >= input.maxSteps) {
        return true;
    }

    if (!input.hooks?.stopWhen) {
        return false;
    }

    try {
        return await input.hooks.stopWhen({
            runId: input.runId,
            threadId: input.threadId,
            stepIndex: input.stepIndex,
            maxSteps: input.maxSteps,
            context: input.context,
            messages: input.messages,
            state: input.state.get(),
            usage: input.usage,
            finishReason: input.finishReason,
            toolCallCount: input.toolCallCount,
        });
    } catch (error) {
        throw BetterAgentError.fromCode("HOOK_FAILED", "Agent stopWhen hook threw.", {
            cause: error,
            context: {
                runId: input.runId,
                stepIndex: input.stepIndex,
            },
        });
    }
}
