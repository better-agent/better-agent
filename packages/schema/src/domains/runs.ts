import { datetime, defineSchema, enumeration, json, model, string } from "@farming-labs/orm";
import { tableNames } from "../names";

export const runsSchema = defineSchema({
    run: model({
        table: tableNames.runs,
        fields: {
            runId: string().unique().map("run_id"),
            agentName: string().map("agent_name"),
            threadId: string().nullable().map("thread_id"),
            scope: string().nullable(),
            status: enumeration(["running", "completed", "failed", "interrupted", "aborted"]),
            abortRequestedAt: datetime().nullable().map("abort_requested_at"),
            finalEvent: json().nullable().map("final_event"),
            config: json().nullable(),
            startedAt: datetime().defaultNow().map("started_at"),
            updatedAt: datetime().defaultNow().map("updated_at"),
            finishedAt: datetime().nullable().map("finished_at"),
        },
        constraints: {
            indexes: [["runId", "scope"]],
        },
    }),
});
