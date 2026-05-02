import type { ToolApprovalConfig } from "@better-agent/core";

/** Options for creating a sandbox. */
export interface SandboxCreateParams {
    /** Template, snapshot, or image to create the sandbox from. */
    template?: string;
    /** Maximum time to wait for the sandbox to become ready. */
    startupTimeoutMs?: number;
    /** Environment variables for the sandbox. */
    envs?: Record<string, string>;
    /** Metadata or labels for the sandbox. */
    metadata?: Record<string, string>;
    /** Shared lifecycle controls for the created sandbox. */
    lifecycle?: {
        /** Maximum lifetime for the sandbox. */
        ttlMs?: number;
        /** Stop the sandbox after this much inactivity. */
        idleStopMs?: number;
        /** Archive the sandbox this long after it stops. */
        archiveAfterMs?: number;
        /** Delete the sandbox this long after it stops. */
        deleteAfterMs?: number;
    };
}

/** Sandbox returned after creation. */
export interface SandboxInstance {
    /** Sandbox id. */
    sandboxId: string;
}

/** Preview details for an exposed sandbox port. */
export interface SandboxPreviewInfo {
    /** Preview URL. */
    url: string;
    /** Preview token, if required. */
    token?: string;
}

/** Capability flags exposed by a sandbox client. */
export interface SandboxCapabilities {
    /** Supports running commands. */
    commands?: true;
    /** Supports filesystem operations. */
    filesystem?: true;
    /** Supports preview URLs. */
    preview?: true;
    /** Supports terminal sessions. */
    pty?: true;
    /** Supports desktop features. */
    desktop?: true;
    /** Supports MCP-style integrations. */
    mcp?: true;
    /** Supports git helpers. */
    git?: true;
    /** Supports snapshots. */
    snapshots?: true;
    /** Supports persistent volumes. */
    volumes?: true;
    /** Supported lifecycle operations. */
    lifecycle?: {
        /** Can start a sandbox. */
        start?: true;
        /** Can stop a sandbox. */
        stop?: true;
        /** Can archive a sandbox. */
        archive?: true;
        /** Can resume a sandbox. */
        resume?: true;
    };
}

/** Parameters for running a command. */
export interface SandboxCommandParams {
    /** Sandbox id to target. */
    sandboxId: string;
    /** Command to run. */
    cmd: string;
    /** Working directory for the command. */
    cwd?: string;
    /** Timeout in milliseconds. */
    timeoutMs?: number;
    /** Environment variables for the command. */
    envs?: Record<string, string>;
}

/** Result returned by a command. */
export interface SandboxCommandResult {
    /** Command exit code. */
    exitCode?: number;
    /** Command stdout. */
    stdout?: string;
    /** Command stderr. */
    stderr?: string;
    /** Process id, if available. */
    pid?: number;
}

/** Parameters for reading a file. */
export interface SandboxReadFileParams {
    /** Sandbox id to target. */
    sandboxId: string;
    /** Path inside the sandbox. */
    path: string;
}

/** Parameters for writing a file. */
export interface SandboxWriteFileParams {
    /** Sandbox id to target. */
    sandboxId: string;
    /** Path inside the sandbox. */
    path: string;
    /** File contents to write. */
    content: string;
}

/** Directory entry returned by `listFiles()`. */
export interface SandboxFileEntry {
    /** Entry name. */
    name: string;
    /** Entry path. */
    path: string;
    /** Entry type, if available. */
    type?: string;
}

/** Parameters for listing a directory. */
export interface SandboxListFilesParams {
    /** Sandbox id to target. */
    sandboxId: string;
    /** Directory to list. */
    path: string;
}

/** Parameters for creating a directory. */
export interface SandboxMakeDirParams {
    /** Sandbox id to target. */
    sandboxId: string;
    /** Directory to create. */
    path: string;
}

/** Parameters for removing a file or directory. */
export interface SandboxRemovePathParams {
    /** Sandbox id to target. */
    sandboxId: string;
    /** Path to remove. */
    path: string;
}

/** Parameters for exposing a sandbox port. */
export interface SandboxGetHostParams {
    /** Sandbox id to target. */
    sandboxId: string;
    /** Port to expose. */
    port: number;
}

/** Parameters for deleting a sandbox. */
export interface SandboxKillParams {
    /** Sandbox id to target. */
    sandboxId: string;
}

/** Optional lifecycle methods for richer sandbox providers. */
export interface SandboxLifecycleClient {
    /** Start a stopped sandbox. */
    startSandbox?(params: {
        /** Sandbox id to target. */
        sandboxId: string;
        /** Timeout in milliseconds. */
        timeoutMs?: number;
    }): Promise<void>;
    /** Stop a running sandbox. */
    stopSandbox?(params: {
        /** Sandbox id to target. */
        sandboxId: string;
        /** Timeout in milliseconds. */
        timeoutMs?: number;
        /** Force the stop when supported. */
        force?: boolean;
    }): Promise<void>;
    /** Archive a sandbox. */
    archiveSandbox?(params: { sandboxId: string }): Promise<void>;
}

/** Optional terminal methods for richer sandbox providers. */
export interface SandboxPTYClient {
    /** Create a terminal session. */
    createSession?(params: {
        /** Sandbox id to target. */
        sandboxId: string;
        /** Terminal session id. */
        sessionId: string;
        /** Working directory for the session. */
        cwd?: string;
        /** Terminal width in columns. */
        cols?: number;
        /** Terminal height in rows. */
        rows?: number;
        /** Environment variables for the session. */
        envs?: Record<string, string>;
        /** Called when terminal output is received. */
        onData?: (data: Uint8Array) => Promise<void> | void;
    }): Promise<{
        /** Session id. */
        sessionId: string;
        /** Final exit code, if available. */
        exitCode?: number;
        /** Error message, if setup fails. */
        error?: string;
    }>;
}

/** Optional desktop methods for richer sandbox providers. */
export interface SandboxDesktopClient {
    /** Start a desktop session for one sandbox. */
    startDesktop?(params: { sandboxId: string }): Promise<void>;
    /** Stop a desktop session for one sandbox. */
    stopDesktop?(params: { sandboxId: string }): Promise<void>;
    /** Capture a screenshot from the active desktop session. */
    screenshot?(params: { sandboxId: string }): Promise<{
        /** Screenshot data. */
        data: string;
        /** Screenshot mime type, if available. */
        mimeType?: string;
    }>;
}

/** Sandbox client used by `sandbox`. */
export interface SandboxClient {
    /** Provider name. */
    provider?: string;
    /** Capability metadata. */
    capabilities?: SandboxCapabilities;
    /** Create a sandbox. */
    createSandbox(params?: SandboxCreateParams): Promise<SandboxInstance>;
    /** Run a command. */
    runCommand(params: SandboxCommandParams): Promise<SandboxCommandResult>;
    /** Read a file. */
    readFile(params: SandboxReadFileParams): Promise<string>;
    /** Write a file. */
    writeFile(params: SandboxWriteFileParams): Promise<{
        /** Final path. */
        path: string;
    }>;
    /** List directory entries. */
    listFiles(params: SandboxListFilesParams): Promise<SandboxFileEntry[]>;
    /** Create a directory. */
    makeDir(params: SandboxMakeDirParams): Promise<{
        /** Whether the directory was created. */
        created: boolean;
    }>;
    /** Remove a file or directory. */
    removePath(params: SandboxRemovePathParams): Promise<void>;
    /** Expose a port as a preview URL. */
    getHost(params: SandboxGetHostParams): Promise<string | SandboxPreviewInfo>;
    /** Delete a sandbox. */
    killSandbox(params: SandboxKillParams): Promise<void>;
    /** Optional lifecycle extensions. */
    lifecycle?: SandboxLifecycleClient;
    /** Optional PTY extensions. */
    pty?: SandboxPTYClient;
    /** Optional desktop extensions. */
    desktop?: SandboxDesktopClient;
}

/** Store for reusable sandbox ids. */
export interface SandboxSessionStore {
    /** Read the sandbox id for a session key. */
    get(key: string): Promise<string | null>;
    /** Store a sandbox id for a session key. */
    set(key: string, sandboxId: string): Promise<void>;
    /** Delete the sandbox id for a session key. */
    delete(key: string): Promise<void>;
}

/** Context passed to `sessionKey`. */
export interface SandboxSessionKeyContext {
    /** Run id. */
    runId: string;
    /** Agent name. */
    agentName: string;
    /** Thread id, if available. */
    threadId?: string;
    /** Tool name, for example `sandbox_exec`. */
    toolName: string;
}

/** Approval settings for sandbox tools. */
export interface SandboxToolApprovals {
    /** Approval policy for `*_exec`. */
    exec?: ToolApprovalConfig;
    /** Approval policy for `*_write_file`. */
    writeFile?: ToolApprovalConfig;
    /** Approval policy for `*_remove_path`. */
    removePath?: ToolApprovalConfig;
    /** Approval policy for `*_kill`. */
    killSandbox?: ToolApprovalConfig;
}

/** Configuration for `sandbox`. */
export interface SandboxConfig {
    /** Plugin id. */
    id?: string;
    /** Tool name prefix. Defaults to `"sandbox"`. */
    prefix?: string;
    /** Sandbox client to use. */
    client: SandboxClient;
    /** Store for reusable sandbox ids. */
    store?: SandboxSessionStore;
    /**
     * Controls sandbox reuse for each tool call.
     *
     * When omitted, the plugin reuses one sandbox per `threadId`.
     * Return a non-empty string to reuse a sandbox under that key.
     * Return `null` or `undefined` to disable reuse for that call.
     */
    sessionKey?: (ctx: SandboxSessionKeyContext) => string | null | undefined;
    /** Authoritative sandbox creation options that model overrides cannot overwrite. */
    createConfig?: SandboxCreateParams;
    /** Fallback sandbox creation options used only when createConfig and model overrides omit a field. */
    createDefaults?: SandboxCreateParams;
    /** Approval settings for risky sandbox tools. */
    approvals?: SandboxToolApprovals;
}

/** Configuration for the built-in E2B sandbox client. */
export interface E2BSandboxClientConfig {
    /** API key used to authenticate with E2B. */
    apiKey?: string;
    /** Access token used instead of an API key. */
    accessToken?: string;
    /** Custom E2B domain or API host. */
    domain?: string;
    /** SDK request timeout in milliseconds. */
    requestTimeoutMs?: number;
}

/** Configuration for the Daytona sandbox client. */
export interface DaytonaSandboxClientConfig {
    /** API key used to authenticate with Daytona. */
    apiKey?: string;
    /** Custom Daytona API base URL. */
    apiUrl?: string;
    /** Daytona target or region. */
    target?: string;
    /** Default language or runtime. */
    language?: string;
    /** Whether previews should be public. */
    public?: boolean;
    /** For Daytona, how the shared sandbox template should be mapped. */
    templateKind?: "snapshot" | "image";
}
