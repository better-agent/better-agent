import { throwUnsupportedStorageTable } from "./errors";
import {
    type BetterAgentStorage,
    type StorageDomain,
    type StorageScope,
    type StorageTable,
    type StoreListQuery,
    storageDomains,
} from "./types";

export interface CreateCompositeStorageOptions {
    default?: BetterAgentStorage;
    domains?: Partial<Record<StorageDomain, BetterAgentStorage>>;
    tables?: Partial<Record<StorageTable, BetterAgentStorage>> & Record<string, BetterAgentStorage>;
    omit?: readonly StorageScope[];
}

export function createCompositeStorage(options: CreateCompositeStorageOptions): BetterAgentStorage {
    const domainRoutes = new Map<string, BetterAgentStorage>();
    const tableRoutes = new Map<string, BetterAgentStorage>();
    const omittedTables = new Set<string>();

    for (const scope of options.omit ?? []) {
        if (scope in storageDomains) {
            for (const table of storageDomains[scope as StorageDomain]) {
                omittedTables.add(table);
            }
            continue;
        }

        omittedTables.add(scope);
    }

    for (const [domain, storage] of Object.entries(options.domains ?? {}) as Array<
        [StorageDomain, BetterAgentStorage | undefined]
    >) {
        if (!storage) {
            continue;
        }

        for (const table of storageDomains[domain]) {
            domainRoutes.set(table, storage);
        }
    }

    for (const [table, storage] of Object.entries(options.tables ?? {})) {
        tableRoutes.set(table, storage);
    }

    const resolve = (table: string): BetterAgentStorage => {
        if (omittedTables.has(table)) {
            throwUnsupportedStorageTable(table, "composite storage");
        }

        return (
            tableRoutes.get(table) ??
            domainRoutes.get(table) ??
            options.default ??
            throwUnsupportedStorageTable(table, "composite storage")
        );
    };

    return {
        get<T = unknown>(table: string, id: string) {
            return resolve(table).get<T>(table, id);
        },
        set<T = unknown>(table: string, id: string, value: T) {
            return resolve(table).set<T>(table, id, value);
        },
        delete(table: string, id: string) {
            return resolve(table).delete(table, id);
        },
        list<T = unknown>(table: string, query?: StoreListQuery) {
            return resolve(table).list<T>(table, query);
        },
    };
}
