import { defineConfig } from "tsdown";
import { betterAgentConfig } from "../../tsdown.base.ts";

export default defineConfig(
    betterAgentConfig({
        entry: ["src/errors.ts", "src/logger.ts", "src/types.ts", "src/utils.ts"],
        platform: "neutral",
    }),
);
