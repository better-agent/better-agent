import type { UserConfig } from "tsdown";

export function betterAgentConfig(overrides: Partial<UserConfig> = {}): UserConfig {
    return {
        // output format
        format: ["esm"],
        target: "es2022",
        platform: "node",
        outDir: "dist",

        // build hygiene
        sourcemap: true,
        clean: true,
        treeshake: true,
        fixedExtension: true,

        // types emit
        dts: { build: true, incremental: true },

        // quality gates
        publint: true,
        attw: {
            enabled: true,
            profile: "esm-only",
            level: "error",
        },

        ...overrides,
    };
}
