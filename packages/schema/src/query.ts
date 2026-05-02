const timestampFields = new Set([
    "abortRequestedAt",
    "startedAt",
    "updatedAt",
    "finishedAt",
    "createdAt",
    "closedAt",
    "timestamp",
]);

type ListQuery = {
    where?: Record<string, unknown>;
};

function toOrmValue(field: string, value: unknown): unknown {
    return timestampFields.has(field) && typeof value === "number" ? new Date(value) : value;
}

export function toBetterAgentOrmListQuery<TQuery extends ListQuery>(
    query?: TQuery,
): TQuery | undefined {
    if (!query?.where) {
        return query;
    }

    return {
        ...query,
        where: Object.fromEntries(
            Object.entries(query.where).map(([field, value]) => [field, toOrmValue(field, value)]),
        ),
    };
}
