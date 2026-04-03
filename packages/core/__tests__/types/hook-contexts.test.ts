import { describe, expectTypeOf, test } from "bun:test";
import { defineAgent } from "../../src/agent";
import type { GenerativeModel } from "../../src/providers";

type PlainTextModel = GenerativeModel<
    Record<string, never>,
    "test",
    "plain-text",
    {
        inputModalities: { text: true };
        inputShape: "chat";
        outputModalities: { text: true };
    }
>;

type ToolSupportModel = GenerativeModel<
    Record<string, never>,
    "test",
    "tool-support",
    {
        inputModalities: { text: true };
        inputShape: "chat";
        outputModalities: { text: true };
        supportsInstruction: true;
        tools: true;
    }
>;

type StructuredOutputModel = GenerativeModel<
    Record<string, never>,
    "test",
    "structured-output",
    {
        inputModalities: { text: true };
        inputShape: "chat";
        outputModalities: { text: true };
        structured_output: true;
    }
>;

type VisionModel = GenerativeModel<
    Record<string, never>,
    "test",
    "vision",
    {
        inputModalities: { text: true; image: true };
        inputShape: "chat";
        outputModalities: { text: true };
    }
>;

type AudioOnlyModel = GenerativeModel<
    Record<string, never>,
    "test",
    "audio-only",
    {
        inputModalities: { audio: true; text: false };
        inputShape: "prompt";
        outputModalities: { text: true };
    }
>;

type PromptTextModel = GenerativeModel<
    Record<string, never>,
    "test",
    "prompt-text",
    {
        inputModalities: { text: true };
        inputShape: "prompt";
        outputModalities: { image: true };
        replayMode: "single_turn_persistent";
        supportsInstruction: false;
    }
>;

describe("hook contexts typing", () => {
    test("context is required when contextSchema exists and setActiveTools is available on tool models", () => {
        defineAgent({
            name: "with-context",
            model: {} as ToolSupportModel,
            contextSchema: {
                type: "object",
                properties: { userId: { type: "string" }, tier: { type: "string" } },
                required: ["userId", "tier"],
            },
            onStep(ctx) {
                expectTypeOf(ctx.context.userId).toEqualTypeOf<string>();
                expectTypeOf(ctx.maxSteps).toEqualTypeOf<number | undefined>();
                ctx.setActiveTools(["any_tool"]);
            },
            onStepFinish(ctx) {
                expectTypeOf(ctx.context.userId).toEqualTypeOf<string>();
                expectTypeOf(ctx.result.response).toBeObject();
            },
            stopWhen(ctx) {
                expectTypeOf(ctx.context.tier).toEqualTypeOf<string>();
                return false;
            },
            instruction: (ctx) => `User ${ctx.userId}`,
        });
    });

    test("plain-text models do not expose setActiveTools and vision messages accept image parts", () => {
        defineAgent({
            name: "text-only",
            model: {} as PlainTextModel,
            onStep(ctx) {
                // @ts-expect-error setToolChoice should NOT exist on non-tool models
                ctx.setToolChoice("required");
                // @ts-expect-error setActiveTools should NOT exist on plain-text models
                ctx.setActiveTools(["test"]);
            },
            // @ts-expect-error outputErrorMode should not exist without structured output support
            outputErrorMode: "repair",
            onOutputError() {
                return { action: "throw" as const };
            },
        });

        defineAgent({
            name: "vision",
            model: {} as VisionModel,
            onStep(context) {
                const validVisionMessage: (typeof context.messages)[number] = {
                    type: "message",
                    role: "user",
                    content: [
                        {
                            type: "image",
                            source: { kind: "url", url: "https://example.com/reference.png" },
                        },
                    ],
                };

                expectTypeOf(validVisionMessage).toMatchTypeOf<(typeof context.messages)[number]>();
            },
        });

        defineAgent({
            name: "audio-only",
            model: {} as AudioOnlyModel,
            onStep(ctx) {
                // @ts-expect-error setSystemInstruction should NOT exist on non-text-input models
                ctx.setSystemInstruction("hello");
            },
        });

        defineAgent({
            name: "prompt-text",
            model: {} as PromptTextModel,
            // @ts-expect-error instruction should NOT exist on prompt models without instruction support
            instruction: "Be cinematic",
            onStep(ctx) {
                // @ts-expect-error setSystemInstruction should NOT exist on prompt models without instruction support
                ctx.setSystemInstruction("hello");
            },
        });
    });

    test("structured-output models expose output error config", () => {
        defineAgent({
            name: "structured",
            model: {} as StructuredOutputModel,
            outputSchema: {
                schema: {
                    type: "object",
                    properties: { ok: { type: "boolean" } },
                    required: ["ok"],
                },
            },
            outputErrorMode: "repair",
            onOutputError(error) {
                expectTypeOf(error.errorKind).toEqualTypeOf<
                    "missing_text" | "parse" | "validation"
                >();
                return { action: "throw" as const };
            },
        });
    });
});
