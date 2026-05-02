import { isRecord } from "@better-agent/shared/utils";
import type { BetterAgentStorage, StoreListQuery, StoreValue } from "./types";

function isStoreValue(value: unknown): value is StoreValue {
    return (
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean" ||
        value === null
    );
}

function getStoreField(value: unknown, field: string): StoreValue | undefined {
    if (!isRecord(value)) {
        return undefined;
    }

    const fieldValue = value[field];
    return isStoreValue(fieldValue) ? fieldValue : undefined;
}

function compareStoreValues(left: StoreValue, right: StoreValue): number {
    if (Object.is(left, right)) {
        return 0;
    }

    if (left === null) {
        return -1;
    }

    if (right === null) {
        return 1;
    }

    if (typeof left === "boolean" && typeof right === "boolean") {
        return Number(left) - Number(right);
    }

    return left < right ? -1 : 1;
}

function matchesWhere(value: unknown, where: NonNullable<StoreListQuery["where"]>): boolean {
    for (const [field, expected] of Object.entries(where)) {
        if (!Object.is(getStoreField(value, field), expected)) {
            return false;
        }
    }

    return true;
}

export function createInMemoryStorage(): BetterAgentStorage {
    const tables = new Map<string, Map<string, unknown>>();

    const getTable = (table: string) => {
        const existing = tables.get(table);
        if (existing) {
            return existing;
        }

        const next = new Map<string, unknown>();
        tables.set(table, next);
        return next;
    };

    return {
        get<T = unknown>(table: string, id: string) {
            return getTable(table).get(id) as T | undefined;
        },
        set<T = unknown>(table: string, id: string, value: T) {
            getTable(table).set(id, value);
        },
        delete(table: string, id: string) {
            getTable(table).delete(id);
        },
        list<T = unknown>(table: string, query: StoreListQuery = {}) {
            let values = Array.from(getTable(table).values());

            if (query.where) {
                values = values.filter((value) => matchesWhere(value, query.where ?? {}));
            }

            if (query.orderBy) {
                for (const [field, direction] of [...Object.entries(query.orderBy)].reverse()) {
                    values = [...values].sort((left, right) => {
                        const leftValue = getStoreField(left, field);
                        const rightValue = getStoreField(right, field);

                        if (leftValue === undefined && rightValue === undefined) {
                            return 0;
                        }

                        if (leftValue === undefined) {
                            return 1;
                        }

                        if (rightValue === undefined) {
                            return -1;
                        }

                        const compared = compareStoreValues(leftValue, rightValue);
                        return direction === "asc" ? compared : -compared;
                    });
                }
            }

            const items = query.take === undefined ? values : values.slice(0, query.take);

            return {
                items: items as T[],
            };
        },
    };
}
