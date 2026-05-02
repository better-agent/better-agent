import { defineConfig } from "tsdown";
import { betterAgentConfig } from "../../tsdown.base.ts";

export default defineConfig(
    betterAgentConfig({
        entry: [
            "src/index.ts",
            "src/app/index.ts",
            "src/agent/index.ts",
            "src/ag-ui/index.ts",
            "src/schema/index.ts",
            "src/tools/index.ts",
            "src/capabilities/index.ts",
            "src/runtime/index.ts",
            "src/storage/index.ts",
            "src/models/index.ts",
            "src/plugins/index.ts",
            "src/mcp/index.ts",
        ],
        platform: "neutral",
        unbundle: true,
    }),
);
