import { describe, expectTypeOf, test } from "bun:test";
import type { GenerativeModel, OutputSchemaForCaps } from "../../src/providers";

type TextOnlyModel = GenerativeModel<
    Record<string, never>,
    "test",
    "text-only",
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

type StructuredModel = GenerativeModel<
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

describe("capability gating", () => {
    test("structured output gating resolves to never without capability and to schema with capability", () => {
        expectTypeOf<OutputSchemaForCaps<TextOnlyModel["caps"]>>().toEqualTypeOf<never>();
        expectTypeOf<OutputSchemaForCaps<StructuredModel["caps"]>>().not.toEqualTypeOf<never>();
        expectTypeOf<VisionModel["caps"]["inputModalities"]>().toMatchTypeOf<{
            image: true;
            text: true;
        }>();
    });
});
