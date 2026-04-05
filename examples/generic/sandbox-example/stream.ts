import { type Event, Events } from "@better-agent/core/events";
import app from "./app";
import {
    colorize,
    conversationId,
    extractAssistantText,
    formatResult,
    printDemoHeader,
    requireEnv,
    resolvePromptInput,
} from "./shared";

requireEnv("OPENAI_API_KEY", "your-openai-api-key");
requireEnv("E2B_API_KEY", "your-e2b-api-key");

const resolved = resolvePromptInput(process.argv.slice(2));

const logEvent = (event: Event) => {
    switch (event.type) {
        case Events.RUN_STARTED:
            console.log(colorize("blue", `[run:start] ${event.runId}`));
            break;
        case Events.STEP_START:
            console.log(colorize("cyan", `[step:start] ${event.stepIndex + 1}`));
            break;
        case Events.TOOL_CALL_START:
            console.log(colorize("yellow", `[tool:start] ${event.toolCallName}`));
            break;
        case Events.TOOL_CALL_RESULT:
            console.log(colorize("green", `[tool:result] ${event.toolCallName}`));
            console.log(formatResult(event.result));
            break;
        case Events.TOOL_CALL_END:
            console.log(colorize("dim", `[tool:end] ${event.toolCallName}`));
            break;
        case Events.RUN_FINISHED:
            console.log(colorize("blue", "[run:finished]"));
            break;
        case Events.RUN_ERROR:
            console.log(colorize("red", `[run:error] ${event.error.message}`));
            break;
        default:
            break;
    }
};

printDemoHeader({
    conversationId,
    prompt: resolved.prompt,
    ...(resolved.preset ? { preset: resolved.preset } : {}),
});

const stream = app.stream("sandbox", {
    input: resolved.prompt,
    conversationId,
});

for await (const event of stream.events) {
    logEvent(event);
}

const result = await stream.result;
console.log("");
console.log(colorize("green", "Assistant response"));
console.log(extractAssistantText(result.response.output));
