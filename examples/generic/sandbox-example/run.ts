import app from "./app";
import {
    colorize,
    conversationId,
    extractAssistantText,
    printDemoHeader,
    requireEnv,
    resolvePromptInput,
} from "./shared";

requireEnv("OPENAI_API_KEY", "your-openai-api-key");
requireEnv("E2B_API_KEY", "your-e2b-api-key");

const resolved = resolvePromptInput(process.argv.slice(2));

printDemoHeader({
    conversationId,
    prompt: resolved.prompt,
    ...(resolved.preset ? { preset: resolved.preset } : {}),
});

const result = await app.run("sandbox", {
    input: resolved.prompt,
    conversationId,
});

console.log(colorize("green", "Assistant response"));
console.log(extractAssistantText(result.response.output));
