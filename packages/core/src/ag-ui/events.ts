import type {
    ActivityDeltaEvent,
    ActivitySnapshotEvent,
    BaseEvent,
    CustomEvent,
    EventType,
    MessagesSnapshotEvent,
    RawEvent,
    ReasoningEncryptedValueEvent,
    ReasoningEndEvent,
    ReasoningMessageChunkEvent,
    ReasoningMessageContentEvent,
    ReasoningMessageEndEvent,
    ReasoningMessageStartEvent,
    ReasoningStartEvent,
    RunErrorEvent,
    RunFinishedEvent,
    RunStartedEvent,
    StateDeltaEvent,
    StateSnapshotEvent,
    StepFinishedEvent,
    StepStartedEvent,
    TextMessageChunkEvent,
    TextMessageContentEvent,
    TextMessageEndEvent,
    TextMessageStartEvent,
    ToolCallArgsEvent,
    ToolCallChunkEvent,
    ToolCallEndEvent,
    ToolCallResultEvent,
    ToolCallStartEvent,
} from "@ag-ui/core";
import type { RemoveIndexSignature } from "@better-agent/shared/types";
import type { AgentMessage, AgentSource, AgentToolResultStatus } from "./messages";

export { EventType } from "@ag-ui/core";

export type AgentEventType = EventType;
export type AgentEventBase = BaseEvent;
export type AgentCustomEvent<TValue = unknown> = CustomEvent & { value?: TValue };
export type AgentSourceEvent = AgentCustomEvent<{
    messageId: string;
    source: AgentSource;
}> & {
    name: "source";
};
export type AgentRawEvent = RawEvent;

export type AgentRunStartedEvent = Omit<RemoveIndexSignature<RunStartedEvent>, "input"> & {
    input: Omit<RemoveIndexSignature<NonNullable<RunStartedEvent["input"]>>, "messages"> & {
        messages?: AgentMessage[];
        resume?: Array<{
            interruptId: string;
            status: "resolved" | "cancelled";
            payload?: unknown;
        }>;
    };
};
export type AgentRunFinishedEvent = Omit<
    RemoveIndexSignature<RunFinishedEvent>,
    "outcome" | "result" | "interrupt" | "interrupts"
> & {
    outcome?: "success" | "interrupt";
    result?: unknown;
    interrupts?: Array<{
        id: string;
        reason: string;
        message?: string;
        toolCallId?: string;
        responseSchema?: Record<string, unknown>;
        expiresAt?: string;
        metadata?: Record<string, unknown>;
    }>;
};
export type AgentRunErrorEvent = RunErrorEvent;
export type AgentStepStartedEvent = StepStartedEvent;
export type AgentStepFinishedEvent = StepFinishedEvent;
export type AgentTextMessageStartEvent = TextMessageStartEvent;
export type AgentTextMessageContentEvent = TextMessageContentEvent;
export type AgentTextMessageEndEvent = TextMessageEndEvent;
export type AgentTextMessageChunkEvent = TextMessageChunkEvent;
export type AgentToolCallStartEvent = ToolCallStartEvent & {
    providerExecuted?: boolean;
};
export type AgentToolCallArgsEvent = ToolCallArgsEvent;
export type AgentToolCallEndEvent = ToolCallEndEvent & {
    providerExecuted?: boolean;
};
export type AgentToolCallChunkEvent = ToolCallChunkEvent;
export type AgentToolCallResultEvent = ToolCallResultEvent & {
    status?: AgentToolResultStatus;
    providerExecuted?: boolean;
};
export type AgentStateSnapshotEvent = StateSnapshotEvent;
export type AgentStateDeltaEvent = StateDeltaEvent;
export type AgentMessagesSnapshotEvent = Omit<
    RemoveIndexSignature<MessagesSnapshotEvent>,
    "messages"
> & {
    messages: AgentMessage[];
};
export type AgentActivitySnapshotEvent = ActivitySnapshotEvent;
export type AgentActivityDeltaEvent = ActivityDeltaEvent;
export type AgentReasoningStartEvent = ReasoningStartEvent;
export type AgentReasoningMessageStartEvent = ReasoningMessageStartEvent;
export type AgentReasoningMessageContentEvent = ReasoningMessageContentEvent;
export type AgentReasoningMessageEndEvent = ReasoningMessageEndEvent;
export type AgentReasoningMessageChunkEvent = ReasoningMessageChunkEvent;
export type AgentReasoningEndEvent = ReasoningEndEvent;
export type AgentReasoningEncryptedValueEvent = ReasoningEncryptedValueEvent;

export type AgentSequencedEvent<TEvent> = TEvent & {
    seq?: number;
};

export type AgentEvent = AgentSequencedEvent<
    | AgentCustomEvent
    | AgentSourceEvent
    | AgentRawEvent
    | AgentRunStartedEvent
    | AgentRunFinishedEvent
    | AgentRunErrorEvent
    | AgentStepStartedEvent
    | AgentStepFinishedEvent
    | AgentTextMessageStartEvent
    | AgentTextMessageContentEvent
    | AgentTextMessageEndEvent
    | AgentTextMessageChunkEvent
    | AgentToolCallStartEvent
    | AgentToolCallArgsEvent
    | AgentToolCallEndEvent
    | AgentToolCallChunkEvent
    | AgentToolCallResultEvent
    | AgentStateSnapshotEvent
    | AgentStateDeltaEvent
    | AgentMessagesSnapshotEvent
    | AgentActivitySnapshotEvent
    | AgentActivityDeltaEvent
    | AgentReasoningStartEvent
    | AgentReasoningMessageStartEvent
    | AgentReasoningMessageContentEvent
    | AgentReasoningMessageEndEvent
    | AgentReasoningMessageChunkEvent
    | AgentReasoningEndEvent
    | AgentReasoningEncryptedValueEvent
>;
