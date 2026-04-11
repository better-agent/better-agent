import {
  betterAgent,
  createMemoryConversationRuntimeStateStore,
  createMemoryConversationStore,
  createMemoryStreamStore,
  defineAgent,
} from "@better-agent/core";
import {
  createDaytonaSandboxClient,
  rateLimitPlugin,
  sandboxPlugin,
} from "@better-agent/plugins";
import { createAnthropic } from "@better-agent/providers/anthropic";
import { createOpenAI } from "@better-agent/providers/openai";
import { createXAI } from "@better-agent/providers/xai";

const parsePositiveInt = (value: string | undefined): number | undefined => {
  if (!value) return undefined;

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
};

const daytonaTemplate = process.env.DAYTONA_TEMPLATE || "node:20";
const daytonaTemplateKind =
  process.env.DAYTONA_TEMPLATE_KIND === "snapshot"
    ? "snapshot"
    : process.env.DAYTONA_TEMPLATE_KIND === "image"
      ? "image"
      : daytonaTemplate === "node:20"
        ? "image"
        : undefined;

const daytonaTimeoutMs = parsePositiveInt(process.env.DAYTONA_TIMEOUT_MS) ?? 180_000;

const openaiProvider = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY ?? "your-openai-api-key",
});

const anthropicProvider = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY ?? "your-anthropic-api-key",
});

const xaiProvider = createXAI({
  apiKey: process.env.XAI_API_KEY ?? "your-xai-api-key",
});

const instruction =
  "You are a concise, practical assistant. Keep answers clear and direct. When sandbox tools are available, use them to inspect files, run commands, write code, and expose preview URLs inside Daytona sandboxes.";

const openai = defineAgent({
  name: "openai",
  model: openaiProvider.model("gpt-5.4"),
  instruction,
});

const anthropic = defineAgent({
  name: "anthropic",
  model: anthropicProvider.text("claude-sonnet-4-6"),
  instruction,
});

const xai = defineAgent({
  name: "xai",
  model: xaiProvider.text("grok-4"),
  instruction,
});

const app = betterAgent({
  agents: [openai, anthropic, xai],
  plugins: [
    rateLimitPlugin({
      windowMs: 60_000,
      max: 30,
    }),
    sandboxPlugin({
      client: createDaytonaSandboxClient({
        apiKey: process.env.DAYTONA_API_KEY,
        apiUrl: process.env.DAYTONA_API_URL || undefined,
        target: process.env.DAYTONA_TARGET || undefined,
        template: daytonaTemplate,
        templateKind: "snapshot",
        timeoutMs: daytonaTimeoutMs,
        public: process.env.DAYTONA_PUBLIC === "true",
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
