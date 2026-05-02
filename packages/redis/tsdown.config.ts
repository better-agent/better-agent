import { defineConfig } from "tsdown";
import { betterAgentConfig } from "../../tsdown.base.ts";

export default defineConfig(
    betterAgentConfig({
        entry: ["src/index.ts"],
        platform: "node",
        external: [
            "@better-agent/core",
            "@better-agent/shared",
            "@farming-labs/orm",
            "@farming-labs/orm-redis",
            "redis",
            "@upstash/redis",
        ],
    }),
);
