export const fileDemoPrompt =
    "Create /workspace/demo/index.js with console.log('hello from sandbox'), run it with node, and tell me the output.";

export const webDemoPrompt =
    "Create a tiny Node HTTP server in /workspace/server.js on port 3000. Start it in the background with a command that returns immediately, verify it locally with curl http://127.0.0.1:3000, then call sandbox_get_host for port 3000 and return the exact URL.";

export const defaultPrompt = fileDemoPrompt;

export const promptPresets = {
    file: fileDemoPrompt,
    web: webDemoPrompt,
} as const;

export const conversationId =
    process.env.SANDBOX_EXAMPLE_CONVERSATION_ID ?? "sandbox-programmatic-example";

export type PromptPresetName = keyof typeof promptPresets;

export const resolvePromptInput = (
    argv: string[],
): {
    prompt: string;
    preset?: PromptPresetName;
} => {
    const raw = argv.join(" ").trim();
    if (!raw) {
        return {
            prompt: defaultPrompt,
            preset: "file",
        };
    }

    if (raw in promptPresets) {
        const preset = raw as PromptPresetName;
        return {
            prompt: promptPresets[preset],
            preset,
        };
    }

    return { prompt: raw };
};

export const requireEnv = (name: string, placeholder?: string) => {
    const value = process.env[name];
    if (!value || (placeholder !== undefined && value === placeholder)) {
        console.error(`Missing ${name}. Add it to .env or .env.local in examples/generic.`);
        process.exit(1);
    }

    return value;
};

const ansi = {
    blue: "\u001b[34m",
    cyan: "\u001b[36m",
    dim: "\u001b[2m",
    green: "\u001b[32m",
    red: "\u001b[31m",
    reset: "\u001b[0m",
    yellow: "\u001b[33m",
} as const;

export const colorize = (
    color: keyof typeof ansi,
    value: string,
    enabled = process.stdout.isTTY ?? false,
) => (enabled ? `${ansi[color]}${value}${ansi.reset}` : value);

export const printDemoHeader = (params: {
    conversationId: string;
    prompt: string;
    preset?: PromptPresetName;
}) => {
    console.log(colorize("cyan", "Sandbox Demo"));
    console.log(`${colorize("dim", "Conversation:")} ${params.conversationId}`);
    if (params.preset) {
        console.log(`${colorize("dim", "Preset:")} ${params.preset}`);
    }
    console.log(`${colorize("dim", "Prompt:")} ${params.prompt}`);
    console.log("");
};

export const formatResult = (value: unknown): string => {
    try {
        const json = JSON.stringify(value, null, 2);
        return json.length > 500 ? `${json.slice(0, 500)}...` : json;
    } catch {
        return String(value);
    }
};

export const extractAssistantText = (output: unknown): string => {
    if (!Array.isArray(output)) {
        return formatResult(output);
    }

    const text = output
        .flatMap((item) => {
            if (
                !item ||
                typeof item !== "object" ||
                (item as { type?: string }).type !== "message"
            ) {
                return [];
            }

            const content = (item as { content?: unknown }).content;
            if (typeof content === "string") {
                return [content];
            }

            if (!Array.isArray(content)) {
                return [];
            }

            return content
                .filter(
                    (part): part is { type: "text"; text: string } =>
                        !!part &&
                        typeof part === "object" &&
                        (part as { type?: string }).type === "text" &&
                        typeof (part as { text?: unknown }).text === "string",
                )
                .map((part) => part.text);
        })
        .join("\n")
        .trim();

    return text || formatResult(output);
};
