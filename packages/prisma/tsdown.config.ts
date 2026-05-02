import { defineConfig } from "tsdown";
import { betterAgentConfig } from "../../tsdown.base.ts";

export default defineConfig(
    betterAgentConfig({
        entry: ["src/index.ts", "src/cli.ts"],
        platform: "node",
        external: ["@better-agent/core", "@better-agent/shared", "@prisma/client", "prisma"],
    }),
);
