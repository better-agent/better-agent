import type { ToolApprovalConfig } from "@better-agent/core";

/** Parameters for creating a sandbox. */
export interface SandboxCreateParams {
    /** Optional provider-specific template identifier. */
    template?: string;
    /** Maximum sandbox lifetime in milliseconds. */
    timeoutMs?: number;
    /** Environment variables applied to the sandbox. */
    envs?: Record<string, string>;
    /** Provider metadata stored with the sandbox, when supported. */
    metadata?: Record<string, string>;
}

/** Sandbox instance metadata returned by drivers. */
export interface SandboxInstance {
    sandboxId: string;
}

/** Preview URL information for a running app inside a sandbox. */
export interface SandboxPreviewInfo {
    url: string;
    token?: string;
}

/** High-level sandbox capability map for provider adapters. */
export interface SandboxCapabilities {
    commands?: true;
    filesystem?: true;
    preview?: true;
    pty?: true;
    desktop?: true;
    mcp?: true;
    git?: true;
    snapshots?: true;
    volumes?: true;
    lifecycle?: {
        start?: true;
        stop?: true;
        archive?: true;
        resume?: true;
    };
}

/** Parameters for running a command inside a sandbox. */
export interface SandboxCommandParams {
    sandboxId: string;
    cmd: string;
    cwd?: string;
    timeoutMs?: number;
    envs?: Record<string, string>;
}

/** Result returned after running a command in a sandbox. */
export interface SandboxCommandResult {
    exitCode?: number;
    stdout?: string;
    stderr?: string;
    pid?: number;
}

/** Parameters for reading a file from a sandbox. */
export interface SandboxReadFileParams {
    sandboxId: string;
    path: string;
}

/** Parameters for writing a file into a sandbox. */
export interface SandboxWriteFileParams {
    sandboxId: string;
    path: string;
    content: string;
}

/** Directory entry returned by sandbox list operations. */
export interface SandboxFileEntry {
    name: string;
    path: string;
    type?: string;
}

/** Parameters for listing a directory in a sandbox. */
export interface SandboxListFilesParams {
    sandboxId: string;
    path: string;
}

/** Parameters for creating a directory in a sandbox. */
export interface SandboxMakeDirParams {
    sandboxId: string;
    path: string;
}

/** Parameters for removing a file or directory in a sandbox. */
export interface SandboxRemovePathParams {
    sandboxId: string;
    path: string;
}

/** Parameters for exposing one sandbox port to the outside world. */
export interface SandboxGetHostParams {
    sandboxId: string;
    port: number;
}

/** Parameters for terminating a sandbox. */
export interface SandboxKillParams {
    sandboxId: string;
}

/** Optional lifecycle operations supported by richer sandbox providers. */
export interface SandboxLifecycleClient {
    startSandbox?(params: { sandboxId: string; timeoutMs?: number }): Promise<void>;
    stopSandbox?(params: { sandboxId: string; timeoutMs?: number; force?: boolean }): Promise<void>;
    archiveSandbox?(params: { sandboxId: string }): Promise<void>;
}

/** Optional PTY operations supported by richer sandbox providers. */
export interface SandboxPTYClient {
    createSession?(params: {
        sandboxId: string;
        sessionId: string;
        cwd?: string;
        cols?: number;
        rows?: number;
        envs?: Record<string, string>;
        onData?: (data: Uint8Array) => Promise<void> | void;
    }): Promise<{
        sessionId: string;
        exitCode?: number;
        error?: string;
    }>;
}

/** Optional desktop/computer-use operations supported by richer providers. */
export interface SandboxDesktopClient {
    startDesktop?(params: { sandboxId: string }): Promise<void>;
    stopDesktop?(params: { sandboxId: string }): Promise<void>;
    screenshot?(params: { sandboxId: string }): Promise<{
        data: string;
        mimeType?: string;
    }>;
}

/** Client used by `sandboxPlugin` to talk to a sandbox provider. */
export interface SandboxClient {
    /** Optional provider identifier for diagnostics and future tool generation. */
    provider?: string;
    /** Capability metadata used to understand richer provider integrations. */
    capabilities?: SandboxCapabilities;
    createSandbox(params?: SandboxCreateParams): Promise<SandboxInstance>;
    runCommand(params: SandboxCommandParams): Promise<SandboxCommandResult>;
    readFile(params: SandboxReadFileParams): Promise<string>;
    writeFile(params: SandboxWriteFileParams): Promise<{
        path: string;
    }>;
    listFiles(params: SandboxListFilesParams): Promise<SandboxFileEntry[]>;
    makeDir(params: SandboxMakeDirParams): Promise<{
        created: boolean;
    }>;
    removePath(params: SandboxRemovePathParams): Promise<void>;
    getHost(params: SandboxGetHostParams): Promise<string | SandboxPreviewInfo>;
    killSandbox(params: SandboxKillParams): Promise<void>;
    lifecycle?: SandboxLifecycleClient;
    pty?: SandboxPTYClient;
    desktop?: SandboxDesktopClient;
}

/** Backwards-compatible alias for the older name. */
export type SandboxDriver = SandboxClient;

/** Persistent mapping between one logical session key and one sandbox id. */
export interface SandboxSessionStore {
    get(key: string): Promise<string | null>;
    set(key: string, sandboxId: string): Promise<void>;
    delete(key: string): Promise<void>;
}

/** Context used when resolving the sandbox session key for one tool run. */
export interface SandboxSessionKeyContext {
    runId: string;
    agentName: string;
    conversationId?: string;
    toolName: string;
}

/** Per-tool approval overrides for the sandbox plugin. */
export interface SandboxToolApprovals {
    exec?: ToolApprovalConfig;
    writeFile?: ToolApprovalConfig;
    removePath?: ToolApprovalConfig;
    killSandbox?: ToolApprovalConfig;
}

/** Configuration for `sandboxPlugin`. */
export interface SandboxPluginConfig {
    /** Plugin id. */
    id?: string;
    /** Prefix used when naming generated tools. Defaults to `"sandbox"`. */
    prefix?: string;
    /** Client implementation for the sandbox provider. */
    client?: SandboxClient;
    /** Backwards-compatible alias for `client`. */
    driver?: SandboxDriver;
    /** Optional store for persisting conversation-scoped sandbox ids. */
    store?: SandboxSessionStore;
    /**
     * Optional session-key resolver.
     *
     * When omitted, the plugin reuses one sandbox per `conversationId`.
     * Returning `null` or `undefined` disables automatic sandbox reuse for the call.
     */
    sessionKey?: (ctx: SandboxSessionKeyContext) => string | null | undefined;
    /** Default sandbox creation options applied when a sandbox is auto-created. */
    defaults?: SandboxCreateParams;
    /** Optional approval policies for the riskier sandbox tools. */
    approvals?: SandboxToolApprovals;
}

/** Configuration for the built-in E2B sandbox driver. */
export interface E2BSandboxDriverConfig extends SandboxCreateParams {
    apiKey?: string;
    accessToken?: string;
    domain?: string;
    requestTimeoutMs?: number;
}

/** Backwards-compatible alias renamed for the client-style API. */
export type E2BSandboxClientConfig = E2BSandboxDriverConfig;

/** Configuration for the Daytona sandbox client. */
export interface DaytonaSandboxClientConfig extends SandboxCreateParams {
    apiKey?: string;
    apiUrl?: string;
    target?: string;
    language?: string;
    snapshot?: string;
    image?: string;
    public?: boolean;
    autoStopInterval?: number;
    autoArchiveInterval?: number;
    autoDeleteInterval?: number;
    templateKind?: "snapshot" | "image";
}
