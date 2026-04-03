import { ok } from "@better-agent/shared/neverthrow";
import type { AnyAgentDefinition } from "../../src";
import type { Event, ModelEvent } from "../../src/events";
import type {
    GenerativeModel,
    GenerativeModelInputItem,
    GenerativeModelResponse,
} from "../../src/providers";
import { defineTool } from "../../src/tools";

export const createTextResponse = (text: string): GenerativeModelResponse => ({
    output: [
        {
            type: "message",
            role: "assistant",
            content: text,
        },
    ],
    finishReason: "stop",
    usage: {},
});

export const createToolCallResponse = (
    calls: Array<{ callId: string; name: string; arguments: string }>,
): GenerativeModelResponse => ({
    output: calls.map((call) => ({
        type: "tool-call" as const,
        callId: call.callId,
        name: call.name,
        arguments: call.arguments,
    })),
    finishReason: "stop",
    usage: {},
});

export const createStructuredTextResponse = (text: string): GenerativeModelResponse => ({
    output: [
        {
            type: "message",
            role: "assistant",
            content: [{ type: "text", text }],
        },
    ],
    finishReason: "stop",
    usage: {},
});

export const createTextModel = (
    onGenerate?: (options: Record<string, unknown>) => void,
    responseFactory: () => GenerativeModelResponse = () => createTextResponse("hello"),
): GenerativeModel => ({
    providerId: "test",
    modelId: "text",
    caps: {
        inputShape: "chat",
        inputModalities: { text: true, image: false, audio: false, video: false, file: false },
        outputModalities: { text: true },
    },
    async doGenerate(options) {
        onGenerate?.(options as Record<string, unknown>);
        return ok({
            response: responseFactory(),
        });
    },
});

export const createScriptedModel = (responses: GenerativeModelResponse[]): GenerativeModel => {
    const queue = [...responses];

    return createTextModel(undefined, () => queue.shift() ?? createTextResponse("done"));
};

export const createStreamModel = (params?: {
    response?: GenerativeModelResponse;
    events?: ModelEvent[];
}): GenerativeModel => ({
    providerId: "test",
    modelId: "stream",
    caps: {
        inputShape: "chat",
        inputModalities: { text: true, image: false, audio: false, video: false, file: false },
        outputModalities: { text: true },
    },
    async doGenerateStream(_options, _ctx) {
        const events = params?.events ?? [
            {
                type: "TEXT_MESSAGE_START",
                messageId: "msg_1",
                role: "assistant",
                timestamp: Date.now(),
            },
            {
                type: "TEXT_MESSAGE_CONTENT",
                messageId: "msg_1",
                delta: "hello",
                timestamp: Date.now(),
            },
            { type: "TEXT_MESSAGE_END", messageId: "msg_1", timestamp: Date.now() },
        ];

        return ok({
            events: (async function* () {
                for (const event of events) {
                    yield ok(event);
                }
            })(),
            final: Promise.resolve(params?.response ?? createTextResponse("hello")),
        });
    },
});

export const createStructuredModel = (responses: GenerativeModelResponse[]): GenerativeModel => {
    const queue = [...responses];

    return {
        providerId: "test",
        modelId: "structured",
        caps: {
            inputShape: "chat",
            inputModalities: { text: true, image: false, audio: false, video: false, file: false },
            outputModalities: { text: true },
            structured_output: true,
        },
        async doGenerate() {
            return ok({
                response: queue.shift() ?? createStructuredTextResponse('{"done":true}'),
            });
        },
    };
};

export const createTextAgent = (overrides?: Partial<AnyAgentDefinition>): AnyAgentDefinition => ({
    name: "assistant",
    model: createTextModel(),
    ...overrides,
});

export const createServerTool = (
    name: string,
    handler?: (input: Record<string, never>) => unknown,
) =>
    defineTool({
        name,
        schema: {
            type: "object",
            properties: {},
            additionalProperties: false,
        } as const,
    }).server(async (input) => (handler ? handler(input) : null));

export const collectEvents = () => {
    const events: Event[] = [];

    return {
        events,
        onEvent: async (event: Event) => {
            events.push(event);
        },
    };
};

export const collectStreamEvents = async (stream: AsyncGenerator<Event>) => {
    const events: Event[] = [];
    for await (const event of stream) {
        events.push(event);
    }
    return events;
};

export const asMessages = (messages: GenerativeModelInputItem[]): GenerativeModelInputItem[] =>
    messages;
