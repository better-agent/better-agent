import type { BivariantFn } from "@better-agent/shared/types";
import type { AgentEvent } from "../ag-ui/events";
import type { AgentMessage } from "../ag-ui/messages";
import type { AgentToolDefinition } from "../ag-ui/tools";
import type { AgentCapabilities } from "../capabilities/types";
import type { FinishReason, TokenUsage } from "../runtime/results";
import type { AgentRunContext } from "../runtime/types";
import type { AgentOutput } from "../schema";

export type AgentModelToolDefinition = AgentToolDefinition & {
    strict?: boolean;
};

export type AgentProviderOptionsFor<TModel> = TModel extends AgentModel<
    AgentCapabilities,
    AgentOutput | undefined,
    infer TProviderOptions,
    string
>
    ? TProviderOptions
    : never;

export type AgentToolChoice =
    | "auto"
    | "none"
    | "required"
    | {
          type: "tool";
          toolName: string;
      };

export interface AgentModelGenerateOptions<
    _TOutput extends AgentOutput | undefined = undefined,
    TProviderOptions = unknown,
> {
    messages: AgentMessage[];
    tools?: AgentModelToolDefinition[];
    toolChoice?: AgentToolChoice;
    providerTools?: Record<string, unknown>;
    output?: AgentOutput;
    providerOptions?: TProviderOptions;
}

export interface AgentModelGenerateResult {
    messages?: AgentMessage[];
    structured?: unknown;
    finishReason?: FinishReason;
    usage?: TokenUsage;
}

export interface AgentModelStreamResult {
    events: AsyncIterable<AgentEvent>;
    final: Promise<AgentModelGenerateResult>;
}

export interface AgentModel<
    TCapabilities extends AgentCapabilities = AgentCapabilities,
    TOutput extends AgentOutput | undefined = undefined,
    TProviderOptions = unknown,
    TModelId extends string = string,
> {
    providerId: string;
    modelId: TModelId;
    capabilities: TCapabilities;
    generate: BivariantFn<
        [AgentModelGenerateOptions<TOutput, TProviderOptions>, AgentRunContext],
        Promise<AgentModelGenerateResult>
    >;
    stream: BivariantFn<
        [AgentModelGenerateOptions<TOutput, TProviderOptions>, AgentRunContext],
        Promise<AgentModelStreamResult>
    >;
}

export interface AgentModelLike<TModelId extends string = string> {
    providerId: string;
    modelId: TModelId;
    capabilities: AgentCapabilities;
    generate: BivariantFn<
        [AgentModelGenerateOptions<AgentOutput | undefined, unknown>, AgentRunContext],
        Promise<AgentModelGenerateResult>
    >;
    stream: BivariantFn<
        [AgentModelGenerateOptions<AgentOutput | undefined, unknown>, AgentRunContext],
        Promise<AgentModelStreamResult>
    >;
}
