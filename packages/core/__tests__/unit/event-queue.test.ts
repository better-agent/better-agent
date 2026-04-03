import { describe, expect, test } from "bun:test";
import { createAsyncEventQueue } from "../../src/run/event-queue";

describe("AsyncEventQueue", () => {
    test("push then iterate yields values in order", async () => {
        const queue = createAsyncEventQueue<number>();
        queue.push(1);
        queue.push(2);
        queue.close();

        const values: number[] = [];
        for await (const value of queue.iterate()) {
            values.push(value);
        }

        expect(values).toEqual([1, 2]);
    });

    test("close after push drains buffered values", async () => {
        const queue = createAsyncEventQueue<string>();
        queue.push("a");
        queue.close();

        const iterator = queue.iterate();
        expect(await iterator.next()).toEqual({ value: "a", done: false });
        expect(await iterator.next()).toEqual({ value: undefined, done: true });
    });

    test("iterate on empty queue waits for push", async () => {
        const queue = createAsyncEventQueue<string>();
        const iterator = queue.iterate();
        const next = iterator.next();
        queue.push("ready");

        expect(next).resolves.toEqual({ value: "ready", done: false });
    });

    test("fail rejects waiting consumers", async () => {
        const queue = createAsyncEventQueue<string>();
        const iterator = queue.iterate();
        const next = iterator.next();
        queue.fail(new Error("boom"));

        expect(next).rejects.toThrow("boom");
    });

    test("push after close is silently dropped", async () => {
        const queue = createAsyncEventQueue<number>();
        queue.close();
        queue.push(1);

        const values: number[] = [];
        for await (const value of queue.iterate()) {
            values.push(value);
        }

        expect(values).toEqual([]);
    });
});
