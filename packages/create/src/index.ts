#!/usr/bin/env node

import { cancel } from "@clack/prompts";
import { Command } from "commander";
import { runCreate } from "./create";
import { pluginSchema, providerSchema } from "./schema";

const program = new Command();

program
    .name("create-better-agent")
    .description("Create a new Better Agent app")
    .argument("[name]", "The name of the app to create")
    .option("--framework <framework>", "The framework to use for the app")
    .option("--providers <providers>", "Comma-separated providers to use for the app")
    .option("--plugins <plugins>", "Comma-separated plugins to use for the app")
    .option("--no-install", "Do not install dependencies automatically")
    .action(async (name, options) => {
        try {
            const install =
                program.getOptionValueSource("install") === "default" ? undefined : options.install;

            await runCreate({
                name,
                framework: options.framework,
                providers: options.providers
                    ? String(options.providers)
                          .split(",")
                          .map((provider) => provider.trim())
                          .filter(Boolean)
                          .map((provider) => providerSchema.parse(provider))
                    : undefined,
                plugins: options.plugins
                    ? String(options.plugins)
                          .split(",")
                          .map((plugin) => plugin.trim())
                          .filter(Boolean)
                          .map((plugin) => pluginSchema.parse(plugin))
                    : undefined,
                install,
            });
        } catch (error) {
            cancel(error instanceof Error ? error.message : String(error));
            process.exit(1);
        }
    });

program.parse();
