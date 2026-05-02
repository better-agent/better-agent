import {
  betterAgent,
  createInMemoryStorage,
  createMemory,
  defineAgent,
} from "@better-agent/core";
import { createOpenAI } from "@better-agent/openai";

const openaiProvider = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const openai = defineAgent({
  name: "openai",
  model: openaiProvider("gpt-5.1"),
  instruction: "You are helpful agent.",
});

const memory = createMemory({
  storage: createInMemoryStorage(),
  scope: () => "static",
});

const app = betterAgent({
  agents: [openai],
  auth: () => ({ subject: "static" }),
  memory,
  plugins: [],
  basePath: "/api/agents",
});

export default app;
