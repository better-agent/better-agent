import type { JsonSchema } from "../schema";

export const RuntimeInterruptReason = {
    ToolCall: "tool_call",
    ClientToolPending: "client_tool_pending",
    ToolApprovalPending: "tool_approval_pending",
    InputRequired: "input_required",
    Confirmation: "confirmation",
} as const;

export type RuntimeInterruptReason =
    | (typeof RuntimeInterruptReason)[keyof typeof RuntimeInterruptReason]
    | (string & {});

export type RunOutcome = "success" | "interrupt";

export interface RuntimeInterrupt {
    id: string;
    reason: RuntimeInterruptReason;
    message?: string;
    toolCallId?: string;
    responseSchema?: JsonSchema;
    expiresAt?: string;
    metadata?: Record<string, unknown>;
}

export interface RuntimeResumeEntry<TPayload = unknown> {
    interruptId: string;
    status: "resolved" | "cancelled";
    payload?: TPayload;
}
