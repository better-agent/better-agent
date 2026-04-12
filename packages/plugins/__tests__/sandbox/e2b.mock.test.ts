import { afterEach, describe, expect, mock, test } from "bun:test";
import { createE2BSandboxClient } from "../../src";

type CreateCall = {
    templateOrOptions?: unknown;
    options?: Record<string, unknown>;
};

type ConnectCall = {
    sandboxId: string;
    options?: Record<string, unknown>;
};

type CommandCall = {
    cmd: string;
    options?: Record<string, unknown>;
};

type E2BSandboxStub = {
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
        list: (
            path: string,
            options?: Record<string, unknown>,
        ) => Promise<
            Array<{
                name: string;
                path: string;
                type?: string;
            }>
        >;
        makeDir: (path: string, options?: Record<string, unknown>) => Promise<boolean>;
        remove: (path: string, options?: Record<string, unknown>) => Promise<void>;
    };
    getHost: (port: number) => string;
    kill: (options?: Record<string, unknown>) => Promise<void>;
};

const createSandboxStub = (overrides: Partial<E2BSandboxStub> = {}): E2BSandboxStub => ({
    sandboxId: "e2b-1",
    commands: {
        async run() {
            return { exitCode: 0, stdout: "hello", stderr: "", pid: 99 };
        },
    },
    files: {
        async read() {
            return "file-content";
        },
        async write(_path, _data) {
            return {};
        },
        async list(path) {
            return [{ name: "demo.txt", path: `${path}/demo.txt`, type: "file" }];
        },
        async makeDir() {
            return true;
        },
        async remove() {},
    },
    getHost(port) {
        return `https://host.example/${port}`;
    },
    async kill() {},
    ...overrides,
});

afterEach(() => {
    mock.restore();
});

describe("createE2BSandboxClient", () => {
    test("maps create, command, filesystem, host, and kill correctly", async () => {
        const createCalls: CreateCall[] = [];
        const connectCalls: ConnectCall[] = [];
        const commandCalls: CommandCall[] = [];
        const readCalls: string[] = [];
        const writeCalls: Array<{ path: string; data: string }> = [];
        const listCalls: string[] = [];
        const makeDirCalls: string[] = [];
        const removeCalls: string[] = [];
        const hostCalls: number[] = [];
        const killCalls: number[] = [];

        const sandbox = createSandboxStub({
            commands: {
                async run(cmd, options) {
                    commandCalls.push({ cmd, options });
                    return { exitCode: 0, stdout: "hello", stderr: "", pid: 99 };
                },
            },
            files: {
                async read(path) {
                    readCalls.push(path);
                    return "file-content";
                },
                async write(path, data) {
                    writeCalls.push({ path, data });
                    return { path: undefined };
                },
                async list(path) {
                    listCalls.push(path);
                    return [{ name: "demo.txt", path: `${path}/demo.txt`, type: "file" }];
                },
                async makeDir(path) {
                    makeDirCalls.push(path);
                    return true;
                },
                async remove(path) {
                    removeCalls.push(path);
                },
            },
            getHost(port) {
                hostCalls.push(port);
                return `https://host.example/${port}`;
            },
            async kill() {
                killCalls.push(1);
            },
        });

        mock.module("e2b", () => ({
            Sandbox: {
                async create(templateOrOptions?: unknown, options?: Record<string, unknown>) {
                    createCalls.push({ templateOrOptions, options });
                    return sandbox;
                },
                async connect(sandboxId: string, options?: Record<string, unknown>) {
                    connectCalls.push({ sandboxId, options });
                    return sandbox;
                },
            },
        }));

        const client = createE2BSandboxClient({
            apiKey: "e2b-key",
            domain: "e2b.example",
            requestTimeoutMs: 2_000,
        });

        const created = await client.createSandbox({
            template: "base-template",
            envs: { NODE_ENV: "test" },
            metadata: { team: "plugins" },
            lifecycle: { ttlMs: 10_000 },
        });
        const command = await client.runCommand({
            sandboxId: created.sandboxId,
            cmd: "pwd",
            cwd: "/workspace",
            envs: { DEBUG: "1" },
            timeoutMs: 1_500,
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
        const host = await client.getHost({
            sandboxId: created.sandboxId,
            port: 3000,
        });
        await client.killSandbox({ sandboxId: created.sandboxId });

        expect(createCalls).toEqual([
            {
                templateOrOptions: "base-template",
                options: {
                    apiKey: "e2b-key",
                    domain: "e2b.example",
                    requestTimeoutMs: 2_000,
                    timeoutMs: 10_000,
                    envs: { NODE_ENV: "test" },
                    metadata: { team: "plugins" },
                },
            },
        ]);
        expect(created).toEqual({ sandboxId: "e2b-1" });
        expect(connectCalls).toEqual(
            new Array(8).fill({
                sandboxId: "e2b-1",
                options: {
                    apiKey: "e2b-key",
                    domain: "e2b.example",
                    requestTimeoutMs: 2_000,
                },
            }),
        );
        expect(commandCalls).toEqual([
            {
                cmd: "pwd",
                options: {
                    cwd: "/workspace",
                    envs: { DEBUG: "1" },
                    timeoutMs: 1_500,
                },
            },
        ]);
        expect(command).toEqual({ exitCode: 0, stdout: "hello", stderr: "", pid: 99 });
        expect(readCalls).toEqual(["/tmp/demo.txt"]);
        expect(content).toBe("file-content");
        expect(writeCalls).toEqual([{ path: "/tmp/out.txt", data: "payload" }]);
        expect(writeResult).toEqual({ path: "/tmp/out.txt" });
        expect(listCalls).toEqual(["/tmp"]);
        expect(entries).toEqual([{ name: "demo.txt", path: "/tmp/demo.txt", type: "file" }]);
        expect(makeDirCalls).toEqual(["/tmp/new"]);
        expect(mkdirResult).toEqual({ created: true });
        expect(removeCalls).toEqual(["/tmp/old"]);
        expect(hostCalls).toEqual([3000]);
        expect(host).toBe("https://host.example/3000");
        expect(killCalls).toEqual([1]);
    });

    test("creates sandbox without template when no template is configured", async () => {
        const createCalls: CreateCall[] = [];
        const sandbox = createSandboxStub({ sandboxId: "e2b-no-template" });

        mock.module("e2b", () => ({
            Sandbox: {
                async create(templateOrOptions?: unknown, options?: Record<string, unknown>) {
                    createCalls.push({ templateOrOptions, options });
                    return sandbox;
                },
                async connect() {
                    return sandbox;
                },
            },
        }));

        const client = createE2BSandboxClient({
            accessToken: "token-1",
            requestTimeoutMs: 500,
        });

        await client.createSandbox({
            envs: { MODE: "bare" },
            metadata: { owner: "plugins" },
            lifecycle: { ttlMs: 2_000 },
        });

        expect(createCalls).toEqual([
            {
                templateOrOptions: {
                    accessToken: "token-1",
                    requestTimeoutMs: 500,
                    timeoutMs: 2_000,
                    envs: { MODE: "bare" },
                    metadata: { owner: "plugins" },
                },
                options: undefined,
            },
        ]);
    });

    test("forwards shared create fields from createSandbox params", async () => {
        const createCalls: CreateCall[] = [];
        const sandbox = createSandboxStub({ sandboxId: "e2b-override" });

        mock.module("e2b", () => ({
            Sandbox: {
                async create(templateOrOptions?: unknown, options?: Record<string, unknown>) {
                    createCalls.push({ templateOrOptions, options });
                    return sandbox;
                },
                async connect() {
                    return sandbox;
                },
            },
        }));

        const client = createE2BSandboxClient({
            apiKey: "config-key",
        });

        await client.createSandbox({
            template: "call-template",
            envs: { CALL: "1" },
            metadata: { level: "call" },
            lifecycle: { ttlMs: 5_000 },
        });

        expect(createCalls).toEqual([
            {
                templateOrOptions: "call-template",
                options: {
                    apiKey: "config-key",
                    timeoutMs: 5_000,
                    envs: { CALL: "1" },
                    metadata: { level: "call" },
                },
            },
        ]);
    });

    test("omits undefined command options and preserves partial command results", async () => {
        const commandCalls: CommandCall[] = [];
        const sandbox = createSandboxStub({
            commands: {
                async run(cmd, options) {
                    commandCalls.push({ cmd, options });
                    return { exitCode: 7 };
                },
            },
        });

        mock.module("e2b", () => ({
            Sandbox: {
                async create() {
                    return sandbox;
                },
                async connect() {
                    return sandbox;
                },
            },
        }));

        const client = createE2BSandboxClient();
        const result = await client.runCommand({
            sandboxId: "e2b-1",
            cmd: "false",
        });

        expect(commandCalls).toEqual([{ cmd: "false", options: {} }]);
        expect(result).toEqual({
            exitCode: 7,
            stdout: undefined,
            stderr: undefined,
            pid: undefined,
        });
    });

    test("returns provider path when write succeeds with an explicit returned path", async () => {
        const sandbox = createSandboxStub({
            files: {
                async read() {
                    return "ignored";
                },
                async write() {
                    return { path: "/tmp/provider-path.txt" };
                },
                async list(path) {
                    return [{ name: "demo.txt", path: `${path}/demo.txt`, type: "file" }];
                },
                async makeDir() {
                    return true;
                },
                async remove() {},
            },
        });

        mock.module("e2b", () => ({
            Sandbox: {
                async create() {
                    return sandbox;
                },
                async connect() {
                    return sandbox;
                },
            },
        }));

        const client = createE2BSandboxClient();
        const result = await client.writeFile({
            sandboxId: "e2b-1",
            path: "/tmp/requested.txt",
            content: "payload",
        });

        expect(result).toEqual({ path: "/tmp/provider-path.txt" });
    });
});
