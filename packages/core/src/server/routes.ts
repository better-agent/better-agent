import { BetterAgentError } from "@better-agent/shared/errors";
import { isPlainRecord, safeJsonParse } from "@better-agent/shared/utils";
import Ajv from "ajv";
import { type RouteEntry, defineRoute } from "../api";
import type { StreamEvent } from "../persistence";
import type { PluginGuardMode, PluginRuntime } from "../plugins";
import type { Modality } from "../providers";
import type { BetterAgentRuntime } from "../run";
import {
    invalidRequest,
    jsonErrorResponse,
    jsonResponse,
    noContentResponse,
    parseAfterFromRequest,
    requestsEventStream,
    toSseResponse,
    toValidationIssue,
} from "./http";
import type { ToolApprovalBody, ToolResultBody } from "./types";

interface ServerRouteDeps {
    runtime: BetterAgentRuntime;
    pluginRuntime: PluginRuntime | null;
    sseHeartbeatMs?: number;
    onRequestDisconnect?: "abort" | "continue";
}

const ajv = new Ajv({ allErrors: true, allowUnionTypes: true });
const modalities: Modality[] = ["text", "image", "video", "audio", "file", "embedding"];

const runSchema = {
    type: "object",
    required: ["input"],
    properties: {
        input: { oneOf: [{ type: "string" }, { type: "array" }, { type: "object" }] },
        context: true,
        output: {
            type: "object",
            additionalProperties: true,
            properties: {
                schema: { type: "object" },
                name: { type: "string" },
                strict: { type: "boolean" },
            },
            required: ["schema"],
        },
        modalities: {
            type: "array",
            minItems: 1,
            items: { enum: modalities },
        },
        modelOptions: { type: "object" },
        conversationId: { type: "string", pattern: "\\S" },
        conversationReplay: {
            anyOf: [
                {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                        omitUnsupportedParts: { type: "boolean" },
                    },
                },
                {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                        omitUnsupportedParts: { type: "boolean" },
                        prepareInput: { type: "null" },
                    },
                },
            ],
        },
        replaceHistory: { type: "boolean" },
        maxSteps: { type: "integer", minimum: 1 },
        advanced: {
            type: "object",
            additionalProperties: false,
            properties: {
                clientToolResultTimeoutMs: { type: "number", exclusiveMinimum: 0 },
                toolApprovalTimeoutMs: { type: "number", exclusiveMinimum: 0 },
            },
        },
    },
    additionalProperties: true,
} as const;

const toolResultSchema = {
    type: "object",
    required: ["runId", "toolCallId", "status"],
    properties: {
        runId: { type: "string", pattern: "\\S" },
        toolCallId: { type: "string", pattern: "\\S" },
        status: { enum: ["success", "error"] },
        result: true,
        error: { type: "string" },
    },
    additionalProperties: true,
    allOf: [
        {
            if: { properties: { status: { const: "success" } } },
            // biome-ignore lint/suspicious/noThenProperty: JSON Schema conditional keyword
            then: {
                required: ["result"],
                not: { required: ["error"] },
            },
        },
        {
            if: { properties: { status: { const: "error" } } },
            // biome-ignore lint/suspicious/noThenProperty: JSON Schema conditional keyword
            then: {
                required: ["error"],
                not: { required: ["result"] },
            },
        },
    ],
} as const;

const toolApprovalSchema = {
    type: "object",
    required: ["runId", "toolCallId", "decision"],
    properties: {
        runId: { type: "string", pattern: "\\S" },
        toolCallId: { type: "string", pattern: "\\S" },
        decision: { enum: ["approved", "denied"] },
        note: { type: "string" },
        actorId: { type: "string" },
    },
    additionalProperties: true,
} as const;

const validateRunRequestBody = ajv.compile(runSchema);
const validateToolResultBody = ajv.compile(toolResultSchema);
const validateToolApprovalBody = ajv.compile(toolApprovalSchema);

const isFiniteNumber = (value: unknown): value is number =>
    typeof value === "number" && Number.isFinite(value);

// Guard persisted events before re-emitting them as SSE payloads.
const isStoredStreamEvent = (event: unknown): event is StreamEvent => {
    if (!isPlainRecord(event)) {
        return false;
    }

    return (
        typeof event.type === "string" &&
        isFiniteNumber(event.timestamp) &&
        isFiniteNumber(event.seq)
    );
};

/**
 * Creates the built-in server route table.
 */
export const createServerRoutes = (deps: ServerRouteDeps): RouteEntry[] => {
    const routes: RouteEntry[] = [
        defineRoute({
            method: "POST",
            pattern: "/:name/run",
            async handler(ctx) {
                const contentType = ctx.request.headers.get("content-type") ?? "";
                if (!contentType.toLowerCase().includes("application/json")) {
                    return new Response(
                        JSON.stringify({
                            code: "UNSUPPORTED_MEDIA_TYPE",
                            message: "Content-Type must include application/json.",
                            status: 415,
                        }),
                        {
                            status: 415,
                            headers: { "content-type": "application/json" },
                        },
                    );
                }

                const text = await ctx.request.text();
                if (text.length === 0) {
                    return invalidRequest([toValidationIssue("Request body must be valid JSON.")]);
                }

                const parsed = safeJsonParse(text);
                if (parsed.isErr() || !isPlainRecord(parsed.value)) {
                    return invalidRequest([
                        toValidationIssue("Request body must be a JSON object."),
                    ]);
                }

                if (!validateRunRequestBody(parsed.value)) {
                    return invalidRequest(
                        validateRunRequestBody.errors?.map((error) =>
                            toValidationIssue(
                                error.message ?? "Request validation failed.",
                                error.instancePath || "/",
                            ),
                        ) ?? [],
                    );
                }

                const runOptions = {
                    input: parsed.value.input,
                    signal: ctx.request.signal,
                    ...(parsed.value.context !== undefined
                        ? { context: parsed.value.context }
                        : {}),
                    ...(parsed.value.output !== undefined ? { output: parsed.value.output } : {}),
                    ...(parsed.value.modalities !== undefined
                        ? { modalities: parsed.value.modalities }
                        : {}),
                    ...(parsed.value.modelOptions !== undefined
                        ? { modelOptions: parsed.value.modelOptions }
                        : {}),
                    ...(parsed.value.conversationId !== undefined
                        ? { conversationId: parsed.value.conversationId }
                        : {}),
                    ...(parsed.value.conversationReplay !== undefined
                        ? { conversationReplay: parsed.value.conversationReplay }
                        : {}),
                    ...(parsed.value.replaceHistory !== undefined
                        ? { replaceHistory: parsed.value.replaceHistory }
                        : {}),
                    ...(parsed.value.maxSteps !== undefined
                        ? { maxSteps: parsed.value.maxSteps }
                        : {}),
                    ...(parsed.value.advanced !== undefined
                        ? { advanced: parsed.value.advanced }
                        : {}),
                };
                if (!requestsEventStream(ctx.request)) {
                    return jsonResponse(
                        await deps.runtime.run(ctx.params.name, runOptions as never),
                    );
                }

                const streamed = deps.runtime.stream(ctx.params.name, runOptions as never);
                void streamed.result.catch(() => {});
                return toSseResponse({
                    events: streamed.events,
                    runId: streamed.runId,
                    streamId: streamed.runId,
                    signal: ctx.request.signal,
                    heartbeatMs: deps.sseHeartbeatMs,
                    onDisconnect:
                        deps.onRequestDisconnect === "continue"
                            ? undefined
                            : async () => {
                                  await deps.runtime.abortRun(streamed.runId);
                              },
                });
            },
        }),
        defineRoute({
            method: "GET",
            pattern: "/:name/conversations/:id",
            async handler(ctx) {
                const rawId = ctx.params.id;
                const id =
                    typeof rawId === "string"
                        ? (() => {
                              try {
                                  return decodeURIComponent(rawId);
                              } catch {
                                  return rawId;
                              }
                          })()
                        : rawId;
                if (!id || id.trim().length === 0) {
                    return invalidRequest([
                        toValidationIssue("Conversation id is required.", "/id"),
                    ]);
                }
                if (!deps.runtime.loadConversation) {
                    return jsonErrorResponse({
                        code: "NOT_IMPLEMENTED",
                        message: "Conversation loading is not implemented by this runtime.",
                        status: 501,
                    });
                }

                const result = await deps.runtime.loadConversation(ctx.params.name, id);
                if (!result) {
                    return noContentResponse();
                }

                return jsonResponse(result);
            },
        }),
        defineRoute({
            method: "GET",
            pattern: "/:name/stream-events/resume",
            async handler(ctx) {
                const streamId = ctx.query.get("streamId");
                if (!streamId) {
                    return invalidRequest([
                        toValidationIssue("streamId is required.", "/streamId"),
                    ]);
                }

                const events = await deps.runtime.resumeStream({
                    streamId,
                    afterSeq: parseAfterFromRequest(ctx.request),
                });
                if (!events) {
                    return noContentResponse();
                }

                return toSseResponse({
                    events: (async function* () {
                        for await (const event of events) {
                            if (!isStoredStreamEvent(event)) {
                                throw BetterAgentError.fromCode(
                                    "VALIDATION_FAILED",
                                    "Stored stream event is invalid.",
                                    {
                                        context: { streamId },
                                        trace: [
                                            {
                                                at: "core.server.resumeStreamEvents.validateEvent",
                                            },
                                        ],
                                    },
                                );
                            }

                            yield event as StreamEvent;
                        }
                    })(),
                    streamId,
                    useEventIds: true,
                    signal: ctx.request.signal,
                    heartbeatMs: deps.sseHeartbeatMs,
                });
            },
        }),
        defineRoute({
            method: "GET",
            pattern: "/:name/conversations/:id/resume",
            async handler(ctx) {
                const rawId = ctx.params.id;
                const id =
                    typeof rawId === "string"
                        ? (() => {
                              try {
                                  return decodeURIComponent(rawId);
                              } catch {
                                  return rawId;
                              }
                          })()
                        : rawId;
                if (!id || id.trim().length === 0) {
                    return invalidRequest([
                        toValidationIssue("Conversation id is required.", "/id"),
                    ]);
                }

                const events = await deps.runtime.resumeConversation(ctx.params.name, {
                    conversationId: id,
                    afterSeq: parseAfterFromRequest(ctx.request),
                });
                if (!events) {
                    return noContentResponse();
                }

                return toSseResponse({
                    events: (async function* () {
                        for await (const event of events) {
                            if (!isStoredStreamEvent(event)) {
                                throw BetterAgentError.fromCode(
                                    "VALIDATION_FAILED",
                                    "Stored stream event is invalid.",
                                    {
                                        context: { streamId: id },
                                        trace: [
                                            {
                                                at: "core.server.resumeStreamEvents.validateEvent",
                                            },
                                        ],
                                    },
                                );
                            }

                            yield event as StreamEvent;
                        }
                    })(),
                    signal: ctx.request.signal,
                    useEventIds: true,
                    heartbeatMs: deps.sseHeartbeatMs,
                });
            },
        }),
        defineRoute({
            method: "POST",
            pattern: "/:name/runs/:runId/abort",
            async handler(ctx) {
                const runId = ctx.params.runId;
                if (!runId || runId.trim().length === 0) {
                    return invalidRequest([toValidationIssue("runId is required.", "/runId")]);
                }

                await deps.runtime.abortRun(runId);
                return noContentResponse();
            },
        }),
        defineRoute({
            method: "POST",
            pattern: "/:name/run/tool-result",
            async handler(ctx) {
                const contentType = ctx.request.headers.get("content-type") ?? "";
                if (!contentType.toLowerCase().includes("application/json")) {
                    return new Response(
                        JSON.stringify({
                            code: "UNSUPPORTED_MEDIA_TYPE",
                            message: "Content-Type must include application/json.",
                            status: 415,
                        }),
                        {
                            status: 415,
                            headers: { "content-type": "application/json" },
                        },
                    );
                }

                const text = await ctx.request.text();
                if (text.length === 0) {
                    return invalidRequest([toValidationIssue("Request body must be valid JSON.")]);
                }

                const parsed = safeJsonParse(text);
                if (parsed.isErr() || !isPlainRecord(parsed.value)) {
                    return invalidRequest([
                        toValidationIssue("Request body must be a JSON object."),
                    ]);
                }

                if (!validateToolResultBody(parsed.value)) {
                    return invalidRequest(
                        validateToolResultBody.errors?.map((error) =>
                            toValidationIssue(
                                error.message ?? "Request validation failed.",
                                error.instancePath || "/",
                            ),
                        ) ?? [],
                    );
                }

                const accepted = await deps.runtime.submitToolResult(
                    parsed.value as ToolResultBody,
                );
                if (!accepted) {
                    return jsonErrorResponse({
                        code: "NOT_FOUND",
                        message: "No pending client tool call found for runId/toolCallId.",
                        status: 404,
                    });
                }

                return noContentResponse();
            },
        }),
        defineRoute({
            method: "POST",
            pattern: "/:name/run/tool-approval",
            async handler(ctx) {
                const contentType = ctx.request.headers.get("content-type") ?? "";
                if (!contentType.toLowerCase().includes("application/json")) {
                    return new Response(
                        JSON.stringify({
                            code: "UNSUPPORTED_MEDIA_TYPE",
                            message: "Content-Type must include application/json.",
                            status: 415,
                        }),
                        {
                            status: 415,
                            headers: { "content-type": "application/json" },
                        },
                    );
                }

                const text = await ctx.request.text();
                if (text.length === 0) {
                    return invalidRequest([toValidationIssue("Request body must be valid JSON.")]);
                }

                const parsed = safeJsonParse(text);
                if (parsed.isErr() || !isPlainRecord(parsed.value)) {
                    return invalidRequest([
                        toValidationIssue("Request body must be a JSON object."),
                    ]);
                }

                if (!validateToolApprovalBody(parsed.value)) {
                    return invalidRequest(
                        validateToolApprovalBody.errors?.map((error) =>
                            toValidationIssue(
                                error.message ?? "Request validation failed.",
                                error.instancePath || "/",
                            ),
                        ) ?? [],
                    );
                }

                const accepted = await deps.runtime.submitToolApproval(
                    parsed.value as ToolApprovalBody,
                );
                if (!accepted) {
                    return jsonErrorResponse({
                        code: "NOT_FOUND",
                        message: "No pending tool approval found for runId/toolCallId.",
                        status: 404,
                    });
                }

                return noContentResponse();
            },
        }),
    ];

    const seenRouteKeys = new Set(routes.map((route) => `${route.method} ${route.pattern}`));

    for (const endpoint of deps.pluginRuntime?.endpoints ?? []) {
        const routeKey = `${endpoint.method} ${endpoint.path}`;
        if (seenRouteKeys.has(routeKey)) {
            throw BetterAgentError.fromCode(
                "VALIDATION_FAILED",
                `Plugin endpoint '${routeKey}' conflicts with an existing server route.`,
                {
                    context: {
                        pluginId: endpoint.pluginId,
                        method: endpoint.method,
                        path: endpoint.path,
                    },
                    trace: [{ at: "core.server.createServer.pluginEndpointConflict" }],
                },
            );
        }

        seenRouteKeys.add(routeKey);
        routes.push(
            defineRoute({
                method: endpoint.method,
                pattern: endpoint.path,
                ...(endpoint.public === true ? { public: true } : {}),
                async handler(ctx) {
                    return endpoint.handler({
                        request: ctx.request,
                        params: ctx.params,
                        query: ctx.query,
                    });
                },
            }),
        );
    }

    return routes;
};

/**
 * Runs plugin guards for one matched built-in route.
 */
export const runPluginGuards = async (params: {
    pluginRuntime: PluginRuntime | null;
    match: { route: RouteEntry; params: Record<string, string> };
    request: Request;
}): Promise<Response | null> => {
    const { pluginRuntime, match, request } = params;
    if (!pluginRuntime?.hasGuards) {
        return null;
    }

    const guardMode: PluginGuardMode | null =
        match.route.pattern === "/:name/conversations/:id"
            ? "load_conversation"
            : match.route.pattern === "/:name/stream-events/resume"
              ? "resume_stream"
              : match.route.pattern === "/:name/conversations/:id/resume"
                ? "resume_conversation"
                : match.route.pattern === "/:name/runs/:runId/abort"
                  ? "abort_run"
                  : match.route.pattern === "/:name/run"
                    ? requestsEventStream(request)
                        ? "stream"
                        : "run"
                    : null;

    if (!guardMode || typeof match.params.name !== "string") {
        return null;
    }

    let input: Record<string, unknown> = {};
    const contentType = request.headers.get("content-type") ?? "";
    const shouldParseJsonBody =
        request.method === "POST" && contentType.toLowerCase().includes("application/json");

    if (shouldParseJsonBody) {
        const text = await request.clone().text();
        if (text.length > 0) {
            const parsed = safeJsonParse(text);
            if (!parsed.isErr() && isPlainRecord(parsed.value)) {
                input = parsed.value;
            }
        }
    }

    return pluginRuntime.dispatchRun({
        mode: guardMode,
        agentName: match.params.name,
        input,
        request,
        plugins: pluginRuntime.plugins,
    });
};
