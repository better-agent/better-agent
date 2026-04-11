import { BetterAgentError } from "@better-agent/shared/errors";
import type {
    DaytonaSandboxClientConfig,
    SandboxClient,
    SandboxCommandResult,
    SandboxFileEntry,
    SandboxPreviewInfo,
} from "./types";

type DaytonaModule = {
    Daytona: new (config?: Record<string, unknown>) => DaytonaClientInstance;
};

type DaytonaClientInstance = {
    create: (
        params?: Record<string, unknown>,
        options?: {
            timeout?: number;
            onSnapshotCreateLogs?: (chunk: string) => void;
        },
    ) => Promise<DaytonaSandboxInstance>;
    get: (sandboxIdOrName: string) => Promise<DaytonaSandboxInstance>;
    start?: (sandbox: DaytonaSandboxInstance, timeout?: number) => Promise<void>;
    stop?: (sandbox: DaytonaSandboxInstance) => Promise<void>;
    delete?: (sandbox: DaytonaSandboxInstance, timeout?: number) => Promise<void>;
};

type DaytonaSandboxInstance = {
    id: string;
    process: {
        executeCommand: (
            command: string,
            cwd?: string,
            envVars?: Record<string, string>,
            timeout?: number,
        ) => Promise<{
            result?: string;
            exitCode?: number;
        }>;
    };
    fs: {
        downloadFile: (remotePath: string, timeout?: number) => Promise<Uint8Array | string>;
        uploadFile: (
            file: Uint8Array | string,
            remotePath: string,
            timeout?: number,
        ) => Promise<void>;
        listFiles: (path: string) => Promise<DaytonaFileInfo[]>;
        createFolder: (path: string, mode: string) => Promise<void>;
        deleteFile: (path: string, recursive?: boolean) => Promise<void>;
    };
    getPreviewLink: (port: number) => Promise<SandboxPreviewInfo>;
    start?: (timeout?: number) => Promise<void>;
    stop?: (timeout?: number) => Promise<void>;
    archive?: () => Promise<void>;
    delete?: (timeout?: number) => Promise<void>;
};

type DaytonaFileInfo = {
    name?: string;
    path?: string;
    isDir?: boolean;
    type?: string;
};

const loadDaytona = async (): Promise<DaytonaModule> => {
    try {
        const moduleName = "@daytonaio/sdk";
        return (await import(moduleName)) as DaytonaModule;
    } catch (error) {
        throw BetterAgentError.fromCode(
            "INTERNAL",
            "The Daytona sandbox client requires the `@daytonaio/sdk` package to be installed in the host app.",
            {
                cause: error,
                trace: [{ at: "plugins.sandbox.createDaytonaSandboxClient.loadDaytona" }],
            },
        );
    }
};

const removeUndefined = (value: Record<string, unknown>) =>
    Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined));

const toSeconds = (value: number | undefined): number | undefined =>
    value === undefined ? undefined : Math.max(1, Math.ceil(value / 1000));

const toUtf8 = (value: Uint8Array | string): string =>
    typeof value === "string" ? value : new TextDecoder().decode(value);

const normalizeFileEntries = (files: DaytonaFileInfo[]): SandboxFileEntry[] =>
    files.map((entry) => ({
        name: entry.name ?? entry.path?.split("/").filter(Boolean).at(-1) ?? "",
        path: entry.path ?? entry.name ?? "",
        type: entry.type ?? (entry.isDir ? "directory" : "file"),
    }));

/** Creates a sandbox client backed by the Daytona SDK. */
export function createDaytonaSandboxClient(config: DaytonaSandboxClientConfig = {}): SandboxClient {
    const clientConfig = removeUndefined({
        apiKey: config.apiKey,
        apiUrl: config.apiUrl,
        target: config.target,
    });

    const buildCreateParams = (overrides?: {
        template?: string;
        envs?: Record<string, string>;
        metadata?: Record<string, string>;
    }) => {
        const template = config.template ?? overrides?.template;
        const templateKind = config.templateKind ?? "snapshot";

        return removeUndefined({
            language: config.language,
            envVars: overrides?.envs ?? config.envs,
            labels: overrides?.metadata ?? config.metadata,
            public: config.public,
            autoStopInterval: config.autoStopInterval,
            autoArchiveInterval: config.autoArchiveInterval,
            autoDeleteInterval: config.autoDeleteInterval,
            ...(template !== undefined
                ? templateKind === "image"
                    ? { image: template }
                    : { snapshot: template }
                : {}),
            ...(config.snapshot !== undefined ? { snapshot: config.snapshot } : {}),
            ...(config.image !== undefined ? { image: config.image } : {}),
        });
    };

    const getClient = async (): Promise<DaytonaClientInstance> => {
        const { Daytona } = await loadDaytona();
        return new Daytona(clientConfig);
    };

    const getSandbox = async (
        sandboxId: string,
    ): Promise<{
        client: DaytonaClientInstance;
        sandbox: DaytonaSandboxInstance;
    }> => {
        const client = await getClient();
        return {
            sandbox: await client.get(sandboxId),
            client,
        };
    };

    const toCommandResult = (response: {
        result?: string;
        exitCode?: number;
    }): SandboxCommandResult => ({
        exitCode: response.exitCode,
        stdout: response.result,
    });

    return {
        provider: "daytona",
        capabilities: {
            commands: true,
            filesystem: true,
            preview: true,
            pty: true,
            desktop: true,
            git: true,
            snapshots: true,
            volumes: true,
            lifecycle: {
                start: true,
                stop: true,
                archive: true,
                resume: true,
            },
        },

        async createSandbox(params) {
            const client = await getClient();
            const timeout = toSeconds(params?.timeoutMs ?? config.timeoutMs);
            const sandbox = await client.create(buildCreateParams(params), {
                ...(timeout !== undefined ? { timeout } : {}),
            });

            return { sandboxId: sandbox.id };
        },

        async runCommand(params) {
            const { sandbox } = await getSandbox(params.sandboxId);
            return toCommandResult(
                await sandbox.process.executeCommand(
                    params.cmd,
                    params.cwd,
                    params.envs,
                    toSeconds(params.timeoutMs),
                ),
            );
        },

        async readFile(params) {
            const { sandbox } = await getSandbox(params.sandboxId);
            return toUtf8(await sandbox.fs.downloadFile(params.path));
        },

        async writeFile(params) {
            const { sandbox } = await getSandbox(params.sandboxId);
            await sandbox.fs.uploadFile(Buffer.from(params.content), params.path);
            return { path: params.path };
        },

        async listFiles(params) {
            const { sandbox } = await getSandbox(params.sandboxId);
            return normalizeFileEntries(await sandbox.fs.listFiles(params.path));
        },

        async makeDir(params) {
            const { sandbox } = await getSandbox(params.sandboxId);
            await sandbox.fs.createFolder(params.path, "755");
            return { created: true };
        },

        async removePath(params) {
            const { sandbox } = await getSandbox(params.sandboxId);
            await sandbox.fs.deleteFile(params.path, true);
        },

        async getHost(params) {
            const { sandbox } = await getSandbox(params.sandboxId);
            return await sandbox.getPreviewLink(params.port);
        },

        async killSandbox(params) {
            const { client, sandbox } = await getSandbox(params.sandboxId);
            if (typeof sandbox.delete === "function") {
                await sandbox.delete(60);
                return;
            }

            if (typeof client.delete === "function") {
                await client.delete(sandbox, 60);
                return;
            }

            throw BetterAgentError.fromCode(
                "NOT_IMPLEMENTED",
                "The active Daytona SDK instance does not expose sandbox deletion.",
                {
                    context: { sandboxId: params.sandboxId },
                    trace: [{ at: "plugins.sandbox.createDaytonaSandboxClient.killSandbox" }],
                },
            );
        },

        lifecycle: {
            async startSandbox(params) {
                const { client, sandbox } = await getSandbox(params.sandboxId);
                const timeout = toSeconds(params.timeoutMs);

                if (typeof sandbox.start === "function") {
                    await sandbox.start(timeout);
                    return;
                }

                if (typeof client.start === "function") {
                    await client.start(sandbox, timeout);
                }
            },

            async stopSandbox(params) {
                const { client, sandbox } = await getSandbox(params.sandboxId);

                if (typeof sandbox.stop === "function") {
                    await sandbox.stop(toSeconds(params.timeoutMs));
                    return;
                }

                if (typeof client.stop === "function") {
                    await client.stop(sandbox);
                }
            },

            async archiveSandbox(params) {
                const { sandbox } = await getSandbox(params.sandboxId);
                if (typeof sandbox.archive === "function") {
                    await sandbox.archive();
                    return;
                }

                throw BetterAgentError.fromCode(
                    "NOT_IMPLEMENTED",
                    "The active Daytona SDK instance does not expose sandbox archiving.",
                    {
                        context: { sandboxId: params.sandboxId },
                        trace: [
                            { at: "plugins.sandbox.createDaytonaSandboxClient.archiveSandbox" },
                        ],
                    },
                );
            },
        },
    };
}
