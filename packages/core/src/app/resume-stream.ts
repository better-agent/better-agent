import type { AppContext } from "./create-app-context";
import { createStreamStore } from "./stream-store";
import type { BetterAgentRuns } from "./types";

export function createResumeStreamMethod(context: AppContext): {
    resumeStream: BetterAgentRuns["resumeStream"];
} {
    const resumeStream: BetterAgentRuns["resumeStream"] = (input) => {
        return createStreamStore(context.config.storage).resume({
            runId: input.runId,
            afterSequence: input.afterSequence,
            signal: input.signal,
        });
    };

    return { resumeStream };
}
