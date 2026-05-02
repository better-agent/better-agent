import { EventType } from "@ag-ui/core";
import type {
    AgentMessagesSnapshotEvent,
    AgentRunErrorEvent,
    AgentRunFinishedEvent,
    AgentRunStartedEvent,
    AgentStateSnapshotEvent,
    AgentStepFinishedEvent,
    AgentStepStartedEvent,
} from "../ag-ui/events";
import type { AgentMessage } from "../ag-ui/messages";
import type { AgentState } from "../ag-ui/state";
import type { AgentToolDefinition } from "../ag-ui/tools";
import type { RunOutcome, RuntimeInterrupt } from "./interrupts";
import type { RuntimeFinishedResult } from "./results";

export function createRunStartedEvent(input: {
    runId: string;
    threadId?: string;
    resume?: Array<{
        interruptId: string;
        status: "resolved" | "cancelled";
        payload?: unknown;
    }>;
    messages?: AgentMessage[];
    tools?: AgentToolDefinition[];
    state?: AgentState;
}): AgentRunStartedEvent {
    return {
        type: EventType.RUN_STARTED,
        timestamp: Date.now(),
        runId: input.runId,
        threadId: input.threadId ?? "",
        input: {
            runId: input.runId,
            threadId: input.threadId ?? "",
            messages: input.messages ?? [],
            tools: input.tools ?? [],
            context: [],
            ...(input.resume !== undefined ? { resume: input.resume } : {}),
            ...(input.state !== undefined ? { state: input.state } : {}),
        },
    };
}

export function createRunFinishedEvent(input: {
    runId: string;
    threadId?: string;
    outcome?: RunOutcome;
    interrupts?: RuntimeInterrupt[];
    result?: RuntimeFinishedResult;
}): AgentRunFinishedEvent {
    if (input.outcome === "interrupt") {
        if (!input.interrupts || input.interrupts.length === 0) {
            throw new Error(
                "RUN_FINISHED interrupt outcome requires a non-empty interrupts array.",
            );
        }
        if (input.result !== undefined) {
            throw new Error("RUN_FINISHED interrupt outcome must not include result.");
        }

        return {
            type: EventType.RUN_FINISHED,
            timestamp: Date.now(),
            runId: input.runId,
            threadId: input.threadId ?? "",
            outcome: "interrupt",
            interrupts: input.interrupts,
        };
    }

    if (input.interrupts !== undefined && input.interrupts.length > 0) {
        throw new Error("RUN_FINISHED success outcome must not include interrupts.");
    }

    return {
        type: EventType.RUN_FINISHED,
        timestamp: Date.now(),
        runId: input.runId,
        threadId: input.threadId ?? "",
        ...(input.outcome !== undefined ? { outcome: input.outcome } : {}),
        ...(input.result !== undefined ? { result: input.result } : {}),
    };
}

export function createStateSnapshotEvent(input: {
    state: AgentState;
}): AgentStateSnapshotEvent {
    return {
        type: EventType.STATE_SNAPSHOT,
        timestamp: Date.now(),
        snapshot: input.state,
    };
}

export function createMessagesSnapshotEvent(input: {
    messages: AgentMessage[];
}): AgentMessagesSnapshotEvent {
    return {
        type: EventType.MESSAGES_SNAPSHOT,
        timestamp: Date.now(),
        messages: input.messages,
    };
}

export function createRunErrorEvent(input: {
    message: string;
    code?: string;
}): AgentRunErrorEvent {
    return {
        type: EventType.RUN_ERROR,
        timestamp: Date.now(),
        message: input.message,
        ...(input.code ? { code: input.code } : {}),
    };
}

export function createStepStartedEvent(input: {
    stepName: string;
}): AgentStepStartedEvent {
    return {
        type: EventType.STEP_STARTED,
        timestamp: Date.now(),
        stepName: input.stepName,
    };
}

export function createStepFinishedEvent(input: {
    stepName: string;
}): AgentStepFinishedEvent {
    return {
        type: EventType.STEP_FINISHED,
        timestamp: Date.now(),
        stepName: input.stepName,
    };
}
