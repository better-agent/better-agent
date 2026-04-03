import { z } from "zod";

const UNION_KEYS = ["allOf", "anyOf", "oneOf"] as const;

/**
 * Finds a property schema by name, including allOf/anyOf/oneOf branches.
 */
export const findJsonSchemaProperty = (
    schema: unknown,
    propertyName: string,
): Record<string, unknown> | undefined =>
    walkSchema(schema, (node) => (isNode(node.properties) ? node.properties[propertyName] : null));

/**
 * Finds the first array `items` schema, including allOf/anyOf/oneOf branches.
 */
export const findJsonSchemaArrayItems = (schema: unknown): Record<string, unknown> | undefined =>
    walkSchema(schema, (node) => node.items);

/**
 * Finds the first schema node that satisfies the predicate.
 */
export const findFirstJsonSchemaNode = (
    schema: unknown,
    predicate: (node: Record<string, unknown>) => boolean,
): Record<string, unknown> | undefined =>
    walkSchema(schema, (node) => (predicate(node) ? node : null));

/**
 * Converts a Zod schema into a JSON Schema object.
 */
export const toZodJsonSchema = (schema: z.ZodType): Record<string, unknown> =>
    z.toJSONSchema(schema) ?? {};

const isNode = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value);

const walkSchema = (
    schema: unknown,
    pick: (node: Record<string, unknown>) => unknown,
): Record<string, unknown> | undefined => {
    if (!isNode(schema)) return undefined;

    const selected = pick(schema);
    if (isNode(selected)) return selected;

    for (const key of UNION_KEYS) {
        const members = schema[key];
        if (!Array.isArray(members)) continue;
        for (const member of members) {
            const found = walkSchema(member, pick);
            if (found) return found;
        }
    }

    return undefined;
};
