import { selectBetterAgentSchema } from "@better-agent/schema";
import { createOrm } from "@farming-labs/orm";
import { createRedisDriver } from "@farming-labs/orm-redis";
import type { RedisOptions } from "./types";

const redisSchema = selectBetterAgentSchema();

export type RedisSchema = typeof redisSchema;
export type RedisOrm = Awaited<ReturnType<typeof createRedisOrm>>;

export async function createRedisOrm(options: RedisOptions) {
    return createOrm({
        schema: redisSchema,
        driver: createRedisDriver({
            client: options.client,
            base: options.base,
            prefixes: options.prefixes,
            transforms: options.transforms,
        }),
    });
}
