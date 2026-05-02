import type { BetterAgentStorage } from "@better-agent/core";
import type { PrismaClientLike as OrmPrismaClientLike } from "@farming-labs/orm-prisma";

export type PrismaClientInput = object;

export interface PrismaOptions {
    client: PrismaClientInput;
}

export type PrismaStorage = BetterAgentStorage;

export type { OrmPrismaClientLike as PrismaClientLike };
