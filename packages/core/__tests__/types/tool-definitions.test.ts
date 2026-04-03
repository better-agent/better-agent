import { describe, expectTypeOf, test } from "bun:test";
import { defineTool } from "../../src";
import type { OpenString, ToolApprovalConfig, ToolNamesOf } from "../../src/tools";

type BillingContext = {
    accountId: string;
    tier: "free" | "pro" | "enterprise";
};

describe("tool definitions typing", () => {
    test("defineTool infers handler args and approval context types", () => {
        const billingApproval: ToolApprovalConfig<BillingContext, { amount: number }> = {
            resolve: ({ context, input, runId, toolCallId, toolName, toolTarget }) => {
                expectTypeOf(context.accountId).toEqualTypeOf<string>();
                expectTypeOf(input.amount).toEqualTypeOf<number>();
                expectTypeOf(runId).toEqualTypeOf<string>();
                expectTypeOf(toolCallId).toEqualTypeOf<string>();
                expectTypeOf(toolName).toEqualTypeOf<string>();
                expectTypeOf(toolTarget).toEqualTypeOf<"server" | "client">();

                return {
                    required: context.tier === "enterprise" || input.amount >= 1_000,
                    timeoutMs: 60_000,
                };
            },
        };

        const reviewCharge = defineTool({
            name: "review_charge",
            schema: {
                type: "object",
                properties: { amount: { type: "number" } },
                required: ["amount"],
                additionalProperties: false,
            } as const,
            approval: billingApproval,
        }).server(async ({ amount }) => ({ approved: amount < 5_000 }));

        expectTypeOf(reviewCharge.name).toEqualTypeOf<"review_charge">();
    });

    test("ToolNamesOf and OpenString preserve known names while allowing unknown strings", () => {
        const lookupAccount = defineTool({
            name: "lookup_account",
            schema: {
                type: "object",
                properties: { accountId: { type: "string" } },
                required: ["accountId"],
            },
        }).server(async () => ({ ok: true }));

        const escalateCase = defineTool({
            name: "escalate_case",
            schema: {
                type: "object",
                properties: { reason: { type: "string" } },
                required: ["reason"],
            },
        }).server(async () => ({ ok: true }));

        type BillingToolName = OpenString<ToolNamesOf<[typeof lookupAccount, typeof escalateCase]>>;

        const knownToolName: BillingToolName = "lookup_account";
        const openWorldToolName: BillingToolName = "runtime_added";

        expectTypeOf(knownToolName).toMatchTypeOf<BillingToolName>();
        expectTypeOf(openWorldToolName).toMatchTypeOf<BillingToolName>();
    });
});
