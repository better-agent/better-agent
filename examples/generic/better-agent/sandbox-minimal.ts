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
        "Use sandbox tools whenever you need to create files, run commands, or expose a port.",
        "Default to /workspace unless the user asks for another location.",
        "When you start a server, call sandbox_get_host and return the URL to the user.",
    ].join(" "),
});

const sandboxClient = createE2BSandboxClient({
    apiKey: process.env.E2B_API_KEY ?? "your-e2b-api-key",
});

// Swap the client above for Daytona if you want:
// const sandboxClient = createDaytonaSandboxClient({
//     apiKey: process.env.DAYTONA_API_KEY ?? "your-daytona-api-key",
//     target: process.env.DAYTONA_TARGET,
// });

const app = betterAgent({
    agents: [sandboxAgent],
    plugins: [sandboxPlugin({ client: sandboxClient })],
    persistence: {
        stream: createMemoryStreamStore(),
        conversations: createMemoryConversationStore(),
        runtimeState: createMemoryConversationRuntimeStateStore(),
    },
    advanced: {
        onRequestDisconnect: "continue",
    },
});

export default app;
