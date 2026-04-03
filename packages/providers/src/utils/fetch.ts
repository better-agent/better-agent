type FetchErrorPayload<TError> = {
    status: number;
    statusText: string;
    error?: TError extends { error?: infer TInner } ? TInner : unknown;
};

type FetchResult<TData, TError> = {
    data?: TData;
    error?: FetchErrorPayload<TError>;
    response: Response;
};

type FetchOptions = {
    method?: string;
    body?: BodyInit | null;
    headers?: HeadersInit;
    signal?: AbortSignal | null;
    throw?: boolean;
};

const RETRY_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 1_000;
const RETRY_MAX_DELAY_MS = 8_000;
const REQUEST_TIMEOUT_MS = 60_000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const parseJsonBody = async (response: Response): Promise<unknown> => {
    const text = await response.text();
    if (!text) return undefined;

    try {
        return JSON.parse(text);
    } catch {
        return undefined;
    }
};

const extractErrorField = <TError>(body: unknown): FetchErrorPayload<TError>["error"] => {
    if (!body || typeof body !== "object" || !("error" in body)) return undefined;
    return (body as { error?: FetchErrorPayload<TError>["error"] }).error;
};

export const baFetch = async <TData, TError>(
    input: string,
    options: FetchOptions = {},
): Promise<FetchResult<TData, TError>> => {
    let lastError: unknown;

    for (let attempt = 0; attempt < RETRY_ATTEMPTS; attempt += 1) {
        const ctrl = new AbortController();
        const timeoutId = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
        const abort = () => ctrl.abort();
        options.signal?.addEventListener("abort", abort, { once: true });

        try {
            const response = await fetch(input, {
                method: options.method,
                body: options.body,
                headers: options.headers,
                signal: ctrl.signal,
            });

            const body = await parseJsonBody(response);
            if (!response.ok) {
                return {
                    error: {
                        status: response.status,
                        statusText: response.statusText,
                        error: extractErrorField<TError>(body),
                    },
                    response,
                };
            }

            return {
                data: body as TData | undefined,
                response,
            };
        } catch (error) {
            lastError = error;
            if (attempt === RETRY_ATTEMPTS - 1 || options.signal?.aborted) {
                throw error;
            }

            const delay = Math.min(RETRY_BASE_DELAY_MS * 2 ** attempt, RETRY_MAX_DELAY_MS);
            await sleep(delay);
        } finally {
            clearTimeout(timeoutId);
            options.signal?.removeEventListener("abort", abort);
        }
    }

    throw lastError instanceof Error ? lastError : new Error(String(lastError));
};
