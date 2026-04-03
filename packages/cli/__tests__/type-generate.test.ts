import { describe, expect, it } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import ts from "typescript";
import { generateTypes } from "../src/typegen/command";

const repoRoot = path.resolve(import.meta.dir, "../../..");

const toImportPath = (fromFile: string, targetFile: string) => {
    const relative = path.relative(path.dirname(fromFile), targetFile).replaceAll(path.sep, "/");
    return relative.startsWith(".") ? relative : `./${relative}`;
};

const createTempProject = async (source?: string) => {
    const dir = await mkdtemp(path.join(repoRoot, ".tmp-cli-types-"));
    const configPath = path.join(dir, "better-agent.ts");

    const configSource =
        source ??
        `
type WriterModel = {
    providerId: "openai";
    modelId: "gpt-4.1";
    options: {
        instructions?: string;
        reasoningEffort?: "low" | "medium" | "high";
        textVerbosity?: "low" | "medium" | "high";
    };
    caps: {
        inputModalities: { text: true };
        inputShape: "chat";
        outputModalities: { text: { options: { textStyle?: "short" | "long" } } };
        structured_output: true;
        tools: true;
    };
};

const writerModel = {} as WriterModel;

export const ba = {
    config: {
        agents: [
            {
                name: "helloAgent",
                model: writerModel,
                contextSchema: {
                    type: "object",
                    properties: {
                        tenantId: { type: "string" },
                        retries: { type: "number" },
                    },
                    required: ["tenantId"],
                    additionalProperties: false,
                },
                outputSchema: {
                    schema: {
                        type: "object",
                        properties: {
                            summary: { type: "string" },
                        },
                        required: ["summary"],
                        additionalProperties: false,
                    },
                },
                tools: [
                    {
                        kind: "client",
                        name: "delete_project_data",
                        schema: {
                            type: "object",
                            properties: {
                                projectId: { type: "string" },
                                reason: { type: "string" },
                            },
                            required: ["projectId"],
                        },
                    },
                    {
                        kind: "server",
                        name: "server_only",
                        schema: { type: "object" },
                    },
                ],
            },
        ],
        tools: [
            {
                kind: "client",
                name: "pick_file",
                schema: {
                    type: "object",
                    properties: {
                        accept: { type: "string" },
                    },
                },
            },
        ],
    },
    async run() {
        return { response: { output: [], finishReason: "stop", usage: {} } };
    },
    stream() {
        return {
            runId: "run_1",
            events: (async function* () {})(),
            result: Promise.resolve({ response: { output: [], finishReason: "stop", usage: {} } }),
        };
    },
    handler() {
        return Promise.resolve(new Response(null, { status: 204 }));
    },
} as const;
`;

    await writeFile(configPath, configSource);
    return { dir, configPath };
};

const createMultiAppProject = async () => {
    const dir = await mkdtemp(path.join(repoRoot, ".tmp-cli-types-"));
    const configPath = path.join(dir, "better-agent.ts");

    const configSource = `
export const alpha = {
    config: {
        agents: [{ name: "alphaAgent", model: { caps: { inputModalities: { text: true } } } }],
    },
    async run() {
        return { response: { output: [], finishReason: "stop", usage: {} } };
    },
    stream() {
        return {
            runId: "run_alpha",
            events: (async function* () {})(),
            result: Promise.resolve({ response: { output: [], finishReason: "stop", usage: {} } }),
        };
    },
    handler() {
        return Promise.resolve(new Response(null, { status: 204 }));
    },
} as const;

export const beta = {
    config: {
        agents: [{ name: "betaAgent", model: { caps: { inputModalities: { text: true } } } }],
        tools: [
            {
                kind: "client",
                name: "pick_color",
                schema: { type: "object", properties: { hex: { type: "string" } } },
            },
        ],
    },
    async run() {
        return { response: { output: [], finishReason: "stop", usage: {} } };
    },
    stream() {
        return {
            runId: "run_beta",
            events: (async function* () {})(),
            result: Promise.resolve({ response: { output: [], finishReason: "stop", usage: {} } }),
        };
    },
    handler() {
        return Promise.resolve(new Response(null, { status: 204 }));
    },
} as const;
`;

    await writeFile(configPath, configSource);
    return { dir, configPath };
};

const createIndirectArrayProject = async () => {
    const dir = await mkdtemp(path.join(repoRoot, ".tmp-cli-types-"));
    const configPath = path.join(dir, "better-agent.ts");

    const configSource = `
type WriterModel = {
    caps: {
        inputModalities: { text: true };
        outputModalities: { text: true };
        structured_output: true;
        tools: true;
    };
};

const writerModel = {} as WriterModel;

const helloAgent = {
    name: "helloAgent",
    model: writerModel,
    contextSchema: {
        type: "object",
        properties: {
            tenantId: { type: "string" },
            retries: { type: "number" },
        },
        required: ["tenantId"],
        additionalProperties: false,
    },
    tools: [
        {
            kind: "client",
            name: "delete_project_data",
            schema: {
                type: "object",
                properties: {
                    projectId: { type: "string" },
                    reason: { type: "string" },
                },
                required: ["projectId"],
            },
        },
        {
            kind: "server",
            name: "server_only",
            schema: { type: "object" },
        },
    ],
} as const;

const agents = [helloAgent] as const;

const appTools = [
    {
        kind: "client",
        name: "pick_file",
        schema: {
            type: "object",
            properties: {
                accept: { type: "string" },
            },
        },
    },
    {
        kind: "server",
        name: "write_file",
        schema: { type: "object" },
    },
] as const;

export const ba = {
    config: {
        agents,
        tools: appTools,
    },
    async run() {
        return { response: { output: [], finishReason: "stop", usage: {} } };
    },
    stream() {
        return {
            runId: "run_1",
            events: (async function* () {})(),
            result: Promise.resolve({ response: { output: [], finishReason: "stop", usage: {} } }),
        };
    },
    handler() {
        return Promise.resolve(new Response(null, { status: 204 }));
    },
} as const;
`;

    await writeFile(configPath, configSource);
    return { dir, configPath };
};

const createUnsupportedComputedAgentsProject = async () => {
    const dir = await mkdtemp(path.join(repoRoot, ".tmp-cli-types-"));
    const configPath = path.join(dir, "better-agent.ts");

    const configSource = `
type WriterModel = {
    caps: {
        inputModalities: { text: true };
    };
};

const writerModel = {} as WriterModel;

const helloAgent = {
    name: "helloAgent",
    model: writerModel,
} as const;

const getAgents = () => [helloAgent] as const;

export const ba = {
    config: {
        agents: getAgents(),
    },
    async run() {
        return { response: { output: [], finishReason: "stop", usage: {} } };
    },
    stream() {
        return {
            runId: "run_1",
            events: (async function* () {})(),
            result: Promise.resolve({ response: { output: [], finishReason: "stop", usage: {} } }),
        };
    },
    handler() {
        return Promise.resolve(new Response(null, { status: 204 }));
    },
} as const;
`;

    await writeFile(configPath, configSource);
    return { dir, configPath };
};

const createUnsupportedSpreadToolsProject = async () => {
    const dir = await mkdtemp(path.join(repoRoot, ".tmp-cli-types-"));
    const configPath = path.join(dir, "better-agent.ts");

    const configSource = `
type WriterModel = {
    caps: {
        inputModalities: { text: true };
        tools: true;
    };
};

const writerModel = {} as WriterModel;

const sharedTools = [
    {
        kind: "client",
        name: "pick_file",
        schema: {
            type: "object",
            properties: {
                accept: { type: "string" },
            },
        },
    },
] as const;

export const ba = {
    config: {
        agents: [
            {
                name: "helloAgent",
                model: writerModel,
                tools: [...sharedTools],
            },
        ],
    },
    async run() {
        return { response: { output: [], finishReason: "stop", usage: {} } };
    },
    stream() {
        return {
            runId: "run_1",
            events: (async function* () {})(),
            result: Promise.resolve({ response: { output: [], finishReason: "stop", usage: {} } }),
        };
    },
    handler() {
        return Promise.resolve(new Response(null, { status: 204 }));
    },
} as const;
`;

    await writeFile(configPath, configSource);
    return { dir, configPath };
};

const createUnsupportedSpreadAgentsProject = async () => {
    const dir = await mkdtemp(path.join(repoRoot, ".tmp-cli-types-"));
    const configPath = path.join(dir, "better-agent.ts");

    const configSource = `
type WriterModel = {
    caps: {
        inputModalities: { text: true };
    };
};

const writerModel = {} as WriterModel;

const sharedAgents = [
    {
        name: "helloAgent",
        model: writerModel,
    },
] as const;

export const ba = {
    config: {
        agents: [...sharedAgents],
    },
    async run() {
        return { response: { output: [], finishReason: "stop", usage: {} } };
    },
    stream() {
        return {
            runId: "run_1",
            events: (async function* () {})(),
            result: Promise.resolve({ response: { output: [], finishReason: "stop", usage: {} } }),
        };
    },
    handler() {
        return Promise.resolve(new Response(null, { status: 204 }));
    },
} as const;
`;

    await writeFile(configPath, configSource);
    return { dir, configPath };
};

const createBasicExampleLikeProject = async () =>
    createTempProject(`
type OpenAITextModel = {
    caps: {
        inputModalities: { text: true };
        outputModalities: { text: true };
        supportsInstruction: true;
    };
};

const openai = {
    text(_model: string) {
        return {} as OpenAITextModel;
    },
};

const helloAgent = {
    name: "helloAgent",
    model: openai.text("gpt-4.1"),
    instruction:
        "You are a friendly hello world assistant. Keep replies short, clear, and conversational.",
} as const;

const app = {
    config: {
        agents: [helloAgent],
    },
    async run() {
        return { response: { output: [], finishReason: "stop", usage: {} } };
    },
    stream() {
        return {
            runId: "run_1",
            events: (async function* () {})(),
            result: Promise.resolve({ response: { output: [], finishReason: "stop", usage: {} } }),
        };
    },
    handler() {
        return Promise.resolve(new Response(null, { status: 204 }));
    },
} as const;

export default app;
`);

const createClientToolExampleLikeProject = async () =>
    createTempProject(`
type OpenAITextModel = {
    caps: {
        inputModalities: { text: true };
        outputModalities: { text: true };
        tools: true;
    };
};

const openai = {
    model(_model: string) {
        return {} as OpenAITextModel;
    },
    tools: {
        webSearch(_options: { search_context_size: "medium" | "low" }) {
            return {
                kind: "hosted",
                name: "web_search",
                schema: { type: "object" },
            } as const;
        },
    },
};

const getClientTime = {
    kind: "client",
    name: "get_client_time",
    schema: {
        type: "object",
        properties: {
            locale: { type: "string" },
        },
        additionalProperties: false,
    },
} as const;

const helloAgent = {
    name: "helloAgent",
    model: openai.model("gpt-4.1"),
    execution: {
        scope: "multi",
        modes: {
            loop: { mode: "loop" },
            once: { mode: "once" },
        },
    },
    tools: [getClientTime, openai.tools.webSearch({ search_context_size: "medium" })],
} as const;

export const ba = {
    config: {
        agents: [helloAgent],
    },
    async run() {
        return { response: { output: [], finishReason: "stop", usage: {} } };
    },
    stream() {
        return {
            runId: "run_1",
            events: (async function* () {})(),
            result: Promise.resolve({ response: { output: [], finishReason: "stop", usage: {} } }),
        };
    },
    handler() {
        return Promise.resolve(new Response(null, { status: 204 }));
    },
} as const;
`);

const createDefinedClientToolExampleProject = async () =>
    createTempProject(`
type OpenAITextModel = {
    caps: {
        inputModalities: { text: true };
        outputModalities: { text: true };
        tools: true;
    };
};

type ClientTool<N extends string, S> = {
    name: N;
    kind: "client";
    schema: S;
};

const defineTool = <const N extends string, const S>(def: {
    name: N;
    schema: S;
}) => ({
    client: () =>
        ({
            name: def.name,
            kind: "client" as const,
            schema: def.schema,
        }) satisfies ClientTool<N, S>,
});

const openai = {
    model(_model: string) {
        return {} as OpenAITextModel;
    },
};

const baseClientTimeTool = defineTool({
    name: "get_client_time",
    schema: {
        type: "object",
        properties: {
            locale: { type: "string" },
        },
        additionalProperties: false,
    },
} as const);

const getClientTime = baseClientTimeTool;

const helloAgent = {
    name: "helloAgent",
    model: openai.model("gpt-4.1"),
    tools: [getClientTime.client()],
} as const;

export const ba = {
    config: {
        agents: [helloAgent],
    },
    async run() {
        return { response: { output: [], finishReason: "stop", usage: {} } };
    },
    stream() {
        return {
            runId: "run_1",
            events: (async function* () {})(),
            result: Promise.resolve({ response: { output: [], finishReason: "stop", usage: {} } }),
        };
    },
    handler() {
        return Promise.resolve(new Response(null, { status: 204 }));
    },
} as const;
`);

const createImportedDefinedClientToolExampleProject = async () => {
    const dir = await mkdtemp(path.join(repoRoot, ".tmp-cli-types-"));
    const configPath = path.join(dir, "better-agent.ts");
    const toolModulePath = path.join(dir, "tools.ts");

    await writeFile(
        toolModulePath,
        `
type ClientTool<N extends string, S> = {
    name: N;
    kind: "client";
    schema: S;
};

export const defineTool = <const N extends string, const S>(def: {
    name: N;
    schema: S;
}) => ({
    client: () =>
        ({
            name: def.name,
            kind: "client" as const,
            schema: def.schema,
        }) satisfies ClientTool<N, S>,
});

const baseClientTimeTool = defineTool({
    name: "get_client_time",
    schema: {
        type: "object",
        properties: {
            locale: { type: "string" },
        },
        additionalProperties: false,
    },
} as const);

const getClientTime = baseClientTimeTool;

export const clientTimeTool = getClientTime.client();
`,
    );

    await writeFile(
        configPath,
        `
import { clientTimeTool } from "./tools";

type OpenAITextModel = {
    caps: {
        inputModalities: { text: true };
        outputModalities: { text: true };
        tools: true;
    };
};

const openai = {
    model(_model: string) {
        return {} as OpenAITextModel;
    },
};

const helloAgent = {
    name: "helloAgent",
    model: openai.model("gpt-4.1"),
    tools: [clientTimeTool],
} as const;

export const ba = {
    config: {
        agents: [helloAgent],
    },
    async run() {
        return { response: { output: [], finishReason: "stop", usage: {} } };
    },
    stream() {
        return {
            runId: "run_1",
            events: (async function* () {})(),
            result: Promise.resolve({ response: { output: [], finishReason: "stop", usage: {} } }),
        };
    },
    handler() {
        return Promise.resolve(new Response(null, { status: 204 }));
    },
} as const;
`,
    );

    return { dir, configPath };
};

const createStandardSchemaTypeProject = async () =>
    createTempProject(`
type WriterModel = {
    caps: {
        inputModalities: { text: true };
        outputModalities: { text: true };
        structured_output: true;
        tools: true;
    };
};

const writerModel = {} as WriterModel;

const contextSchema = {
    "~standard": {
        version: 1,
        vendor: "test",
        types: {
            input: {} as {
                role: "admin" | "support";
                tenantId?: string;
            },
        },
    },
} as const;

const responseSchema = {
    "~standard": {
        version: 1,
        vendor: "test",
        types: {
            input: {} as {
                answer: string;
                priority: "low" | "high";
            },
        },
    },
} as const;

const pickFileSchema = {
    "~standard": {
        version: 1,
        vendor: "test",
        types: {
            input: {} as {
                accept?: string;
                source: "local" | "cloud";
            },
        },
    },
} as const;

export const ba = {
    config: {
        agents: [
            {
                name: "helloAgent",
                model: writerModel,
                contextSchema,
                outputSchema: {
                    schema: responseSchema,
                    strict: true,
                },
                tools: [
                    {
                        kind: "client",
                        name: "pick_file",
                        schema: pickFileSchema,
                    },
                ],
            },
        ],
    },
    async run() {
        return { response: { output: [], finishReason: "stop", usage: {} } };
    },
    stream() {
        return {
            runId: "run_1",
            events: (async function* () {})(),
            result: Promise.resolve({ response: { output: [], finishReason: "stop", usage: {} } }),
        };
    },
    handler() {
        return Promise.resolve(new Response(null, { status: 204 }));
    },
} as const;
`);

const captureStderr = async (work: () => Promise<number>) => {
    const originalWrite = process.stderr.write;
    let stderr = "";
    process.stderr.write = ((chunk: string | Uint8Array) => {
        stderr += typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8");
        return true;
    }) as typeof process.stderr.write;

    try {
        const exitCode = await work();
        return { exitCode, stderr };
    } finally {
        process.stderr.write = originalWrite;
    }
};

const formatDiagnostic = (diagnostic: ts.Diagnostic) => {
    const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n");
    if (!diagnostic.file || diagnostic.start === undefined) return message;
    const { line, character } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
    return `${diagnostic.file.fileName}:${line + 1}:${character + 1} ${message}`;
};

const compileTypeAssertions = async (params: {
    dir: string;
    configPath: string;
    generatedTypePath: string;
}) => {
    const assertionPath = path.join(params.dir, "type-assertions.ts");
    const clientHelperPath = path.join(
        repoRoot,
        "packages",
        "client",
        "src",
        "types",
        "client-type-helpers.ts",
    );
    const clientIndexPath = path.join(repoRoot, "packages", "client", "src", "index.ts");

    const assertionSource = `
import { createClient } from ${JSON.stringify(toImportPath(assertionPath, clientIndexPath))};
import type {
    AgentContext,
    AgentNameFromApp,
    DefaultStructuredOutputForAgent,
    ModalitiesForAgent,
    NormalizeClientApp,
    RunInputForAgent,
    TextInputShorthandForAgent,
    ToolInputFromApp,
    ToolNameForApp,
} from ${JSON.stringify(toImportPath(assertionPath, clientHelperPath))};
import type { BAClientApp } from ${JSON.stringify(
        toImportPath(assertionPath, params.generatedTypePath),
    )};
import { ba } from ${JSON.stringify(toImportPath(assertionPath, params.configPath))};

type Equal<A, B> =
    (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2)
        ? (<T>() => T extends B ? 1 : 2) extends (<T>() => T extends A ? 1 : 2)
            ? true
            : false
        : false;

type Expect<T extends true> = T;

type ActualApp = NormalizeClientApp<typeof ba>;
type GeneratedApp = NormalizeClientApp<BAClientApp>;

type _agentNames = Expect<
    Equal<AgentNameFromApp<ActualApp>, AgentNameFromApp<GeneratedApp>>
>;
type _context = Expect<
    Equal<
        AgentContext<ActualApp, "helloAgent">,
        AgentContext<GeneratedApp, "helloAgent">
    >
>;
type _toolNames = Expect<
    Equal<ToolNameForApp<ActualApp>, ToolNameForApp<GeneratedApp>>
>;
type _toolInputApp = Expect<
    Equal<
        ToolInputFromApp<ActualApp, "pick_file">,
        ToolInputFromApp<GeneratedApp, "pick_file">
    >
>;
type _toolInputAgent = Expect<
    Equal<
        ToolInputFromApp<ActualApp, "delete_project_data">,
        ToolInputFromApp<GeneratedApp, "delete_project_data">
    >
>;
type _modalities = Expect<
    Equal<
        ModalitiesForAgent<ActualApp, "helloAgent">,
        ModalitiesForAgent<GeneratedApp, "helloAgent">
    >
>;
type _textInput = Expect<
    Equal<
        TextInputShorthandForAgent<ActualApp, "helloAgent">,
        TextInputShorthandForAgent<GeneratedApp, "helloAgent">
    >
>;
type _runInput = Expect<
    Equal<
        RunInputForAgent<ActualApp, "helloAgent">,
        RunInputForAgent<GeneratedApp, "helloAgent">
    >
>;
type _defaultOutput = Expect<
    Equal<
        DefaultStructuredOutputForAgent<ActualApp, "helloAgent">,
        DefaultStructuredOutputForAgent<GeneratedApp, "helloAgent">
    >
>;

const client = createClient<BAClientApp>({
    baseURL: "https://example.com/api",
    secret: "dev_secret",
    toolHandlers: {
        pick_file(input) {
            const value: string | undefined = input.accept;
            return value ?? null;
        },
        delete_project_data(input) {
            const projectId: string = input.projectId;
            const reason: string | undefined = input.reason;
            return { projectId, reason };
        },
    },
});

client.run("helloAgent", {
    input: "Write a short summary",
    context: {
        tenantId: "tenant_123",
        retries: 2,
    },
    modalities: ["text"],
});
`;

    await writeFile(assertionPath, assertionSource);

    const program = ts.createProgram({
        rootNames: [assertionPath],
        options: {
            noEmit: true,
            strict: true,
            target: ts.ScriptTarget.ES2022,
            module: ts.ModuleKind.ESNext,
            moduleResolution: ts.ModuleResolutionKind.Bundler,
            allowImportingTsExtensions: true,
            lib: ["lib.es2022.d.ts", "lib.dom.d.ts"],
            skipLibCheck: true,
            baseUrl: repoRoot,
            paths: {
                "@better-agent/client": ["packages/client/src/index.ts"],
                "@better-agent/core": ["packages/core/src/index.ts"],
                "@better-agent/core/*": ["packages/core/src/*"],
                "@better-agent/shared/*": ["packages/shared/src/*"],
            },
        },
    });

    return ts.getPreEmitDiagnostics(program).map(formatDiagnostic);
};

describe("CLI types generate", () => {
    it("returns 1 with BAD_REQUEST when no config paths are provided", async () => {
        const { exitCode, stderr } = await captureStderr(() => generateTypes({}));
        expect(exitCode).toBe(1);
        expect(stderr).toContain("[BAD_REQUEST]");
    });

    it("returns 1 with NOT_FOUND when config path does not exist", async () => {
        const dir = await mkdtemp(path.join(repoRoot, ".tmp-cli-types-"));

        try {
            const { exitCode, stderr } = await captureStderr(() =>
                generateTypes({
                    cwd: dir,
                    config: ["./missing-config.ts"],
                    yes: true,
                }),
            );

            expect(exitCode).toBe(1);
            expect(stderr).toContain("[NOT_FOUND]");
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });

    it("generates an import-free portable type that matches client-side inference", async () => {
        const { dir, configPath } = await createTempProject();
        const outPath = path.join(dir, "types", "better-agent.types.d.ts");

        try {
            const exitCode = await generateTypes({
                cwd: dir,
                config: [configPath],
                out: "./types/better-agent.types.d.ts",
                name: "BAClientApp",
                yes: true,
            });
            expect(exitCode).toBe(0);

            const generated = await readFile(outPath, "utf-8");
            expect(generated).toContain("export type BAClientApp = {");
            expect(generated).not.toContain("import ");
            expect(generated).not.toContain('import("');
            expect(generated).toContain('providerId: "openai"');
            expect(generated).toContain('modelId: "gpt-4.1"');
            expect(generated).not.toContain("instructions?:");
            expect(generated).not.toContain('"text"?:');
            expect(generated).toContain("reasoningEffort?:");
            expect(generated).toContain("textVerbosity?:");

            const diagnostics = await compileTypeAssertions({
                dir,
                configPath,
                generatedTypePath: outPath,
            });

            expect(diagnostics).toEqual([]);
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });

    it("extracts typed Standard Schema inputs without depending on validator syntax", async () => {
        const { dir, configPath } = await createStandardSchemaTypeProject();
        const outPath = path.join(dir, "types", "better-agent.types.d.ts");

        try {
            const exitCode = await generateTypes({
                cwd: dir,
                config: [configPath],
                out: "./types/better-agent.types.d.ts",
                name: "BAClientApp",
                yes: true,
            });

            expect(exitCode).toBe(0);

            const generated = await readFile(outPath, "utf-8");
            expect(generated).toContain('role: "admin" | "support"');
            expect(generated).toContain("tenantId?: string");
            expect(generated).toContain("answer: string");
            expect(generated).toContain('priority: "low" | "high"');
            expect(generated).toContain('source: "local" | "cloud"');
            expect(generated).toContain("accept?: string");
            expect(generated).toContain("strict: true");
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });

    it("generates unique aliases for multiple app exports", async () => {
        const { dir, configPath } = await createMultiAppProject();
        const outPath = path.join(dir, "types", "better-agent.types.d.ts");

        try {
            const exitCode = await generateTypes({
                cwd: dir,
                config: [configPath],
                out: "./types/better-agent.types.d.ts",
                name: "BAClientApp",
                yes: true,
            });
            expect(exitCode).toBe(0);

            const generated = await readFile(outPath, "utf-8");
            expect(generated).toContain("export type BAClientApp_better_agent_ts_alpha");
            expect(generated).toContain("export type BAClientApp_better_agent_ts_beta");
            expect(generated).not.toContain("import ");
            expect(generated).not.toContain('import("');
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });

    it("supports identifier-resolved agents and tools arrays", async () => {
        const { dir, configPath } = await createIndirectArrayProject();
        const outPath = path.join(dir, "types", "better-agent.types.d.ts");

        try {
            const exitCode = await generateTypes({
                cwd: dir,
                config: [configPath],
                out: "./types/better-agent.types.d.ts",
                name: "BAClientApp",
                yes: true,
            });
            expect(exitCode).toBe(0);

            const generated = await readFile(outPath, "utf-8");
            expect(generated).toContain('name: "helloAgent"');
            expect(generated).toContain('name: "pick_file"');
            expect(generated).not.toContain('name: "write_file"');
            expect(generated).not.toContain('name: "server_only"');

            const diagnostics = await compileTypeAssertions({
                dir,
                configPath,
                generatedTypePath: outPath,
            });

            expect(diagnostics).toEqual([]);
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });

    it("surfaces actionable validation errors for unsupported computed arrays", async () => {
        const { dir, configPath } = await createUnsupportedComputedAgentsProject();

        try {
            const { exitCode, stderr } = await captureStderr(() =>
                generateTypes({
                    cwd: dir,
                    config: [configPath],
                    out: "./types/better-agent.types.d.ts",
                    name: "BAClientApp",
                    yes: true,
                }),
            );

            expect(exitCode).toBe(1);
            expect(stderr).toContain("[VALIDATION_FAILED]");
            expect(stderr).toContain("better-agent.ts:ba.config.agents");
            expect(stderr).toContain("agents must be declared as an array literal");
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });

    it("surfaces actionable validation errors for spread tools", async () => {
        const { dir, configPath } = await createUnsupportedSpreadToolsProject();

        try {
            const { exitCode, stderr } = await captureStderr(() =>
                generateTypes({
                    cwd: dir,
                    config: [configPath],
                    out: "./types/better-agent.types.d.ts",
                    name: "BAClientApp",
                    yes: true,
                }),
            );

            expect(exitCode).toBe(1);
            expect(stderr).toContain("[VALIDATION_FAILED]");
            expect(stderr).toContain("better-agent.ts:ba.config.agents[0].tools[0]");
            expect(stderr).toContain("spread tools are not supported");
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });

    it("surfaces actionable validation errors for spread agents", async () => {
        const { dir, configPath } = await createUnsupportedSpreadAgentsProject();

        try {
            const { exitCode, stderr } = await captureStderr(() =>
                generateTypes({
                    cwd: dir,
                    config: [configPath],
                    out: "./types/better-agent.types.d.ts",
                    name: "BAClientApp",
                    yes: true,
                }),
            );

            expect(exitCode).toBe(1);
            expect(stderr).toContain("[VALIDATION_FAILED]");
            expect(stderr).toContain("better-agent.ts:ba.config.agents[0]");
            expect(stderr).toContain("spread agents are not supported");
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });

    it("generates portable types for a basic example-like fixture", async () => {
        const { dir, configPath } = await createBasicExampleLikeProject();
        const outPath = path.join(dir, "types", "better-agent.types.d.ts");

        try {
            const exitCode = await generateTypes({
                cwd: dir,
                config: [configPath],
                out: "./types/better-agent.types.d.ts",
                name: "BAClientApp",
                yes: true,
            });

            expect(exitCode).toBe(0);

            const generated = await readFile(outPath, "utf-8");
            expect(generated).toContain("export type BAClientApp = {");
            expect(generated).not.toContain("import ");
            expect(generated).not.toContain('import("');
            expect(generated).toContain('name: "helloAgent"');
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });

    it("generates portable types for a client-tool example-like fixture", async () => {
        const { dir, configPath } = await createClientToolExampleLikeProject();
        const outPath = path.join(dir, "types", "better-agent.types.d.ts");

        try {
            const exitCode = await generateTypes({
                cwd: dir,
                config: [configPath],
                out: "./types/better-agent.types.d.ts",
                name: "BAClientApp",
                yes: true,
            });

            expect(exitCode).toBe(0);

            const generated = await readFile(outPath, "utf-8");
            expect(generated).toContain("export type BAClientApp = {");
            expect(generated).not.toContain("import ");
            expect(generated).not.toContain('import("');
            expect(generated).toContain('name: "helloAgent"');
            expect(generated).toContain('name: "get_client_time"');
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });

    it("extracts schema from aliased defineTool(...).client() client tools", async () => {
        const { dir, configPath } = await createDefinedClientToolExampleProject();
        const outPath = path.join(dir, "types", "better-agent.types.d.ts");

        try {
            const exitCode = await generateTypes({
                cwd: dir,
                config: [configPath],
                out: "./types/better-agent.types.d.ts",
                name: "BAClientApp",
                yes: true,
            });

            expect(exitCode).toBe(0);

            const generated = await readFile(outPath, "utf-8");
            expect(generated).toContain('name: "get_client_time"');
            expect(generated).toContain("properties: {");
            expect(generated).toContain("locale: {");
            expect(generated).toContain('type: "string"');
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });

    it("extracts imported client tools created from defineTool(...).client()", async () => {
        const { dir, configPath } = await createImportedDefinedClientToolExampleProject();
        const outPath = path.join(dir, "types", "better-agent.types.d.ts");

        try {
            const exitCode = await generateTypes({
                cwd: dir,
                config: [configPath],
                out: "./types/better-agent.types.d.ts",
                name: "BAClientApp",
                yes: true,
            });

            expect(exitCode).toBe(0);

            const generated = await readFile(outPath, "utf-8");
            expect(generated).toContain('name: "get_client_time"');
            expect(generated).toContain("locale: {");
            expect(generated).not.toContain("tools: readonly []");
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });
});
