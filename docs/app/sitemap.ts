import type { MetadataRoute } from "next";

const BASE_URL = "https://better-agent.com";

const routes = [
    "",
    "/docs",
    "/docs/get-started",
    "/docs/concepts",
    "/docs/concepts/agent",
    "/docs/concepts/tools",
    "/docs/concepts/events",
    "/docs/concepts/client",
    "/docs/concepts/auth",
    "/docs/concepts/hil",
    "/docs/concepts/mcp",
    "/docs/concepts/memory",
    "/docs/concepts/plugins",
    "/docs/concepts/state",
    "/docs/concepts/storage",
    "/docs/concepts/structured-output",
    "/docs/concepts/typescript",
    "/docs/database",
    "/docs/database/drizzle",
    "/docs/database/kysely",
    "/docs/database/prisma",
    "/docs/database/redis",
    "/docs/integrations",
    "/docs/integrations/astro",
    "/docs/integrations/elysia",
    "/docs/integrations/express",
    "/docs/integrations/fastify",
    "/docs/integrations/hono",
    "/docs/integrations/nestjs",
    "/docs/integrations/nextjs",
    "/docs/integrations/nuxt",
    "/docs/integrations/remix",
    "/docs/integrations/solidstart",
    "/docs/integrations/sveltekit",
    "/docs/integrations/tanstack-start",
    "/docs/plugins",
    "/docs/plugins/ip-allowlist",
    "/docs/plugins/logging",
    "/docs/plugins/rate-limit",
    "/docs/plugins/sandbox",
    "/docs/providers",
    "/docs/providers/ai-sdk",
    "/docs/providers/anthropic",
    "/docs/providers/gemini",
    "/docs/providers/ollama",
    "/docs/providers/openai",
    "/docs/providers/openrouter",
    "/docs/providers/workers-ai",
    "/docs/providers/xai",
    "/changelog",
];

export default function sitemap(): MetadataRoute.Sitemap {
    const lastModified = new Date();

    return routes.map((route) => ({
        url: `${BASE_URL}${route}`,
        lastModified,
        changeFrequency: route === "" ? "weekly" : "monthly",
        priority: route === "" ? 1 : route === "/docs" ? 0.9 : 0.7,
    }));
}
