import { describe, expect, test } from "bun:test";
import type { ConversationStore } from "../../src/persistence";
import type { BetterAgentRuntime } from "../../src/run";
import { createRuntime } from "../../src/run";
import { createTextAgent } from "../helpers/mock-model";

describe("runtime state validation", () => {
    test("run rejects malformed loaded conversation messages", async () => {
        const agent = createTextAgent();
        const conversations: ConversationStore = {
            async load() {
                return { items: [{ garbage: true }] as never, cursor: "cursor_1" };
            },
            async save() {
                throw new Error("save should not be called when validation fails");
            },
        };
        const runtime = createRuntime({
            agents: [agent] as const,
            conversations,
        } as Parameters<typeof createRuntime>[0]) as unknown as BetterAgentRuntime;

        expect(
            runtime.run(agent.name, { input: "hello", conversationId: "conv_1" }),
        ).rejects.toMatchObject({
            code: "VALIDATION_FAILED",
        });
    });
});
