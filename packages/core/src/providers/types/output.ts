import type { Capabilities, OutputEnabled } from "./capabilities";
import type {
    AudioContentBase,
    EmbeddingContentBase,
    ImageContentBase,
    ReasoningContentBase,
    TextContentBase,
    TranscriptContentBase,
    VideoContentBase,
} from "./content";
import type { GenerativeModelMessageRole } from "./input";
import type {
    GenerativeModelProviderToolResult,
    GenerativeModelToolCallRequest,
} from "./tool-calls";

/**
 * One output message part.
 */
export type GenerativeModelOutputMessagePart<TModelCaps extends Capabilities = Capabilities> =
    | (OutputEnabled<TModelCaps, "text"> extends true ? TextContentBase : never)
    | (OutputEnabled<TModelCaps, "image"> extends true ? ImageContentBase : never)
    | (OutputEnabled<TModelCaps, "video"> extends true ? VideoContentBase : never)
    | (OutputEnabled<TModelCaps, "audio"> extends true ? AudioContentBase : never)
    | (OutputEnabled<TModelCaps, "embedding"> extends true ? EmbeddingContentBase : never)
    | TranscriptContentBase
    | ReasoningContentBase;

/**
 * Output message content.
 */
export type GenerativeModelOutputMessageContent<TModelCaps extends Capabilities = Capabilities> =
    | (OutputEnabled<TModelCaps, "text"> extends true ? string : never)
    | Array<GenerativeModelOutputMessagePart<TModelCaps>>;

/**
 * Output message emitted by the model.
 */
export type GenerativeModelOutputMessage<TModelCaps extends Capabilities = Capabilities> = {
    type: "message";
    role: GenerativeModelMessageRole<TModelCaps>;
    content: GenerativeModelOutputMessageContent<TModelCaps>;
    providerMetadata?: Record<string, unknown>;
};

/**
 * Output item returned by a model.
 */
export type GenerativeModelOutputItem<TModelCaps extends Capabilities = Capabilities> =
    | GenerativeModelOutputMessage<TModelCaps>
    | GenerativeModelToolCallRequest
    | GenerativeModelProviderToolResult;
