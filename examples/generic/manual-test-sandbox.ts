import { stdin, stdout } from "node:process";
import { createInterface } from "node:readline/promises";
import { type Event, Events } from "@better-agent/core/events";
import app from "./better-agent/sandbox-minimal";

const initialPrompt = process.argv.slice(2).join(" ").trim();

const conversationId = process.env.SANDBOX_DEMO_CONVERSATION_ID ?? "sandbox-demo";
const openAiApiKey = process.env.OPENAI_API_KEY;
const e2bApiKey = process.env.E2B_API_KEY;

if (!openAiApiKey || openAiApiKey === "your-openai-api-key") {
    console.error("Missing OPENAI_API_KEY.");
    process.exit(1);
}

if (!e2bApiKey || e2bApiKey === "your-e2b-api-key") {
    console.error("Missing E2B_API_KEY.");
    process.exit(1);
}

const formatResult = (result: unknown): string => {
    try {
        const json = JSON.stringify(result, null, 2);
        return json.length > 400 ? `${json.slice(0, 400)}...` : json;
    } catch {
        return String(result);
    }
};

const formatAssistantOutput = (output: unknown): string => {
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

const logEvent = (event: Event) => {
    switch (event.type) {
        case Events.RUN_STARTED:
            console.log(`[run:start] ${event.runId}`);
            break;
        case Events.STEP_START:
            console.log(`[step:start] ${event.stepIndex + 1}`);
            break;
        case Events.TOOL_CALL_START:
            console.log(`[tool:start] ${event.toolCallName}`);
            break;
        case Events.TOOL_CALL_RESULT:
            console.log(`[tool:result] ${event.toolCallName}`);
            console.log(formatResult(event.result));
            break;
        case Events.TOOL_CALL_END:
            console.log(`[tool:end] ${event.toolCallName}`);
            break;
        case Events.RUN_FINISHED:
            console.log("[run:finished]");
            break;
        case Events.RUN_ERROR:
            console.log(`[run:error] ${event.error.message}`);
            break;
        default:
            break;
    }
};

const runPrompt = async (prompt: string) => {
    console.log(`Conversation ID: ${conversationId}`);
    console.log(`Prompt: ${prompt}`);
    console.log("");

    const stream = app.stream("sandbox", {
        input: prompt,
        conversationId,
    });

    for await (const event of stream.events) {
        logEvent(event);
    }

    const result = await stream.result;
    console.log("");
    console.log("Final response output:");
    console.log(formatAssistantOutput(result.response.output));
    console.log("");
};

try {
    if (initialPrompt) {
        await runPrompt(initialPrompt);
        process.exit(0);
    }

    console.log(`Conversation ID: ${conversationId}`);
    console.log("Interactive sandbox demo");
    console.log("Type a prompt and press Enter. Type 'exit' to quit.");
    console.log("");

    const rl = createInterface({
        input: stdin,
        output: stdout,
    });

    try {
        while (true) {
            const prompt = (await rl.question("sandbox> ")).trim();
            if (!prompt) {
                continue;
            }

            if (prompt === "exit" || prompt === "quit") {
                break;
            }

            await runPrompt(prompt);
        }
    } finally {
        rl.close();
    }
} catch (error) {
    console.error("");
    console.error("Sandbox demo failed.");
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
}
