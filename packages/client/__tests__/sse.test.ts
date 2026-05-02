import { describe, expect, test } from "bun:test";
import { BetterAgentClientError } from "../src/core/errors";
import { parseSse } from "../src/core/sse";

const toStream = (chunks: string[]): ReadableStream<Uint8Array> =>
    new ReadableStream<Uint8Array>({
        start(controller) {
            const encoder = new TextEncoder();
            for (const chunk of chunks) {
                controller.enqueue(encoder.encode(chunk));
            }
            controller.close();
        },
    });

describe("parseSse", () => {
    test("throws BetterAgentClientError from message field", async () => {
        const stream = toStream([
            'event: error\ndata: {"message":"stream exploded","code":"BROKEN"}\n\n',
        ]);

        let caught: unknown;
        try {
            for await (const _event of parseSse(stream)) {
                // consume stream
            }
        } catch (error) {
            caught = error;
        }

        expect(caught).toBeInstanceOf(BetterAgentClientError);
        expect((caught as BetterAgentClientError).message).toBe("stream exploded");
        expect((caught as BetterAgentClientError).code).toBe("BROKEN");
        expect((caught as BetterAgentClientError).status).toBeUndefined();
        expect((caught as BetterAgentClientError).details).toEqual({
            message: "stream exploded",
            code: "BROKEN",
        });
    });

    test("falls back to detail for problem-details payloads", async () => {
        const stream = toStream([
            'event: error\ndata: {"type":"https://x/errors#bad-request","status":422,"detail":"invalid user input","code":"VALIDATION_FAILED"}\n\n',
        ]);

        let caught: unknown;
        try {
            for await (const _event of parseSse(stream)) {
                // consume stream
            }
        } catch (error) {
            caught = error;
        }

        expect(caught).toBeInstanceOf(BetterAgentClientError);
        expect((caught as BetterAgentClientError).message).toBe("invalid user input");
        expect((caught as BetterAgentClientError).code).toBe("VALIDATION_FAILED");
        expect((caught as BetterAgentClientError).status).toBe(422);
    });

    test("handles non-JSON error payloads", async () => {
        const stream = toStream(["event: error\ndata: gateway timeout\n\n"]);

        let caught: unknown;
        try {
            for await (const _event of parseSse(stream)) {
                // consume stream
            }
        } catch (error) {
            caught = error;
        }

        expect(caught).toBeInstanceOf(BetterAgentClientError);
        expect((caught as BetterAgentClientError).message).toBe("gateway timeout");
        expect((caught as BetterAgentClientError).details).toBeUndefined();
    });
});
