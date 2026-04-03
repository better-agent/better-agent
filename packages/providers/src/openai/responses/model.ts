import type { RunContext } from "@better-agent/core";
import { Events } from "@better-agent/core/events";
import type { Event } from "@better-agent/core/events";
import type {
    GenerativeModelCallOptions,
    GenerativeModelResponse,
    ModalitiesParam,
} from "@better-agent/core/providers";
import { BetterAgentError } from "@better-agent/shared/errors";
import { type Result, err, ok } from "@better-agent/shared/neverthrow";
import type { createOpenAIClient } from "../client";
import {
    OPENAI_RESPONSE_CAPS,
    collectNonStreamOutputEvents,
    createDeferred,
    openaiUpstreamError,
} from "../shared/runtime";
import type { OpenAICapsFor, OpenAIGenerativeModel, OpenAIOptionsFor } from "../types";
import {
    mapFromOpenAIResponsesResponse,
    mapFromOpenAIResponsesStreamEvent,
    mapToOpenAIResponsesRequest,
} from "./mappers";
import type { OpenAIResponseModels, OpenAIResponseStreamEvent } from "./schemas";

export const createOpenAIResponsesModel = <M extends OpenAIResponseModels>(
    modelId: M,
    client: ReturnType<typeof createOpenAIClient>,
): OpenAIGenerativeModel<M> => {
    const doGenerate: NonNullable<OpenAIGenerativeModel<M>["doGenerate"]> = async <
        const TModalities extends ModalitiesParam<OpenAICapsFor<M>>,
    >(
        options: GenerativeModelCallOptions<OpenAICapsFor<M>, OpenAIOptionsFor<M>, TModalities>,
        ctx: RunContext,
    ) => {
        const requestBodyResult = mapToOpenAIResponsesRequest({ modelId, options });
        if (requestBodyResult.isErr()) {
            return err(
                requestBodyResult.error.at({
                    at: "openai.generate.mapRequest",
                    data: { modelId, endpoint: "responses" },
                }),
            );
        }

        const requestBody = requestBodyResult.value;
        const raw = await client.responses.create(requestBody, { signal: ctx.signal ?? null });
        if (raw.isErr()) {
            return err(
                raw.error
                    .at({ at: "openai.generate.modelContext", data: { model: String(modelId) } })
                    .at({
                        at: "openai.generate.http",
                        data: { modelId, endpoint: "responses", path: "/v1/responses" },
                    }),
            );
        }

        const response = mapFromOpenAIResponsesResponse(raw.value);
        return ok({
            response: {
                ...response,
                request: { body: requestBody },
            } satisfies GenerativeModelResponse,
            events: collectNonStreamOutputEvents(response, ctx),
        });
    };

    const doGenerateStream: NonNullable<OpenAIGenerativeModel<M>["doGenerateStream"]> = async <
        const TModalities extends ModalitiesParam<OpenAICapsFor<M>>,
    >(
        options: GenerativeModelCallOptions<OpenAICapsFor<M>, OpenAIOptionsFor<M>, TModalities>,
        ctx: RunContext,
    ) => {
        const requestBodyResult = mapToOpenAIResponsesRequest({ modelId, options });
        if (requestBodyResult.isErr()) {
            return err(
                requestBodyResult.error.at({
                    at: "openai.generateStream.mapRequest",
                    data: { modelId, endpoint: "responses" },
                }),
            );
        }

        const requestBody = requestBodyResult.value;
        const streamResult = await client.responses.stream(requestBody, {
            signal: ctx.signal ?? null,
        });
        if (streamResult.isErr()) {
            return err(
                streamResult.error
                    .at({ at: "openai.generate.modelContext", data: { model: String(modelId) } })
                    .at({
                        at: "openai.generateStream.http",
                        data: { modelId, endpoint: "responses", path: "/v1/responses" },
                    }),
            );
        }

        const {
            promise: final,
            resolve: resolveFinal,
            reject: rejectFinal,
        } = createDeferred<GenerativeModelResponse>();

        const events = (async function* (): AsyncGenerator<Result<Event, BetterAgentError>> {
            const messageId = ctx.generateMessageId();
            const functionCallIdByItemId = new Map<string, string>();
            let sawFinal = false;
            let sawTextEnd = false;
            let finalResolved = false;
            const endedToolCalls = new Set<string>();
            const resultToolCalls = new Set<string>();
            const startedImageMessages = new Set<string>();
            const endedImageMessages = new Set<string>();
            const startedReasoningMessages = new Set<string>();
            const endedReasoningMessages = new Set<string>();

            try {
                for await (const raw of streamResult.value) {
                    if (raw.isErr()) {
                        const appErr = BetterAgentError.wrap({
                            err: raw.error,
                            message: "OpenAI stream chunk error",
                            opts: { code: "UPSTREAM_FAILED" },
                        }).at({ at: "openai.generateStream.chunk" });
                        yield err(appErr);
                        rejectFinal(appErr);
                        return;
                    }

                    let openAiEvent = raw.value as OpenAIResponseStreamEvent;
                    if (
                        openAiEvent.type === "response.output_item.added" &&
                        openAiEvent.item?.type === "function_call" &&
                        typeof openAiEvent.item.id === "string" &&
                        openAiEvent.item.id.length > 0 &&
                        typeof openAiEvent.item.call_id === "string" &&
                        openAiEvent.item.call_id.length > 0
                    ) {
                        functionCallIdByItemId.set(openAiEvent.item.id, openAiEvent.item.call_id);
                    } else if (
                        (openAiEvent.type === "response.function_call_arguments.delta" ||
                            openAiEvent.type === "response.function_call_arguments.done") &&
                        typeof openAiEvent.item_id === "string" &&
                        openAiEvent.item_id.length > 0 &&
                        (typeof openAiEvent.call_id !== "string" ||
                            openAiEvent.call_id.length === 0)
                    ) {
                        const mappedCallId = functionCallIdByItemId.get(openAiEvent.item_id);
                        if (mappedCallId) openAiEvent = { ...openAiEvent, call_id: mappedCallId };
                    }

                    const mapped = mapFromOpenAIResponsesStreamEvent(openAiEvent, messageId);
                    if (mapped.isErr()) {
                        const appErr = mapped.error.at({ at: "openai.generateStream.mapEvent" });
                        yield err(appErr);
                        rejectFinal(appErr);
                        return;
                    }

                    const m = mapped.value;
                    if (!m) continue;

                    if (m.kind === "final") {
                        sawFinal = true;
                        for (const outputItem of m.response.output) {
                            if (
                                outputItem.type !== "provider-tool-result" ||
                                resultToolCalls.has(outputItem.callId)
                            ) {
                                continue;
                            }

                            yield ok({
                                type: Events.TOOL_CALL_RESULT,
                                parentMessageId: messageId,
                                toolCallId: outputItem.callId,
                                toolCallName: outputItem.name,
                                result: outputItem.result,
                                runId: ctx.runId,
                                agentName: ctx.agentName,
                                toolTarget: "hosted",
                                timestamp: Date.now(),
                            });
                            resultToolCalls.add(outputItem.callId);

                            if (
                                startedImageMessages.has(outputItem.callId) &&
                                !endedImageMessages.has(outputItem.callId)
                            ) {
                                yield ok({
                                    type: Events.IMAGE_MESSAGE_END,
                                    messageId: outputItem.callId,
                                    timestamp: Date.now(),
                                });
                                endedImageMessages.add(outputItem.callId);
                            }

                            if (endedToolCalls.has(outputItem.callId)) continue;
                            yield ok({
                                type: Events.TOOL_CALL_END,
                                parentMessageId: messageId,
                                toolCallId: outputItem.callId,
                                toolCallName: outputItem.name,
                                runId: ctx.runId,
                                agentName: ctx.agentName,
                                toolTarget: "hosted",
                                timestamp: Date.now(),
                            });
                            endedToolCalls.add(outputItem.callId);
                        }

                        resolveFinal({ ...m.response, request: { body: requestBody } });
                        finalResolved = true;
                        if (sawTextEnd) return;
                        continue;
                    }

                    const ev = m.event;
                    const reasoningKey =
                        ev.type === Events.REASONING_MESSAGE_START ||
                        ev.type === Events.REASONING_MESSAGE_CONTENT ||
                        ev.type === Events.REASONING_MESSAGE_END
                            ? `${ev.visibility}:${ev.messageId}`
                            : null;

                    if (ev.type === Events.TEXT_MESSAGE_END) sawTextEnd = true;

                    if (
                        ev.type === Events.IMAGE_MESSAGE_CONTENT &&
                        !startedImageMessages.has(ev.messageId)
                    ) {
                        yield ok({
                            type: Events.IMAGE_MESSAGE_START,
                            messageId: ev.messageId,
                            role: "assistant",
                            timestamp: Date.now(),
                        });
                        startedImageMessages.add(ev.messageId);
                    }

                    if (ev.type === Events.TOOL_CALL_END) endedToolCalls.add(ev.toolCallId);
                    if (ev.type === Events.TOOL_CALL_RESULT) resultToolCalls.add(ev.toolCallId);
                    if (ev.type === Events.REASONING_MESSAGE_START && reasoningKey) {
                        startedReasoningMessages.add(reasoningKey);
                    }

                    if (
                        (ev.type === Events.REASONING_MESSAGE_CONTENT ||
                            ev.type === Events.REASONING_MESSAGE_END) &&
                        reasoningKey &&
                        !startedReasoningMessages.has(reasoningKey)
                    ) {
                        yield ok({
                            type: Events.REASONING_MESSAGE_START,
                            messageId: ev.messageId,
                            role: "assistant",
                            visibility: ev.visibility,
                            timestamp: Date.now(),
                        });
                        startedReasoningMessages.add(reasoningKey);
                    }

                    if (
                        ev.type === Events.REASONING_MESSAGE_END &&
                        reasoningKey &&
                        endedReasoningMessages.has(reasoningKey)
                    ) {
                        continue;
                    }

                    yield ok(ev);

                    if (
                        ev.type === Events.TOOL_CALL_RESULT &&
                        startedImageMessages.has(ev.toolCallId) &&
                        !endedImageMessages.has(ev.toolCallId)
                    ) {
                        yield ok({
                            type: Events.IMAGE_MESSAGE_END,
                            messageId: ev.toolCallId,
                            timestamp: Date.now(),
                        });
                        endedImageMessages.add(ev.toolCallId);
                    }

                    if (ev.type === Events.TOOL_CALL_RESULT && !endedToolCalls.has(ev.toolCallId)) {
                        yield ok({
                            type: Events.TOOL_CALL_END,
                            parentMessageId: messageId,
                            toolCallId: ev.toolCallId,
                            toolCallName: ev.toolCallName,
                            runId: ctx.runId,
                            agentName: ctx.agentName,
                            toolTarget: "hosted",
                            timestamp: Date.now(),
                        });
                        endedToolCalls.add(ev.toolCallId);
                    }

                    if (ev.type === Events.REASONING_MESSAGE_END && reasoningKey) {
                        endedReasoningMessages.add(reasoningKey);
                    }

                    if (finalResolved && sawTextEnd) return;
                }

                if (!sawFinal) {
                    const missingFinal = openaiUpstreamError(
                        "Stream ended without response.completed",
                        { provider: "openai", code: "STREAM_MISSING_FINAL" },
                    ).at({ at: "openai.generateStream.missingFinal" });
                    yield err(missingFinal);
                    rejectFinal(missingFinal);
                    return;
                }
            } catch (e) {
                const appErr = BetterAgentError.wrap({
                    err: e,
                    message: "OpenAI streaming failed",
                    opts: {
                        code: "UPSTREAM_FAILED",
                        context: { provider: "openai", model: String(modelId) },
                    },
                }).at({ at: "openai.generateStream.generator" });
                yield err(appErr);
                rejectFinal(appErr);
                return;
            }
        })();

        return ok({ events, final });
    };

    return {
        providerId: "openai",
        modelId,
        caps: OPENAI_RESPONSE_CAPS as OpenAICapsFor<M>,
        doGenerate,
        doGenerateStream,
    };
};
