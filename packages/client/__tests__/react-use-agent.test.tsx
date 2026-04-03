import "./setup";
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, test } from "node:test";
import type { RunResult } from "@better-agent/core";
import { JSDOM } from "jsdom";
import { StrictMode, act } from "react";
import { type Root, createRoot } from "react-dom/client";
import { useAgent } from "../src/react/useAgent";
import type { BetterAgentClient } from "../src/types/client";

const createRunResult = (overrides?: Record<string, unknown>): RunResult =>
    ({
        response: {
            output: [],
            finishReason: "stop",
            usage: {},
        },
        ...(overrides ?? {}),
    }) as RunResult;

const createMockClient = () => {
    const runCalls: Array<{
        agent: string;
        input: Record<string, unknown>;
    }> = [];

    const client: BetterAgentClient = {
        async run(agent, input) {
            runCalls.push({
                agent: String(agent),
                input: input as Record<string, unknown>,
            });
            return createRunResult();
        },
        stream() {
            throw new Error("Not used in this test.");
        },
        resumeStream() {
            throw new Error("Not used in this test.");
        },
        resumeConversation() {
            throw new Error("Not used in this test.");
        },
        async submitToolResult() {},
        async submitToolApproval() {},
        async abortRun() {},
    } as BetterAgentClient;

    return { client, runCalls };
};

describe("react useAgent", () => {
    let dom: JSDOM;
    let root: Root;
    let container: HTMLDivElement;
    const testGlobal = globalThis as typeof globalThis & {
        IS_REACT_ACT_ENVIRONMENT?: boolean;
    };

    beforeEach(() => {
        dom = new JSDOM("<!doctype html><html><body></body></html>");
        globalThis.window = dom.window as unknown as typeof window;
        globalThis.document = dom.window.document;
        globalThis.navigator = dom.window.navigator;
        testGlobal.IS_REACT_ACT_ENVIRONMENT = true;
        container = document.createElement("div");
        document.body.appendChild(container);
        root = createRoot(container);
    });

    afterEach(async () => {
        await act(async () => {
            root.unmount();
        });
        dom.window.close();
    });

    test("sendMessage works under StrictMode after mount cleanup replays", async () => {
        const mock = createMockClient();
        let agent: ReturnType<typeof useAgent> | null = null;

        function Harness() {
            agent = useAgent(mock.client, {
                agent: "support",
                delivery: "final",
            });
            return null;
        }

        await act(async () => {
            root.render(
                <StrictMode>
                    <Harness />
                </StrictMode>,
            );
        });

        assert.ok(agent);

        await act(async () => {
            await agent?.sendMessage("Hello");
        });

        assert.equal(mock.runCalls.length, 1);
        assert.equal(mock.runCalls[0]?.agent, "support");
        assert.equal(mock.runCalls[0]?.input.input, "Hello");
    });
});
