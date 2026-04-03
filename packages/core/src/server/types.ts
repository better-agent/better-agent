import type { PluginRuntime } from "../plugins";
import type { Modality, OutputSchemaDefinition } from "../providers";
import type {
    BetterAgentRuntime,
    RunAdvancedOptions,
    RunOptions,
    SubmitToolApprovalParams,
    SubmitToolResultParams,
} from "../run";

/**
 * Server configuration.
 */
export interface CreateServerConfig {
    /** Runtime used to execute agent operations. */
    runtime: BetterAgentRuntime;
    /** Optional plugin runtime used for guards and plugin routes. */
    pluginRuntime?: PluginRuntime | null;
    /** Optional bearer token required for non-public routes. */
    secret?: string;
    /** Base path for all routes, for example `"/api"`. */
    basePath?: string;
    /** Advanced server controls. */
    advanced?: {
        /** Heartbeat interval for SSE responses. */
        sseHeartbeatMs?: number;
        /** How streaming runs react when the client disconnects. */
        onRequestDisconnect?: "abort" | "continue";
    };
}

/**
 * Built-in server instance.
 */
export interface BetterAgentServer {
    /** Handles one incoming HTTP request. */
    handle(request: Request): Promise<Response>;
}

/** JSON body accepted by the run endpoint. @internal */
export type RunRequestBody = Omit<
    Pick<
        RunOptions<unknown, OutputSchemaDefinition<Record<string, unknown>>>,
        | "input"
        | "context"
        | "output"
        | "modelOptions"
        | "conversationId"
        | "conversationReplay"
        | "replaceHistory"
        | "maxSteps"
        | "advanced"
    >,
    "modalities"
> & {
    modalities?: readonly Modality[];
    advanced?: RunAdvancedOptions;
};

/** JSON body accepted by the tool-result endpoint. @internal */
export type ToolResultBody = SubmitToolResultParams;

/** JSON body accepted by the tool-approval endpoint. @internal */
export type ToolApprovalBody = SubmitToolApprovalParams;
