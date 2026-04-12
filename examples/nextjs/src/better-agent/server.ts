import {
    betterAgent,
    createMemoryConversationRuntimeStateStore,
    createMemoryConversationStore,
    createMemoryStreamStore,
    defineAgent,
} from "@better-agent/core";

import { createE2BSandboxClient, rateLimitPlugin, sandboxPlugin } from "@better-agent/plugins";
import { createOpenRouter } from "@better-agent/providers/openrouter";

const openrouterProvider = createOpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY ?? "your-openrouter-api-key",
    siteURL: process.env.OPENROUTER_SITE_URL ?? "http://localhost:3000",
    appName: process.env.OPENROUTER_APP_NAME ?? "better-agent-nextjs-demo",
});

const conciseInstruction = "You are a concise, practical assistant. Keep answers clear and direct.";

const searchInstruction = `${conciseInstruction} Use web search when the user asks for current or recent information.`;

const openrouterText = defineAgent({
    name: "openrouter-text",
    model: openrouterProvider.text("openai/gpt-5.4-mini"),
    instruction: conciseInstruction,
});

const openrouterSearch = defineAgent({
    name: "openrouter-search",
    model: openrouterProvider.text("openai/gpt-5.4-mini"),
    instruction: searchInstruction,
    tools: [openrouterProvider.tools.webSearch({ search_context_size: "medium" })],
});

const openrouterFile = defineAgent({
    name: "openrouter-file",
    model: openrouterProvider.text("openai/gpt-5.4-mini"),
    instruction: `${conciseInstruction} Read uploaded files when present and answer from their contents.`,
});

const openrouterAudio = defineAgent({
    name: "openrouter-audio",
    model: openrouterProvider.text("openai/gpt-4o-audio-preview"),
    instruction: `${conciseInstruction} When audio is provided, transcribe it, summarize it when useful, and respond clearly.`,
    defaultModalities: ["text", "audio"] as const,
});

const openrouterImage = defineAgent({
    name: "openrouter-image",
    model: openrouterProvider.image("google/gemini-3.1-flash-image-preview"),
    defaultModalities: ["image"] as const,
});

const app = betterAgent({
    agents: [
        openrouterText,
        openrouterSearch,
        openrouterFile,
        openrouterAudio,
        openrouterImage,
    ],
    plugins: [
        rateLimitPlugin({
            windowMs: 60_000,
            max: 30,
        }),
        sandboxPlugin({
            client: createE2BSandboxClient({
                apiKey: process.env.E2B_API_KEY,
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
    baseURL: "/agents",
    secret: process.env.BETTER_AGENT_SECRET ?? "your-secret-here",
});

export default app;
