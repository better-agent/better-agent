import { describe, expect, test } from "bun:test";
import type { ToolExecutionContext } from "@better-agent/core";
import type { SandboxClient } from "../../src";
import { sandbox } from "../../src";

type TestServerTool = {
    target: "server";
    name: string;
    execute: (args: unknown, ctx: ToolExecutionContext<unknown>) => unknown;
};

const createDriver = () => {
    const created: string[] = [];
    const commands: Array<{ sandboxId: string; cmd: string }> = [];
    const removed: Array<{ sandboxId: string; path: string }> = [];
    const killed: string[] = [];
    const createCalls: Array<Record<string, unknown> | undefined> = [];

    const driver: SandboxClient = {
        async createSandbox(params) {
            const sandboxId = `sbx-${created.length + 1}`;
            created.push(sandboxId);
            createCalls.push(params as Record<string, unknown> | undefined);
            return { sandboxId };
        },
        async runCommand(params) {
            commands.push({ sandboxId: params.sandboxId, cmd: params.cmd });
            return {
                exitCode: 0,
                stdout: `ran:${params.cmd}`,
            };
        },
        async readFile(params) {
            return `read:${params.sandboxId}:${params.path}`;
        },
        async writeFile(params) {
            return { path: params.path };
        },
        async listFiles(params) {
            return [{ name: "demo.txt", path: `${params.path}/demo.txt`, type: "file" }];
        },
        async makeDir() {
            return { created: true };
        },
        async removePath(params) {
            removed.push({ sandboxId: params.sandboxId, path: params.path });
        },
        async getHost(params) {
            return `https://${params.sandboxId}-${params.port}.example.test`;
        },
        async killSandbox(params) {
            killed.push(params.sandboxId);
        },
    };

    return {
        driver,
        created,
        commands,
        removed,
        killed,
        createCalls,
    };
};

const createToolContext = (
    overrides: Partial<ToolExecutionContext<unknown>> = {},
): ToolExecutionContext<unknown> => ({
    runId: "run-1",
    agentName: "assistant",
    threadId: "conv-1",
    toolCallId: "tool-1",
    toolName: "sandbox_exec",
    signal: new AbortController().signal,
    context: undefined,
    state: {
        get: () => undefined,
        set: () => {},
        patch: () => {},
    },
    ...overrides,
});

const getServerTool = async (
    plugin: ReturnType<typeof sandbox>,
    name: string,
): Promise<TestServerTool> => {
    const source = plugin.tools;
    if (!source) {
        throw new Error("sandbox did not provide any tools.");
    }

    const resolved = Array.isArray(source)
        ? source
        : typeof source === "function"
          ? await source(undefined)
          : [];
    const tools = Array.isArray(resolved) ? resolved : [resolved];

    for (const tool of tools) {
        if ("target" in tool && tool.target === "server" && tool.name === name && tool.execute) {
            return tool as TestServerTool;
        }
    }

    throw new Error(`Missing server tool '${name}'.`);
};

describe("sandbox", () => {
    test("rejects ttl lifecycle settings for Daytona", () => {
        const state = createDriver();
        state.driver.provider = "daytona";

        expect(() =>
            sandbox({
                client: state.driver,
                createConfig: {
                    lifecycle: {
                        ttlMs: 60_000,
                    },
                },
            }),
        ).toThrow(/lifecycle\.ttlMs/);
    });

    test("rejects startup and Daytona-style lifecycle settings for E2B", () => {
        const state = createDriver();
        state.driver.provider = "e2b";

        expect(() =>
            sandbox({
                client: state.driver,
                createConfig: {
                    startupTimeoutMs: 30_000,
                },
            }),
        ).toThrow(/startupTimeoutMs/);

        expect(() =>
            sandbox({
                client: state.driver,
                createConfig: {
                    lifecycle: {
                        idleStopMs: 60_000,
                    },
                },
            }),
        ).toThrow(/idleStopMs/);
    });

    test("reuses one sandbox across one thread when configured with client", async () => {
        const state = createDriver();
        const plugin = sandbox({ client: state.driver });
        const execTool = await getServerTool(plugin, "sandbox_exec");

        const first = await execTool.execute(
            { cmd: "pwd" },
            createToolContext({ runId: "run-1", toolCallId: "msg-1" }),
        );
        const second = await execTool.execute(
            { cmd: "ls" },
            createToolContext({ runId: "run-2", toolCallId: "msg-2" }),
        );

        expect(state.created).toEqual(["sbx-1"]);
        expect(state.commands).toEqual([
            { sandboxId: "sbx-1", cmd: "pwd" },
            { sandboxId: "sbx-1", cmd: "ls" },
        ]);
        expect(first).toMatchObject({
            sandboxId: "sbx-1",
            createdSandbox: true,
            stdout: "ran:pwd",
        });
        expect(second).toMatchObject({
            sandboxId: "sbx-1",
            createdSandbox: false,
            stdout: "ran:ls",
        });
    });

    test("uses explicit sandbox ids without creating a managed session", async () => {
        const state = createDriver();
        const plugin = sandbox({ client: state.driver });
        const execTool = await getServerTool(plugin, "sandbox_exec");

        const result = await execTool.execute(
            { sandboxId: "external-1", cmd: "echo hi" },
            createToolContext(),
        );

        expect(state.created).toEqual([]);
        expect(state.commands).toEqual([{ sandboxId: "external-1", cmd: "echo hi" }]);
        expect(result).toMatchObject({
            sandboxId: "external-1",
            createdSandbox: false,
            stdout: "ran:echo hi",
        });
    });

    test("clears the stored sandbox when kill is called", async () => {
        const state = createDriver();
        const plugin = sandbox({ client: state.driver });
        const createTool = await getServerTool(plugin, "sandbox_create");
        const killTool = await getServerTool(plugin, "sandbox_kill");
        const execTool = await getServerTool(plugin, "sandbox_exec");

        await createTool.execute({}, createToolContext());
        const killResult = await killTool.execute({}, createToolContext());
        const nextExec = await execTool.execute(
            { cmd: "whoami" },
            createToolContext({ runId: "run-2", toolCallId: "msg-2" }),
        );

        expect(state.killed).toEqual(["sbx-1"]);
        expect(killResult).toMatchObject({
            sandboxId: "sbx-1",
            killed: true,
            clearedSessionKey: "thread:conv-1",
        });
        expect(state.created).toEqual(["sbx-1", "sbx-2"]);
        expect(nextExec).toMatchObject({
            sandboxId: "sbx-2",
            createdSandbox: true,
        });
    });

    test("clears the stored sandbox when killing the managed sandbox by explicit id", async () => {
        const state = createDriver();
        const plugin = sandbox({ client: state.driver });
        const createTool = await getServerTool(plugin, "sandbox_create");
        const killTool = await getServerTool(plugin, "sandbox_kill");
        const execTool = await getServerTool(plugin, "sandbox_exec");

        const created = (await createTool.execute({}, createToolContext())) as {
            sandboxId: string;
        };
        const killResult = await killTool.execute(
            { sandboxId: created.sandboxId },
            createToolContext(),
        );
        const nextExec = await execTool.execute(
            { cmd: "whoami" },
            createToolContext({ runId: "run-2", toolCallId: "msg-2" }),
        );

        expect(state.killed).toEqual(["sbx-1"]);
        expect(killResult).toMatchObject({
            sandboxId: "sbx-1",
            killed: true,
            clearedSessionKey: "thread:conv-1",
        });
        expect(state.created).toEqual(["sbx-1", "sbx-2"]);
        expect(nextExec).toMatchObject({
            sandboxId: "sbx-2",
            createdSandbox: true,
        });
    });

    test("does not reuse sandboxes when there is no thread id", async () => {
        const state = createDriver();
        const plugin = sandbox({ client: state.driver });
        const execTool = await getServerTool(plugin, "sandbox_exec");

        await execTool.execute(
            { cmd: "pwd" },
            createToolContext({ threadId: undefined, runId: "run-1" }),
        );
        await execTool.execute(
            { cmd: "ls" },
            createToolContext({
                threadId: undefined,
                runId: "run-2",
                toolCallId: "msg-2",
            }),
        );

        expect(state.created).toEqual(["sbx-1", "sbx-2"]);
    });

    test("resolves scalar create params as createConfig, then input, then createDefaults", async () => {
        const state = createDriver();
        const plugin = sandbox({
            client: state.driver,
            createConfig: {
                template: "trusted-template",
            },
            createDefaults: {
                template: "default-template",
                startupTimeoutMs: 30_000,
            },
        });
        const createTool = await getServerTool(plugin, "sandbox_create");

        await createTool.execute(
            {
                forceNew: true,
                template: "llm-template",
                startupTimeoutMs: 5_000,
            },
            createToolContext(),
        );

        expect(state.createCalls).toEqual([
            {
                template: "trusted-template",
                startupTimeoutMs: 5_000,
                envs: undefined,
                metadata: undefined,
                lifecycle: undefined,
            },
        ]);
    });

    test("merges envs and metadata with createConfig winning over input and createDefaults", async () => {
        const state = createDriver();
        const plugin = sandbox({
            client: state.driver,
            createConfig: {
                envs: {
                    API_URL: "https://trusted.example.test",
                },
                metadata: {
                    owner: "user",
                },
                lifecycle: {
                    deleteAfterMs: 120_000,
                },
            },
            createDefaults: {
                envs: {
                    FEATURE_FLAG: "disabled",
                },
                metadata: {
                    region: "eu-west-1",
                },
                lifecycle: {
                    idleStopMs: 60_000,
                    archiveAfterMs: 180_000,
                },
            },
        });
        const createTool = await getServerTool(plugin, "sandbox_create");

        await createTool.execute(
            {
                forceNew: true,
                envs: {
                    FEATURE_FLAG: "enabled",
                    EXTRA: "1",
                },
                metadata: {
                    owner: "assistant",
                    note: "from-input",
                },
                lifecycle: {
                    idleStopMs: 90_000,
                },
            },
            createToolContext(),
        );

        expect(state.createCalls).toEqual([
            {
                template: undefined,
                startupTimeoutMs: undefined,
                envs: {
                    FEATURE_FLAG: "enabled",
                    EXTRA: "1",
                    API_URL: "https://trusted.example.test",
                },
                metadata: {
                    region: "eu-west-1",
                    owner: "user",
                    note: "from-input",
                },
                lifecycle: {
                    idleStopMs: 90_000,
                    archiveAfterMs: 180_000,
                    deleteAfterMs: 120_000,
                },
            },
        ]);
    });

    for (const testCase of [
        {
            name: "undefined",
            sessionKey: () => undefined,
        },
        {
            name: "null",
            sessionKey: () => null,
        },
    ] as const) {
        test(`does not reuse sandboxes when custom sessionKey returns ${testCase.name}`, async () => {
            const state = createDriver();
            const plugin = sandbox({
                client: state.driver,
                sessionKey: testCase.sessionKey,
            });
            const execTool = await getServerTool(plugin, "sandbox_exec");

            await execTool.execute(
                { cmd: "pwd" },
                createToolContext({ runId: "run-1", toolCallId: "msg-1" }),
            );
            await execTool.execute(
                { cmd: "ls" },
                createToolContext({ runId: "run-2", toolCallId: "msg-2" }),
            );

            expect(state.created).toEqual(["sbx-1", "sbx-2"]);
        });
    }

    test("reuses sandboxes when custom sessionKey returns a stable key", async () => {
        const state = createDriver();
        const plugin = sandbox({
            client: state.driver,
            sessionKey: ({ threadId }) => (threadId ? `stable:${threadId}` : undefined),
        });
        const execTool = await getServerTool(plugin, "sandbox_exec");

        await execTool.execute(
            { cmd: "pwd" },
            createToolContext({ runId: "run-1", toolCallId: "msg-1" }),
        );
        await execTool.execute(
            { cmd: "ls" },
            createToolContext({ runId: "run-2", toolCallId: "msg-2" }),
        );

        expect(state.created).toEqual(["sbx-1"]);
        expect(state.commands).toEqual([
            { sandboxId: "sbx-1", cmd: "pwd" },
            { sandboxId: "sbx-1", cmd: "ls" },
        ]);
    });

    test("rejects whitespace-only explicit sandbox ids", async () => {
        const state = createDriver();
        const plugin = sandbox({ client: state.driver });
        const killTool = await getServerTool(plugin, "sandbox_kill");

        expect(killTool.execute({ sandboxId: "   " }, createToolContext())).rejects.toMatchObject({
            code: "VALIDATION_FAILED",
            message: "`sandboxId` must be a non-empty string when provided.",
        });
        expect(state.killed).toEqual([]);
    });

    for (const testCase of [
        {
            name: "returns preview tokens when the client provides structured host info",
            getHost: async (sandboxId: string, port: number) => ({
                url: `https://${sandboxId}-${port}.example.test`,
                token: "preview-token",
            }),
            expected: {
                sandboxId: "sbx-1",
                host: "https://sbx-1-3000.example.test",
                token: "preview-token",
            },
        },
        {
            name: "normalizes bare hostnames into https urls",
            getHost: async (sandboxId: string, port: number) => `${port}-${sandboxId}.example.test`,
            expected: {
                sandboxId: "sbx-1",
                host: "https://3000-sbx-1.example.test",
            },
        },
    ] as const) {
        test(testCase.name, async () => {
            const state = createDriver();
            state.driver.getHost = async (params) =>
                testCase.getHost(params.sandboxId, params.port);

            const plugin = sandbox({ client: state.driver });
            const createTool = await getServerTool(plugin, "sandbox_create");
            const getHostTool = await getServerTool(plugin, "sandbox_get_host");

            await createTool.execute({}, createToolContext());
            const result = await getHostTool.execute({ port: 3000 }, createToolContext());

            expect(result).toMatchObject(testCase.expected);
        });
    }
});
