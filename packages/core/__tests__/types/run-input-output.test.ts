import { describe, expectTypeOf, test } from "bun:test";
import { defineAgent } from "../../src";
import type { AgentDefinition } from "../../src/agent";
import type { AppRunInput } from "../../src/app/types";
import type { GenerativeModel } from "../../src/providers";
import type { RunOptionsForAgent } from "../../src/run/types";

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

describe("run input and output typing", () => {
    test("text model app and runtime input accept strings", () => {
        const billingAgent = { name: "billing", model: {} as PlainTextModel } as AgentDefinition<
            "billing",
            PlainTextModel
        >;
        const appInput: AppRunInput<typeof billingAgent>["input"] = "hello";
        const runtimeInput: RunOptionsForAgent<typeof billingAgent>["input"] = "hello";

        expectTypeOf(appInput).toMatchTypeOf<AppRunInput<typeof billingAgent>["input"]>();
        expectTypeOf(runtimeInput).toMatchTypeOf<
            RunOptionsForAgent<typeof billingAgent>["input"]
        >();
    });

    test("vision model input accepts image content parts", () => {
        const visionAgent = { name: "vision", model: {} as VisionModel } as AgentDefinition<
            "vision",
            VisionModel
        >;

        const visionRunInputOk: AppRunInput<typeof visionAgent>["input"] = [
            {
                type: "message",
                role: "user",
                content: [
                    {
                        type: "image",
                        source: { kind: "url", url: "https://example.com/image.png" },
                    },
                ],
            },
        ];

        expectTypeOf(visionRunInputOk).toMatchTypeOf<AppRunInput<typeof visionAgent>["input"]>();
    });

    test("text model input rejects image content parts", () => {
        const billingAgent = { name: "billing", model: {} as PlainTextModel } as AgentDefinition<
            "billing",
            PlainTextModel
        >;

        const billingRunInputBad: AppRunInput<typeof billingAgent>["input"] = [
            {
                type: "message",
                role: "user",
                content: [
                    {
                        // @ts-expect-error text-only app run input should reject image parts.
                        type: "image",
                        source: { kind: "url", url: "https://example.com/image.png" },
                    },
                ],
            },
        ];

        void billingRunInputBad;
    });

    test("run options allow conversationReplay.prepareInput null as a run-level override", () => {
        const billingAgent = { name: "billing", model: {} as PlainTextModel } as AgentDefinition<
            "billing",
            PlainTextModel
        >;

        const runOptionsOk: RunOptionsForAgent<typeof billingAgent> = {
            input: "hello",
            conversationId: "conv_1",
            conversationReplay: {
                prepareInput: null,
            },
        };

        expectTypeOf(runOptionsOk).toMatchTypeOf<RunOptionsForAgent<typeof billingAgent>>();
    });

    test("run options require context when the agent has a context schema", () => {
        const billingAgent = defineAgent({
            name: "billing_with_context",
            model: {} as PlainTextModel,
            contextSchema: {
                type: "object",
                properties: { accountId: { type: "string" } },
                required: ["accountId"],
                additionalProperties: false,
            } as const,
        });

        const runOptionsOk: RunOptionsForAgent<typeof billingAgent> = {
            input: "hello",
            context: {
                accountId: "acct_123",
            },
        };

        expectTypeOf(runOptionsOk).toMatchTypeOf<RunOptionsForAgent<typeof billingAgent>>();

        const neverRun = false as boolean;
        if (neverRun) {
            // @ts-expect-error context should be required when contextSchema is present.
            const missingContext: RunOptionsForAgent<typeof billingAgent> = {
                input: "hello",
            };
            void missingContext;
        }
    });
});
