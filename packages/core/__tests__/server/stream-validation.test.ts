import { describe, expect, test } from "bun:test";
import type { BetterAgentRuntime } from "../../src/run";
import { createServer } from "../../src/server";

describe("server stream replay validation", () => {
    test("resume rejects malformed stored stream events", async () => {
        const runtime = {
            async resumeStream() {
                return (async function* () {
                    yield { seq: 0, garbage: true };
                })();
            },
            async resumeConversation() {
                return null;
            },
        } as unknown as BetterAgentRuntime;

        const server = createServer({ runtime, pluginRuntime: null });
        const response = await server.handle(
            new Request("https://example.com/test/stream-events/resume?streamId=stream_1"),
        );

        expect(response.status).toBe(200);
        expect(await response.text()).toContain("Stored stream event is invalid.");
    });
});
