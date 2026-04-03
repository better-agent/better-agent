import { describe, expectTypeOf, test } from "bun:test";
import { betterAgent, defineAgent } from "../../src";
import type { GenerativeModel } from "../../src/providers";

type PlainTextModel = GenerativeModel<
    Record<string, never>,
    "test",
    "plain",
    {
        inputModalities: { text: true };
        inputShape: "chat";
        outputModalities: { text: true };
    }
>;

type StructuredTextModel = GenerativeModel<
    Record<string, never>,
    "test",
    "structured",
    {
        inputModalities: { text: true };
        inputShape: "chat";
        outputModalities: { text: true };
        structured_output: true;
    }
>;

describe("app typing", () => {
    const supportAgent = defineAgent({
        name: "support",
        model: {
            provider: "test",
            modelId: "text",
            caps: {
                inputModalities: { text: true },
                inputShape: "chat",
                outputModalities: { text: true },
                structured_output: true,
            },
        } as unknown as StructuredTextModel,
        contextSchema: {
            type: "object",
            properties: { role: { type: "string" } },
            required: ["role"],
            additionalProperties: false,
        } as const,
        outputSchema: {
            schema: {
                type: "object",
                properties: { summary: { type: "string" } },
                required: ["summary"],
                additionalProperties: false,
            } as const,
        },
    });

    const plainAgent = defineAgent({
        name: "plain",
        model: {
            provider: "test",
            modelId: "plain",
            caps: {
                inputModalities: { text: true },
                inputShape: "chat",
                outputModalities: { text: true },
            },
        } as unknown as PlainTextModel,
    });

    const app = betterAgent({
        agents: [supportAgent, plainAgent] as const,
    });
    const neverRun = false as boolean;

    test("app.run keeps agent-specific context and output types", () => {
        if (neverRun) {
            const supportResult = app.run("support", {
                input: "hi",
                context: { role: "admin" },
            });
            const plainResult = app.run("plain", { input: "hi" });

            expectTypeOf(supportResult).toMatchTypeOf<
                Promise<{
                    structured: { summary: string };
                }>
            >();
            expectTypeOf(plainResult).toMatchTypeOf<Promise<object>>();

            // @ts-expect-error support agent requires context
            app.run("support", { input: "hi" });
        }
    });
});
