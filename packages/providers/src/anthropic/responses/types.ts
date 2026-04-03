import type { Capabilities, GenerativeModel } from "@better-agent/core/providers";

import type { AnthropicMessagesRequestSchema, AnthropicResponseModels } from "./schemas";

export interface AnthropicResponseCaps extends Capabilities {
    inputModalities: { text: true; image: true; file: true };
    inputShape: "chat";
    replayMode: "multi_turn";
    supportsInstruction: true;
    outputModalities: {
        text: {
            options: {
                max_tokens?: AnthropicMessagesRequestSchema["max_tokens"];
                temperature?: AnthropicMessagesRequestSchema["temperature"];
                top_k?: AnthropicMessagesRequestSchema["top_k"];
                top_p?: AnthropicMessagesRequestSchema["top_p"];
            };
        };
    };
    tools: true;
    structured_output: true;
    additionalSupportedRoles: readonly ["developer"];
}

export type AnthropicResponseEndpointOptions = {
    max_tokens?: AnthropicMessagesRequestSchema["max_tokens"];
    metadata?: {
        userId?: string;
    };
    stop_sequences?: AnthropicMessagesRequestSchema["stop_sequences"];
    temperature?: AnthropicMessagesRequestSchema["temperature"];
    thinking?:
        | {
              type: "adaptive";
          }
        | {
              type: "enabled";
              budgetTokens?: number;
          }
        | {
              type: "disabled";
          };
    top_k?: AnthropicMessagesRequestSchema["top_k"];
    top_p?: AnthropicMessagesRequestSchema["top_p"];
    structuredOutputMode?: "outputFormat" | "jsonTool" | "auto";
    disableParallelToolUse?: boolean;
    cacheControl?: {
        type: "ephemeral";
        ttl?: "5m" | "1h";
    };
    mcpServers?: Array<{
        type: "url";
        name: string;
        url: string;
        authorizationToken?: string | null;
        toolConfiguration?: {
            enabled?: boolean | null;
            allowedTools?: string[] | null;
        } | null;
    }>;
    container?: {
        id?: string;
        skills?: Array<{
            type: "anthropic" | "custom";
            skillId: string;
            version?: string;
        }>;
    };
    toolStreaming?: boolean;
    effort?: "low" | "medium" | "high" | "max";
    speed?: "fast" | "standard";
    anthropicBeta?: string[];
    contextManagement?: {
        edits: unknown[];
    };
};

type SuggestedModelId<TKnown extends string> = TKnown | (string & {});
export type AnthropicResponseModelId = SuggestedModelId<AnthropicResponseModels>;

export type AnthropicResponseGenerativeModel<
    M extends AnthropicResponseModelId = AnthropicResponseModelId,
> = GenerativeModel<AnthropicResponseEndpointOptions, "anthropic", M, AnthropicResponseCaps>;
