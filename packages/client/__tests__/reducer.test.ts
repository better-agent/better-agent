import "./setup";
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { Event } from "@better-agent/core/events";
import { applyEvent, createMessageState } from "../src/core/reducer";
import type { UIMessage } from "../src/types/ui";

const applyEvents = (events: Event[], initial: UIMessage[] = []) =>
    events.reduce((state, event) => applyEvent(state, event), createMessageState(initial));

describe("client reducer", () => {
    test("replay mode synthesizes the submitted user turn from RUN_STARTED", () => {
        const state = applyEvent(
            createMessageState(),
            {
                type: "RUN_STARTED",
                timestamp: 1,
                runId: "run_1",
                agentName: "support",
                runInput: { input: "Hello again" },
            },
            { synthesizeReplayUserMessage: true },
        );

        assert.equal(state.messages.length, 1);
        assert.deepEqual(state.messages[0], {
            localId: "user_run:run_1",
            id: "user_run:run_1",
            role: "user",
            parts: [{ type: "text", text: "Hello again", state: "complete" }],
            status: "sent",
        });
    });

    test("replay mode synthesizes the current user turn from a single structured message input", () => {
        const state = applyEvent(
            createMessageState(),
            {
                type: "RUN_STARTED",
                timestamp: 1,
                runId: "run_structured",
                agentName: "support",
                runInput: {
                    input: {
                        type: "message",
                        role: "user",
                        content: [{ type: "text", text: "Structured hello" }],
                    },
                },
            } as Event,
            { synthesizeReplayUserMessage: true },
        );

        assert.deepEqual(state.messages, [
            {
                localId: "user_run:run_structured:0",
                role: "user",
                parts: [{ type: "text", text: "Structured hello", state: "complete" }],
                status: "sent",
            },
        ]);
    });

    test("replay mode preserves repeated text for different runs and deduplicates same-run replay", () => {
        const initial: UIMessage[] = [
            {
                localId: "user_earlier",
                role: "user",
                parts: [{ type: "text", text: "Repeat me", state: "complete" }],
            },
            {
                localId: "assistant_earlier",
                role: "assistant",
                parts: [{ type: "text", text: "Earlier reply", state: "complete" }],
            },
        ];

        const repeatedState = applyEvent(
            createMessageState(initial),
            {
                type: "RUN_STARTED",
                timestamp: 2,
                runId: "run_repeat",
                agentName: "support",
                runInput: { input: "Repeat me" },
            },
            { synthesizeReplayUserMessage: true },
        );

        assert.equal(repeatedState.messages.filter((message) => message.role === "user").length, 2);

        const dedupedState = applyEvent(
            createMessageState([
                ...initial,
                {
                    localId: "user_run:run_current",
                    id: "user_run:run_current",
                    role: "user",
                    parts: [{ type: "text", text: "Current", state: "complete" }],
                    status: "sent",
                },
            ]),
            {
                type: "RUN_STARTED",
                timestamp: 3,
                runId: "run_current",
                agentName: "support",
                runInput: { input: "Current" },
            },
            { synthesizeReplayUserMessage: true },
        );

        assert.equal(dedupedState.messages.filter((message) => message.role === "user").length, 2);
        assert.equal(dedupedState.messages.at(-1)?.localId, "user_run:run_current");
    });

    test("replay mode uses the synthesized user turn as the current tool/approval anchor", () => {
        const state = [
            {
                type: "RUN_STARTED",
                timestamp: 1,
                runId: "run_1",
                agentName: "support",
                runInput: { input: "Need approval" },
            },
            {
                type: "TOOL_APPROVAL_REQUIRED",
                timestamp: 2,
                runId: "run_1",
                agentName: "support",
                parentMessageId: "missing_assistant",
                toolCallId: "call_1",
                toolCallName: "dangerousTool",
                toolTarget: "server",
                toolInput: { risky: true },
                state: "requested",
            },
        ].reduce(
            (current, event) =>
                applyEvent(current, event as Event, { synthesizeReplayUserMessage: true }),
            createMessageState(),
        );

        assert.equal(state.messages.length, 2);
        assert.equal(state.messages[0]?.role, "user");
        assert.equal(state.messages[1]?.localId, "assistant_turn:user_run:run_1");
        assert.deepEqual(state.messages[1]?.parts, [
            {
                type: "tool-call",
                callId: "call_1",
                name: "dangerousTool",
                toolTarget: "server",
                status: "pending",
                state: "approval-requested",
                approval: {
                    input: { risky: true },
                },
            },
        ]);
    });

    test("builds a text message from start/content/end events", () => {
        const state = applyEvents([
            {
                type: "TEXT_MESSAGE_START",
                timestamp: 1,
                messageId: "msg_1",
                role: "assistant",
            },
            {
                type: "TEXT_MESSAGE_CONTENT",
                timestamp: 2,
                messageId: "msg_1",
                delta: "Hello",
            },
            {
                type: "TEXT_MESSAGE_CONTENT",
                timestamp: 3,
                messageId: "msg_1",
                delta: " world",
            },
            {
                type: "TEXT_MESSAGE_END",
                timestamp: 4,
                messageId: "msg_1",
            },
        ]);

        assert.equal(state.messages.length, 1);
        assert.deepEqual(
            {
                localId: state.messages[0]?.localId,
                role: state.messages[0]?.role,
            },
            {
                localId: "msg_1",
                role: "assistant",
            },
        );
        assert.deepEqual(state.messages[0]?.parts, [
            {
                type: "text",
                text: "Hello world",
                state: "complete",
            },
        ]);
    });

    test("tracks tool-call lifecycle and result on the current assistant turn", () => {
        const state = applyEvents(
            [
                {
                    type: "TOOL_CALL_START",
                    timestamp: 2,
                    runId: "run_1",
                    agentName: "support",
                    parentMessageId: "assistant_1",
                    toolCallId: "call_1",
                    toolCallName: "lookupWeather",
                    toolTarget: "server",
                },
                {
                    type: "TOOL_CALL_ARGS",
                    timestamp: 3,
                    runId: "run_1",
                    agentName: "support",
                    parentMessageId: "assistant_1",
                    toolCallId: "call_1",
                    toolCallName: "lookupWeather",
                    toolTarget: "server",
                    delta: '{"city":"Addis',
                },
                {
                    type: "TOOL_CALL_ARGS",
                    timestamp: 4,
                    runId: "run_1",
                    agentName: "support",
                    parentMessageId: "assistant_1",
                    toolCallId: "call_1",
                    toolCallName: "lookupWeather",
                    toolTarget: "server",
                    delta: ' Ababa"}',
                },
                {
                    type: "TOOL_CALL_END",
                    timestamp: 5,
                    runId: "run_1",
                    agentName: "support",
                    parentMessageId: "assistant_1",
                    toolCallId: "call_1",
                    toolCallName: "lookupWeather",
                    toolTarget: "server",
                },
                {
                    type: "TOOL_CALL_RESULT",
                    timestamp: 6,
                    runId: "run_1",
                    agentName: "support",
                    parentMessageId: "assistant_1",
                    toolCallId: "call_1",
                    toolCallName: "lookupWeather",
                    toolTarget: "server",
                    result: { forecast: "sunny" },
                },
            ],
            [
                {
                    localId: "user_1",
                    role: "user",
                    parts: [{ type: "text", text: "Weather?" }],
                },
                {
                    localId: "assistant_1",
                    role: "assistant",
                    parts: [],
                },
            ],
        );

        assert.equal(state.messages.length, 2);
        assert.deepEqual(state.messages[1]?.parts, [
            {
                type: "tool-call",
                callId: "call_1",
                name: "lookupWeather",
                toolTarget: "server",
                args: '{"city":"Addis Ababa"}',
                status: "success",
                state: "completed",
            },
            {
                type: "tool-result",
                callId: "call_1",
                result: { forecast: "sunny" },
                status: "success",
            },
        ]);
    });

    test("replaces hosted tool args when the same call continues on the server", () => {
        const state = applyEvents(
            [
                {
                    type: "TOOL_CALL_START",
                    timestamp: 1,
                    runId: "run_1",
                    agentName: "support",
                    parentMessageId: "assistant_1",
                    toolCallId: "call_1",
                    toolCallName: "lookupWeather",
                    toolTarget: "hosted",
                },
                {
                    type: "TOOL_CALL_ARGS",
                    timestamp: 2,
                    runId: "run_1",
                    agentName: "support",
                    parentMessageId: "assistant_1",
                    toolCallId: "call_1",
                    toolCallName: "lookupWeather",
                    toolTarget: "hosted",
                    delta: '{"location":"Dalian"}',
                },
                {
                    type: "TOOL_CALL_START",
                    timestamp: 3,
                    runId: "run_1",
                    agentName: "support",
                    parentMessageId: "assistant_1",
                    toolCallId: "call_1",
                    toolCallName: "lookupWeather",
                    toolTarget: "server",
                },
                {
                    type: "TOOL_CALL_ARGS",
                    timestamp: 4,
                    runId: "run_1",
                    agentName: "support",
                    parentMessageId: "assistant_1",
                    toolCallId: "call_1",
                    toolCallName: "lookupWeather",
                    toolTarget: "server",
                    delta: '{"location":"Dalian"}',
                },
                {
                    type: "TOOL_CALL_END",
                    timestamp: 5,
                    runId: "run_1",
                    agentName: "support",
                    parentMessageId: "assistant_1",
                    toolCallId: "call_1",
                    toolCallName: "lookupWeather",
                    toolTarget: "server",
                },
            ],
            [{ localId: "assistant_1", role: "assistant", parts: [] }],
        );

        assert.deepEqual(state.messages[0]?.parts, [
            {
                type: "tool-call",
                callId: "call_1",
                name: "lookupWeather",
                toolTarget: "server",
                args: '{"location":"Dalian"}',
                status: "pending",
                state: "input-complete",
            },
        ]);
    });

    test("ignores duplicate completed tool-call start/args/end events", () => {
        const initialState = applyEvents(
            [
                {
                    type: "TOOL_CALL_START",
                    timestamp: 1,
                    runId: "run_1",
                    agentName: "support",
                    parentMessageId: "assistant_1",
                    toolCallId: "call_1",
                    toolCallName: "lookupWeather",
                    toolTarget: "server",
                },
                {
                    type: "TOOL_CALL_RESULT",
                    timestamp: 2,
                    runId: "run_1",
                    agentName: "support",
                    parentMessageId: "assistant_1",
                    toolCallId: "call_1",
                    toolCallName: "lookupWeather",
                    toolTarget: "server",
                    result: { forecast: "sunny" },
                },
            ],
            [{ localId: "assistant_1", role: "assistant", parts: [] }],
        );

        const duplicateEvents: Event[] = [
            {
                type: "TOOL_CALL_START",
                timestamp: 3,
                runId: "run_1",
                agentName: "support",
                parentMessageId: "assistant_1",
                toolCallId: "call_1",
                toolCallName: "lookupWeather",
                toolTarget: "server",
            },
            {
                type: "TOOL_CALL_ARGS",
                timestamp: 4,
                runId: "run_1",
                agentName: "support",
                parentMessageId: "assistant_1",
                toolCallId: "call_1",
                toolCallName: "lookupWeather",
                toolTarget: "server",
                delta: '{"ignored":true}',
            },
            {
                type: "TOOL_CALL_END",
                timestamp: 5,
                runId: "run_1",
                agentName: "support",
                parentMessageId: "assistant_1",
                toolCallId: "call_1",
                toolCallName: "lookupWeather",
                toolTarget: "server",
            },
        ];

        const state = duplicateEvents.reduce(
            (current, event) => applyEvent(current, event),
            initialState,
        );

        assert.deepEqual(state.messages[0]?.parts, [
            {
                type: "tool-call",
                callId: "call_1",
                name: "lookupWeather",
                toolTarget: "server",
                status: "success",
                state: "completed",
            },
            {
                type: "tool-result",
                callId: "call_1",
                result: { forecast: "sunny" },
                status: "success",
            },
        ]);
    });
});
