import { defineConfig } from "tsdown";
import { betterAgentConfig } from "../../tsdown.base.ts";

export default defineConfig(
    betterAgentConfig({
        entry: [
            "src/index.ts",
            "src/react/index.ts",
            "src/preact/index.ts",
            "src/svelte/index.ts",
            "src/vue/index.ts",
            "src/solid/index.ts",
        ],
        platform: "browser",
    }),
);
