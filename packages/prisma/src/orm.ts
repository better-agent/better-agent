import { createOrm } from "@farming-labs/orm";
import type { AnyModelDefinition, OrmClient, SchemaDefinition } from "@farming-labs/orm";
import { createPrismaDriver } from "@farming-labs/orm-prisma";
import type { PrismaClientLike } from "@farming-labs/orm-prisma";
import type { PrismaOptions } from "./types";

export function createPrismaOrm<
    TSchema extends SchemaDefinition<Record<string, AnyModelDefinition>>,
>(schema: TSchema, options: PrismaOptions): OrmClient<TSchema> {
    return createOrm({
        schema,
        driver: createPrismaDriver({
            client: options.client as PrismaClientLike,
        }),
    });
}
