import { describe, expect, test } from "bun:test";
import { EventType } from "@ag-ui/core";
import type { AgentEvent } from "../src/ag-ui/events";
import type { AgentAssistantMessage, AgentMessage } from "../src/ag-ui/messages";
import { createRuntimeStateControl } from "../src/runtime/state";
import {
    collectAssistantToolCalls,
    collectToolCallEvent,
    createToolCallBuffer,
    getCompletedToolCallIds,
    getPendingAssistantToolMessage,
} from "../src/runtime/tool-execution";

const assistantWithToolCalls = {
    id: "assistant-1",
    role: "assistant",
    content: "",
    toolCalls: [
        {
            id: "call-1",
            type: "function",
            function: {
                name: "search",
                arguments: '{"query":"docs"}',
            },
        },
    ],
} as AgentAssistantMessage & { toolCalls: NonNullable<AgentAssistantMessage["toolCalls"]> };

describe("runtime state and tool buffers", () => {
    test("state control sets, patches, and applies state events", () => {
        const state = createRuntimeStateControl<{ count: number }>({ count: 1 });

        expect(state.get()).toEqual({ count: 1 });
        expect(state.set({ count: 2 })).toMatchObject({ type: EventType.STATE_SNAPSHOT });
        expect(state.get()).toEqual({ count: 2 });

        const delta = state.patch([{ op: "replace", path: "/count", value: 3 }]);
        expect(delta).toMatchObject({ type: EventType.STATE_DELTA });
        expect(state.get()).toEqual({ count: 3 });

        state.apply({
            type: EventType.STATE_SNAPSHOT,
            timestamp: 1,
            snapshot: { count: 4 },
        } as AgentEvent);
        expect(state.get()).toEqual({ count: 4 });

        state.apply({
            type: EventType.STATE_DELTA,
            timestamp: 1,
            delta: [{ op: "replace", path: "/missing/deep", value: 5 }],
        } as AgentEvent);
        expect(state.get()).toEqual({ count: 4 });
    });

    test("collectToolCallEvent buffers starts, args, chunks, and removes results", () => {
        const buffer = createToolCallBuffer();

        collectToolCallEvent(buffer, {
            type: EventType.TOOL_CALL_START,
            timestamp: 1,
            toolCallId: "call-1",
            toolCallName: "search",
            parentMessageId: "assistant-1",
        } as AgentEvent);
        collectToolCallEvent(buffer, {
            type: EventType.TOOL_CALL_ARGS,
            timestamp: 1,
            toolCallId: "call-1",
            delta: '{"query"',
        } as AgentEvent);
        collectToolCallEvent(buffer, {
            type: EventType.TOOL_CALL_CHUNK,
            timestamp: 1,
            toolCallId: "call-1",
            delta: ':"docs"}',
        } as AgentEvent);

        expect(buffer.get("call-1")).toMatchObject({
            toolCallName: "search",
            argsText: '{"query":"docs"}',
        });

        collectToolCallEvent(buffer, {
            type: EventType.TOOL_CALL_RESULT,
            timestamp: 1,
            toolCallId: "call-1",
        } as AgentEvent);
        expect(buffer.has("call-1")).toBe(false);
    });

    test("collectAssistantToolCalls ignores provider-executed tool calls", () => {
        const buffer = createToolCallBuffer();
        const count = collectAssistantToolCalls(buffer, {
            ...assistantWithToolCalls,
            toolCalls: [
                ...assistantWithToolCalls.toolCalls,
                {
                    id: "provider-call",
                    type: "function",
                    providerExecuted: true,
                    function: { name: "native", arguments: "{}" },
                },
            ],
        });

        expect(count).toBe(1);
        expect(buffer.get("call-1")?.argsText).toBe('{"query":"docs"}');
        expect(buffer.has("provider-call")).toBe(false);
    });

    test("detects completed and pending assistant tool calls", () => {
        const completedMessages = [
            assistantWithToolCalls,
            { id: "tool-1", role: "tool", toolCallId: "call-1", content: "ok" },
        ] as AgentMessage[];

        expect(getCompletedToolCallIds(completedMessages)).toEqual(new Set(["call-1"]));

        expect(getPendingAssistantToolMessage([assistantWithToolCalls])?.id).toBe("assistant-1");
        expect(getPendingAssistantToolMessage(completedMessages)).toBeUndefined();
    });
});
