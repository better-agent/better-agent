import { describe, expect, test } from "bun:test";
import { BetterAgentError } from "../src/errors";

function buildInternalError() {
    return BetterAgentError.fromCode("INTERNAL", "boom");
}

function buildBadRequestError() {
    return BetterAgentError.fromCode("BAD_REQUEST", "invalid input");
}

describe("BetterAgentError stack", () => {
    test("fromCode captures stack at callsite", () => {
        const error = buildInternalError();
        expect(error.stack).toBeDefined();
        expect(error.stack).toContain("errors.test.ts");
        expect(error.stack).not.toContain("packages/shared/src/errors.ts");
    });

    test("wrap captures stack at wrapper callsite", () => {
        const root = new Error("root");
        const error = BetterAgentError.wrap({
            err: root,
            message: "top",
        });
        expect(error.stack).toBeDefined();
        expect(error.stack).toContain("errors.test.ts");
        expect(error.stack).not.toContain("packages/shared/src/errors.ts");
    });
});

describe("BetterAgentError problem details", () => {
    test("exports RFC-style problem details with docs type URL", () => {
        const error = buildBadRequestError().at({
            at: "tool.validate",
            data: {
                field: "query",
            },
        });
        error.traceId = "trace_123";
        error.context = {
            tool: "searchDocs",
            agent: "support",
        };

        const problem = error.toProblem();

        expect(problem.type).toBe("https://better-agent.com/docs/concepts/errors#bad-request");
        expect(problem.title).toBe("Bad Request");
        expect(problem.status).toBe(400);
        expect(problem.detail).toBe("invalid input");
        expect(problem.code).toBe("BAD_REQUEST");
        expect(problem.traceId).toBe("trace_123");
        expect(problem.context?.agent).toBe("support");
        expect(problem.context?.tool).toBe("searchDocs");
        expect(problem.trace?.[0]?.at).toBe("tool.validate");
    });

    test("fromProblem round-trips core fields", () => {
        const from = BetterAgentError.fromProblem({
            type: "https://better-agent.com/docs/concepts/errors#timeout",
            title: "Gateway Timeout",
            status: 504,
            detail: "Provider timed out",
            code: "TIMEOUT",
            retryable: true,
            context: {
                provider: "openai",
            },
        });

        expect(from.code).toBe("TIMEOUT");
        expect(from.status).toBe(504);
        expect(from.retryable).toBe(true);
        expect(from.context?.provider).toBe("openai");
        expect(from.type).toBe("https://better-agent.com/docs/concepts/errors#timeout");
    });

    test("omits undefined optional fields in serialized output", () => {
        const error = BetterAgentError.fromCode("BAD_REQUEST", "missing field");
        const json = error.toJSON() as Record<string, unknown>;

        expect("traceId" in json).toBe(false);
        expect("context" in json).toBe(false);
    });

    test("does not define optional own-properties when unset", () => {
        const error = BetterAgentError.fromCode("BAD_REQUEST", "missing field");

        expect(Object.hasOwn(error, "traceId")).toBe(false);
        expect(Object.hasOwn(error, "context")).toBe(false);
    });

    test("uses fallback metadata for unknown error codes", () => {
        const error = BetterAgentError.fromCode("CUSTOM_PROVIDER_FAIL", "provider failed");

        expect(error.status).toBe(500);
        expect(error.title).toBe("Internal Server Error");
        expect(error.retryable).toBe(false);
        expect(error.type).toBe(
            "https://better-agent.com/docs/concepts/errors#custom-provider-fail",
        );
    });
});

describe("BetterAgentError wrap", () => {
    test("preserves cause when wrapping native errors", () => {
        const root = new Error("root");
        const wrapped = BetterAgentError.wrap({
            err: root,
            message: "top",
        });

        expect(wrapped.message).toBe("top");
        expect(wrapped.cause).toBe(root);
        expect(wrapped.code).toBe("INTERNAL");
    });

    test("wrap of BetterAgentError preserves cause and merges context/trace", () => {
        const base = BetterAgentError.fromCode("BAD_REQUEST", "base", {
            context: { source: "tool" },
            trace: [{ at: "base.step" }],
        });

        const wrapped = BetterAgentError.wrap({
            err: base,
            message: "outer",
            opts: {
                context: { action: "retry" },
                trace: [{ at: "outer.step" }],
            },
        });

        expect(wrapped.message).toBe("outer: base");
        expect(wrapped.cause).toBe(base);
        expect(wrapped.context).toEqual({ source: "tool", action: "retry" });
        expect(wrapped.trace.map((f) => f.at)).toEqual(["base.step", "outer.step"]);
    });
});
