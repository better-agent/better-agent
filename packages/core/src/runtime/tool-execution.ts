import { EventType } from "@ag-ui/core";
import { BetterAgentError } from "@better-agent/shared/errors";
import type {
    AgentEvent,
    AgentStateDeltaEvent,
    AgentStateSnapshotEvent,
    AgentToolCallEndEvent,
    AgentToolCallResultEvent,
    AgentToolCallStartEvent,
} from "../ag-ui/events";
import type {
    AgentAssistantMessage,
    AgentAssistantToolCall,
    AgentMessage,
    AgentToolMessage,
    AgentToolResultStatus,
} from "../ag-ui/messages";
import type { PluginRuntime } from "../plugins";
import { validateInput } from "../schema";
import { isClientTool, isServerTool } from "../tools/resolve-tools";
import type { AnyDefinedTool } from "../tools/types";
import { createRuntimeError } from "./errors";
import { type RuntimeHooks, notifyRuntimeStateChange } from "./hooks";
import { RuntimeInterruptReason } from "./interrupts";
import type { RuntimeInterrupt, RuntimeResumeEntry } from "./interrupts";
import { type RuntimeStateControl, createRuntimeStateControl } from "./state";
import { type BetterAgentIdGenerator, defaultGenerateId, ensureAbortSignal } from "./utils";

export interface ToolCallBufferEntry {
    toolCallId: string;
    toolCallName?: string;
    argsText: string;
    parentMessageId?: string;
}

type ToolExecutionEvent = AgentToolCallResultEvent | AgentStateSnapshotEvent | AgentStateDeltaEvent;

function isProviderExecutedToolCall(
    toolCall: AgentAssistantToolCall | AgentToolCallStartEvent | AgentToolCallEndEvent,
): boolean {
    return toolCall.providerExecuted === true;
}

export function createToolCallBuffer(): Map<string, ToolCallBufferEntry> {
    return new Map<string, ToolCallBufferEntry>();
}

export function getCompletedToolCallIds(messages: AgentMessage[]): Set<string> {
    return new Set(
        messages
            .filter((message): message is AgentToolMessage => message.role === "tool")
            .map((message) => message.toolCallId),
    );
}

export function getPendingAssistantToolMessage(
    messages: AgentMessage[],
):
    | (AgentAssistantMessage & { toolCalls: NonNullable<AgentAssistantMessage["toolCalls"]> })
    | undefined {
    const completedToolCallIds = getCompletedToolCallIds(messages);

    for (let index = messages.length - 1; index >= 0; index -= 1) {
        const message = messages[index];

        if (message?.role === "tool") {
            continue;
        }

        if (message?.role !== "assistant") {
            return undefined;
        }

        if (!Array.isArray(message.toolCalls) || message.toolCalls.length === 0) {
            return undefined;
        }

        return message.toolCalls.some(
            (toolCall) =>
                !isProviderExecutedToolCall(toolCall) && !completedToolCallIds.has(toolCall.id),
        )
            ? (message as AgentAssistantMessage & {
                  toolCalls: NonNullable<AgentAssistantMessage["toolCalls"]>;
              })
            : undefined;
    }

    return undefined;
}

export function collectAssistantToolCalls(
    buffer: Map<string, ToolCallBufferEntry>,
    assistantMessage: AgentAssistantMessage & {
        toolCalls: NonNullable<AgentAssistantMessage["toolCalls"]>;
    },
): number {
    let toolCallCount = 0;

    for (const toolCall of assistantMessage.toolCalls) {
        if (isProviderExecutedToolCall(toolCall)) {
            continue;
        }

        toolCallCount += 1;

        collectToolCallEvent(buffer, {
            type: EventType.TOOL_CALL_START,
            timestamp: Date.now(),
            toolCallId: toolCall.id,
            toolCallName: toolCall.function.name,
            parentMessageId: assistantMessage.id,
        });

        collectToolCallEvent(buffer, {
            type: EventType.TOOL_CALL_ARGS,
            timestamp: Date.now(),
            toolCallId: toolCall.id,
            delta: toolCall.function.arguments,
        });
    }

    return toolCallCount;
}

export function collectToolCallEvent(
    buffer: Map<string, ToolCallBufferEntry>,
    event: AgentEvent,
): void {
    if (event.type === EventType.TOOL_CALL_START) {
        buffer.set(event.toolCallId, {
            toolCallId: event.toolCallId,
            toolCallName: event.toolCallName,
            argsText: "",
            parentMessageId: event.parentMessageId,
        });
        return;
    }

    if (event.type === EventType.TOOL_CALL_ARGS) {
        const current = buffer.get(event.toolCallId);

        if (!current) {
            buffer.set(event.toolCallId, {
                toolCallId: event.toolCallId,
                argsText: event.delta,
            });
            return;
        }

        current.argsText += event.delta;
        buffer.set(event.toolCallId, current);
        return;
    }

    if (event.type === EventType.TOOL_CALL_CHUNK && event.toolCallId) {
        const current = buffer.get(event.toolCallId);

        if (!current) {
            buffer.set(event.toolCallId, {
                toolCallId: event.toolCallId,
                toolCallName: event.toolCallName,
                argsText: event.delta ?? "",
                parentMessageId: event.parentMessageId,
            });
            return;
        }

        current.toolCallName = event.toolCallName ?? current.toolCallName;
        current.parentMessageId = event.parentMessageId ?? current.parentMessageId;
        current.argsText += event.delta ?? "";
        buffer.set(event.toolCallId, current);
        return;
    }

    if (event.type === EventType.TOOL_CALL_RESULT) {
        buffer.delete(event.toolCallId);
    }
}

function safeParseToolResultContent(content: string): unknown {
    if (!content.trim()) {
        return "";
    }

    try {
        return JSON.parse(content);
    } catch {
        return content;
    }
}

function parseToolInput(input: string): unknown {
    if (!input.trim()) {
        return input;
    }

    try {
        return JSON.parse(input);
    } catch {
        return input;
    }
}

function findToolNameForCallId(
    messages: readonly AgentMessage[],
    toolCallId: string,
): string | undefined {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
        const message = messages[index];

        if (message?.role !== "assistant" || !Array.isArray(message.toolCalls)) {
            continue;
        }

        const toolCall = message.toolCalls.find((call) => call.id === toolCallId);
        if (toolCall) {
            return toolCall.function.name;
        }
    }

    return undefined;
}

function createToolResultEvent(input: {
    messageId: string;
    toolCallId: string;
    content: string;
    status: "success" | "error" | "denied";
}): AgentToolCallResultEvent {
    return {
        type: EventType.TOOL_CALL_RESULT,
        timestamp: Date.now(),
        messageId: input.messageId,
        toolCallId: input.toolCallId,
        content: input.content,
        role: "tool",
        status: input.status,
    };
}

function createToolResultMessage(input: {
    id: string;
    toolCallId: string;
    content: string;
    status: "success" | "error" | "denied";
    error?: string;
    approval?: {
        approved?: boolean;
        metadata?: Record<string, unknown>;
    };
}): AgentToolMessage {
    return {
        id: input.id,
        role: "tool",
        toolCallId: input.toolCallId,
        content: input.content,
        status: input.status,
        error: input.error,
        approval: input.approval,
    };
}

function getToolFailureMessage(toolName: string, toolsByName: Map<string, AnyDefinedTool>): string {
    const tool = toolsByName.get(toolName);

    if (!tool) {
        return `Tool '${toolName}' is not registered.`;
    }

    return `Tool '${toolName}' cannot be executed.`;
}

function createToolResultId(input: {
    generateId?: BetterAgentIdGenerator;
    runId: string;
    agentName?: string;
    threadId?: string;
    toolCallId: string;
    toolName?: string;
}): string {
    const generateId = input.generateId ?? defaultGenerateId;
    return generateId("toolResult", {
        agentName: input.agentName,
        runId: input.runId,
        threadId: input.threadId,
        toolCallId: input.toolCallId,
        toolName: input.toolName,
        role: "tool",
    });
}

function createInterruptId(input: {
    toolCallId: string;
    phase: "approval" | "client_result";
}): string {
    return `${input.toolCallId}:${input.phase}`;
}

function getInterruptTimeout(
    tool: AnyDefinedTool,
    phase: "approval" | "client_result",
): number | undefined {
    if (phase === "approval") {
        return tool.interrupt?.approval?.timeoutMs ?? tool.interrupt?.timeoutMs;
    }

    return tool.interrupt?.clientTool?.timeoutMs ?? tool.interrupt?.timeoutMs;
}

function toInterruptExpiry(timeoutMs: number | undefined): string | undefined {
    if (timeoutMs === undefined) {
        return undefined;
    }

    return new Date(Date.now() + timeoutMs).toISOString();
}

function createClientToolInterrupt(input: {
    tool: AnyDefinedTool;
    toolCallId: string;
    toolInput: unknown;
}): RuntimeInterrupt {
    const timeoutMs = getInterruptTimeout(input.tool, "client_result");

    return {
        id: createInterruptId({
            toolCallId: input.toolCallId,
            phase: "client_result",
        }),
        reason: RuntimeInterruptReason.ClientToolPending,
        message: `Please complete the client tool '${input.tool.name}' to continue.`,
        toolCallId: input.toolCallId,
        responseSchema: {
            type: "object",
            properties: {
                status: {
                    type: "string",
                    enum: ["success", "error"],
                },
                result: {},
                error: {
                    type: "string",
                },
            },
            required: ["status"],
        },
        ...(toInterruptExpiry(timeoutMs) ? { expiresAt: toInterruptExpiry(timeoutMs) } : {}),
    };
}

async function resolveApprovalRequirement(input: {
    tool: AnyDefinedTool;
    toolInput: unknown;
    context: unknown;
    runId: string;
    toolCallId: string;
}): Promise<
    | {
          enabled: false;
      }
    | {
          enabled: true;
          metadata?: Record<string, unknown>;
      }
> {
    const approval = input.tool.approval;

    if (!approval) {
        return { enabled: false };
    }

    if (approval.resolve) {
        const resolved = await approval.resolve({
            toolInput: input.toolInput,
            context: input.context,
            runId: input.runId,
            toolCallId: input.toolCallId,
            toolName: input.tool.name,
            toolTarget: input.tool.target,
        });

        if (typeof resolved === "boolean") {
            return {
                enabled: resolved,
            };
        }

        return {
            enabled: resolved.enabled ?? true,
            metadata: resolved.metadata,
        };
    }

    return {
        enabled: approval.enabled ?? false,
    };
}

function createApprovalInterrupt(input: {
    tool: AnyDefinedTool;
    toolCallId: string;
    toolInput: unknown;
    timeoutMs?: number;
    metadata?: Record<string, unknown>;
}): RuntimeInterrupt {
    return {
        id: createInterruptId({
            toolCallId: input.toolCallId,
            phase: "approval",
        }),
        reason: RuntimeInterruptReason.ToolApprovalPending,
        message: `Approve tool '${input.tool.name}' before continuing.`,
        toolCallId: input.toolCallId,
        responseSchema: {
            type: "object",
            properties: {
                approved: {
                    type: "boolean",
                },
                metadata: {
                    type: "object",
                    additionalProperties: true,
                },
            },
            required: ["approved"],
        },
        ...(toInterruptExpiry(input.timeoutMs)
            ? { expiresAt: toInterruptExpiry(input.timeoutMs) }
            : {}),
        ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
    };
}

function extractApprovalPayload(payload: unknown): {
    approved?: boolean;
    metadata?: Record<string, unknown>;
} {
    if (typeof payload !== "object" || payload === null) {
        return {};
    }

    return {
        ...("approved" in payload && typeof payload.approved === "boolean"
            ? { approved: payload.approved }
            : {}),
        ...("metadata" in payload &&
        typeof payload.metadata === "object" &&
        payload.metadata !== null
            ? { metadata: payload.metadata as Record<string, unknown> }
            : {}),
    };
}

function getResumeEntry(input: {
    resume?: RuntimeResumeEntry[];
    interruptId: string;
}): RuntimeResumeEntry | undefined {
    return input.resume?.find((entry) => entry.interruptId === input.interruptId);
}

function getApprovalDecision(input: {
    resume?: RuntimeResumeEntry[];
    toolCallId: string;
}): "approved" | "denied" | "cancelled" | "missing" {
    const resumeEntry = getResumeEntry({
        resume: input.resume,
        interruptId: createInterruptId({
            toolCallId: input.toolCallId,
            phase: "approval",
        }),
    });

    if (!resumeEntry) {
        return "missing";
    }

    if (resumeEntry.status === "cancelled") {
        return "cancelled";
    }

    if (
        typeof resumeEntry.payload === "object" &&
        resumeEntry.payload !== null &&
        "approved" in resumeEntry.payload
    ) {
        if (resumeEntry.payload.approved === true) {
            return "approved";
        }

        if (resumeEntry.payload.approved === false) {
            return "denied";
        }
    }

    return "missing";
}

export function toModelToolResultContent(content: unknown): string {
    if (typeof content === "string") {
        return content;
    }

    if (typeof content === "undefined") {
        return "null";
    }

    return JSON.stringify(content);
}

function validateToolOutput(tool: AnyDefinedTool, output: unknown): unknown {
    if (!tool.outputSchema) {
        return output;
    }

    return validateInput(tool.outputSchema, output, {
        invalidMessage: `Tool '${tool.name}' returned invalid output.`,
    });
}

function validateToolInput(tool: AnyDefinedTool, input: unknown): unknown {
    return validateInput(tool.inputSchema, input, {
        invalidMessage: `Tool '${tool.name}' received invalid input.`,
    });
}

export async function prepareModelMessagesForTools(input: {
    messages: readonly AgentMessage[];
    tools?: readonly AnyDefinedTool[];
}): Promise<AgentMessage[]> {
    if (!input.tools?.some((tool) => tool.toModelOutput)) {
        return [...input.messages];
    }

    const toolsByName = new Map(input.tools.map((tool) => [tool.name, tool]));
    const modelMessages: AgentMessage[] = [];

    for (const message of input.messages) {
        if (message.role !== "tool") {
            modelMessages.push(message);
            continue;
        }

        const toolName = findToolNameForCallId(input.messages, message.toolCallId);
        const tool = toolName ? toolsByName.get(toolName) : undefined;

        if (!tool?.toModelOutput || typeof message.content !== "string") {
            modelMessages.push(message);
            continue;
        }

        try {
            const rawOutput = safeParseToolResultContent(message.content);
            const validatedOutput = validateToolOutput(tool, rawOutput);
            const modelOutput = await tool.toModelOutput(validatedOutput);

            modelMessages.push({
                ...message,
                content: toModelToolResultContent(modelOutput),
            });
        } catch {
            modelMessages.push(message);
        }
    }

    return modelMessages;
}

function shouldThrowToolError(tool: AnyDefinedTool): boolean {
    return tool.toolErrorMode === "throw";
}

function toToolFailureContent(error: unknown): string {
    if (error instanceof Error) {
        return error.message;
    }

    return "Tool execution failed.";
}

function createDeniedApprovalResult(input: {
    messageId: string;
    toolCallId: string;
    payload: unknown;
}): {
    event: AgentToolCallResultEvent;
    message: AgentToolMessage;
    modelMessage: AgentToolMessage;
} {
    const content = toModelToolResultContent(input.payload);

    return {
        event: createToolResultEvent({
            messageId: input.messageId,
            toolCallId: input.toolCallId,
            content,
            status: "denied",
        }),
        message: createToolResultMessage({
            id: input.messageId,
            toolCallId: input.toolCallId,
            content: "",
            status: "denied",
            approval: extractApprovalPayload(input.payload),
        }),
        modelMessage: createToolResultMessage({
            id: input.messageId,
            toolCallId: input.toolCallId,
            content,
            status: "denied",
        }),
    };
}

async function createClientToolResult(input: {
    messageId: string;
    tool: AnyDefinedTool;
    toolCallId: string;
    payload: unknown;
    status: "success" | "error" | "denied";
    approval?: {
        approved?: boolean;
        metadata?: Record<string, unknown>;
    };
}): Promise<{
    event: AgentToolCallResultEvent;
    message: AgentToolMessage;
    modelMessage: AgentToolMessage;
}> {
    if (input.status === "denied") {
        const content = toModelToolResultContent(input.payload);

        return {
            event: createToolResultEvent({
                messageId: input.messageId,
                toolCallId: input.toolCallId,
                content,
                status: "denied",
            }),
            message: createToolResultMessage({
                id: input.messageId,
                toolCallId: input.toolCallId,
                content: "",
                status: "denied",
            }),
            modelMessage: createToolResultMessage({
                id: input.messageId,
                toolCallId: input.toolCallId,
                content,
                status: "denied",
            }),
        };
    }

    if (
        typeof input.payload === "object" &&
        input.payload !== null &&
        "status" in input.payload &&
        input.payload.status === "success" &&
        "result" in input.payload
    ) {
        const validatedOutput = validateToolOutput(input.tool, input.payload.result);
        const modelOutput = input.tool.toModelOutput
            ? await input.tool.toModelOutput(validatedOutput)
            : validatedOutput;
        const content = toModelToolResultContent(validatedOutput);
        const modelContent = toModelToolResultContent(modelOutput);

        return {
            event: createToolResultEvent({
                messageId: input.messageId,
                toolCallId: input.toolCallId,
                content,
                status: "success",
            }),
            message: createToolResultMessage({
                id: input.messageId,
                toolCallId: input.toolCallId,
                content,
                status: "success",
                approval: input.approval,
            }),
            modelMessage: createToolResultMessage({
                id: input.messageId,
                toolCallId: input.toolCallId,
                content: modelContent,
                status: "success",
            }),
        };
    }

    const errorContent =
        typeof input.payload === "object" &&
        input.payload !== null &&
        "error" in input.payload &&
        typeof input.payload.error === "string"
            ? input.payload.error
            : toModelToolResultContent(input.payload);

    return {
        event: createToolResultEvent({
            messageId: input.messageId,
            toolCallId: input.toolCallId,
            content: errorContent,
            status: "error",
        }),
        message: createToolResultMessage({
            id: input.messageId,
            toolCallId: input.toolCallId,
            content: errorContent,
            status: "error",
            error: errorContent,
        }),
        modelMessage: createToolResultMessage({
            id: input.messageId,
            toolCallId: input.toolCallId,
            content: errorContent,
            status: "error",
            error: errorContent,
        }),
    };
}

async function createServerToolSuccessResult(input: {
    messageId: string;
    tool: AnyDefinedTool;
    toolCallId: string;
    result: unknown;
    approval?: {
        approved?: boolean;
        metadata?: Record<string, unknown>;
    };
}): Promise<{
    event: AgentToolCallResultEvent;
    message: AgentToolMessage;
    modelMessage: AgentToolMessage;
}> {
    const validatedOutput = validateToolOutput(input.tool, input.result);
    const modelOutput = input.tool.toModelOutput
        ? await input.tool.toModelOutput(validatedOutput)
        : validatedOutput;
    const content = toModelToolResultContent(validatedOutput);
    const modelContent = toModelToolResultContent(modelOutput);

    return {
        event: createToolResultEvent({
            messageId: input.messageId,
            toolCallId: input.toolCallId,
            content,
            status: "success",
        }),
        message: createToolResultMessage({
            id: input.messageId,
            toolCallId: input.toolCallId,
            content,
            status: "success",
            approval: input.approval,
        }),
        modelMessage: createToolResultMessage({
            id: input.messageId,
            toolCallId: input.toolCallId,
            content: modelContent,
            status: "success",
        }),
    };
}

async function createServerToolSkippedResult(input: {
    messageId: string;
    tool: AnyDefinedTool;
    toolCallId: string;
    status: AgentToolResultStatus | undefined;
    result: unknown;
    error?: string;
    approval?: {
        approved?: boolean;
        metadata?: Record<string, unknown>;
    };
}): Promise<{
    event: AgentToolCallResultEvent;
    message: AgentToolMessage;
    modelMessage: AgentToolMessage;
}> {
    const status = input.status ?? "success";

    if (status === "success") {
        return createServerToolSuccessResult({
            tool: input.tool,
            messageId: input.messageId,
            toolCallId: input.toolCallId,
            result: input.result,
            approval: input.approval,
        });
    }

    const content = input.error ?? toModelToolResultContent(input.result);

    return {
        event: createToolResultEvent({
            messageId: input.messageId,
            toolCallId: input.toolCallId,
            content,
            status,
        }),
        message: createToolResultMessage({
            id: input.messageId,
            toolCallId: input.toolCallId,
            content,
            status,
            ...(status === "error" ? { error: content } : {}),
            approval: input.approval,
        }),
        modelMessage: createToolResultMessage({
            id: input.messageId,
            toolCallId: input.toolCallId,
            content,
            status,
            ...(status === "error" ? { error: content } : {}),
        }),
    };
}

async function applyAfterToolCall(input: {
    pluginRuntime?: PluginRuntime;
    runId: string;
    agentName?: string;
    threadId?: string;
    context?: unknown;
    toolName: string;
    toolCallId: string;
    toolInput: unknown;
    status: AgentToolResultStatus;
    result: unknown;
    error?: string;
}): Promise<{
    status: AgentToolResultStatus;
    result: unknown;
    error?: string;
}> {
    if (!input.pluginRuntime?.hasToolHooks) {
        return {
            status: input.status,
            result: input.result,
            ...(input.error !== undefined ? { error: input.error } : {}),
        };
    }

    let status = input.status;
    let result = input.result;
    let error = input.error;
    await input.pluginRuntime.applyAfterToolCall({
        runId: input.runId,
        agentName: input.agentName ?? "",
        threadId: input.threadId,
        context: input.context,
        toolName: input.toolName,
        toolCallId: input.toolCallId,
        input: input.toolInput,
        status,
        result,
        ...(error !== undefined ? { error } : {}),
        setStatus(nextStatus) {
            status = nextStatus;
        },
        setResult(nextResult) {
            result = nextResult;
        },
        setError(nextError) {
            error = nextError;
        },
    });

    return {
        status,
        result,
        ...(error !== undefined ? { error } : {}),
    };
}

export async function executeBufferedToolCalls(input: {
    buffer: Map<string, ToolCallBufferEntry>;
    runId: string;
    agentName?: string;
    threadId?: string;
    tools?: AnyDefinedTool[];
    context?: unknown;
    signal?: AbortSignal;
    checkAbort?: (message: string) => Promise<void> | void;
    state?: RuntimeStateControl<unknown>;
    resume?: RuntimeResumeEntry[];
    completedToolCallIds?: Set<string>;
    hooks?: RuntimeHooks;
    pluginRuntime?: PluginRuntime;
    generateId?: BetterAgentIdGenerator;
}): Promise<{
    events: ToolExecutionEvent[];
    messages: AgentToolMessage[];
    modelMessages: AgentToolMessage[];
    interrupts?: RuntimeInterrupt[];
}> {
    const toolsByName = new Map((input.tools ?? []).map((tool) => [tool.name, tool]));
    const events: ToolExecutionEvent[] = [];
    const messages: AgentToolMessage[] = [];
    const modelMessages: AgentToolMessage[] = [];
    const signal = ensureAbortSignal(input.signal);
    const state = input.state ?? createRuntimeStateControl(undefined);
    const interrupts: RuntimeInterrupt[] = [];

    for (const [, entry] of input.buffer) {
        if (signal.aborted) {
            throw createRuntimeError("ABORTED", "Run aborted before tool execution.");
        }
        await input.checkAbort?.("Run aborted before tool execution.");

        if (input.completedToolCallIds?.has(entry.toolCallId)) {
            continue;
        }

        const toolName = entry.toolCallName ?? "unknown";
        const tool = toolsByName.get(toolName);
        const toolResultMessageId = createToolResultId({
            generateId: input.generateId,
            runId: input.runId,
            agentName: input.agentName,
            threadId: input.threadId,
            toolCallId: entry.toolCallId,
            toolName,
        });
        const toolInput = entry.argsText;
        let effectiveToolInput: string | unknown;
        let approvalPayload: ReturnType<typeof extractApprovalPayload> | undefined;

        if (!tool) {
            const content = getToolFailureMessage(toolName, toolsByName);

            events.push(
                createToolResultEvent({
                    messageId: toolResultMessageId,
                    toolCallId: entry.toolCallId,
                    content,
                    status: "error",
                }),
            );

            messages.push(
                createToolResultMessage({
                    id: toolResultMessageId,
                    toolCallId: entry.toolCallId,
                    content,
                    status: "error",
                    error: content,
                }),
            );
            modelMessages.push(
                createToolResultMessage({
                    id: toolResultMessageId,
                    toolCallId: entry.toolCallId,
                    content,
                    status: "error",
                    error: content,
                }),
            );

            continue;
        }

        try {
            effectiveToolInput = validateToolInput(tool, parseToolInput(toolInput));

            const approval = await resolveApprovalRequirement({
                tool,
                toolInput: effectiveToolInput,
                context: input.context,
                runId: input.runId,
                toolCallId: entry.toolCallId,
            });

            if (approval.enabled) {
                const decision = getApprovalDecision({
                    resume: input.resume,
                    toolCallId: entry.toolCallId,
                });

                if (decision === "missing") {
                    interrupts.push(
                        createApprovalInterrupt({
                            tool,
                            toolCallId: entry.toolCallId,
                            toolInput: effectiveToolInput,
                            timeoutMs: getInterruptTimeout(tool, "approval"),
                            metadata: approval.metadata,
                        }),
                    );
                    continue;
                }

                if (decision === "denied") {
                    const resumeEntry = getResumeEntry({
                        resume: input.resume,
                        interruptId: createInterruptId({
                            toolCallId: entry.toolCallId,
                            phase: "approval",
                        }),
                    });
                    const denied = createDeniedApprovalResult({
                        messageId: toolResultMessageId,
                        toolCallId: entry.toolCallId,
                        payload: resumeEntry?.payload ?? { approved: false },
                    });

                    events.push(denied.event);
                    messages.push(denied.message);
                    modelMessages.push(denied.modelMessage);
                    continue;
                }

                if (decision === "cancelled") {
                    const denied = createDeniedApprovalResult({
                        messageId: toolResultMessageId,
                        toolCallId: entry.toolCallId,
                        payload: { approved: false, status: "cancelled" },
                    });

                    events.push(denied.event);
                    messages.push(denied.message);
                    modelMessages.push(denied.modelMessage);
                    continue;
                }

                const resumeEntry = getResumeEntry({
                    resume: input.resume,
                    interruptId: createInterruptId({
                        toolCallId: entry.toolCallId,
                        phase: "approval",
                    }),
                });
                approvalPayload = extractApprovalPayload(
                    resumeEntry?.payload ?? { approved: true },
                );
            }

            if (isClientTool(tool)) {
                const resumeEntry = getResumeEntry({
                    resume: input.resume,
                    interruptId: createInterruptId({
                        toolCallId: entry.toolCallId,
                        phase: "client_result",
                    }),
                });

                if (resumeEntry?.status === "cancelled") {
                    const denied = await createClientToolResult({
                        messageId: toolResultMessageId,
                        tool,
                        toolCallId: entry.toolCallId,
                        payload: { status: "cancelled" },
                        status: "denied",
                    });

                    events.push(denied.event);
                    messages.push(denied.message);
                    modelMessages.push(denied.modelMessage);
                    continue;
                }

                if (resumeEntry?.status === "resolved") {
                    const result = await createClientToolResult({
                        messageId: toolResultMessageId,
                        tool,
                        toolCallId: entry.toolCallId,
                        payload: resumeEntry.payload,
                        approval: approvalPayload,
                        status:
                            typeof resumeEntry.payload === "object" &&
                            resumeEntry.payload !== null &&
                            "status" in resumeEntry.payload &&
                            resumeEntry.payload.status === "success"
                                ? "success"
                                : "error",
                    });

                    events.push(result.event);
                    messages.push(result.message);
                    modelMessages.push(result.modelMessage);
                    continue;
                }

                interrupts.push(
                    createClientToolInterrupt({
                        tool,
                        toolCallId: entry.toolCallId,
                        toolInput: effectiveToolInput,
                    }),
                );
                continue;
            }

            if (!isServerTool(tool)) {
                throw createRuntimeError(
                    "PROTOCOL_ERROR",
                    `Tool '${toolName}' has an invalid target.`,
                    {
                        context: {
                            runId: input.runId,
                            toolCallId: entry.toolCallId,
                            toolName,
                            toolTarget: tool.target,
                        },
                    },
                );
            }

            if (input.pluginRuntime?.hasToolHooks) {
                const beforeDecision = await input.pluginRuntime.applyBeforeToolCall({
                    runId: input.runId,
                    agentName: input.agentName ?? "",
                    threadId: input.threadId,
                    context: input.context,
                    toolName,
                    toolCallId: entry.toolCallId,
                    input: effectiveToolInput,
                    setInput(nextInput) {
                        effectiveToolInput = nextInput;
                    },
                });

                if (beforeDecision?.skip === true) {
                    const afterToolCall = await applyAfterToolCall({
                        pluginRuntime: input.pluginRuntime,
                        runId: input.runId,
                        agentName: input.agentName,
                        threadId: input.threadId,
                        context: input.context,
                        toolName,
                        toolCallId: entry.toolCallId,
                        toolInput: effectiveToolInput,
                        status: beforeDecision.status ?? "success",
                        result: beforeDecision.result,
                        ...(beforeDecision.error !== undefined
                            ? { error: beforeDecision.error }
                            : {}),
                    });
                    const skipped = await createServerToolSkippedResult({
                        messageId: toolResultMessageId,
                        tool,
                        toolCallId: entry.toolCallId,
                        status: afterToolCall.status,
                        result: afterToolCall.result,
                        error: afterToolCall.error,
                        approval: approvalPayload,
                    });

                    events.push(skipped.event);
                    messages.push(skipped.message);
                    modelMessages.push(skipped.modelMessage);
                    continue;
                }
            }

            const stagedState = createRuntimeStateControl(state.get());
            const stagedStateEvents: Array<AgentStateSnapshotEvent | AgentStateDeltaEvent> = [];
            const result = await tool.execute(effectiveToolInput, {
                context: input.context,
                runId: input.runId,
                agentName: input.agentName,
                threadId: input.threadId,
                toolCallId: entry.toolCallId,
                toolName,
                signal,
                state: {
                    get: () => stagedState.get(),
                    set: (snapshot) => {
                        stagedStateEvents.push(stagedState.set(snapshot));
                    },
                    patch: (delta) => {
                        stagedStateEvents.push(stagedState.patch(delta));
                    },
                },
            });

            if (signal.aborted) {
                throw createRuntimeError("ABORTED", "Run aborted after tool execution.");
            }
            await input.checkAbort?.("Run aborted after tool execution.");
            const finalResult = await applyAfterToolCall({
                pluginRuntime: input.pluginRuntime,
                runId: input.runId,
                agentName: input.agentName,
                threadId: input.threadId,
                context: input.context,
                toolName,
                toolCallId: entry.toolCallId,
                toolInput: effectiveToolInput,
                status: "success",
                result,
            });

            for (const event of stagedStateEvents) {
                state.apply(event);
                events.push(event);
                await notifyRuntimeStateChange({
                    hooks: input.hooks,
                    state,
                    event,
                });
            }

            const success = await createServerToolSkippedResult({
                messageId: toolResultMessageId,
                tool,
                toolCallId: entry.toolCallId,
                status: finalResult.status,
                result: finalResult.result,
                error: finalResult.error,
                approval: approvalPayload,
            });

            events.push(success.event);
            messages.push(success.message);
            modelMessages.push(success.modelMessage);
        } catch (error) {
            if (shouldThrowToolError(tool)) {
                throw BetterAgentError.fromCode("TOOL_FAILED", toToolFailureContent(error), {
                    cause: error,
                    context: {
                        runId: input.runId,
                        toolCallId: entry.toolCallId,
                        toolName,
                    },
                });
            }

            const content = toToolFailureContent(error);
            const finalResult = await applyAfterToolCall({
                pluginRuntime: input.pluginRuntime,
                runId: input.runId,
                agentName: input.agentName,
                threadId: input.threadId,
                context: input.context,
                toolName,
                toolCallId: entry.toolCallId,
                toolInput: effectiveToolInput,
                status: "error",
                result: undefined,
                error: content,
            });
            const failed = await createServerToolSkippedResult({
                messageId: toolResultMessageId,
                tool,
                toolCallId: entry.toolCallId,
                status: finalResult.status,
                result: finalResult.result,
                error: finalResult.error,
                approval: approvalPayload,
            });

            events.push(failed.event);
            messages.push(failed.message);
            modelMessages.push(failed.modelMessage);
        }
    }

    return {
        events,
        messages,
        modelMessages,
        ...(interrupts.length > 0 ? { interrupts } : {}),
    };
}
