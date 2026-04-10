import { defineConfig } from "tsdown";
import { betterAgentConfig } from "../../tsdown.base.ts";

export default defineConfig(
    betterAgentConfig({
        entry: [
            "src/openai/index.ts",
            "src/anthropic/index.ts",
            "src/xai/index.ts",
            "src/openrouter/index.ts",
        ],
        external: [
            "@better-agent/core",
            "@better-agent/core/events",
            "@better-agent/core/providers",
            "@better-agent/shared",
        ],
        platform: "neutral",
    }),
);
