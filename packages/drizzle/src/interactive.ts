import { resolveSchemaDomains } from "@better-agent/schema";
import type { SchemaDomain } from "@better-agent/schema";
import { cancel, isCancel, multiselect } from "@clack/prompts";

export const drizzleDomains = [
    "memory",
    "runs",
    "streams",
] as const satisfies readonly SchemaDomain[];
export type DrizzleDomain = (typeof drizzleDomains)[number];

const domainOptions = {
    memory: {
        label: "Memory",
        hint: "threads/messages",
    },
    runs: {
        label: "Runs",
        hint: "history",
    },
    streams: {
        label: "Streams",
        hint: "resume",
    },
} as const satisfies Record<DrizzleDomain, { label: string; hint: string }>;

export async function promptDrizzleDomains(): Promise<readonly DrizzleDomain[] | undefined> {
    const selected = await multiselect<DrizzleDomain>({
        message: "Select schema domains",
        required: false,
        initialValues: [...drizzleDomains],
        options: drizzleDomains.map((domain) => ({
            value: domain,
            label: domainOptions[domain].label,
            hint: domainOptions[domain].hint,
        })),
    });

    if (isCancel(selected)) {
        cancel("Generation cancelled.");
        process.exit(0);
    }

    return selected.length === drizzleDomains.length ? undefined : resolveSchemaDomains(selected);
}
