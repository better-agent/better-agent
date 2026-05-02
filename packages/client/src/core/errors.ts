export class BetterAgentClientError extends Error {
    readonly status?: number;
    readonly code?: string;
    readonly details?: unknown;

    constructor(
        message: string,
        options: {
            status?: number;
            code?: string;
            details?: unknown;
            cause?: unknown;
        } = {},
    ) {
        super(message, { cause: options.cause });
        this.name = "BetterAgentClientError";
        this.status = options.status;
        this.code = options.code;
        this.details = options.details;
    }
}

export const toBetterAgentClientError = (error: unknown): BetterAgentClientError => {
    if (error instanceof BetterAgentClientError) {
        return error;
    }

    if (error instanceof Error) {
        return new BetterAgentClientError(error.message, { cause: error });
    }

    return new BetterAgentClientError("An unknown error occurred.", { cause: error });
};
