export type FrameworkId =
    | "generic"
    | "nextjs"
    | "remix"
    | "sveltekit"
    | "astro"
    | "nuxt"
    | "tanstack-start"
    | "solidstart"
    | "react-router";

export type InitMode = "create" | "patch";

export type ProviderId = "anthropic" | "openai" | "xai";

export type PluginId = "auth" | "ip-allowlist" | "logging" | "rate-limit";

export interface DetectionResult {
    framework: FrameworkId | null;
    useSrcDir: boolean;
    hasTypeScript: boolean;
}

export interface DirectoryState {
    exists: boolean;
    isEmpty: boolean;
    hasPackageJson: boolean;
}

export interface InitOptions {
    cwd?: string;
    mode?: InitMode;
    name?: string;
    framework?: FrameworkId;
    providers?: ProviderId[];
    plugins?: PluginId[];
    yes?: boolean;
    starterUi?: boolean;
}

export interface TargetFile {
    label: string;
    path: string;
    content: string;
    overwrite?: boolean;
}

export interface FileResult {
    label: string;
    kind: "created" | "exists" | "updated" | "skipped";
}
