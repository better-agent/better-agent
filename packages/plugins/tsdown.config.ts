import { defineConfig } from "tsdown";
import { betterAgentConfig } from "../../tsdown.base.ts";

export default defineConfig(
    betterAgentConfig({
        entry: ["src/index.ts"],
        external: ["@better-agent/core", "@better-agent/shared"],
        platform: "neutral",
    }),
);
