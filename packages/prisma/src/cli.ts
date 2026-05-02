#!/usr/bin/env node

import path from "node:path";
import process from "node:process";
import { resolveSchemaDomains } from "@better-agent/schema";
import type { SchemaDomain } from "@better-agent/schema";
import { Command } from "commander";
import { type GenerateMode, type PrismaProvider, generatePrismaSchemaFile } from "./generate";
import { prismaDomains, promptPrismaDomains } from "./interactive";

const program = new Command();
const providers = ["postgresql", "mysql", "sqlite"] as const;
const modes = ["block", "replace"] as const;
const green = (value: string) => (process.stdout.isTTY ? `\x1b[32m${value}\x1b[0m` : value);
const dim = (value: string) => (process.stdout.isTTY ? `\x1b[2m${value}\x1b[0m` : value);
const successMark = green("✓");

function printHeader() {
    console.log(green("BETTER-AGENT"));
    console.log(dim("Prisma adapter"));
    console.log("");
}

function parseDomains(input?: string): readonly SchemaDomain[] | undefined {
    if (!input) {
        return undefined;
    }

    const only = input
        .split(",")
        .map((domain) => domain.trim())
        .filter(Boolean);

    if (only.some((domain) => !prismaDomains.includes(domain as SchemaDomain))) {
        throw new Error(`Unsupported domain list '${input}'.`);
    }

    return resolveSchemaDomains(only as SchemaDomain[]);
}

function parseProvider(input: string): PrismaProvider {
    if (!providers.includes(input as PrismaProvider)) {
        throw new Error(`Unsupported provider '${input}'.`);
    }

    return input as PrismaProvider;
}

function parseMode(input: string): GenerateMode {
    if (!modes.includes(input as GenerateMode)) {
        throw new Error(`Unsupported mode '${input}'.`);
    }

    return input as GenerateMode;
}

program.name("better-agent-prisma").description("Better Agent Prisma helpers");

program
    .command("generate")
    .description("Generate Better Agent Prisma schema into your project")
    .option("--out <path>", "Prisma schema file path", "prisma/schema.prisma")
    .option("--provider <provider>", "postgresql | mysql | sqlite", "postgresql")
    .option("--mode <mode>", "block | replace", "block")
    .option("--only <domains>", "memory | runs | streams", "")
    .action(
        async (options: {
            out: string;
            provider: PrismaProvider;
            mode: GenerateMode;
            only?: string;
        }) => {
            const only =
                !options.only && process.stdin.isTTY
                    ? await promptPrismaDomains()
                    : parseDomains(options.only);
            const result = await generatePrismaSchemaFile({
                out: path.resolve(process.cwd(), options.out),
                provider: parseProvider(options.provider),
                mode: parseMode(options.mode),
                only,
            });

            console.log(
                `${successMark} updated Better Agent Prisma schema: ${result.operation} ${result.out}`,
            );
            console.log("");
        },
    );

printHeader();

program.parseAsync().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exitCode = 1;
});
