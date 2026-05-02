import type { BetterAgentStorage } from "@better-agent/core";
import type { RedisClientLike as OrmRedisClientLike } from "@farming-labs/orm-redis";

export type RedisClientInput = OrmRedisClientLike;

export type RedisModelPrefixMap = Partial<Record<string, string>>;

export type RedisFieldTransform = {
    encode?: (value: unknown) => unknown;
    decode?: (value: unknown) => unknown;
};

export type RedisFieldTransformMap = Partial<
    Record<string, Partial<Record<string, RedisFieldTransform>>>
>;

export interface RedisOptions {
    client: RedisClientInput;
    base?: string;
    prefixes?: RedisModelPrefixMap;
    transforms?: RedisFieldTransformMap;
}

export type RedisStorage = BetterAgentStorage;

export type { OrmRedisClientLike as RedisClientLike };
