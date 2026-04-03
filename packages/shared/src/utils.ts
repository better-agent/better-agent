import { type Result, err, ok } from "./neverthrow";

export const safeJsonParse = (text: string): Result<unknown, Error> => {
    try {
        return ok(JSON.parse(text));
    } catch (error) {
        return err(error instanceof Error ? error : new Error(String(error)));
    }
};

export const isPlainRecord = (value: unknown): value is Record<string, unknown> => {
    return typeof value === "object" && value !== null && !Array.isArray(value);
};
