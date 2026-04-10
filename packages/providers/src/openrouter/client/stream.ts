export const unwrapOpenRouterStreamJson = (parsed: unknown): unknown => {
    if (!parsed || typeof parsed !== "object") return parsed;
    const obj = parsed;

    if ("data" in obj) return obj.data;
    if ("value" in obj) return obj.value;
    return obj;
};
