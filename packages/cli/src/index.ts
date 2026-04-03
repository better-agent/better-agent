#!/usr/bin/env node
import { Command } from "commander";
import { generateTypes } from "./typegen/command";

const cli = new Command();

cli.name("better-agent").description("Better Agent CLI").version("0.0.1");

const generateCommand = cli.command("generate").description("Generate Better Agent type");

generateCommand
    .command("type")
    .description("Generate a portable client app type from Better Agent config exports")
    .option(
        "--config <path...>",
        "One or more Better Agent config paths (e.g. --config ./agents.ts ./libs/better-agent.ts)",
    )
    .option("--cwd <path>", "Base directory for resolving relative config paths", process.cwd())
    .option("--out <path>", "Generated .d.ts file path", "better-agent.types.d.ts")
    .option("--name <identifier>", "Exported type alias name", "BAClientApp")
    .option("--yes", "Skip prompts and overwrite output", false)
    .action(async (opts) => {
        const code = await generateTypes(opts);
        process.exit(code);
    });

cli.parse();
