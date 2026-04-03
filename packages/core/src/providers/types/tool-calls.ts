/**
 * Tool selection strategy for a model call.
 */
export type ToolChoice<TName extends string = string> =
    | {
          type: "auto";
      }
    | {
          type: "none";
      }
    | {
          type: "required";
      }
    | {
          type: "tool";
          name: TName;
      };

/**
 * Tool call request emitted by a model.
 */
export interface GenerativeModelToolCallRequest {
    type: "tool-call";
    name: string;
    arguments: string;
    callId: string;
    result?: never;
}

/**
 * Tool call result returned to the model.
 */
export interface GenerativeModelToolCallResult {
    type: "tool-call";
    name: string;
    callId: string;
    result: unknown;
    isError?: boolean;
    arguments?: string;
}

/**
 * Provider-originated tool result surfaced in model output.
 *
 * This is used for provider-native tool artifacts that appear in provider
 * responses, but are not model-emitted tool-call requests.
 */
export interface GenerativeModelProviderToolResult {
    type: "provider-tool-result";
    name: string;
    callId: string;
    result: unknown;
    isError?: boolean;
}
