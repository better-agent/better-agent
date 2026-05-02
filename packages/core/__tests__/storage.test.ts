import { describe, expect, test } from "bun:test";
import { BetterAgentError } from "@better-agent/shared/errors";
import { createCompositeStorage } from "../src/storage/composite";
import {
    isUnsupportedStorageTableError,
    throwUnsupportedStorageTable,
    unsupportedStorageTableError,
} from "../src/storage/errors";
import { createInMemoryStorage } from "../src/storage/in-memory";
import { storageTables } from "../src/storage/types";
import type { BetterAgentStorage, StoreListQuery } from "../src/storage/types";

const createRecordingStorage = (label: string) => {
    const calls: string[] = [];
    const storage: BetterAgentStorage = {
        get: (table, id) => {
            calls.push(`${label}:get:${table}:${id}`);
            return undefined;
        },
        set: (table, id) => {
            calls.push(`${label}:set:${table}:${id}`);
        },
        delete: (table, id) => {
            calls.push(`${label}:delete:${table}:${id}`);
        },
        list: (table, query?: StoreListQuery) => {
            calls.push(`${label}:list:${table}:${query?.take ?? "all"}`);
            return { items: [] };
        },
    };

    return { storage, calls };
};

describe("storage", () => {
    test("in-memory storage supports set/get/delete", async () => {
        const storage = createInMemoryStorage();

        await storage.set("items", "a", { id: "a" });
        expect(await storage.get<{ id: string }>("items", "a")).toEqual({ id: "a" });

        await storage.delete("items", "a");
        expect(await storage.get("items", "a")).toBeUndefined();
    });

    test("in-memory storage lists with where, orderBy, and take", async () => {
        const storage = createInMemoryStorage();
        await storage.set("items", "a", { id: "a", scope: "one", rank: 2 });
        await storage.set("items", "b", { id: "b", scope: "one", rank: 1 });
        await storage.set("items", "c", { id: "c", scope: "two", rank: 3 });
        await storage.set("items", "d", { id: "d", scope: "one" });

        const result = await storage.list<{ id: string }>("items", {
            where: { scope: "one" },
            orderBy: { rank: "asc" },
            take: 2,
        });

        expect(result.items.map((item) => item.id)).toEqual(["b", "a"]);
    });

    test("in-memory storage orders descending", async () => {
        const storage = createInMemoryStorage();
        await storage.set("items", "a", { id: "a", rank: 1 });
        await storage.set("items", "b", { id: "b", rank: 2 });

        const result = await storage.list<{ id: string }>("items", {
            orderBy: { rank: "desc" },
        });

        expect(result.items.map((item) => item.id)).toEqual(["b", "a"]);
    });

    test("composite storage routes by table, domain, and default", async () => {
        const table = createRecordingStorage("table");
        const domain = createRecordingStorage("domain");
        const fallback = createRecordingStorage("default");
        const storage = createCompositeStorage({
            default: fallback.storage,
            domains: { memory: domain.storage },
            tables: { [storageTables.memoryMessages]: table.storage },
        });

        await storage.get(storageTables.memoryMessages, "message-1");
        await storage.get(storageTables.memoryThreads, "thread-1");
        await storage.get(storageTables.runs, "run-1");

        expect(table.calls).toEqual([`table:get:${storageTables.memoryMessages}:message-1`]);
        expect(domain.calls).toEqual([`domain:get:${storageTables.memoryThreads}:thread-1`]);
        expect(fallback.calls).toEqual([`default:get:${storageTables.runs}:run-1`]);
    });

    test("composite storage omits tables and domains", async () => {
        const storage = createCompositeStorage({
            default: createInMemoryStorage(),
            omit: ["memory"],
        });

        expect(() => storage.get(storageTables.memoryThreads, "thread-1")).toThrow(
            "Storage table 'memoryThreads' is not supported by composite storage.",
        );
    });

    test("unsupported storage errors include table context", () => {
        const error = unsupportedStorageTableError("custom", "test storage");

        expect(error).toBeInstanceOf(BetterAgentError);
        expect(error.code).toBe("VALIDATION_FAILED");
        expect(error.context).toEqual({ table: "custom", adapterName: "test storage" });
        expect(isUnsupportedStorageTableError(error)).toBe(true);
        expect(() => throwUnsupportedStorageTable("custom")).toThrow(BetterAgentError);
    });
});
