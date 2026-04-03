import { defineConfig } from "tsdown";
import { betterAgentConfig } from "../../tsdown.base.ts";

export default defineConfig(
    betterAgentConfig({
        entry: ["src/index.ts", "src/express.ts", "src/fastify.ts"],
        external: ["@better-agent/core", "node:events", "node:stream"],
        platform: "neutral",
        unbundle: true,
    }),
);
