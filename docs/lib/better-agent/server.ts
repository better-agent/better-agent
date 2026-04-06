import { betterAgent, defineAgent } from "@better-agent/core";
import { rateLimitPlugin } from "@better-agent/plugins";
import { createOpenAI } from "@better-agent/providers/openai";
import { z } from "zod";
import { context7Tools } from "./mcp";

const openai = createOpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

const askDocs = defineAgent({
    name: "askDocs",
    description: "Answers questions about Better Agent using Better Agent docs from Context7.",
    model: openai.text("gpt-5-mini"),
    contextSchema: z
        .object({
            url: z.string().optional(),
            title: z.string().optional(),
        })
        .optional(),
    maxSteps: 4,
    instruction: (context) => `You are a friendly and helpful assistant for Better Agent.
${context?.url ? `\nThe user is currently viewing the page: ${context.title ? `${context.title} (${context.url})` : context.url}. Prioritize this context if relevant.\n` : ""}
Your goal is to provide very short, straight-to-the-point answers based only on the Better Agent documentation.

Rules:
- Be friendly but extremely concise.
- No fluff, no long introductions, and no emojis.
- Provide the answer directly and immediately.
- Use the provided tools to search the documentation.
- If the documentation doesn't have the answer, state that clearly without speculation.
- Never mention tool names, MCP, or internal processes you used to find the answer.
- Use markdown for formatting, but keep code blocks minimal and only when necessary.
- When you find an answer using the tools, append a small sources section at the bottom under the exact heading \`### Sources\` with a bulleted list of minimal, monospaced links (e.g. [\`page name\`](url)) to the specific documentation pages or GitHub files you used.

GitHub repository (https://github.com/better-agent/better-agent)
`,
    tools: context7Tools,
});

const app = betterAgent({
    agents: [askDocs],
    plugins: [
        rateLimitPlugin({
            windowMs: Number(process.env.ASK_AI_RATE_LIMIT_WINDOW_MS ?? 60_000),
            max: Number(process.env.ASK_AI_RATE_LIMIT_MAX ?? 20),
            key: ({ agentName, request }) =>
                `${agentName}:${
                    request.headers
                        .get("cookie")
                        ?.split(";")
                        .find((part) => part.trim().startsWith("ask_ai_session="))
                        ?.split("=")[1] || "anonymous"
                }`,
        }),
    ],
    baseURL: "/agents",
    secret: process.env.BETTER_AGENT_SECRET,
});

export default app;
