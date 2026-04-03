/** Better Agent error codes. */
export type BetterAgentErrorCode =
    | "BAD_REQUEST"
    | "VALIDATION_FAILED"
    | "NOT_FOUND"
    | "CONFLICT"
    | "RATE_LIMITED"
    | "TIMEOUT"
    | "ABORTED"
    | "UPSTREAM_FAILED"
    | "INTERNAL"
    | (string & {});

type ErrorCodeMeta = {
    status: number;
    title: string;
    retryable: boolean;
    slug: string;
};

export const ERROR_DOCS_BASE_URL = "https://better-agent.com/docs/concepts/errors";

/** Default metadata by error code. */
export const ERROR_CODE_META: Readonly<Record<string, ErrorCodeMeta>> = {
    BAD_REQUEST: { status: 400, title: "Bad Request", retryable: false, slug: "bad-request" },
    NOT_FOUND: { status: 404, title: "Not Found", retryable: false, slug: "not-found" },
    CONFLICT: { status: 409, title: "Conflict", retryable: false, slug: "conflict" },
    VALIDATION_FAILED: {
        status: 422,
        title: "Unprocessable Entity",
        retryable: false,
        slug: "validation-failed",
    },
    RATE_LIMITED: {
        status: 429,
        title: "Too Many Requests",
        retryable: true,
        slug: "rate-limited",
    },
    TIMEOUT: { status: 504, title: "Gateway Timeout", retryable: true, slug: "timeout" },
    ABORTED: {
        status: 499,
        title: "Client Closed Request",
        retryable: false,
        slug: "aborted",
    },
    UPSTREAM_FAILED: {
        status: 502,
        title: "Upstream Failed",
        retryable: true,
        slug: "upstream-failed",
    },
    INTERNAL: {
        status: 500,
        title: "Internal Server Error",
        retryable: false,
        slug: "internal",
    },
};

/** One error trace frame. */
export type BetterAgentErrorTraceFrame = {
    at: string;
    data?: Record<string, unknown>;
};

/** Free-form error metadata. */
export type BetterAgentErrorContext = Record<string, unknown>;

/** RFC 7807-style error payload. */
export type BetterAgentProblemDetails = {
    type: string;
    title: string;
    status: number;
    detail: string;
    code: string;
    retryable?: boolean;
    issues?: unknown[];
    context?: BetterAgentErrorContext;
    traceId?: string;
    trace?: BetterAgentErrorTraceFrame[];
};

type WrapOptions = {
    code?: BetterAgentErrorCode | undefined;
    status?: number | undefined;
    title?: string | undefined;
    type?: string | undefined;
    retryable?: boolean | undefined;
    issues?: unknown[] | undefined;
    context?: BetterAgentErrorContext | undefined;
    traceId?: string | undefined;
    cause?: unknown;
    trace?: BetterAgentErrorTraceFrame[] | undefined;
    // biome-ignore lint/complexity/noBannedTypes: Stack capture needs function constructor references.
    stackFrom?: Function;
};

/** Options for {@link BetterAgentError}. */
export type BetterAgentErrorOptions = {
    code: BetterAgentErrorCode;
    status?: number | undefined;
    title?: string | undefined;
    type?: string | undefined;
    retryable?: boolean | undefined;
    issues?: unknown[] | undefined;
    context?: BetterAgentErrorContext | undefined;
    traceId?: string | undefined;
    cause?: unknown;
    trace?: BetterAgentErrorTraceFrame[] | undefined;
    // biome-ignore lint/complexity/noBannedTypes: Stack capture needs function constructor references.
    stackFrom?: Function;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null;

const isProblemDetailsLike = (value: unknown): value is BetterAgentProblemDetails => {
    if (!isRecord(value)) return false;
    return (
        typeof value.type === "string" &&
        typeof value.title === "string" &&
        typeof value.status === "number" &&
        typeof value.detail === "string" &&
        typeof value.code === "string"
    );
};

const getCodeMeta = (code: string): ErrorCodeMeta => {
    const found = ERROR_CODE_META[code];
    if (found) return found;
    return {
        status: 500,
        title: "Internal Server Error",
        retryable: false,
        slug: code.toLowerCase().replace(/_/g, "-"),
    };
};

const getDocsTypeUrl = (code: string): string => {
    const meta = getCodeMeta(code);
    return `${ERROR_DOCS_BASE_URL}#${meta.slug}`;
};

/** Better Agent error type. */
export class BetterAgentError extends Error {
    code: BetterAgentErrorCode;
    status: number;
    title: string;
    type: string;
    retryable: boolean;
    declare issues?: unknown[];
    declare context?: BetterAgentErrorContext;
    declare traceId?: string;
    trace: BetterAgentErrorTraceFrame[];

    constructor(message: string, opts: BetterAgentErrorOptions) {
        if (opts.cause !== undefined) {
            super(message, { cause: opts.cause });
        } else {
            super(message);
        }

        Object.setPrototypeOf(this, new.target.prototype);
        this.name = "BetterAgentError";

        const meta = getCodeMeta(opts.code);
        this.code = opts.code;
        this.status = opts.status ?? meta.status;
        this.title = opts.title ?? meta.title;
        this.type = opts.type ?? getDocsTypeUrl(opts.code);
        this.retryable = opts.retryable ?? meta.retryable;
        if (opts.issues !== undefined) this.issues = opts.issues;
        if (opts.context !== undefined) this.context = opts.context;
        if (opts.traceId !== undefined) this.traceId = opts.traceId;
        this.trace = opts.trace ?? [];

        // captureStackTrace is available in V8/Node.js environments
        const ctor = Error as unknown as {
            captureStackTrace?: (target: object, ctor?: unknown) => void;
        };
        if (ctor.captureStackTrace !== undefined) {
            ctor.captureStackTrace(this, opts.stackFrom ?? BetterAgentError);
        }
    }

    /** Adds a trace frame. */
    at(frame: BetterAgentErrorTraceFrame): this {
        this.trace.push(frame);
        return this;
    }

    /** Converts this error to problem details. */
    toProblem(overrides: Partial<BetterAgentProblemDetails> = {}): BetterAgentProblemDetails {
        const out: BetterAgentProblemDetails = {
            type: overrides.type ?? this.type,
            title: overrides.title ?? this.title,
            status: overrides.status ?? this.status,
            detail: overrides.detail ?? this.message,
            code: String(overrides.code ?? this.code),
        };

        const retryable = overrides.retryable ?? this.retryable;
        if (retryable !== undefined) out.retryable = retryable;

        const issues = overrides.issues ?? this.issues;
        if (issues !== undefined) out.issues = issues;

        const traceId = overrides.traceId ?? this.traceId;
        if (traceId !== undefined) out.traceId = traceId;

        const context = {
            ...(this.context ?? {}),
            ...(isRecord(overrides.context) ? overrides.context : {}),
        };
        if (Object.keys(context).length > 0) out.context = context;

        const trace = overrides.trace ?? this.trace;
        if (trace.length > 0) out.trace = trace;

        return out;
    }

    /** JSON form for `JSON.stringify`. */
    toJSON() {
        return this.toProblem();
    }

    /** Debug form with stack and cause. */
    toDebugJSON() {
        const debug = this.toProblem() as BetterAgentProblemDetails & {
            stack?: string;
            cause?: unknown;
        };

        if (this.stack !== undefined) debug.stack = this.stack;
        if (this.cause !== undefined) debug.cause = this.cause;

        return debug;
    }

    /** Creates an error from a code and message. */
    static fromCode(
        code: BetterAgentErrorCode,
        message: string,
        opts: Omit<WrapOptions, "code"> = {},
    ): BetterAgentError {
        return new BetterAgentError(message, {
            code,
            ...opts,
            stackFrom: opts.stackFrom ?? BetterAgentError.fromCode,
        });
    }

    /** Rehydrates an error from problem details. */
    static fromProblem(
        input: BetterAgentProblemDetails | Record<string, unknown>,
        opts: Omit<WrapOptions, "code"> = {},
    ): BetterAgentError {
        if (!isProblemDetailsLike(input)) {
            return BetterAgentError.wrap({
                err: input,
                message: "Invalid problem details payload",
                opts: {
                    ...opts,
                    code: "INTERNAL",
                },
            });
        }

        return new BetterAgentError(input.detail, {
            code: input.code,
            status: input.status,
            title: input.title,
            type: input.type,
            retryable: input.retryable,
            issues: input.issues,
            context: input.context,
            traceId: input.traceId,
            trace: input.trace,
            ...opts,
            stackFrom: opts.stackFrom ?? BetterAgentError.fromProblem,
        });
    }

    /** Wraps unknown errors as {@link BetterAgentError}. */
    static wrap(args: {
        err: unknown;
        message?: string;
        opts?: WrapOptions;
    }): BetterAgentError {
        const code = args.opts?.code ?? "INTERNAL";

        if (args.err instanceof BetterAgentError) {
            return new BetterAgentError(
                args.message ? `${args.message}: ${args.err.message}` : args.err.message,
                {
                    code,
                    status: args.opts?.status ?? args.err.status,
                    title: args.opts?.title ?? args.err.title,
                    type: args.opts?.type ?? args.err.type,
                    retryable: args.opts?.retryable ?? args.err.retryable,
                    context: {
                        ...(args.err.context ?? {}),
                        ...(args.opts?.context ?? {}),
                    },
                    traceId: args.opts?.traceId ?? args.err.traceId,
                    trace: args.opts?.trace
                        ? [...args.err.trace, ...args.opts.trace]
                        : args.err.trace,
                    cause: args.opts?.cause ?? args.err,
                    stackFrom: args.opts?.stackFrom ?? BetterAgentError.wrap,
                },
            );
        }

        if (isProblemDetailsLike(args.err)) {
            return BetterAgentError.fromProblem(args.err, {
                ...args.opts,
                stackFrom: args.opts?.stackFrom ?? BetterAgentError.wrap,
            });
        }

        if (args.err instanceof Error) {
            return new BetterAgentError(args.message || args.err.message, {
                ...args.opts,
                code,
                cause: args.opts?.cause ?? args.err,
                stackFrom: args.opts?.stackFrom ?? BetterAgentError.wrap,
            });
        }

        return new BetterAgentError(args.message || "Unknown error", {
            ...args.opts,
            code,
            stackFrom: args.opts?.stackFrom ?? BetterAgentError.wrap,
        });
    }
}
