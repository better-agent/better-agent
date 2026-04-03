import "./setup";
import { describe, test } from "bun:test";
import { defineTool } from "@better-agent/core";
import type { GenerativeModel } from "@better-agent/core/providers";
import { createClient } from "../src/core/client";
import type { UseAgentOptions } from "../src/react/types";
import type { UseAgentResult } from "../src/react/types";
import type { AgentChatStore } from "../src/svelte/types";
import type { BetterAgentClient, RunInputForAgent } from "../src/types/client";
import type { AgentChatControllerOptions } from "../src/types/controller";
import type { SubmitInput } from "../src/types/controller";

type WriterModel = GenerativeModel<
    {
        temperature?: number;
    },
    "test",
    "writer",
    {
        inputModalities: { text: true };
        inputShape: "chat";
        outputModalities: {
            text: { options: { textStyle?: "short" | "long" } };
            image: { options: { imageQuality?: "standard" | "hd" } };
        };
    }
>;

type AudioOnlyModel = GenerativeModel<
    Record<string, never>,
    "test",
    "audio-only",
    {
        inputModalities: { audio: true; text: false };
        inputShape: "prompt";
        outputModalities: { audio: true };
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

type ToolSupportModel = GenerativeModel<
    Record<string, never>,
    "test",
    "tool-support",
    {
        inputModalities: { text: true };
        inputShape: "chat";
        outputModalities: { text: true };
        tools: true;
    }
>;

const extractorSchema = {
    schema: {
        type: "object",
        properties: {
            ok: { type: "boolean" },
        },
        required: ["ok"],
        additionalProperties: false,
    } as const,
} as const;

const supportContextSchema = {
    type: "object",
    properties: {
        role: {
            type: "string",
            enum: ["admin", "support"],
        },
    },
    required: ["role"],
    additionalProperties: false,
} as const;

type EmptyObject = Record<string, never>;

const emptyToolSchema = {
    "~standard": {
        version: 1,
        vendor: "test",
        types: {
            input: {} as Record<string, never>,
            output: {} as Record<string, never>,
        },
        jsonSchema: {
            input() {
                return {
                    type: "object",
                    properties: {},
                    additionalProperties: false,
                };
            },
            output() {
                return {
                    type: "object",
                    properties: {},
                    additionalProperties: false,
                };
            },
        },
    },
} as const;

type TestApp = {
    config: {
        agents: readonly [
            { name: "writer"; model: WriterModel },
            { name: "audio"; model: AudioOnlyModel },
            {
                name: "extractor";
                model: StructuredModel;
                outputSchema: typeof extractorSchema;
            },
        ];
    };
};

type PortableGeneratedApp = {
    config: {
        agents: readonly [
            {
                name: "portable";
                model: StructuredModel & ToolSupportModel;
                contextSchema: {
                    role: "admin" | "support";
                };
                outputSchema: {
                    schema: {
                        actions: "Send Email" | "Get client time";
                    };
                };
                tools: readonly [
                    {
                        kind: "client";
                        name: "getClientTime";
                        schema: {
                            why: string;
                        };
                    },
                ];
            },
        ];
    };
};

describe("client typing", () => {
    test("run input follows the selected agent input capabilities", () => {
        const writerInputOk = { input: "Draft a caption." } satisfies RunInputForAgent<
            TestApp,
            "writer"
        >;

        const audioInputOk = {
            input: [
                {
                    type: "message" as const,
                    content: [
                        {
                            type: "audio" as const,
                            source: { kind: "url" as const, url: "https://example.com/clip.mp3" },
                        },
                    ],
                },
            ],
        } satisfies RunInputForAgent<TestApp, "audio">;

        const writerInputCheck: RunInputForAgent<TestApp, "writer"> = writerInputOk;
        const audioInputCheck: RunInputForAgent<TestApp, "audio"> = audioInputOk;
        void writerInputCheck;
        void audioInputCheck;

        // @ts-expect-error audio-only models should not accept plain string input.
        const audioInputBad: RunInputForAgent<TestApp, "audio"> = { input: "hello" };
        void audioInputBad;
    });

    test("modalities narrow modelOptions on the typed client and submit input", () => {
        const writerTextSubmit = {
            input: "Draft a caption.",
            modalities: ["text"] as const,
            modelOptions: { temperature: 0.2, textStyle: "short" as const },
        } satisfies SubmitInput<TestApp, "writer", readonly ["text"]>;

        const writerImageSubmit = {
            input: "Render a poster.",
            modalities: ["image"] as const,
            modelOptions: { temperature: 0.1, imageQuality: "hd" as const },
        } satisfies SubmitInput<TestApp, "writer", readonly ["image"]>;

        const writerTextSubmitCheck: SubmitInput<TestApp, "writer", readonly ["text"]> =
            writerTextSubmit;
        const writerImageSubmitCheck: SubmitInput<TestApp, "writer", readonly ["image"]> =
            writerImageSubmit;
        void writerTextSubmitCheck;
        void writerImageSubmitCheck;

        const assertClientTyping = (client: BetterAgentClient<TestApp>) => {
            client.run("writer", {
                input: "Draft a caption.",
                modalities: ["text"],
                modelOptions: { textStyle: "short", temperature: 0.2 },
            });

            client.stream("writer", {
                input: "Render a poster.",
                modalities: ["image"],
                modelOptions: { imageQuality: "hd" },
            });

            // Unknown model options keys are accepted as passthrough to the provider
            // (they resolve to `unknown` via the Record<string, unknown> escape hatch).
            client.run("writer", {
                input: "Draft a caption.",
                modalities: ["text"],
                modelOptions: { imageQuality: "hd" },
            });

            client.stream("writer", {
                input: "Render a poster.",
                modalities: ["image"],
                modelOptions: { textStyle: "short" },
            });
        };

        void assertClientTyping;
    });

    test("wrapper sendMessage shorthand is only available for text-input agents", () => {
        const assertWrapperTyping = () => {
            const reactWriter = null as unknown as UseAgentResult<TestApp, "writer">;
            const reactAudio = null as unknown as UseAgentResult<TestApp, "audio">;
            const svelteWriter = null as unknown as AgentChatStore<TestApp, "writer">;
            const svelteAudio = null as unknown as AgentChatStore<TestApp, "audio">;

            reactWriter.sendMessage("Draft a caption.");
            svelteWriter.sendMessage("Draft a caption.");

            reactAudio.sendMessage({
                input: [
                    {
                        type: "message",
                        content: [
                            {
                                type: "audio",
                                source: {
                                    kind: "url",
                                    url: "https://example.com/clip.mp3",
                                },
                            },
                        ],
                    },
                ],
            });

            // @ts-expect-error audio-only agents should not expose string shorthand in React.
            reactAudio.sendMessage("hello");

            // @ts-expect-error audio-only agents should not expose string shorthand in Svelte.
            svelteAudio.sendMessage("hello");
        };

        void assertWrapperTyping;
    });

    test("typed client run result requires structured when the agent has outputSchema", () => {
        const assertClientTyping = async (client: BetterAgentClient<TestApp>) => {
            const result = await client.run("extractor", {
                input: "Extract whether this is valid.",
            });

            result.structured.ok;
        };

        void assertClientTyping;
    });

    test("typed client run result stays unstructured when the agent has no outputSchema", () => {
        const assertClientTyping = async (client: BetterAgentClient<TestApp>) => {
            const result = await client.run("writer", {
                input: "Draft a caption.",
            });

            // @ts-expect-error writer run result should not expose structured output.
            result.structured;
        };

        void assertClientTyping;
    });

    test("useAgent and controller onFinish expose typed structured output for structured agents", () => {
        const hookOptions: UseAgentOptions<TestApp, "extractor"> = {
            agent: "extractor",
            onFinish: (params) => {
                params.structured.ok;
            },
        };

        const controllerOptions: AgentChatControllerOptions<TestApp, "extractor"> = {
            agent: "extractor",
            onFinish: (params) => {
                params.structured.ok;
            },
        };

        void hookOptions;
        void controllerOptions;
    });

    test("useAgent and controller onFinish stay unstructured for agents without outputSchema", () => {
        const hookOptions: UseAgentOptions<TestApp, "writer"> = {
            agent: "writer",
            onFinish: (params) => {
                // @ts-expect-error writer onFinish should not expose structured output.
                params.structured;
            },
        };

        const controllerOptions: AgentChatControllerOptions<TestApp, "writer"> = {
            agent: "writer",
            onFinish: (params) => {
                // @ts-expect-error writer onFinish should not expose structured output.
                params.structured;
            },
        };

        void hookOptions;
        void controllerOptions;
    });

    test("typed client preserves optional contextSchema and client tool schema from a real app", () => {
        const getClientTime = defineTool({
            name: "getClientTime",
            schema: emptyToolSchema,
        }).client();

        type SupportApp = {
            config: {
                agents: readonly [
                    {
                        name: "support";
                        model: ToolSupportModel;
                        contextSchema: typeof supportContextSchema;
                        tools: readonly [typeof getClientTime];
                    },
                ];
            };
        };

        const client = createClient<SupportApp>({
            baseURL: "/agents",
            secret: "test-secret",
            toolHandlers: {
                getClientTime: (input) => {
                    input satisfies EmptyObject;
                    return { now: "2026-04-02T00:00:00.000Z" };
                },
            },
        });

        const hookOptions: UseAgentOptions<SupportApp, "support"> = {
            agent: "support",
            context: {
                role: "support",
            },
        };

        const assertClientTyping = (typedClient: typeof client) => {
            typedClient.run("support", {
                input: "Hello",
                context: {
                    role: "admin",
                },
            });
        };

        void hookOptions;
        void assertClientTyping;
    });

    test("typed client requires context when the agent has a context schema", () => {
        const getClientTime = defineTool({
            name: "getClientTime",
            schema: emptyToolSchema,
        }).client();

        type SupportRequiredContextApp = {
            config: {
                agents: readonly [
                    {
                        name: "support_required_context";
                        model: ToolSupportModel;
                        contextSchema: typeof supportContextSchema;
                        tools: readonly [typeof getClientTime];
                    },
                ];
            };
        };

        const client = createClient<SupportRequiredContextApp>({
            baseURL: "/agents",
            secret: "test-secret",
        });

        const runInputOk: RunInputForAgent<SupportRequiredContextApp, "support_required_context"> =
            {
                input: "Hello",
                context: {
                    role: "admin",
                },
            };

        const hookOptions: UseAgentOptions<SupportRequiredContextApp, "support_required_context"> =
            {
                agent: "support_required_context",
                context: {
                    role: "support",
                },
            };

        const controllerOptions: AgentChatControllerOptions<
            SupportRequiredContextApp,
            "support_required_context"
        > = {
            agent: "support_required_context",
            context: {
                role: "support",
            },
        };

        const neverRun = false as boolean;
        if (neverRun) {
            // @ts-expect-error context should be required for typed client runs.
            client.run("support_required_context", {
                input: "Hello",
            });

            // @ts-expect-error context should be required for useAgent options.
            const missingHookContext: UseAgentOptions<
                SupportRequiredContextApp,
                "support_required_context"
            > = { agent: "support_required_context" };

            // @ts-expect-error context should be required for controller options.
            const missingControllerContext: AgentChatControllerOptions<
                SupportRequiredContextApp,
                "support_required_context"
            > = { agent: "support_required_context" };

            void missingHookContext;
            void missingControllerContext;
        }

        void hookOptions;
        void controllerOptions;
        void runInputOk;
    });

    test("portable generated app types preserve context, structured output, and tool input", () => {
        const client = createClient<PortableGeneratedApp>({
            baseURL: "/agents",
            secret: "test-secret",
            toolHandlers: {
                getClientTime: (input) => {
                    input.why satisfies string;
                    return { now: "2026-04-03T00:00:00.000Z" };
                },
            },
        });

        const hookOptions: UseAgentOptions<PortableGeneratedApp, "portable"> = {
            agent: "portable",
            context: {
                role: "support",
            },
            onFinish: (params) => {
                params.structured.actions satisfies "Send Email" | "Get client time";
            },
        };

        const runInputOk: RunInputForAgent<PortableGeneratedApp, "portable"> = {
            input: "Hello",
            context: {
                role: "admin",
            },
        };

        const assertClientTyping = async (typedClient: typeof client) => {
            const result = await typedClient.run("portable", {
                input: "Hello",
                context: {
                    role: "support",
                },
            });

            result.structured.actions satisfies "Send Email" | "Get client time";
        };

        void hookOptions;
        void runInputOk;
        void assertClientTyping;
    });
});
