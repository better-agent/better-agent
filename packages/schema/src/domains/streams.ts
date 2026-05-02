import {
    datetime,
    defineSchema,
    enumeration,
    id,
    integer,
    json,
    model,
    string,
} from "@farming-labs/orm";
import { tableNames } from "../names";

export const streamsSchema = defineSchema({
    stream: model({
        table: tableNames.streams,
        fields: {
            id: id(),
            runId: string().map("run_id"),
            status: enumeration(["open", "closed"]),
            createdAt: datetime().defaultNow().map("created_at"),
            updatedAt: datetime().defaultNow().map("updated_at"),
            closedAt: datetime().nullable().map("closed_at"),
        },
        constraints: {
            unique: [["runId"]],
        },
    }),
    streamEvent: model({
        table: tableNames.streamEvents,
        fields: {
            id: id(),
            runId: string().map("run_id"),
            seq: integer(),
            timestamp: datetime().defaultNow(),
            event: json(),
        },
        constraints: {
            unique: [["runId", "seq"]],
            indexes: [["runId"]],
        },
    }),
});
