import {
    BetterAgentError,
    type BetterAgentErrorCode,
    type BetterAgentErrorContext,
} from "@better-agent/shared/errors";

export type RuntimeErrorCode =
    | BetterAgentErrorCode
    | "APPROVAL_REQUIRED"
    | "INVALID_STATE"
    | "PROTOCOL_ERROR"
    | "TOOL_FAILED"
    | "UNSUPPORTED_CAPABILITY";

export function createRuntimeError(
    code: RuntimeErrorCode,
    message: string,
    options: {
        cause?: unknown;
        context?: BetterAgentErrorContext;
    } = {},
): BetterAgentError {
    return BetterAgentError.fromCode(code, message, {
        cause: options.cause,
        context: options.context,
    });
}
