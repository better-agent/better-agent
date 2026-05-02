import { defineConfig } from "tsdown";
import { betterAgentConfig } from "../../tsdown.base.ts";

export default defineConfig(
    betterAgentConfig({
        entry: ["src/index.ts"],
        external: ["@better-agent/ai-sdk", "@better-agent/core", "ai", "workers-ai-provider"],
        platform: "neutral",
    }),
);
