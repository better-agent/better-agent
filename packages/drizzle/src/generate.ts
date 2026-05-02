import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { selectBetterAgentSchema } from "@better-agent/schema";
import type { SchemaDomain } from "@better-agent/schema";
import { renderDrizzleSchema } from "@farming-labs/orm";

export const DRIZZLE_START_MARKER = "// @better-agent/drizzle:start";
export const DRIZZLE_END_MARKER = "// @better-agent/drizzle:end";

export type DrizzleDialect = "pg" | "mysql" | "sqlite";
export type GenerateMode = "block" | "replace";

export interface GenerateDrizzleSchemaOptions {
    out: string;
    dialect: DrizzleDialect;
    mode: GenerateMode;
    only?: readonly SchemaDomain[];
}

export interface GenerateDrizzleSchemaResult {
    out: string;
    dialect: DrizzleDialect;
    mode: GenerateMode;
    only?: readonly SchemaDomain[];
    operation: "created" | "updated" | "replaced";
}

export function upsertManagedDrizzleBlock(existing: string, schema: string): string {
    const block = `${DRIZZLE_START_MARKER}\n${schema.trim()}\n${DRIZZLE_END_MARKER}\n`;
    const start = existing.indexOf(DRIZZLE_START_MARKER);
    const end = existing.indexOf(DRIZZLE_END_MARKER);

    if (start >= 0 && end > start) {
        const before = existing.slice(0, start).replace(/\s*$/, "\n\n");
        const after = existing.slice(end + DRIZZLE_END_MARKER.length).replace(/^\s*/, "\n\n");
        return `${before}${block}${after}`.replace(/\n{3,}/g, "\n\n");
    }

    return existing.trim().length === 0 ? block : `${existing.trim()}\n\n${block}`;
}

async function readExistingSchema(out: string): Promise<string | null> {
    try {
        return await readFile(out, "utf8");
    } catch {
        return null;
    }
}

export async function generateDrizzleSchemaFile(
    options: GenerateDrizzleSchemaOptions,
): Promise<GenerateDrizzleSchemaResult> {
    const { out, dialect, mode, only } = options;
    const schema = renderDrizzleSchema(selectBetterAgentSchema(only), { dialect });
    const resultBase = {
        out,
        dialect,
        mode,
        ...(only ? { only } : {}),
    };
    await mkdir(path.dirname(out), { recursive: true });

    if (mode === "replace") {
        await writeFile(out, `${schema.trim()}\n`, "utf8");
        return {
            ...resultBase,
            operation: "replaced",
        };
    }

    const existing = await readExistingSchema(out);
    const next = upsertManagedDrizzleBlock(existing ?? "", schema);
    await writeFile(out, next, "utf8");

    return {
        ...resultBase,
        operation: existing === null ? "created" : "updated",
    };
}
