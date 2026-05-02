import { defineConfig } from "tsdown";
import { betterAgentConfig } from "../../tsdown.base.ts";

export default defineConfig(
    betterAgentConfig({
        entry: ["src/index.ts"],
        external: ["@ai-sdk/openai-compatible", "@better-agent/ai-sdk", "@better-agent/core", "ai"],
        platform: "neutral",
    }),
);
