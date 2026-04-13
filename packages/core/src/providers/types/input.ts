import type { StripIndex } from "../../internal/types";
import type { AgentToolDefinition } from "../../tools";
import type {
    Capabilities,
    IfCap,
    InputEnabled,
    ModalitiesField,
    ModalitiesParam,
    ModalityOptionsFor,
    StructuredOutput,
} from "./capabilities";
import type {
    AudioContentBase,
    EmbeddingContentBase,
    FileContentBase,
    ImageContentBase,
    ReasoningContentBase,
    TextContentBase,
    TranscriptContentBase,
    VideoContentBase,
} from "./content";
import type {
    GenerativeModelProviderToolResult,
    GenerativeModelToolCallResult,
    ToolChoice,
} from "./tool-calls";

/**
 * Message roles supported by a model.
 */
export type GenerativeModelMessageRole<TModelCaps extends Capabilities> =
    | "system"
    | "user"
    | "assistant"
    | (TModelCaps["additionalSupportedRoles"] extends readonly (infer R)[] ? R : never)
    | (string & {}); // allow arbitrary strings as roles to provide an escape hatch when you know the role exists but the type indicates otherwise

/**
 * One input message part.
 */
export type GenerativeModelInputMessagePart<TModelCaps extends Capabilities = Capabilities> =
    | (InputEnabled<TModelCaps, "text"> extends true ? TextContentBase : never)
    | (InputEnabled<TModelCaps, "image"> extends true ? ImageContentBase : never)
    | (InputEnabled<TModelCaps, "file"> extends true ? FileContentBase : never)
    | (InputEnabled<TModelCaps, "video"> extends true ? VideoContentBase : never)
    | (InputEnabled<TModelCaps, "audio"> extends true ? AudioContentBase : never)
    | EmbeddingContentBase
    | TranscriptContentBase
    | ReasoningContentBase;

/**
 * Input message content.
 */
export type GenerativeModelInputMessageContent<TModelCaps extends Capabilities = Capabilities> =
    | (InputEnabled<TModelCaps, "text"> extends true ? string : never)
    | Array<GenerativeModelInputMessagePart<TModelCaps>>;

/**
 * Prompt-style input message with no explicit role.
 */
export type PromptInputMessage<TModelCaps extends Capabilities> = {
    type: "message";
    content: GenerativeModelInputMessageContent<TModelCaps>;
    role?: never;
};

/**
 * Chat-style input message with an explicit role.
 */
export type ChatInputMessage<TModelCaps extends Capabilities> = {
    type: "message";
    role: GenerativeModelMessageRole<TModelCaps>;
    content: GenerativeModelInputMessageContent<TModelCaps>;
};

/**
 * Input message type selected by {@link Capabilities.inputShape | inputShape}.
 */
export type GenerativeModelInputMessage<TModelCaps extends Capabilities = Capabilities> =
    TModelCaps["inputShape"] extends "prompt"
        ? PromptInputMessage<TModelCaps>
        : ChatInputMessage<TModelCaps>;

/**
 * Input item sent to a model.
 */
export type GenerativeModelInputItem<TModelCaps extends Capabilities = Capabilities> =
    | GenerativeModelInputMessage<TModelCaps>
    | GenerativeModelToolCallResult
    | GenerativeModelProviderToolResult;

/**
 * Complete input for a model call.
 */
export type GenerativeModelInput<TModelCaps extends Capabilities = Capabilities> =
    | (InputEnabled<TModelCaps, "text"> extends true ? string : never)
    | Array<GenerativeModelInputItem<TModelCaps>>;

/**
 * Provider options excluding reserved runtime fields.
 *
 * Strips keys that the framework manages internally (`tools`, `toolChoice`, `input`,
 * `modalities`, `structured_output`) as well as fields that have framework-level
 * equivalents (`instructions` → `agent.instruction`, `text` → use `textVerbosity`
 * shorthand + `outputSchema`).
 */
export type ModelOptions<TOptions> = StripIndex<
    Omit<
        TOptions,
        | "tools"
        | "toolChoice"
        | "input"
        | "modalities"
        | "structured_output"
        | "instructions"
        | "text"
    >
>;

/**
 * Options for invoking a model call.
 *
 * @typeParam TModelCaps Capability flags for the model.
 * @typeParam TOptions Provider-specific model options.
 * @typeParam TModalities Selected output modalities, if any.
 */
export type GenerativeModelCallOptions<
    TModelCaps extends Capabilities = Capabilities,
    TOptions extends Record<string, unknown> = Record<string, unknown>,
    TModalities extends ModalitiesParam<TModelCaps> = undefined,
> = {
    input: GenerativeModelInput<TModelCaps>;
} & ModalitiesField<TModalities> &
    IfCap<
        TModelCaps["tools"],
        {
            tools?: readonly AgentToolDefinition[];
            toolChoice?: ToolChoice;
        }
    > &
    IfCap<
        TModelCaps["structured_output"],
        {
            structured_output?: StructuredOutput;
        }
    > &
    ModelOptions<TOptions> &
    ModalityOptionsFor<TModelCaps, TModalities>;
