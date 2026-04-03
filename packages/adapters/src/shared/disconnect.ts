export const createDisconnectSignal = (
    request: {
        once(event: "aborted", listener: () => void): unknown;
        aborted?: boolean;
    },
    response?: { once(event: "close", listener: () => void): unknown; writableEnded?: boolean },
): AbortSignal => {
    const controller = new AbortController();

    const abort = () => {
        if (!controller.signal.aborted) {
            controller.abort();
        }
    };

    if (request.aborted) {
        abort();
    } else {
        request.once("aborted", abort);
    }
    response?.once("close", () => {
        if (!response.writableEnded) {
            abort();
        }
    });

    return controller.signal;
};

export const isDisconnectError = (error: unknown): boolean => {
    if (!(error instanceof Error)) {
        return false;
    }

    return error.name === "AbortError" || error.message.includes("aborted");
};
