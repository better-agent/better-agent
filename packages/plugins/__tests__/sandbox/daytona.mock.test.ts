import { afterEach, describe, expect, mock, test } from "bun:test";
import { createDaytonaSandboxClient } from "../../src";

type ExecuteCall = {
    command: string;
    cwd?: string;
    envVars?: Record<string, string>;
    timeout?: number;
};

type UploadCall = {
    file: Uint8Array | string;
    remotePath: string;
    timeout?: number;
};

type FolderCall = {
    path: string;
    mode: string;
};

type DeleteFileCall = {
    path: string;
    recursive?: boolean;
};

type ClientDeleteCall = {
    sandboxId: string;
    timeout?: number;
};

type ClientStartCall = {
    sandboxId: string;
    timeout?: number;
};

type DaytonaSandboxStub = {
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
        listFiles: (path: string) => Promise<
            Array<{
                name?: string;
                path?: string;
                isDir?: boolean;
                type?: string;
            }>
        >;
        createFolder: (path: string, mode: string) => Promise<void>;
        deleteFile: (path: string, recursive?: boolean) => Promise<void>;
    };
    getPreviewLink: (port: number) => Promise<{ url: string; token?: string }>;
    start?: (timeout?: number) => Promise<void>;
    stop?: (timeout?: number) => Promise<void>;
    archive?: () => Promise<void>;
    delete?: (timeout?: number) => Promise<void>;
};

const createSandboxStub = (overrides: Partial<DaytonaSandboxStub> = {}): DaytonaSandboxStub => ({
    id: "daytona-1",
    process: {
        async executeCommand() {
            return { result: "ok", exitCode: 0 };
        },
    },
    fs: {
        async downloadFile() {
            return new TextEncoder().encode("hello");
        },
        async uploadFile() {},
        async listFiles() {
            return [];
        },
        async createFolder() {},
        async deleteFile() {},
    },
    async getPreviewLink(port: number) {
        return { url: `https://preview.example/${port}` };
    },
    ...overrides,
});

afterEach(() => {
    mock.restore();
});

describe("createDaytonaSandboxClient", () => {
    test("maps create, command, filesystem, preview, and sandbox delete correctly", async () => {
        const constructorConfigs: unknown[] = [];
        const createCalls: Array<{
            params?: Record<string, unknown>;
            options?: Record<string, unknown>;
        }> = [];
        const getCalls: string[] = [];
        const executeCalls: ExecuteCall[] = [];
        const downloadCalls: string[] = [];
        const uploadCalls: UploadCall[] = [];
        const listCalls: string[] = [];
        const folderCalls: FolderCall[] = [];
        const deleteFileCalls: DeleteFileCall[] = [];
        const previewCalls: number[] = [];
        const sandboxDeleteCalls: number[] = [];

        const sandbox = createSandboxStub({
            process: {
                async executeCommand(command, cwd, envVars, timeout) {
                    executeCalls.push({ command, cwd, envVars, timeout });
                    return { result: "ok", exitCode: 0 };
                },
            },
            fs: {
                async downloadFile(remotePath) {
                    downloadCalls.push(remotePath);
                    return new TextEncoder().encode("hello");
                },
                async uploadFile(file, remotePath, timeout) {
                    uploadCalls.push({ file, remotePath, timeout });
                },
                async listFiles(path) {
                    listCalls.push(path);
                    return [
                        { path: "/tmp/demo.txt", type: "file" },
                        { name: "logs", path: "/tmp/logs", isDir: true },
                    ];
                },
                async createFolder(path, mode) {
                    folderCalls.push({ path, mode });
                },
                async deleteFile(path, recursive) {
                    deleteFileCalls.push({ path, recursive });
                },
            },
            async getPreviewLink(port) {
                previewCalls.push(port);
                return { url: `https://preview.example/${port}`, token: "token-1" };
            },
            async delete(timeout) {
                sandboxDeleteCalls.push(timeout ?? 0);
            },
        });

        mock.module("@daytonaio/sdk", () => ({
            Daytona: class {
                constructor(config?: Record<string, unknown>) {
                    constructorConfigs.push(config);
                }

                async create(params?: Record<string, unknown>, options?: Record<string, unknown>) {
                    createCalls.push({ params, options });
                    return sandbox;
                }

                async get(sandboxIdOrName: string) {
                    getCalls.push(sandboxIdOrName);
                    return sandbox;
                }
            },
        }));

        const client = createDaytonaSandboxClient({
            apiKey: "daytona-key",
            apiUrl: "https://daytona.example",
            target: "us",
            language: "typescript",
            template: "snapshot-1",
            envs: { NODE_ENV: "test" },
            metadata: { team: "plugins" },
            public: true,
            autoStopInterval: 60,
            autoArchiveInterval: 120,
            autoDeleteInterval: 240,
            timeoutMs: 12_000,
        });

        const created = await client.createSandbox();
        const command = await client.runCommand({
            sandboxId: created.sandboxId,
            cmd: "pwd",
            cwd: "/workspace",
            envs: { DEBUG: "1" },
            timeoutMs: 4_500,
        });
        const content = await client.readFile({
            sandboxId: created.sandboxId,
            path: "/tmp/demo.txt",
        });
        const writeResult = await client.writeFile({
            sandboxId: created.sandboxId,
            path: "/tmp/out.txt",
            content: "payload",
        });
        const entries = await client.listFiles({
            sandboxId: created.sandboxId,
            path: "/tmp",
        });
        const mkdirResult = await client.makeDir({
            sandboxId: created.sandboxId,
            path: "/tmp/new",
        });
        await client.removePath({
            sandboxId: created.sandboxId,
            path: "/tmp/old",
        });
        const preview = await client.getHost({
            sandboxId: created.sandboxId,
            port: 3000,
        });
        await client.killSandbox({ sandboxId: created.sandboxId });

        expect(constructorConfigs.length).toBeGreaterThan(0);
        expect(
            constructorConfigs.every(
                (config) =>
                    JSON.stringify(config) ===
                    JSON.stringify({
                        apiKey: "daytona-key",
                        apiUrl: "https://daytona.example",
                        target: "us",
                    }),
            ),
        ).toBe(true);
        expect(createCalls).toEqual([
            {
                params: {
                    language: "typescript",
                    envVars: { NODE_ENV: "test" },
                    labels: { team: "plugins" },
                    public: true,
                    autoStopInterval: 60,
                    autoArchiveInterval: 120,
                    autoDeleteInterval: 240,
                    snapshot: "snapshot-1",
                },
                options: { timeout: 12 },
            },
        ]);
        expect(created).toEqual({ sandboxId: "daytona-1" });
        expect(getCalls).toEqual(new Array(8).fill("daytona-1"));
        expect(executeCalls).toEqual([
            {
                command: "pwd",
                cwd: "/workspace",
                envVars: { DEBUG: "1" },
                timeout: 5,
            },
        ]);
        expect(command).toEqual({ exitCode: 0, stdout: "ok" });
        expect(downloadCalls).toEqual(["/tmp/demo.txt"]);
        expect(content).toBe("hello");
        expect(uploadCalls).toHaveLength(1);
        expect(uploadCalls[0]?.remotePath).toBe("/tmp/out.txt");
        const uploadedFile = uploadCalls[0]?.file;
        expect(uploadedFile instanceof Uint8Array).toBe(true);
        if (!(uploadedFile instanceof Uint8Array)) {
            throw new Error("Expected uploadFile to receive Uint8Array content.");
        }
        expect(Buffer.from(uploadedFile).toString()).toBe("payload");
        expect(writeResult).toEqual({ path: "/tmp/out.txt" });
        expect(listCalls).toEqual(["/tmp"]);
        expect(entries).toEqual([
            { name: "demo.txt", path: "/tmp/demo.txt", type: "file" },
            { name: "logs", path: "/tmp/logs", type: "directory" },
        ]);
        expect(folderCalls).toEqual([{ path: "/tmp/new", mode: "755" }]);
        expect(mkdirResult).toEqual({ created: true });
        expect(deleteFileCalls).toEqual([{ path: "/tmp/old", recursive: true }]);
        expect(previewCalls).toEqual([3000]);
        expect(preview).toEqual({
            url: "https://preview.example/3000",
            token: "token-1",
        });
        expect(sandboxDeleteCalls).toEqual([60]);
    });

    test("prefers image template when configured for image-based sandboxes", async () => {
        const createCalls: Array<Record<string, unknown> | undefined> = [];
        const sandbox = createSandboxStub({ id: "daytona-image" });

        mock.module("@daytonaio/sdk", () => ({
            Daytona: class {
                async create(params?: Record<string, unknown>) {
                    createCalls.push(params);
                    return sandbox;
                }

                async get() {
                    return sandbox;
                }
            },
        }));

        const client = createDaytonaSandboxClient({
            template: "image-default",
            templateKind: "image",
            language: "javascript",
        });

        await client.createSandbox({
            template: "node:20",
            envs: { MODE: "image" },
            metadata: { owner: "plugins" },
        });

        expect(createCalls).toEqual([
            {
                language: "javascript",
                envVars: { MODE: "image" },
                labels: { owner: "plugins" },
                image: "image-default",
            },
        ]);
    });

    test("prefers configured snapshot template over create overrides", async () => {
        const createCalls: Array<Record<string, unknown> | undefined> = [];
        const sandbox = createSandboxStub({ id: "daytona-snapshot" });

        mock.module("@daytonaio/sdk", () => ({
            Daytona: class {
                async create(params?: Record<string, unknown>) {
                    createCalls.push(params);
                    return sandbox;
                }

                async get() {
                    return sandbox;
                }
            },
        }));

        const client = createDaytonaSandboxClient({
            template: "snapshot-default",
            templateKind: "snapshot",
            language: "typescript",
        });

        await client.createSandbox({
            template: "snapshot-override",
            envs: { MODE: "snapshot" },
        });

        expect(createCalls).toEqual([
            {
                language: "typescript",
                envVars: { MODE: "snapshot" },
                snapshot: "snapshot-default",
            },
        ]);
    });

    test("prefers explicit snapshot and image config over template-derived values", async () => {
        const createCalls: Array<Record<string, unknown> | undefined> = [];
        const sandbox = createSandboxStub({ id: "daytona-explicit" });

        mock.module("@daytonaio/sdk", () => ({
            Daytona: class {
                async create(params?: Record<string, unknown>) {
                    createCalls.push(params);
                    return sandbox;
                }

                async get() {
                    return sandbox;
                }
            },
        }));

        const client = createDaytonaSandboxClient({
            template: "template-ignored",
            templateKind: "snapshot",
            snapshot: "snapshot-explicit",
            image: "image-explicit",
        });

        await client.createSandbox();

        expect(createCalls).toEqual([
            {
                snapshot: "snapshot-explicit",
                image: "image-explicit",
            },
        ]);
    });

    test("converts sub-second timeouts to one second and preserves string file reads", async () => {
        const createOptions: Array<Record<string, unknown> | undefined> = [];
        const executeCalls: ExecuteCall[] = [];
        const sandbox = createSandboxStub({
            process: {
                async executeCommand(command, cwd, envVars, timeout) {
                    executeCalls.push({ command, cwd, envVars, timeout });
                    return { result: "tiny-timeout", exitCode: 0 };
                },
            },
            fs: {
                async downloadFile() {
                    return "plain-text";
                },
                async uploadFile() {},
                async listFiles() {
                    return [];
                },
                async createFolder() {},
                async deleteFile() {},
            },
        });

        mock.module("@daytonaio/sdk", () => ({
            Daytona: class {
                async create(_params?: Record<string, unknown>, options?: Record<string, unknown>) {
                    createOptions.push(options);
                    return sandbox;
                }

                async get() {
                    return sandbox;
                }
            },
        }));

        const client = createDaytonaSandboxClient({ timeoutMs: 1 });

        await client.createSandbox();
        const command = await client.runCommand({
            sandboxId: "daytona-1",
            cmd: "echo tiny",
            timeoutMs: 1,
        });
        const content = await client.readFile({
            sandboxId: "daytona-1",
            path: "/tmp/plain.txt",
        });

        expect(createOptions).toEqual([{ timeout: 1 }]);
        expect(executeCalls).toEqual([
            {
                command: "echo tiny",
                cwd: undefined,
                envVars: undefined,
                timeout: 1,
            },
        ]);
        expect(command).toEqual({ exitCode: 0, stdout: "tiny-timeout" });
        expect(content).toBe("plain-text");
    });

    test("uses sandbox lifecycle methods when available", async () => {
        const startCalls: number[] = [];
        const stopCalls: number[] = [];
        const archiveCalls: number[] = [];
        const sandbox = createSandboxStub({
            id: "daytona-lifecycle",
            async start(timeout?: number) {
                startCalls.push(timeout ?? 0);
            },
            async stop(timeout?: number) {
                stopCalls.push(timeout ?? 0);
            },
            async archive() {
                archiveCalls.push(1);
            },
        });

        mock.module("@daytonaio/sdk", () => ({
            Daytona: class {
                async create() {
                    return sandbox;
                }

                async get() {
                    return sandbox;
                }
            },
        }));

        const client = createDaytonaSandboxClient();
        await client.lifecycle?.startSandbox?.({
            sandboxId: "daytona-lifecycle",
            timeoutMs: 9_500,
        });
        await client.lifecycle?.stopSandbox?.({
            sandboxId: "daytona-lifecycle",
            timeoutMs: 1_500,
        });
        await client.lifecycle?.archiveSandbox?.({
            sandboxId: "daytona-lifecycle",
        });

        expect(startCalls).toEqual([10]);
        expect(stopCalls).toEqual([2]);
        expect(archiveCalls).toEqual([1]);
    });

    test("falls back to client delete and lifecycle methods when sandbox methods are unavailable", async () => {
        const clientDeleteCalls: ClientDeleteCall[] = [];
        const clientStartCalls: ClientStartCall[] = [];
        const clientStopCalls: string[] = [];

        const sandbox = createSandboxStub({
            id: "daytona-2",
            process: {
                async executeCommand() {
                    return { result: "ignored", exitCode: 0 };
                },
            },
        });

        mock.module("@daytonaio/sdk", () => ({
            Daytona: class {
                async create() {
                    return sandbox;
                }

                async get() {
                    return sandbox;
                }

                async delete(target: { id: string }, timeout?: number) {
                    clientDeleteCalls.push({ sandboxId: target.id, timeout });
                }

                async start(target: { id: string }, timeout?: number) {
                    clientStartCalls.push({ sandboxId: target.id, timeout });
                }

                async stop(target: { id: string }) {
                    clientStopCalls.push(target.id);
                }
            },
        }));

        const client = createDaytonaSandboxClient();
        await client.killSandbox({ sandboxId: "daytona-2" });
        await client.lifecycle?.startSandbox?.({
            sandboxId: "daytona-2",
            timeoutMs: 9_500,
        });
        await client.lifecycle?.stopSandbox?.({ sandboxId: "daytona-2" });

        expect(clientDeleteCalls).toEqual([{ sandboxId: "daytona-2", timeout: 60 }]);
        expect(clientStartCalls).toEqual([{ sandboxId: "daytona-2", timeout: 10 }]);
        expect(clientStopCalls).toEqual(["daytona-2"]);
    });

    test("throws NOT_IMPLEMENTED when delete support is unavailable", async () => {
        const sandbox = createSandboxStub({ id: "daytona-no-delete" });

        mock.module("@daytonaio/sdk", () => ({
            Daytona: class {
                async create() {
                    return sandbox;
                }

                async get() {
                    return sandbox;
                }
            },
        }));

        const client = createDaytonaSandboxClient();

        expect(client.killSandbox({ sandboxId: "daytona-no-delete" })).rejects.toMatchObject({
            code: "NOT_IMPLEMENTED",
            message: "The active Daytona SDK instance does not expose sandbox deletion.",
        });
    });

    test("throws NOT_IMPLEMENTED when archive support is unavailable", async () => {
        const sandbox = createSandboxStub({ id: "daytona-no-archive" });

        mock.module("@daytonaio/sdk", () => ({
            Daytona: class {
                async create() {
                    return sandbox;
                }

                async get() {
                    return sandbox;
                }
            },
        }));

        const client = createDaytonaSandboxClient();

        expect(
            client.lifecycle?.archiveSandbox?.({ sandboxId: "daytona-no-archive" }),
        ).rejects.toMatchObject({
            code: "NOT_IMPLEMENTED",
            message: "The active Daytona SDK instance does not expose sandbox archiving.",
        });
    });
});
