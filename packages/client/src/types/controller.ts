import type {
    GenerativeModelInputItem,
    GenerativeModelResponse,
} from "@better-agent/core/providers";
import type { AgentClientError } from "../core/error";
import type { MessageState } from "../core/reducer";
import type { ClientEvent, OnToolCall, ToolHandlers } from "./client";
import type {
    AgentContextInputField,
    AgentNameFromApp,
    DefaultStructuredOutputForAgent,
    ModalitiesForAgent,
    RunInputForAgent,
    TextInputShorthandForAgent,
} from "./client-type-helpers";
import type { PendingToolApproval, UIMessage } from "./ui";

/** Input for a `UIMessage` before `localId` is assigned. */
export type UIMessageInput = Omit<UIMessage, "localId"> & {
    localId?: string;
};

/** Next messages or a function that returns them. */
export type SetMessagesInput = UIMessageInput[] | ((messages: UIMessage[]) => UIMessageInput[]);

/** Input for `sendMessage`. */
export type SubmitInput<
    TApp = unknown,
    TAgentName extends AgentNameFromApp<TApp> = AgentNameFromApp<TApp>,
    TModalities extends ModalitiesForAgent<TApp, TAgentName> | undefined = undefined,
> = Omit<RunInputForAgent<TApp, TAgentName, TModalities>, "conversationId" | "sendClientHistory">;

/** Public `sendMessage` input. */
export type SendMessageInputForAgent<
    TApp = unknown,
    TAgentName extends AgentNameFromApp<TApp> = AgentNameFromApp<TApp>,
    TModalities extends ModalitiesForAgent<TApp, TAgentName> | undefined = undefined,
> = TextInputShorthandForAgent<TApp, TAgentName> | SubmitInput<TApp, TAgentName, TModalities>;

/** Custom model-history preparation for `sendClientHistory`. */
export type PrepareMessages = (params: {
    messages: UIMessage[];
    input: unknown;
}) => GenerativeModelInputItem[];

/** Internal controller run input shape. */
export type ControllerRunInput = Record<string, unknown> & {
    input: unknown;
    context?: unknown | undefined;
    modalities?: readonly string[] | undefined;
    modelOptions?: Record<string, unknown> | undefined;
};

/** Immutable controller snapshot. */
export interface AgentChatSnapshot {
    /** Stable local chat id. */
    id: string;
    /** Conversation id, when provided. */
    conversationId: string | undefined;
    /** Conversation messages. */
    messages: UIMessage[];
    /** Current request status. */
    status: AgentStatus;
    /** Latest client error. */
    error: AgentClientError | undefined;
    /** Latest stream id. */
    streamId: string | undefined;
    /** Latest run id. */
    runId: string | undefined;
    /** True while a request is active. */
    isLoading: boolean;
    /** True while streaming events are being consumed. */
    isStreaming: boolean;
    /** Pending tool approvals. */
    pendingToolApprovals: PendingToolApproval[];
}

/** Chat request status. */
export type AgentStatus = "ready" | "hydrating" | "submitted" | "streaming" | "error";

/** Startup resume behavior. */
export type ResumeOption =
    | boolean
    | {
          afterSeq?: number;
          streamId?: string;
      };

/** Options for `AgentChatController`. */
export type AgentChatControllerOptions<
    TApp = unknown,
    TAgentName extends AgentNameFromApp<TApp> = AgentNameFromApp<TApp>,
> = {
    /** Stable local chat id. */
    id?: string;
    /** Agent name. */
    agent: TAgentName;
    /** Conversation id. */
    conversationId?: string;
    /** Default provider model options. */
    modelOptions?: RunInputForAgent<TApp, TAgentName> extends {
        modelOptions?: infer TModelOptions;
    }
        ? TModelOptions
        : Record<string, unknown>;
    /** Delivery strategy. */
    delivery?: "auto" | "stream" | "final";
    /** Initial UI messages. */
    initialMessages?: UIMessageInput[];
    /** Resumes a stream or conversation on init. */
    resume?: ResumeOption;
    /** Sends full client-side history with each request. */
    sendClientHistory?: boolean;
    /** Fully overrides client history serialization when replay is enabled. */
    prepareMessages?: PrepareMessages;
    /**
     * Loads conversation history from the server on init when `conversationId` is set.
     *
     * Server history replaces `initialMessages` when found.
     */
    hydrateFromServer?: boolean;
    /** Generates local message ids. */
    generateMessageId?: (message?: Partial<UIMessageInput>) => string;
    /** Controls optimistic user-message insertion. */
    optimisticUserMessage?: boolean | { enabled?: boolean; onError?: "fail" | "remove" };
    /** Per-run function tool handler. */
    onToolCall?: OnToolCall<TApp>;
    /** Per-run map-based tool handlers. */
    toolHandlers?: ToolHandlers<TApp>;
    /** Called when a run ends. */
    onFinish?: (opts: OnFinishParams<TApp, TAgentName>) => void;
    /** Called when an optimistic user message fails. */
    onOptimisticUserMessageError?: (params: { message: UIMessage; error: Error }) => void;
    /** Called for `DATA_PART` events. */
    onData?: (part: { id?: string; data: unknown }) => void;
    /** Called after the HTTP response is received. */
    onResponse?: (response: Response) => void;
    /** Called when the run fails. */
    onError?: (error: Error) => void;
    /** Called for every streamed event. */
    onEvent?: (event: ClientEvent) => void;
    /** Called when streaming disconnects. */
    onDisconnect?: (info: { error: Error; runId?: string; streamId?: string }) => void;
} & AgentContextInputField<TApp, TAgentName>;

type OnFinishStructuredField<TApp, TAgentName extends AgentNameFromApp<TApp>> = [
    DefaultStructuredOutputForAgent<TApp, TAgentName>,
] extends [never]
    ? object
    : {
          /** Final parsed structured output, when this agent has a output schema. */
          structured: DefaultStructuredOutputForAgent<TApp, TAgentName>;
      };

/** `onFinish` callback parameters. */
export type OnFinishParams<
    TApp = unknown,
    TAgentName extends AgentNameFromApp<TApp> = AgentNameFromApp<TApp>,
> = {
    /** Final local messages. */
    messages: UIMessage[];
    /** Run id, when available. */
    runId?: string;
    /** Stream id, when available. */
    streamId?: string;
    /** Conversation id, when configured. */
    conversationId?: string;
    /** Final model response, when available. */
    response?: GenerativeModelResponse;
    /** Finish reason, when available. */
    finishReason?: GenerativeModelResponse["finishReason"];
    /** Usage, when available. */
    usage?: GenerativeModelResponse["usage"];
    /** True when the run was aborted. */
    isAbort: boolean;
} & OnFinishStructuredField<TApp, TAgentName>;

/** Result from `sendMessage`. */
export interface SendResult {
    /** Run id, when available. */
    runId?: string;
    /** Stream id, when available. */
    streamId?: string;
}

/** Result from `retryMessage`. */
export interface RetryResult {
    /** Stream id, when available. */
    streamId?: string;
}

/** Parameters for `approveToolCall`. */
export interface ApproveToolCallParams {
    /** Tool-call id. */
    toolCallId: string;
    /** Run id override. Defaults to the latest run id. */
    runId?: string;
    /** Approval decision. */
    decision: "approved" | "denied";
    /** Approval note. */
    note?: string;
    /** Actor id. */
    actorId?: string;
}

/** Options for `sendMessage`. */
export interface SendMessageOptions {
    /** Abort signal. */
    signal?: AbortSignal;
}

/** @internal Controller-only submit options. */
export type InternalSubmitOptions = {
    replaceLocalId?: string;
    replaceMessage?: UIMessage;
    forceRun?: boolean;
    signal?: AbortSignal;
    reuseOptimisticLocalId?: string;
    serializedHistoryInput?: boolean;
};

/** @internal Prepared request input for one controller send. */
export type PreparedRequestInput = {
    inputToSend: unknown;
    serializedClientHistory: boolean;
};

/** @internal Terminal stream states seen by the controller. */
export type StreamTerminalState = "finished" | "aborted" | "error";

/** @internal Result from consuming one stream. */
export type StreamConsumptionResult = {
    receivedEvent: boolean;
    terminalState?: StreamTerminalState;
    terminalError?: AgentClientError;
};

/** @internal Mutable context for one controller submission. */
export type SubmissionContext = {
    signal: AbortSignal;
    conversationId?: string;
    inputValue: unknown;
    sendClientHistory: boolean;
    optimisticLocalId?: string;
    optimisticMessageMarkedSent: boolean;
    optimisticConfig: {
        enabled: boolean;
        onError: "fail" | "remove";
    };
    preSubmitState: MessageState;
    useFinalDelivery: boolean;
    runInput: ControllerRunInput;
    internalOptions?: InternalSubmitOptions;
};
