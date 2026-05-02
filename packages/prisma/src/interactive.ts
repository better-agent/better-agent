import { resolveSchemaDomains } from "@better-agent/schema";
import type { SchemaDomain } from "@better-agent/schema";
import { cancel, isCancel, multiselect } from "@clack/prompts";

export const prismaDomains = [
    "memory",
    "runs",
    "streams",
] as const satisfies readonly SchemaDomain[];
export type PrismaDomain = (typeof prismaDomains)[number];

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
} as const satisfies Record<PrismaDomain, { label: string; hint: string }>;

export async function promptPrismaDomains(): Promise<readonly PrismaDomain[] | undefined> {
    const selected = await multiselect<PrismaDomain>({
        message: "Select schema domains",
        required: false,
        initialValues: [...prismaDomains],
        options: prismaDomains.map((domain) => ({
            value: domain,
            label: domainOptions[domain].label,
            hint: domainOptions[domain].hint,
        })),
    });

    if (isCancel(selected)) {
        cancel("Generation cancelled.");
        process.exit(0);
    }

    return selected.length === prismaDomains.length ? undefined : resolveSchemaDomains(selected);
}
