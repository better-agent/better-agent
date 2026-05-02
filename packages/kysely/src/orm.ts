import { createOrm } from "@farming-labs/orm";
import type { AnyModelDefinition, OrmClient, SchemaDefinition } from "@farming-labs/orm";
import { createKyselyDriver } from "@farming-labs/orm-kysely";
import type { KyselyOptions } from "./types";

export function createKyselyOrm<
    TSchema extends SchemaDefinition<Record<string, AnyModelDefinition>>,
>(schema: TSchema, options: KyselyOptions): OrmClient<TSchema> {
    return createOrm({
        schema,
        driver: createKyselyDriver({
            db: options.db,
            dialect: options.dialect,
        }),
    });
}
