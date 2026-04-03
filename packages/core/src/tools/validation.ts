import { BetterAgentError } from "@better-agent/shared/errors";
import { resolveToJsonSchema } from "../schema";
import type { ResolvableSchema } from "../schema";
import { TOOL_JSON_SCHEMA } from "./constants";

type ToolValidationTarget = {
    name?: unknown;
    schema: ResolvableSchema;
    [TOOL_JSON_SCHEMA]?: Record<string, unknown>;
};

/**
 * Validates a tool definition and returns the resolved JSON Schema used at runtime.
 */
export const validateToolDefinition = <const TTool extends ToolValidationTarget>(
    def: TTool,
): Record<string, unknown> => {
    if (typeof def.name !== "string" || def.name.length === 0) {
        throw BetterAgentError.fromCode(
            "VALIDATION_FAILED",
            "Tool name must be a non-empty string.",
            {
                trace: [{ at: "core.tools.validateToolDefinition.name" }],
            },
        );
    }

    const existingSchema = def[TOOL_JSON_SCHEMA];
    if (existingSchema !== undefined) {
        return existingSchema;
    }

    const jsonSchema = resolveToJsonSchema(def.schema);
    if (jsonSchema.isErr()) {
        throw jsonSchema.error.at({
            at: "core.tools.validateToolDefinition.schema",
            data: { toolName: def.name },
        });
    }

    return jsonSchema.value;
};
