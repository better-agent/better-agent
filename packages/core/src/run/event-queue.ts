/** Async queue for stream events. */
export interface AsyncEventQueue<T> {
    push(value: T): void;
    close(): void;
    fail(error: unknown): void;
    iterate(): AsyncGenerator<T>;
}

/** Creates an async event queue. */
export const createAsyncEventQueue = <T>(): AsyncEventQueue<T> => {
    const values: T[] = [];
    const waiters: {
        resolve: (result: IteratorResult<T>) => void;
        reject: (error: unknown) => void;
    }[] = [];
    let closed = false;
    let failure: unknown;

    const settleNext = (result: IteratorResult<T>) => {
        const waiter = waiters.shift();
        if (waiter) {
            waiter.resolve(result);
            return true;
        }

        return false;
    };

    const rejectAll = (error: unknown) => {
        for (const waiter of waiters.splice(0)) {
            waiter.reject(error);
        }
    };

    const closeAll = () => {
        for (const waiter of waiters.splice(0)) {
            waiter.resolve({ value: undefined, done: true } as IteratorResult<T>);
        }
    };

    return {
        push(value) {
            if (closed || failure !== undefined) return;
            if (settleNext({ value, done: false })) return;
            values.push(value);
        },
        close() {
            if (closed || failure !== undefined) return;
            closed = true;
            closeAll();
        },
        fail(error) {
            if (closed || failure !== undefined) return;
            failure = error;
            rejectAll(error);
        },
        async *iterate() {
            while (true) {
                if (values.length > 0) {
                    // biome-ignore lint/style/noNonNullAssertion: queue length was checked above
                    yield values.shift()!;
                    continue;
                }

                if (failure !== undefined) {
                    throw failure;
                }

                if (closed) {
                    return;
                }

                const next = await new Promise<IteratorResult<T>>((resolve, reject) => {
                    waiters.push({ resolve, reject });
                });

                if (next.done) {
                    return;
                }

                yield next.value;
            }
        },
    };
};
