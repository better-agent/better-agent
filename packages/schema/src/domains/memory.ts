import { datetime, defineSchema, id, json, model, string } from "@farming-labs/orm";
import { tableNames } from "../names";

export const memorySchema = defineSchema({
    thread: model({
        table: tableNames.threads,
        fields: {
            id: id(),
            agentName: string().nullable().map("agent_name"),
            scope: string().nullable(),
            title: string().nullable(),
            state: json().nullable(),
            metadata: json().nullable(),
            createdAt: datetime().defaultNow().map("created_at"),
            updatedAt: datetime().defaultNow().map("updated_at"),
        },
        constraints: {
            indexes: [["agentName", "scope"]],
        },
    }),
    message: model({
        table: tableNames.messages,
        fields: {
            id: id(),
            threadId: string().references("thread.id").map("thread_id"),
            runId: string().nullable().map("run_id"),
            message: json(),
            createdAt: datetime().defaultNow().map("created_at"),
        },
        constraints: {
            indexes: [["threadId"]],
        },
    }),
});
