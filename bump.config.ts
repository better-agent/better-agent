import { defineConfig } from "bumpp";
import { globSync } from "tinyglobby";

export default defineConfig({
    files: globSync(
        [
            "./packages/shared/package.json",
            "./packages/core/package.json",
            "./packages/adapters/package.json",
            "./packages/client/package.json",
            "./packages/providers/package.json",
            "./packages/plugins/package.json",
            "./packages/cli/package.json",
            "./packages/create/package.json",
        ],
        { expandDirectories: false },
    ),
});
