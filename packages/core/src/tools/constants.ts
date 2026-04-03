/**
 * Symbol used to attach an optional per-run cleanup hook to a tool.
 */
export const TOOL_CLEANUP = Symbol.for("better-agent.tool.cleanup");

/**
 * Symbol used to store the resolved JSON Schema for a tool.
 */
export const TOOL_JSON_SCHEMA = Symbol.for("better-agent.tool.json_schema");
