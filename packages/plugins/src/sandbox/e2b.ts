import { BetterAgentError } from "@better-agent/shared/errors";
import type {
    E2BSandboxClientConfig,
    SandboxClient,
    SandboxCommandParams,
    SandboxCommandResult,
    SandboxFileEntry,
} from "./types";

type E2BSandboxModule = {
    Sandbox: {
        create: (
            templateOrOptions?: string | Record<string, unknown>,
            options?: Record<string, unknown>,
        ) => Promise<E2BSandboxInstance>;
        connect: (
            sandboxId: string,
            options?: Record<string, unknown>,
        ) => Promise<E2BSandboxInstance>;
    };
};

type E2BSandboxInstance = {
    sandboxId: string;
    commands: {
        run: (
            cmd: string,
            options?: Record<string, unknown>,
        ) => Promise<{
            exitCode?: number;
            stdout?: string;
            stderr?: string;
            pid?: number;
        }>;
    };
    files: {
        read: (path: string, options?: Record<string, unknown>) => Promise<string>;
        write: (
            path: string,
            data: string,
            options?: Record<string, unknown>,
        ) => Promise<{ path?: string }>;
        list: (path: string, options?: Record<string, unknown>) => Promise<SandboxFileEntry[]>;
        makeDir: (path: string, options?: Record<string, unknown>) => Promise<boolean>;
        remove: (path: string, options?: Record<string, unknown>) => Promise<void>;
    };
    getHost: (port: number) => string;
    kill: (options?: Record<string, unknown>) => Promise<void>;
};

const removeUndefined = (value: Record<string, unknown>) =>
    Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined));

const loadE2B = async (): Promise<E2BSandboxModule> => {
    try {
        const moduleName = "e2b";
        return (await import(moduleName)) as E2BSandboxModule;
    } catch (error) {
        throw BetterAgentError.fromCode(
            "INTERNAL",
            "The built-in E2B sandbox client requires the `e2b` package to be installed in the host app.",
            {
                cause: error,
                trace: [{ at: "plugins.sandbox.createE2BSandboxClient.loadE2B" }],
            },
        );
    }
};

/** Creates a sandbox client backed by the E2B SDK. */
export function createE2BSandboxClient(config: E2BSandboxClientConfig = {}): SandboxClient {
    const connectionOptions = removeUndefined({
        apiKey: config.apiKey,
        accessToken: config.accessToken,
        domain: config.domain,
        requestTimeoutMs: config.requestTimeoutMs,
    });

    const toCreateOptions = (overrides?: {
        template?: string;
        timeoutMs?: number;
        envs?: Record<string, string>;
        metadata?: Record<string, string>;
    }) =>
        removeUndefined({
            ...connectionOptions,
            timeoutMs: overrides?.timeoutMs ?? config.timeoutMs,
            envs: overrides?.envs ?? config.envs,
            metadata: overrides?.metadata ?? config.metadata,
        });

    const connectSandbox = async (sandboxId: string): Promise<E2BSandboxInstance> => {
        const { Sandbox } = await loadE2B();
        return await Sandbox.connect(sandboxId, connectionOptions);
    };

    const mapCommandResult = (
        result: Awaited<ReturnType<E2BSandboxInstance["commands"]["run"]>>,
    ): SandboxCommandResult => ({
        exitCode: result.exitCode,
        stdout: result.stdout,
        stderr: result.stderr,
        pid: result.pid,
    });

    return {
        provider: "e2b",
        capabilities: {
            commands: true,
            filesystem: true,
            preview: true,
            mcp: true,
            pty: true,
            desktop: true,
        },
        async createSandbox(params) {
            const { Sandbox } = await loadE2B();
            const template = params?.template ?? config.template;
            const options = toCreateOptions(params);

            const sandbox =
                template !== undefined
                    ? await Sandbox.create(template, options)
                    : await Sandbox.create(options);

            return { sandboxId: sandbox.sandboxId };
        },

        async runCommand(params: SandboxCommandParams) {
            const sandbox = await connectSandbox(params.sandboxId);
            return mapCommandResult(
                await sandbox.commands.run(
                    params.cmd,
                    removeUndefined({
                        cwd: params.cwd,
                        envs: params.envs,
                        timeoutMs: params.timeoutMs,
                    }),
                ),
            );
        },

        async readFile(params) {
            const sandbox = await connectSandbox(params.sandboxId);
            return await sandbox.files.read(params.path);
        },

        async writeFile(params) {
            const sandbox = await connectSandbox(params.sandboxId);
            const result = await sandbox.files.write(params.path, params.content);
            return { path: result.path ?? params.path };
        },

        async listFiles(params) {
            const sandbox = await connectSandbox(params.sandboxId);
            return await sandbox.files.list(params.path);
        },

        async makeDir(params) {
            const sandbox = await connectSandbox(params.sandboxId);
            return {
                created: await sandbox.files.makeDir(params.path),
            };
        },

        async removePath(params) {
            const sandbox = await connectSandbox(params.sandboxId);
            await sandbox.files.remove(params.path);
        },

        async getHost(params) {
            const sandbox = await connectSandbox(params.sandboxId);
            return sandbox.getHost(params.port);
        },

        async killSandbox(params) {
            const sandbox = await connectSandbox(params.sandboxId);
            await sandbox.kill();
        },
    };
}
