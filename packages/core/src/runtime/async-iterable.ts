export function createAsyncIterableQueue<TValue>() {
    const values: TValue[] = [];
    const waiters: Array<(result: IteratorResult<TValue>) => void> = [];
    let closed = false;

    return {
        push(value: TValue) {
            if (closed) {
                return;
            }

            const waiter = waiters.shift();
            if (waiter) {
                waiter({ value, done: false });
                return;
            }

            values.push(value);
        },
        close() {
            if (closed) {
                return;
            }

            closed = true;
            for (const waiter of waiters.splice(0)) {
                waiter({ value: undefined as never, done: true });
            }
        },
        async *iterate(): AsyncIterable<TValue> {
            while (true) {
                if (values.length > 0) {
                    yield values.shift() as TValue;
                    continue;
                }

                if (closed) {
                    return;
                }

                const next = await new Promise<IteratorResult<TValue>>((resolve) => {
                    waiters.push(resolve);
                });

                if (next.done) {
                    return;
                }

                yield next.value;
            }
        },
    };
}
