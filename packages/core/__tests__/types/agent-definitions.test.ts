import { describe, expectTypeOf, test } from "bun:test";
import { defineAgent, defineTool } from "../../src";
import type {
    AgentContext,
    AgentInstruction,
    AgentModelCaps,
    AgentOutputSchema,
    AgentStructuredOutput,
    AgentTools,
    AnyAgentDefinition,
    GenerativeModel,
    ToolApprovalConfig,
} from "../../src";

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

type StructuredTextModel = GenerativeModel<
    Record<string, never>,
    "test",
    "structured-text",
    {
        inputModalities: { text: true };
        inputShape: "chat";
        outputModalities: { text: true };
        structured_output: true;
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

describe("agent definitions typing", () => {
    const lookupAccount = defineTool({
        name: "lookup_account",
        schema: {
            type: "object",
            properties: { accountId: { type: "string" } },
            required: ["accountId"],
            additionalProperties: false,
        } as const,
    }).server(async ({ accountId }) => ({ accountId }));

    const hostedLookupTool = {
        kind: "hosted" as const,
        provider: "test",
        type: "lookup_account",
        config: {},
    };

    const billingAgent = defineAgent({
        name: "billing",
        model: {} as ToolSupportModel,
        contextSchema: {
            type: "object",
            properties: { accountId: { type: "string" }, tier: { type: "string" } },
            required: ["accountId", "tier"],
            additionalProperties: false,
        },
        instruction: ({ accountId, tier }) => `Handle billing for ${accountId} on ${tier}.`,
        tools: hostedLookupTool,
    });

    const reportAgent = defineAgent({
        name: "report",
        model: {} as StructuredTextModel,
        contextSchema: {
            type: "object",
            properties: { reportId: { type: "string" } },
            required: ["reportId"],
            additionalProperties: false,
        },
        outputSchema: {
            schema: {
                type: "object",
                properties: { summary: { type: "string" } },
                required: ["summary"],
                additionalProperties: false,
            } as const,
        },
    });

    test("context, instruction, tools, and structured output infer correctly", () => {
        const anyAgentOk: AnyAgentDefinition = billingAgent;
        const billingContextOk: AgentContext<typeof billingAgent> = {
            accountId: "acct_123",
            tier: "pro",
        };
        const reportStructuredOk: AgentStructuredOutput<typeof reportAgent> = {
            summary: "ready",
        };
        const instructionOk: AgentInstruction<
            AgentContext<typeof billingAgent>,
            AgentModelCaps<ToolSupportModel>
        > = ({ accountId }) => `Billing for ${accountId}`;
        const agentToolsOk: AgentTools<AgentContext<typeof billingAgent>> = (context) => {
            if (context) void context.accountId;
            return hostedLookupTool;
        };
        const reportOutputSchemaOk: NonNullable<AgentOutputSchema<typeof reportAgent>> = {
            schema: {
                type: "object",
                properties: { summary: { type: "string" } },
                required: ["summary"],
                additionalProperties: false,
            } as const,
        };

        expectTypeOf(anyAgentOk).toMatchTypeOf<AnyAgentDefinition>();
        expectTypeOf(billingContextOk).toMatchTypeOf<AgentContext<typeof billingAgent>>();
        expectTypeOf(reportStructuredOk).toMatchTypeOf<AgentStructuredOutput<typeof reportAgent>>();
        expectTypeOf(instructionOk).toMatchTypeOf<
            AgentInstruction<AgentContext<typeof billingAgent>, AgentModelCaps<ToolSupportModel>>
        >();
        expectTypeOf(agentToolsOk).toMatchTypeOf<AgentTools<AgentContext<typeof billingAgent>>>();
        expectTypeOf(reportOutputSchemaOk).toMatchTypeOf<
            NonNullable<AgentOutputSchema<typeof reportAgent>>
        >();
        void lookupAccount;
    });

    test("inline tool approvals can see agent context through the tools field", () => {
        defineAgent({
            name: "support-inline-tools",
            model: {} as ToolSupportModel,
            contextSchema: {
                type: "object",
                properties: { role: { type: "string" } },
                required: ["role"],
                additionalProperties: false,
            } as const,
            tools: [
                defineTool({
                    name: "escalate_ticket",
                    schema: {
                        type: "object",
                        properties: { ticketId: { type: "string" } },
                        required: ["ticketId"],
                        additionalProperties: false,
                    } as const,
                    approval: {
                        resolve: ({ context, input }) => {
                            expectTypeOf(context.role).toMatchTypeOf<string>();
                            expectTypeOf(input.ticketId).toEqualTypeOf<string>();

                            return {
                                required: context.role === "reviewer",
                            };
                        },
                    },
                }).server(async ({ ticketId }) => ({ ticketId })),
            ],
        });
    });

    test("defined agents erase stored tool context but preserve literal tool metadata", () => {
        const schema = {
            type: "object",
            properties: { ticketId: { type: "string" } },
            required: ["ticketId"],
            additionalProperties: false,
        } as const;

        const approval: ToolApprovalConfig<{ role: string }, { ticketId: string }> = {
            resolve: () => ({
                required: true,
            }),
        };

        const contextualTool = defineTool({
            name: "escalate_ticket",
            schema,
            approval,
        }).server(async ({ ticketId }) => ({ ticketId }));

        const agent = defineAgent({
            name: "support-erased-tools",
            model: {} as ToolSupportModel,
            contextSchema: {
                type: "object",
                properties: { role: { type: "string" } },
                required: ["role"],
                additionalProperties: false,
            } as const,
            tools: [contextualTool] as const,
        });

        const toolsOk: typeof agent.tools = [contextualTool] as const;
        void toolsOk;
    });

    test("invalid output schema and invalid context fields fail type checks", () => {
        defineAgent({
            name: "invalid_output",
            model: {} as PlainTextModel,
            // @ts-expect-error plain-text models should not expose outputSchema in defineAgent config.
            outputSchema: {
                schema: {
                    type: "object",
                    properties: { summary: { type: "string" } },
                    required: ["summary"],
                    additionalProperties: false,
                } as const,
            },
        });

        defineAgent({
            name: "invalid_tools",
            model: {} as PlainTextModel,
            // @ts-expect-error non-tool models should not expose tools in defineAgent config.
            tools: hostedLookupTool,
        });

        defineAgent({
            name: "invalid_tool_error_mode",
            model: {} as PlainTextModel,
            // @ts-expect-error non-tool models should not expose toolErrorMode in defineAgent config.
            toolErrorMode: "tool_error",
        });

        defineAgent({
            name: "invalid_on_tool_error",
            model: {} as PlainTextModel,
            // @ts-expect-error non-tool models should not expose onToolError in defineAgent config.
            onToolError() {
                return { action: "throw" as const };
            },
        });

        defineAgent({
            name: "invalid_instruction",
            model: {} as AudioOnlyModel,
            // @ts-expect-error non-text-input models should not expose instruction in defineAgent config.
            instruction: "transcribe this",
        });

        const billingContextBad: AgentContext<typeof billingAgent> = {
            // @ts-expect-error billing context should not accept ticketId.
            ticketId: "ticket_123",
        };
        void billingContextBad;

        const neverRun = false as boolean;
        if (neverRun) {
            defineAgent({
                name: "invalid_conversation_replay_null",
                model: {} as PlainTextModel,
                conversationReplay: {
                    // @ts-expect-error agent defaults should not allow prepareInput: null.
                    prepareInput: null,
                },
            });

            const billingStructuredBad = null as unknown as AgentStructuredOutput<
                typeof billingAgent
            >;
            // @ts-expect-error billingAgent has no default structured output schema.
            billingStructuredBad.summary;
        }
    });
});
