import { BetterAgentError } from "@better-agent/shared/errors";
import { type Result, err, ok } from "@better-agent/shared/neverthrow";
import { safeJsonParse } from "@better-agent/shared/utils";
import {
    type AnthropicResponseStreamEvent,
    AnthropicResponseStreamEventSchema,
} from "../responses/schemas";

const parseSSERecord = (
    record: string,
): Result<AnthropicResponseStreamEvent | null, BetterAgentError> => {
    const lines = record
        .split(/\r?\n/)
        .map((line) => line.trimEnd())
        .filter(Boolean);

    if (!lines.length) return ok(null);

    const data = lines
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trimStart())
        .join("\n");

    if (!data) return ok(null);
    if (data === "[DONE]") return ok(null);

    const parsed = safeJsonParse(data);
    if (parsed.isErr()) {
        return err(
            BetterAgentError.wrap({
                err: parsed.error,
                message: "Anthropic stream returned invalid JSON",
                opts: {
                    code: "UPSTREAM_FAILED",
                    context: {
                        provider: "anthropic",
                        raw: data,
                    },
                },
            }).at({
                at: "anthropic.stream.parse",
            }),
        );
    }

    const event = AnthropicResponseStreamEventSchema.safeParse(parsed.value);
    if (!event.success) {
        return err(
            BetterAgentError.fromCode(
                "UPSTREAM_FAILED",
                "Anthropic stream returned an unknown event payload",
                {
                    context: {
                        provider: "anthropic",
                        issues: event.error.issues,
                    },
                },
            ).at({
                at: "anthropic.stream.validate",
            }),
        );
    }

    return ok(event.data);
};

export async function* parseAnthropicSSEStream(
    stream: ReadableStream<Uint8Array>,
): AsyncGenerator<Result<AnthropicResponseStreamEvent, BetterAgentError>> {
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });

            while (true) {
                const recordBoundary = buffer.indexOf("\n\n");
                if (recordBoundary === -1) break;

                const record = buffer.slice(0, recordBoundary);
                buffer = buffer.slice(recordBoundary + 2);

                const parsed = parseSSERecord(record);
                if (parsed.isErr()) {
                    yield err(parsed.error);
                    return;
                }

                if (parsed.value) {
                    yield ok(parsed.value);
                }
            }
        }

        buffer += decoder.decode();
        const remaining = buffer.trim();
        if (!remaining) return;

        const parsed = parseSSERecord(remaining);
        if (parsed.isErr()) {
            yield err(parsed.error);
            return;
        }

        if (parsed.value) {
            yield ok(parsed.value);
        }
    } finally {
        reader.releaseLock();
    }
}
