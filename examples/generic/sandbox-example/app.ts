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

const modelId = process.env.SANDBOX_EXAMPLE_MODEL ?? "gpt-4.1";

const sandboxAgent = defineAgent({
    name: "sandbox",
    model: openaiProvider.model(modelId),
    instruction: [
        "You can use sandbox tools to create files, run commands, and expose ports.",
        "Default to /workspace unless the user asks for another location.",
        "When you run an app server, start it in the background so the shell command returns instead of hanging.",
        'For long-running servers, prefer commands like `bash -lc "node server.js >/tmp/server.log 2>&1 & echo $!"`.',
        "After starting a server, verify the port locally from inside the sandbox before calling sandbox_get_host.",
        "When you call sandbox_get_host, return the exact URL you received.",
    ].join(" "),
});

const sandboxClient = createE2BSandboxClient({
    apiKey: process.env.E2B_API_KEY ?? "your-e2b-api-key",
});

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
