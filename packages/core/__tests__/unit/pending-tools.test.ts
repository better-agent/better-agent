import { describe, expect, test } from "bun:test";
import { createPendingToolRuntime } from "../../src/run/pending-tools";

describe("pending tool runtime", () => {
    test("client tool wait aborts when the signal aborts", async () => {
        const pending = createPendingToolRuntime();
        const controller = new AbortController();
        const wait = pending.awaitClientToolResult({
            runId: "run_1",
            toolCallId: "call_1",
            toolName: "confirm",
            timeoutMs: 5_000,
            signal: controller.signal,
        });

        controller.abort();

        expect(wait).rejects.toMatchObject({
            code: "ABORTED",
        });
    });

    test("approval wait aborts when the signal aborts", async () => {
        const pending = createPendingToolRuntime();
        const controller = new AbortController();
        const wait = pending.awaitToolApproval({
            runId: "run_1",
            toolCallId: "call_1",
            toolName: "dangerous",
            timeoutMs: 5_000,
            signal: controller.signal,
        });

        controller.abort();

        expect(wait).rejects.toMatchObject({
            code: "ABORTED",
        });
    });
});
