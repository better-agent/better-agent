import type { BetterAgentStorage } from "@better-agent/core";
import type { AnyModelDefinition, SchemaDefinition } from "@farming-labs/orm";
import type {
    KyselyDatabaseLike,
    KyselyDialect,
    KyselyDriverConfig,
} from "@farming-labs/orm-kysely";

type BetterAgentKyselyDriverConfig = KyselyDriverConfig<
    SchemaDefinition<Record<string, AnyModelDefinition>>
>;

export interface KyselyOptions {
    db: BetterAgentKyselyDriverConfig["db"];
    dialect: BetterAgentKyselyDriverConfig["dialect"];
}

export type KyselyStorage = BetterAgentStorage;

export type { KyselyDatabaseLike, KyselyDialect };
