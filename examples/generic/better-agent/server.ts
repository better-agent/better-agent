import {
    betterAgent,
    createMemoryConversationRuntimeStateStore,
    createMemoryConversationStore,
    createMemoryStreamStore,
    defineAgent,
} from "@better-agent/core";

import { createAnthropic } from "@better-agent/providers/anthropic";
import { createOpenAI } from "@better-agent/providers/openai";
import { createXAI } from "@better-agent/providers/xai";
import { sandboxPlugin, createE2BSandboxClient } from "@better-agent/plugins";

const anthropicProvider = createAnthropic({
    apiKey: process.env.ANTHROPIC_API_KEY ?? "your-anthropic-api-key",
});

const openaiProvider = createOpenAI({
    apiKey: process.env.OPENAI_API_KEY ?? "your-openai-api-key",
});

const xaiProvider = createXAI({
    apiKey: process.env.XAI_API_KEY ?? "your-xai-api-key",
});

const anthropic = defineAgent({
    name: "anthropic",
    model: anthropicProvider.text("claude-sonnet-4-6"),
    instruction: "You are a concise, practical assistant. Keep answers clear and direct.",
});

const openai = defineAgent({
    name: "openai",
    model: openaiProvider.model("gpt-4.1"),
    instruction: "You are a concise, practical assistant. Keep answers clear and direct.",
});

const xai = defineAgent({
    name: "xai",
    model: xaiProvider.text("grok-4"),
    instruction: "You are a concise, practical assistant. Keep answers clear and direct.",
});

const app = betterAgent({
    agents: [anthropic, openai, xai],
    plugins: [
        sandboxPlugin({
            client: createE2BSandboxClient({
                apiKey: process.env.E2B_API_KEY ?? "your-e2b-api-key",
            }),
        })
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
