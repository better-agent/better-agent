import type { BetterAgentStorage, StoreListQuery, StoreListResult } from "@better-agent/core";
import { storageTables, throwUnsupportedStorageTable } from "@better-agent/core";
import { selectBetterAgentSchema, toBetterAgentOrmListQuery } from "@better-agent/schema";
import type { ModelClient, ModelName, OrmClient } from "@farming-labs/orm";
import { createRedisOrm } from "../orm";
import type { RedisOptions } from "../types";
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

const redisSchema = selectBetterAgentSchema();

type RedisSchema = typeof redisSchema;
type RedisModelName = ModelName<RedisSchema>;
type RedisOrm = OrmClient<RedisSchema>;

type TableAdapter = {
    get(id: string): Promise<unknown | undefined>;
    set(id: string, value: unknown): Promise<void>;
    delete(id: string): Promise<void>;
    list(query?: StoreListQuery): Promise<StoreListResult<unknown>>;
};

async function upsertRow<TModelName extends RedisModelName, TRow>(input: {
    model: ModelClient<RedisSchema, TModelName>;
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

function createTableAdapter<TModelName extends RedisModelName, TRecord, TRow>(input: {
    getModel(): Promise<ModelClient<RedisSchema, TModelName>>;
    keyField: string;
    fromRow(row: TRow): TRecord;
    toRow(id: string, record: TRecord): TRow;
}): TableAdapter {
    return {
        async get(id) {
            const model = await input.getModel();
            type FindUniqueArgs = Parameters<typeof model.findUnique>[0];

            const row = (await model.findUnique({
                where: { [input.keyField]: id },
            } as FindUniqueArgs)) as TRow | null;

            return row ? input.fromRow(row) : undefined;
        },
        async set(id, value) {
            const model = await input.getModel();
            await upsertRow({
                model,
                keyField: input.keyField,
                id,
                row: input.toRow(id, value as TRecord),
            });
        },
        async delete(id) {
            const model = await input.getModel();
            type DeleteManyArgs = Parameters<typeof model.deleteMany>[0];

            await model.deleteMany({
                where: { [input.keyField]: id },
            } as DeleteManyArgs);
        },
        async list(query) {
            const model = await input.getModel();

            const rows = (await model.findMany(toBetterAgentOrmListQuery(query))) as TRow[];
            return {
                items: rows.map(input.fromRow),
            };
        },
    };
}

function resolveAdapter(adapters: ReadonlyMap<string, TableAdapter>, table: string): TableAdapter {
    return adapters.get(table) ?? throwUnsupportedStorageTable(table, "redis storage");
}

function requireModel<TModelName extends RedisModelName>(
    orm: RedisOrm,
    modelName: TModelName,
): ModelClient<RedisSchema, TModelName> {
    const model = orm[modelName];
    if (!model) {
        throw new Error(`Redis ORM model '${modelName}' is not available.`);
    }

    return model;
}

export function redisStorage(options: RedisOptions): BetterAgentStorage {
    let orm: Promise<RedisOrm> | undefined;
    const getOrm = () => {
        orm ??= createRedisOrm(options) as Promise<RedisOrm>;
        return orm;
    };
    const adapters = new Map<string, TableAdapter>();

    const getModel = <TModelName extends RedisModelName>(modelName: TModelName) => {
        return async () => requireModel(await getOrm(), modelName);
    };

    adapters.set(
        storageTables.runs,
        createTableAdapter({
            getModel: getModel("run"),
            keyField: "runId",
            fromRow: fromRunRow,
            toRow: toRunRow,
        }),
    );

    adapters.set(
        storageTables.memoryThreads,
        createTableAdapter({
            getModel: getModel("thread"),
            keyField: "id",
            fromRow: fromThreadRow,
            toRow: toThreadRow,
        }),
    );

    adapters.set(
        storageTables.memoryMessages,
        createTableAdapter({
            getModel: getModel("message"),
            keyField: "id",
            fromRow: fromMessageRow,
            toRow: toMessageRow,
        }),
    );

    adapters.set(
        storageTables.streams,
        createTableAdapter({
            getModel: getModel("stream"),
            keyField: "id",
            fromRow: fromStreamRow,
            toRow: toStreamRow,
        }),
    );

    adapters.set(
        storageTables.streamEvents,
        createTableAdapter({
            getModel: getModel("streamEvent"),
            keyField: "id",
            fromRow: fromStreamEventRow,
            toRow: toStreamEventRow,
        }),
    );

    return {
        async get<T = unknown>(table: string, id: string): Promise<T | undefined> {
            return (await resolveAdapter(adapters, table).get(id)) as T | undefined;
        },
        set(table, id, value) {
            return resolveAdapter(adapters, table).set(id, value);
        },
        delete(table, id) {
            return resolveAdapter(adapters, table).delete(id);
        },
        async list<T = unknown>(
            table: string,
            query?: StoreListQuery,
        ): Promise<StoreListResult<T>> {
            return (await resolveAdapter(adapters, table).list(query)) as StoreListResult<T>;
        },
    };
}
