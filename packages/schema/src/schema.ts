import { defineSchema } from "@farming-labs/orm";
import { memorySchema } from "./domains/memory";
import { runsSchema } from "./domains/runs";
import { streamsSchema } from "./domains/streams";

const schemaDomains = {
    memory: memorySchema,
    runs: runsSchema,
    streams: streamsSchema,
} as const;

export type SchemaDomain = keyof typeof schemaDomains;

export function resolveSchemaDomains(only?: readonly SchemaDomain[]): readonly SchemaDomain[] {
    const domainNames = Object.keys(schemaDomains) as SchemaDomain[];

    if (!only || only.length === 0) {
        return domainNames;
    }

    const domains = new Set<SchemaDomain>(only);
    return domainNames.filter((domain) => domains.has(domain));
}

export function selectBetterAgentSchema(only?: readonly SchemaDomain[]) {
    const domains = resolveSchemaDomains(only);
    return defineSchema(
        Object.assign({}, ...domains.map((domain) => schemaDomains[domain].models)),
    );
}
