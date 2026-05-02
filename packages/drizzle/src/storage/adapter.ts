import type { BetterAgentStorage, StoreListQuery, StoreListResult } from "@better-agent/core";
import { storageTables, throwUnsupportedStorageTable } from "@better-agent/core";
import { selectBetterAgentSchema, toBetterAgentOrmListQuery } from "@better-agent/schema";
import type { ModelClient, ModelName, OrmClient } from "@farming-labs/orm";
import { createDrizzleOrm } from "../orm";
import type { DrizzleOptions } from "../types";
import {
    fromMessageRow,
    fromRunRow,
    fromStreamEventRow,
    fromStreamRow,
    fromThreadRow,
    toMessageRow,
    toRunRow,
    toStreamEventRow,
    toStreamRow,
    toThreadRow,
} from "./mappers";

const drizzleSchema = selectBetterAgentSchema();

type DrizzleSchema = typeof drizzleSchema;
type DrizzleModelName = ModelName<DrizzleSchema>;
type DrizzleOrm = OrmClient<DrizzleSchema>;

type TableAdapter = {
    get(id: string): Promise<unknown | undefined>;
    set(id: string, value: unknown): Promise<void>;
    delete(id: string): Promise<void>;
    list(query?: StoreListQuery): Promise<StoreListResult<unknown>>;
};

async function upsertRow<TModelName extends DrizzleModelName, TRow>(input: {
    model: ModelClient<DrizzleSchema, TModelName>;
    keyField: string;
    id: string;
    row: TRow;
}): Promise<void> {
    type FindUniqueArgs = Parameters<typeof input.model.findUnique>[0];
    type UpdateArgs = Parameters<typeof input.model.update>[0];
    type UpsertArgs = Parameters<typeof input.model.upsert>[0];

    const where = { [input.keyField]: input.id };
    const existing = await input.model.findUnique({ where } as FindUniqueArgs);

    if (!existing) {
        await input.model.upsert({
            where,
            create: input.row,
            update: input.row,
        } as UpsertArgs);
        return;
    }

    await input.model.update({
        where,
        data: input.row,
    } as UpdateArgs);
}

function createTableAdapter<TModelName extends DrizzleModelName, TRecord, TRow>(input: {
    model: ModelClient<DrizzleSchema, TModelName>;
    keyField: string;
    fromRow(row: TRow): TRecord;
    toRow(id: string, record: TRecord): TRow;
}): TableAdapter {
    return {
        async get(id) {
            type FindUniqueArgs = Parameters<typeof input.model.findUnique>[0];

            const row = (await input.model.findUnique({
                where: { [input.keyField]: id },
            } as FindUniqueArgs)) as TRow | null;

            return row ? input.fromRow(row) : undefined;
        },
        async set(id, value) {
            await upsertRow({
                model: input.model,
                keyField: input.keyField,
                id,
                row: input.toRow(id, value as TRecord),
            });
        },
        async delete(id) {
            type DeleteManyArgs = Parameters<typeof input.model.deleteMany>[0];

            await input.model.deleteMany({
                where: { [input.keyField]: id },
            } as DeleteManyArgs);
        },
        async list(query) {
            const rows = (await input.model.findMany(toBetterAgentOrmListQuery(query))) as TRow[];
            return {
                items: rows.map(input.fromRow),
            };
        },
    };
}

function resolveAdapter(adapters: ReadonlyMap<string, TableAdapter>, table: string): TableAdapter {
    return adapters.get(table) ?? throwUnsupportedStorageTable(table, "drizzle storage");
}

function requireModel<TModelName extends DrizzleModelName>(
    orm: DrizzleOrm,
    modelName: TModelName,
): ModelClient<DrizzleSchema, TModelName> | undefined {
    return orm[modelName];
}

export function drizzleStorage(options: DrizzleOptions): BetterAgentStorage {
    const orm = createDrizzleOrm(drizzleSchema, options) as DrizzleOrm;
    const adapters = new Map<string, TableAdapter>();

    const runModel = requireModel(orm, "run");
    if (runModel) {
        adapters.set(
            storageTables.runs,
            createTableAdapter({
                model: runModel,
                keyField: "runId",
                fromRow: fromRunRow,
                toRow: toRunRow,
            }),
        );
    }

    const threadModel = requireModel(orm, "thread");
    if (threadModel) {
        adapters.set(
            storageTables.memoryThreads,
            createTableAdapter({
                model: threadModel,
                keyField: "id",
                fromRow: fromThreadRow,
                toRow: toThreadRow,
            }),
        );
    }

    const messageModel = requireModel(orm, "message");
    if (messageModel) {
        adapters.set(
            storageTables.memoryMessages,
            createTableAdapter({
                model: messageModel,
                keyField: "id",
                fromRow: fromMessageRow,
                toRow: toMessageRow,
            }),
        );
    }

    const streamModel = requireModel(orm, "stream");
    if (streamModel) {
        adapters.set(
            storageTables.streams,
            createTableAdapter({
                model: streamModel,
                keyField: "id",
                fromRow: fromStreamRow,
                toRow: toStreamRow,
            }),
        );
    }

    const streamEventModel = requireModel(orm, "streamEvent");
    if (streamEventModel) {
        adapters.set(
            storageTables.streamEvents,
            createTableAdapter({
                model: streamEventModel,
                keyField: "id",
                fromRow: fromStreamEventRow,
                toRow: toStreamEventRow,
            }),
        );
    }

    return {
        get<T = unknown>(table: string, id: string) {
            return resolveAdapter(adapters, table).get(id) as Promise<T | undefined>;
        },
        set<T = unknown>(table: string, id: string, value: T) {
            return resolveAdapter(adapters, table).set(id, value);
        },
        delete(table: string, id: string) {
            return resolveAdapter(adapters, table).delete(id);
        },
        list<T = unknown>(table: string, query?: StoreListQuery) {
            return resolveAdapter(adapters, table).list(query) as Promise<StoreListResult<T>>;
        },
    };
}
