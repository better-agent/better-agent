/** Configuration for `logging`. */
export type LoggingConfig = {
    /** Plugin id. */
    id?: string;
    /** Minimum log level. */
    level?: "debug" | "info" | "warn" | "error";
    /** Logger implementation. */
    logger?: {
        /** Debug logger. */
        debug?: (...args: unknown[]) => void;
        /** Info logger. */
        info?: (...args: unknown[]) => void;
        /** Warn logger. */
        warn?: (...args: unknown[]) => void;
        /** Error logger. */
        error?: (...args: unknown[]) => void;
    };
    /** Enabled logging groups. */
    include?: {
        /** Logs incoming requests. */
        requests?: boolean;
        /** Logs run events. */
        events?: boolean;
        /** Logs step boundaries. */
        steps?: boolean;
        /** Logs model calls. */
        modelCalls?: boolean;
        /** Logs tool calls. */
        toolCalls?: boolean;
        /** Logs error events. */
        errors?: boolean;
    };
    /** Extra header names to redact. */
    redactHeaders?: readonly string[];
    /** Rewrites logged bodies before emission. */
    redactBody?: (ctx: {
        /** Raw body value. */
        body: unknown;
        /** Logging phase. */
        phase: "request" | "response" | "tool_args" | "tool_result";
    }) => unknown;
    /** Formats one log entry. */
    format?: (entry: LogEntry) => unknown;
};

/** Structured log entry emitted by `logging`. */
export type LogEntry = {
    /** Log level. */
    level: "debug" | "info" | "warn" | "error";
    /** Log event name. */
    event:
        | "request.received"
        | "run.event"
        | "step.start"
        | "model.before"
        | "model.after"
        | "tool.before"
        | "tool.after";
    /** ISO timestamp. */
    timestamp: string;
    /** Agent name. */
    agentName: string;
    /** Run id, when available. */
    runId?: string;
    /** Conversation id, when available. */
    conversationId?: string;
    /** Event data. */
    data?: Record<string, unknown>;
};
