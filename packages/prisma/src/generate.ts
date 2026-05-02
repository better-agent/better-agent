import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { selectBetterAgentSchema } from "@better-agent/schema";
import type { SchemaDomain } from "@better-agent/schema";
import { renderPrismaSchema } from "@farming-labs/orm";

export const PRISMA_START_MARKER = "// @better-agent/prisma:start";
export const PRISMA_END_MARKER = "// @better-agent/prisma:end";

export type PrismaProvider = "postgresql" | "mysql" | "sqlite";
export type GenerateMode = "block" | "replace";

export interface GeneratePrismaSchemaOptions {
    out: string;
    provider: PrismaProvider;
    mode: GenerateMode;
    only?: readonly SchemaDomain[];
}

export interface GeneratePrismaSchemaResult {
    out: string;
    provider: PrismaProvider;
    mode: GenerateMode;
    only?: readonly SchemaDomain[];
    operation: "created" | "updated" | "replaced";
}

export function stripPrismaSchemaPreamble(schema: string): string {
    return schema
        .replace(/^\s*generator\s+\w+\s*\{[\s\S]*?\}\s*/gm, "")
        .replace(/^\s*datasource\s+\w+\s*\{[\s\S]*?\}\s*/gm, "")
        .trim();
}

export function upsertManagedPrismaBlock(existing: string, schema: string): string {
    const block = `${PRISMA_START_MARKER}\n${schema.trim()}\n${PRISMA_END_MARKER}\n`;
    const start = existing.indexOf(PRISMA_START_MARKER);
    const end = existing.indexOf(PRISMA_END_MARKER);

    if (start >= 0 && end > start) {
        const before = existing.slice(0, start).replace(/\s*$/, "\n\n");
        const after = existing.slice(end + PRISMA_END_MARKER.length).replace(/^\s*/, "\n\n");
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

export async function generatePrismaSchemaFile(
    options: GeneratePrismaSchemaOptions,
): Promise<GeneratePrismaSchemaResult> {
    const { out, provider, mode, only } = options;
    const schema = renderPrismaSchema(selectBetterAgentSchema(only), { provider });
    const resultBase = {
        out,
        provider,
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
    const next = upsertManagedPrismaBlock(existing ?? "", stripPrismaSchemaPreamble(schema));
    await writeFile(out, next, "utf8");

    return {
        ...resultBase,
        operation: existing === null ? "created" : "updated",
    };
}
