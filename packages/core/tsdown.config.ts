import { defineConfig } from "tsdown";
import { betterAgentConfig } from "../../tsdown.base.ts";

export default defineConfig(
    betterAgentConfig({
        entry: [
            "src/index.ts",
            "src/events/index.ts",
            "src/server/index.ts",
            "src/persistence/index.ts",
            "src/providers/index.ts",
            "src/mcp/index.ts",
        ],
        platform: "neutral",
        unbundle: true,
    }),
);
