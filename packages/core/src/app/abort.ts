import { BetterAgentError } from "@better-agent/shared/errors";
import { type RunRecord, storageTables } from "../storage";
import type { AppContext } from "./create-app-context";
import { resolveUnsupportedStorageTable, tolerateUnsupportedStorageTable } from "./helpers";
import type { BetterAgentRuns } from "./types";

export function createAbortMethod(context: AppContext): { abortRun: BetterAgentRuns["abort"] } {
    const abortRun: BetterAgentRuns["abort"] = async (runId) => {
        const storage = context.config.storage;
        if (storage) {
            const result = await resolveUnsupportedStorageTable(() =>
                storage.get<RunRecord>(storageTables.runs, runId),
            );

            if (!result.supported) {
                const runtime = context.activeRuntimes.get(runId);
                await runtime?.abortRun(runId);
                return;
            }

            const record = result.value;
            if (!record) {
                throw BetterAgentError.fromCode("NOT_FOUND", `Run '${runId}' not found.`, {
                    context: { runId },
                });
            }

            if (record.abortRequestedAt === undefined && record.status === "running") {
                await tolerateUnsupportedStorageTable(() =>
                    storage.set(storageTables.runs, runId, {
                        ...record,
                        abortRequestedAt: Date.now(),
                        updatedAt: Date.now(),
                    }),
                );
            }
        }

        const runtime = context.activeRuntimes.get(runId);
        await runtime?.abortRun(runId);
    };

    return { abortRun };
}
