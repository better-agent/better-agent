import type { SandboxSessionStore } from "./types";

/** Creates an in-memory sandbox session store. */
export function createMemorySandboxSessionStore(): SandboxSessionStore {
    const sessions = new Map<string, string>();

    return {
        async get(key) {
            return sessions.get(key) ?? null;
        },
        async set(key, sandboxId) {
            sessions.set(key, sandboxId);
        },
        async delete(key) {
            sessions.delete(key);
        },
    };
}
