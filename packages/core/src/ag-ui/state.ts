import type { State } from "@ag-ui/core";
import type { Operation } from "fast-json-patch";

export type AgentState = State;
export type JsonPatchOperation = Exclude<Operation, { op: "_get" }>;

export interface AgentStateHandle<TState = unknown> {
    get(): TState | undefined;
    set(snapshot: TState): void;
    patch(delta: JsonPatchOperation[]): void;
}

export interface AgentStateSnapshot<TState = AgentState> {
    snapshot: TState;
}

export interface AgentStateDelta<TDelta = JsonPatchOperation[]> {
    delta: TDelta;
}
