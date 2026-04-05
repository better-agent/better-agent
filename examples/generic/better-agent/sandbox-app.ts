import {
    betterAgent,
    createMemoryConversationRuntimeStateStore,
    createMemoryConversationStore,
    createMemoryStreamStore,
    defineAgent,
} from "@better-agent/core";
import { createE2BSandboxClient, sandboxPlugin } from "@better-agent/plugins";
import { createOpenAI } from "@better-agent/providers/openai";

const openaiProvider = createOpenAI({
    apiKey: process.env.OPENAI_API_KEY ?? "your-openai-api-key",
});

const sandboxAgent = defineAgent({
    name: "sandbox",
    model: openaiProvider.model("gpt-4.1"),
    instruction: [
        "You are a practical coding assistant.",
        "Use sandbox tools whenever you need to create files, run commands, or expose a port.",
        "Default to working inside /workspace unless the user asks for another location.",
        "When you start a server, call sandbox_get_host and return the preview URL to the user.",
        "Explain what you did briefly after the sandbox work succeeds.",
    ].join(" "),
});

const app = betterAgent({
    agents: [sandboxAgent],
    plugins: [
        sandboxPlugin({
            client: createE2BSandboxClient({
                apiKey: process.env.E2B_API_KEY ?? "your-e2b-api-key",
            }),
        }),
    ],
    persistence: {
        stream: createMemoryStreamStore(),
        conversations: createMemoryConversationStore(),
        runtimeState: createMemoryConversationRuntimeStateStore(),
    },
    advanced: {
        onRequestDisconnect: "continue",
    },
});

export { sandboxAgent };
export default app;
