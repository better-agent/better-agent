import { createOrm } from "@farming-labs/orm";
import type { AnyModelDefinition, OrmClient, SchemaDefinition } from "@farming-labs/orm";
import { createDrizzleDriver } from "@farming-labs/orm-drizzle";
import type { DrizzleOptions } from "./types";

export function createDrizzleOrm<
    TSchema extends SchemaDefinition<Record<string, AnyModelDefinition>>,
>(schema: TSchema, options: DrizzleOptions): OrmClient<TSchema> {
    return createOrm({
        schema,
        driver: createDrizzleDriver({
            db: options.db,
            dialect: options.dialect,
        }),
    });
}
