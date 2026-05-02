import { EventType } from "@ag-ui/core";
import jsonPatch from "fast-json-patch";
import type { AgentEvent, AgentStateDeltaEvent, AgentStateSnapshotEvent } from "../ag-ui/events";
import type { JsonPatchOperation } from "../ag-ui/state";

const { applyPatch } = jsonPatch;

export interface RuntimeStateControl<TState> {
    get(): TState | undefined;
    set(snapshot: unknown): AgentStateSnapshotEvent;
    patch(delta: JsonPatchOperation[]): AgentStateDeltaEvent;
    apply(event: AgentEvent): void;
}

export function createRuntimeStateControl<TState>(
    initialState: TState | undefined,
): RuntimeStateControl<TState> {
    let currentState = initialState;

    return {
        get() {
            return currentState;
        },
        set(snapshot) {
            currentState = snapshot as TState;

            return {
                type: EventType.STATE_SNAPSHOT,
                timestamp: Date.now(),
                snapshot,
            };
        },
        patch(delta) {
            currentState = applyPatch(currentState, delta, true, false).newDocument;

            return {
                type: EventType.STATE_DELTA,
                timestamp: Date.now(),
                delta,
            };
        },
        apply(event) {
            if (event.type === EventType.STATE_SNAPSHOT) {
                currentState = event.snapshot;
                return;
            }

            if (event.type === EventType.STATE_DELTA) {
                try {
                    currentState = applyPatch(currentState, event.delta, true, false).newDocument;
                } catch {
                    return;
                }
            }
        },
    };
}
