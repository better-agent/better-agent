import { describe, expect, test } from "bun:test";
import { ok } from "@better-agent/shared/neverthrow";
import { betterAgent, defineAgent } from "../../src";
import { defineTool } from "../../src/tools";
import {
    createStructuredModel,
    createStructuredTextResponse,
    createTextAgent,
    createTextModel,
    createToolCallResponse,
} from "../helpers/mock-model";

describe("betterAgent", () => {
    test("accepts a relative baseURL and normalizes it to a server basePath", async () => {
        const app = betterAgent({
            agents: [
                defineAgent({
                    name: "assistant",
                    model: createTextModel(),
                }),
            ],
            baseURL: "/api",
        });

        const response = await app.handler(
            new Request("https://example.com/api/assistant/run", {
                method: "POST",
            }),
        );

        expect(response.status).not.toBe(500);
    });

    test("applies server advanced interactive defaults to app streams", async () => {
        const agent = createTextAgent({
            name: "assistant",
            model: {
                ...createTextAgent().model,
                async doGenerateStream() {
                    return ok({
                        events: (async function* () {})(),
                        final: Promise.resolve(
                            createToolCallResponse([
                                { callId: "call_1", name: "confirm", arguments: '{"ok":true}' },
                            ]),
                        ),
                    });
                },
            },
            toolErrorMode: "throw",
            tools: [
                defineTool({
                    name: "confirm",
                    schema: {
                        type: "object",
                        properties: { ok: { type: "boolean" } },
                        required: ["ok"],
                        additionalProperties: false,
                    } as const,
                }).client() as never,
            ] as never,
        });

        const app = betterAgent({
            agents: [agent] as const,
            advanced: {
                clientToolResultTimeoutMs: 1,
            },
        });

        const stream = app.stream("assistant", { input: "go" } as never);
        const consumeEvents = (async () => {
            try {
                for await (const _event of stream.events) {
                    // drain
                }
            } catch {
                // queue fails when the stream result rejects
            }
        })();

        expect(stream.result).rejects.toMatchObject({
            code: "TIMEOUT",
            message: "Run failed: Timed out waiting for client tool result for 'confirm'.",
        });
        await consumeEvents;
    });

    test("rejects malformed agent definitions at app creation time", () => {
        expect(() =>
            betterAgent({
                agents: [
                    {
                        name: "structured",
                        model: createStructuredModel([createStructuredTextResponse('{"ok":true}')]),
                        outputSchema: {
                            schema: {
                                type: 123,
                            },
                        },
                    } as never,
                ],
            }),
        ).toThrow();
    });
});
