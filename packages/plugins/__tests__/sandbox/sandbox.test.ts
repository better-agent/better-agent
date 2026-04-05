import { describe, expect, test } from "bun:test";
import type { ServerToolDefinition, ToolRunContext } from "@better-agent/core";
import type { SandboxDriver } from "../../src";
import { sandboxPlugin } from "../../src";

const createDriver = () => {
    const created: string[] = [];
    const commands: Array<{ sandboxId: string; cmd: string }> = [];
    const removed: Array<{ sandboxId: string; path: string }> = [];
    const killed: string[] = [];

    const driver: SandboxDriver = {
        async createSandbox() {
            const sandboxId = `sbx-${created.length + 1}`;
            created.push(sandboxId);
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
    };
};

const createToolContext = (overrides: Partial<ToolRunContext> = {}): ToolRunContext => ({
    runId: "run-1",
    agentName: "assistant",
    conversationId: "conv-1",
    parentMessageId: "msg-1",
    signal: new AbortController().signal,
    emit: async () => {},
    ...overrides,
});

const getServerTool = (
    plugin: ReturnType<typeof sandboxPlugin>,
    name: string,
): ServerToolDefinition => {
    const tools = Array.isArray(plugin.tools) ? plugin.tools : [];
    const tool = tools.find(
        (candidate): candidate is ServerToolDefinition =>
            candidate.kind === "server" && candidate.name === name,
    );

    if (!tool) {
        throw new Error(`Missing server tool '${name}'.`);
    }

    return tool;
};

describe("sandboxPlugin", () => {
    test("reuses one sandbox across one conversation when configured with client", async () => {
        const state = createDriver();
        const plugin = sandboxPlugin({ client: state.driver });
        const execTool = getServerTool(plugin, "sandbox_exec");

        const first = await execTool.handler(
            { cmd: "pwd" } as never,
            createToolContext({ runId: "run-1", parentMessageId: "msg-1" }),
        );
        const second = await execTool.handler(
            { cmd: "ls" } as never,
            createToolContext({ runId: "run-2", parentMessageId: "msg-2" }),
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
        const plugin = sandboxPlugin({ client: state.driver });
        const execTool = getServerTool(plugin, "sandbox_exec");

        const result = await execTool.handler(
            { sandboxId: "external-1", cmd: "echo hi" } as never,
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
        const plugin = sandboxPlugin({ client: state.driver });
        const createTool = getServerTool(plugin, "sandbox_create");
        const killTool = getServerTool(plugin, "sandbox_kill");
        const execTool = getServerTool(plugin, "sandbox_exec");

        await createTool.handler({} as never, createToolContext());
        const killResult = await killTool.handler({} as never, createToolContext());
        const nextExec = await execTool.handler(
            { cmd: "whoami" } as never,
            createToolContext({ runId: "run-2", parentMessageId: "msg-2" }),
        );

        expect(state.killed).toEqual(["sbx-1"]);
        expect(killResult).toMatchObject({
            sandboxId: "sbx-1",
            killed: true,
            clearedSessionKey: "conversation:conv-1",
        });
        expect(state.created).toEqual(["sbx-1", "sbx-2"]);
        expect(nextExec).toMatchObject({
            sandboxId: "sbx-2",
            createdSandbox: true,
        });
    });

    test("does not reuse sandboxes when there is no conversation id", async () => {
        const state = createDriver();
        const plugin = sandboxPlugin({ driver: state.driver });
        const execTool = getServerTool(plugin, "sandbox_exec");

        await execTool.handler(
            { cmd: "pwd" } as never,
            createToolContext({ conversationId: undefined, runId: "run-1" }),
        );
        await execTool.handler(
            { cmd: "ls" } as never,
            createToolContext({
                conversationId: undefined,
                runId: "run-2",
                parentMessageId: "msg-2",
            }),
        );

        expect(state.created).toEqual(["sbx-1", "sbx-2"]);
    });

    test("returns preview tokens when the client provides structured host info", async () => {
        const state = createDriver();
        state.driver.getHost = async (params) => ({
            url: `https://${params.sandboxId}-${params.port}.example.test`,
            token: "preview-token",
        });

        const plugin = sandboxPlugin({ client: state.driver });
        const createTool = getServerTool(plugin, "sandbox_create");
        const getHostTool = getServerTool(plugin, "sandbox_get_host");

        await createTool.handler({} as never, createToolContext());
        const result = await getHostTool.handler({ port: 3000 } as never, createToolContext());

        expect(result).toMatchObject({
            sandboxId: "sbx-1",
            host: "https://sbx-1-3000.example.test",
            token: "preview-token",
        });
    });

    test("normalizes bare hostnames into https urls", async () => {
        const state = createDriver();
        state.driver.getHost = async (params) => `${params.port}-${params.sandboxId}.example.test`;

        const plugin = sandboxPlugin({ client: state.driver });
        const createTool = getServerTool(plugin, "sandbox_create");
        const getHostTool = getServerTool(plugin, "sandbox_get_host");

        await createTool.handler({} as never, createToolContext());
        const result = await getHostTool.handler({ port: 3000 } as never, createToolContext());

        expect(result).toMatchObject({
            sandboxId: "sbx-1",
            host: "https://3000-sbx-1.example.test",
        });
    });
});
