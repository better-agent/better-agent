import type { BetterAgentStorage } from "@better-agent/core";
import type { SchemaDefinition } from "@farming-labs/orm";
import type { DrizzleDriverConfig } from "@farming-labs/orm-drizzle";

export type DrizzleStorage = BetterAgentStorage;

// biome-ignore lint/suspicious/noExplicitAny:
type BetterAgentDrizzleDriverConfig = DrizzleDriverConfig<SchemaDefinition<any>>;

export type DrizzleDialect = BetterAgentDrizzleDriverConfig["dialect"];

export interface DrizzleOptions {
    db: NonNullable<BetterAgentDrizzleDriverConfig["db"]>;
    dialect: BetterAgentDrizzleDriverConfig["dialect"];
}
