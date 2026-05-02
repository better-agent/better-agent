import type { AgentState } from "../ag-ui/state";
import type { RunInput, RunResult, StreamResult } from "./types";

export interface RuntimeRunRequest<TState = AgentState> {
    runId: string;
    input: RunInput<TState>;
}

export interface RuntimeControl<TState = AgentState> {
    run(request: RuntimeRunRequest<TState>): Promise<RunResult<TState>>;
    stream(request: RuntimeRunRequest<TState>): Promise<StreamResult<TState>>;
    abortRun(runId: string): Promise<void>;
}
