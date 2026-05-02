import path from "node:path";
import { z } from "zod";
import { type Framework, frameworkIds } from "./frameworks";

export const frameworkSchema = z.enum(frameworkIds);
export const providerIds = [
    "openai",
    "anthropic",
    "gemini",
    "xai",
    "ollama",
    "openrouter",
    "workers-ai",
] as const;

export const providerSchema = z.enum(providerIds);
export const providersSchema = z.array(providerSchema).min(1, "At least one provider is required");
export const pluginSchema = z.enum(["ip-allowlist", "logging", "rate-limit", "sandbox"]);
export const pluginsSchema = z.array(pluginSchema).default([]);
export const appNameSchema = z
    .string()
    .trim()
    .min(1, "App name is required")
    .regex(/^[a-z0-9-]+$/, "App name must use lowercase letters, numbers, and hyphens only");

export const resolvedCreateConfigSchema = z.object({
    name: appNameSchema,
    framework: frameworkSchema,
    providers: providersSchema,
    plugins: pluginsSchema,
    targetDir: z.string().trim().min(1, "Target directory is required"),
});

export type ResolvedCreateConfig = z.infer<typeof resolvedCreateConfigSchema>;
export type Provider = z.infer<typeof providerSchema>;
export type Plugin = z.infer<typeof pluginSchema>;

export const resolveCreateConfig = (input: {
    name: string;
    framework: Framework;
    providers: Provider[];
    plugins?: Plugin[];
}) => {
    const targetDir = path.resolve(process.cwd(), input.name);
    const appName = path.basename(targetDir).trim();

    return resolvedCreateConfigSchema.parse({
        name: appName,
        framework: input.framework,
        providers: input.providers,
        plugins: input.plugins ?? [],
        targetDir,
    });
};
