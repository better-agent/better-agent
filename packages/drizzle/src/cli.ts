#!/usr/bin/env node

import path from "node:path";
import process from "node:process";
import { resolveSchemaDomains } from "@better-agent/schema";
import type { SchemaDomain } from "@better-agent/schema";
import { Command } from "commander";
import { type DrizzleDialect, type GenerateMode, generateDrizzleSchemaFile } from "./generate";
import { drizzleDomains, promptDrizzleDomains } from "./interactive";

const program = new Command();
const dialects = ["pg", "mysql", "sqlite"] as const;
const modes = ["block", "replace"] as const;
const green = (value: string) => (process.stdout.isTTY ? `\x1b[32m${value}\x1b[0m` : value);
const dim = (value: string) => (process.stdout.isTTY ? `\x1b[2m${value}\x1b[0m` : value);
const successMark = green("✓");

function printHeader() {
    console.log(green("BETTER-AGENT"));
    console.log(dim("Drizzle adapter"));
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

    if (only.some((domain) => !drizzleDomains.includes(domain as SchemaDomain))) {
        throw new Error(`Unsupported domain list '${input}'.`);
    }

    return resolveSchemaDomains(only as SchemaDomain[]);
}

function parseDialect(input: string): DrizzleDialect {
    if (!dialects.includes(input as DrizzleDialect)) {
        throw new Error(`Unsupported dialect '${input}'.`);
    }

    return input as DrizzleDialect;
}

function parseMode(input: string): GenerateMode {
    if (!modes.includes(input as GenerateMode)) {
        throw new Error(`Unsupported mode '${input}'.`);
    }

    return input as GenerateMode;
}

program.name("better-agent-drizzle").description("Better Agent Drizzle helpers");

program
    .command("generate")
    .description("Generate Better Agent Drizzle schema into your project")
    .option("--out <path>", "Drizzle schema file path", "src/db/better-agent.schema.ts")
    .option("--dialect <dialect>", "pg | mysql | sqlite", "pg")
    .option("--mode <mode>", "block | replace", "block")
    .option("--only <domains>", "memory | runs | streams", "")
    .action(
        async (options: {
            out: string;
            dialect: DrizzleDialect;
            mode: GenerateMode;
            only?: string;
        }) => {
            const only =
                !options.only && process.stdin.isTTY
                    ? await promptDrizzleDomains()
                    : parseDomains(options.only);
            const result = await generateDrizzleSchemaFile({
                out: path.resolve(process.cwd(), options.out),
                dialect: parseDialect(options.dialect),
                mode: parseMode(options.mode),
                only,
            });

            console.log(
                `${successMark} updated Better Agent Drizzle schema: ${result.operation} ${result.out}`,
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
