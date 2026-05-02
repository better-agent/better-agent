import { beforeEach, describe, expect, setSystemTime, test } from "bun:test";
import { BetterAgentError } from "@better-agent/shared/errors";
import type { AgentMessage } from "../src/ag-ui/messages";
import { createMemory } from "../src/memory/memory";
import { createInMemoryStorage } from "../src/storage/in-memory";

const thread = (id: string) => ({
    id,
    agentName: "agent",
    scope: "project",
    title: id,
    createdAt: 1,
    updatedAt: 1,
});

const userMessage = (id: string, content: string) =>
    ({
        id,
        role: "user",
        content,
    }) as AgentMessage;

describe("memory", () => {
    beforeEach(() => {
        setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    });

    test("unbound memory operations throw validation errors", async () => {
        const memory = createMemory();

        expect(() => memory.threads.get("thread-1")).toThrow(BetterAgentError);
    });

    test("lastMessages must be a positive integer", () => {
        expect(() => createMemory({ lastMessages: 0 })).toThrow(BetterAgentError);
        expect(() => createMemory({ lastMessages: 1.5 })).toThrow(BetterAgentError);
        expect(createMemory({ lastMessages: 2 }).lastMessages).toBe(2);
    });

    test("threads validate ids and list with filters", async () => {
        const memory = createMemory({ storage: createInMemoryStorage() });

        expect(memory.threads.set("thread-1", thread("other"))).rejects.toThrow(BetterAgentError);

        await memory.threads.set("thread-1", thread("thread-1"));
        await memory.threads.set("thread-2", { ...thread("thread-2"), scope: "other" });

        expect(await memory.threads.get("thread-1")).toEqual(thread("thread-1"));
        expect(
            await memory.threads.list({ agentName: "agent", scope: "project", limit: 1 }),
        ).toEqual([thread("thread-1")]);
    });

    test("messages append, list chronologically, and respect limit", async () => {
        const memory = createMemory({ storage: createInMemoryStorage() });

        await memory.messages.append({
            threadId: "thread-1",
            runId: "run-1",
            messages: [userMessage("a", "first"), userMessage("b", "second")],
        });

        expect(
            (await memory.messages.list({ threadId: "thread-1" })).map((message) => message.id),
        ).toEqual(["a", "b"]);
        expect(
            (await memory.messages.list({ threadId: "thread-1", limit: 1 })).map(
                (message) => message.id,
            ),
        ).toEqual(["b"]);
    });

    test("messages can list only history before a run", async () => {
        const memory = createMemory({ storage: createInMemoryStorage() });

        await memory.messages.append({
            threadId: "thread-1",
            runId: "run-1",
            messages: [userMessage("a", "first")],
        });
        await memory.messages.append({
            threadId: "thread-1",
            runId: "run-2",
            messages: [userMessage("b", "second")],
        });
        await memory.messages.append({
            threadId: "thread-1",
            runId: "run-3",
            messages: [userMessage("c", "third")],
        });

        expect(
            (await memory.messages.list({ threadId: "thread-1", beforeRunId: "run-2" })).map(
                (message) => message.id,
            ),
        ).toEqual(["a"]);
    });

    test("empty message appends are ignored", async () => {
        const memory = createMemory({ storage: createInMemoryStorage() });

        await memory.messages.append({ threadId: "thread-1", messages: [] });

        expect(await memory.messages.list({ threadId: "thread-1" })).toEqual([]);
    });

    test("deleting a thread deletes its messages", async () => {
        const memory = createMemory({ storage: createInMemoryStorage() });

        await memory.threads.set("thread-1", thread("thread-1"));
        await memory.messages.append({
            threadId: "thread-1",
            messages: [userMessage("a", "first")],
        });
        await memory.threads.delete("thread-1");

        expect(await memory.threads.get("thread-1")).toBeUndefined();
        expect(await memory.messages.list({ threadId: "thread-1" })).toEqual([]);
    });

    test("fork copies thread and transformed messages", async () => {
        const memory = createMemory({ storage: createInMemoryStorage() });
        await memory.threads.set("source", thread("source"));
        await memory.messages.append({
            threadId: "source",
            messages: [userMessage("a", "first")],
        });

        const forked = await memory.fork("next", "source", (messages) => [
            ...messages,
            userMessage("b", "second"),
        ]);

        expect(forked.id).toBe("next");
        expect(
            (await memory.messages.list({ threadId: "next" })).map((message) => message.id),
        ).toEqual(["a", "b"]);
    });

    test("fork throws when source thread is missing", async () => {
        const memory = createMemory({ storage: createInMemoryStorage() });

        await expect(memory.fork("next", "missing")).rejects.toThrow(BetterAgentError);
    });
});
