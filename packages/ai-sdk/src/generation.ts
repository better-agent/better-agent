import type {
    AgentEvent,
    EmbeddingGenerationManyResult,
    EmbeddingGenerationModel,
    EmbeddingGenerationResult,
    GeneratedFile,
    GeneratedImage,
    GenerationMessage,
    ImageGenerationModel,
    ImageGenerationResult,
    SpeechGenerationModel,
    SpeechGenerationResult,
    TextGenerationInput,
    TextGenerationModel,
    TextGenerationResult,
    TextGenerationStreamResult,
    TranscriptionGenerationInputValue,
    TranscriptionGenerationModel,
    TranscriptionGenerationResult,
    VideoGenerationInputValue,
    VideoGenerationModel,
    VideoGenerationResult,
} from "@better-agent/core";
import { EventType as BetterAgentEventType, defaultGenerateId } from "@better-agent/core";
import {
    type EmbeddingModel as AiEmbeddingModel,
    type ImageModel as AiImageModel,
    type LanguageModel as AiLanguageModel,
    type SpeechModel as AiSpeechModel,
    type TranscriptionModel as AiTranscriptionModel,
    embed as aiEmbed,
    embedMany as aiEmbedMany,
    generateImage as aiGenerateImage,
    experimental_generateSpeech as aiGenerateSpeech,
    generateText as aiGenerateText,
    experimental_generateVideo as aiGenerateVideo,
    streamText as aiStreamText,
    experimental_transcribe as aiTranscribe,
} from "ai";
import { disableAiSdkWarnings, wrapAiSdkError } from "./errors";
import { type AiSdkGeneratedFile, aiSdkFileToGeneratedFile, filesFromResult } from "./files";
import { textFromContent, toAiSdkUserContent } from "./messages";
import { toBetterAgentFinishReason, toBetterAgentUsage } from "./results";

export interface AiSdkGenerationModelOptions<TModel, TModelId extends string = string> {
    model: TModel;
    providerId: string;
    modelId: TModelId;
}

type AiVideoModel = Parameters<typeof aiGenerateVideo>[0]["model"];

function toAiSdkGenerationPrompt(messages: readonly GenerationMessage[] | undefined) {
    if (!messages) {
        return {};
    }

    const system = messages
        .filter((message) => message.role === "system" || message.role === "developer")
        .map((message) => ({
            role: "system" as const,
            content: textFromContent(message.content),
        }));
    const modelMessages = messages
        .filter((message) => message.role !== "system" && message.role !== "developer")
        .map((message) => ({
            role: message.role,
            content:
                message.role === "user"
                    ? toAiSdkUserContent(message.content)
                    : textFromContent(message.content),
        }));

    return {
        ...(system.length > 0 ? { system } : {}),
        messages: modelMessages,
    };
}

function toTextGenerateOptions<TProviderOptions>(input: TextGenerationInput<TProviderOptions>) {
    const prompt = typeof input.input === "string" ? input.input : undefined;
    const messages = Array.isArray(input.input) ? input.input : undefined;

    return {
        ...(prompt !== undefined ? { prompt } : {}),
        ...(messages ? toAiSdkGenerationPrompt(messages) : {}),
        ...(input.providerOptions ? { providerOptions: input.providerOptions as never } : {}),
        ...(input.signal ? { abortSignal: input.signal } : {}),
    };
}

export function aiSdkTextModel<TProviderOptions = unknown, TModelId extends string = string>(
    options: AiSdkGenerationModelOptions<AiLanguageModel, TModelId>,
): TextGenerationModel<TProviderOptions, TModelId> {
    disableAiSdkWarnings();

    return {
        providerId: options.providerId,
        modelId: options.modelId,
        kind: "text",
        async generate(input) {
            try {
                const result = await aiGenerateText({
                    model: options.model,
                    ...toTextGenerateOptions(input),
                } as never);

                return {
                    text: result.text,
                    files: filesFromResult(result),
                    finishReason: toBetterAgentFinishReason(result.finishReason),
                    usage: toBetterAgentUsage(result.usage),
                    providerMetadata: result.providerMetadata,
                };
            } catch (error) {
                throw wrapAiSdkError(error);
            }
        },
        async stream(input): Promise<TextGenerationStreamResult> {
            try {
                const result = aiStreamText({
                    model: options.model,
                    ...toTextGenerateOptions(input),
                    onError: () => {},
                } as never);

                return createTextGenerationStream(result.fullStream);
            } catch (error) {
                throw wrapAiSdkError(error);
            }
        },
    };
}

interface TextGenerationStreamState {
    text: string;
    files: GeneratedFile[];
    finishReason?: TextGenerationResult["finishReason"];
    usage?: TextGenerationResult["usage"];
    providerMetadata?: unknown;
}

function createTextGenerationStream(
    stream: AsyncIterable<{
        type: string;
        text?: string;
        file?: AiSdkGeneratedFile;
        finishReason?: Parameters<typeof toBetterAgentFinishReason>[0];
        totalUsage?: Parameters<typeof toBetterAgentUsage>[0];
        error?: unknown;
        data?: string | Uint8Array;
        uint8Array?: Uint8Array;
        base64?: string;
        mediaType?: string;
        providerMetadata?: unknown;
    }>,
): TextGenerationStreamResult {
    const messageId = defaultGenerateId("message", { role: "assistant" });
    const state: TextGenerationStreamState = {
        text: "",
        files: [],
    };
    let resolveFinal!: (value: TextGenerationResult) => void;
    let rejectFinal!: (error: unknown) => void;

    const final = new Promise<TextGenerationResult>((resolve, reject) => {
        resolveFinal = resolve;
        rejectFinal = reject;
    });
    void final.catch(() => undefined);

    async function* events(): AsyncIterable<AgentEvent> {
        try {
            for await (const part of stream) {
                switch (part.type) {
                    case "text-start":
                        yield {
                            type: BetterAgentEventType.TEXT_MESSAGE_START,
                            timestamp: Date.now(),
                            messageId,
                            role: "assistant",
                        };
                        break;
                    case "text-delta":
                        state.text += part.text ?? "";
                        yield {
                            type: BetterAgentEventType.TEXT_MESSAGE_CONTENT,
                            timestamp: Date.now(),
                            messageId,
                            delta: part.text ?? "",
                        };
                        break;
                    case "text-end":
                        yield {
                            type: BetterAgentEventType.TEXT_MESSAGE_END,
                            timestamp: Date.now(),
                            messageId,
                        };
                        break;
                    case "file": {
                        const file = aiSdkFileToGeneratedFile(
                            (part.file ?? part) as AiSdkGeneratedFile,
                        );
                        state.files.push(file);
                        yield {
                            type: BetterAgentEventType.CUSTOM,
                            timestamp: Date.now(),
                            name: "file",
                            value: {
                                messageId,
                                file,
                            },
                        };
                        break;
                    }
                    case "finish":
                        state.finishReason = toBetterAgentFinishReason(part.finishReason);
                        state.usage = toBetterAgentUsage(part.totalUsage);
                        state.providerMetadata = part.providerMetadata;
                        break;
                    case "error":
                        throw wrapAiSdkError(part.error);
                    default:
                        break;
                }
            }

            resolveFinal({
                text: state.text,
                files: state.files,
                finishReason: state.finishReason,
                usage: state.usage,
                providerMetadata: state.providerMetadata,
            });
        } catch (error) {
            const wrappedError = wrapAiSdkError(error);
            rejectFinal(wrappedError);
            throw wrappedError;
        }
    }

    return {
        events: events(),
        final,
    };
}

export function aiSdkEmbeddingModel<TProviderOptions = unknown, TModelId extends string = string>(
    options: AiSdkGenerationModelOptions<AiEmbeddingModel, TModelId>,
): EmbeddingGenerationModel<TProviderOptions, TModelId> {
    disableAiSdkWarnings();

    return {
        providerId: options.providerId,
        modelId: options.modelId,
        kind: "embedding",
        async embed(input) {
            try {
                const result = await aiEmbed({
                    model: options.model,
                    value: input.input,
                    providerOptions: input.providerOptions as never,
                    abortSignal: input.signal,
                });

                return toEmbedResult(result);
            } catch (error) {
                throw wrapAiSdkError(error);
            }
        },
        async embedMany(input) {
            try {
                const result = await aiEmbedMany({
                    model: options.model,
                    values: input.input,
                    providerOptions: input.providerOptions as never,
                    abortSignal: input.signal,
                });

                return {
                    embeddings: result.embeddings,
                    usage: result.usage ? { tokens: result.usage.tokens } : undefined,
                    providerMetadata: result.providerMetadata,
                } satisfies EmbeddingGenerationManyResult;
            } catch (error) {
                throw wrapAiSdkError(error);
            }
        },
    };
}

function toEmbedResult(result: {
    embedding: number[];
    usage?: { tokens?: number };
    providerMetadata?: unknown;
}): EmbeddingGenerationResult {
    return {
        embedding: result.embedding,
        usage: result.usage ? { tokens: result.usage.tokens } : undefined,
        providerMetadata: result.providerMetadata,
    };
}

export function aiSdkImageModel<TProviderOptions = unknown, TModelId extends string = string>(
    options: AiSdkGenerationModelOptions<AiImageModel, TModelId>,
): ImageGenerationModel<TProviderOptions, TModelId> {
    disableAiSdkWarnings();

    return {
        providerId: options.providerId,
        modelId: options.modelId,
        kind: "image",
        async generate(input) {
            try {
                const result = await aiGenerateImage({
                    model: options.model,
                    prompt: input.input,
                    n: input.n,
                    size: input.size as never,
                    aspectRatio: input.aspectRatio as never,
                    providerOptions: input.providerOptions as never,
                    abortSignal: input.signal,
                });

                return toImageGenerateResult(result);
            } catch (error) {
                throw wrapAiSdkError(error);
            }
        },
    };
}

function toGeneratedImage(image: {
    uint8Array?: Uint8Array;
    base64?: string;
    data?: string | Uint8Array;
    url?: string;
    mediaType?: string;
    providerMetadata?: unknown;
}): GeneratedImage {
    return aiSdkFileToGeneratedFile(image);
}

function toImageGenerateResult(result: {
    image?: Parameters<typeof toGeneratedImage>[0];
    images?: Parameters<typeof toGeneratedImage>[0][];
    providerMetadata?: unknown;
}): ImageGenerationResult {
    const images = result.images?.map(toGeneratedImage) ?? [];
    const image = result.image ? toGeneratedImage(result.image) : images[0];

    return {
        images: images.length > 0 ? images : image ? [image] : [],
        providerMetadata: result.providerMetadata,
    };
}

function videoImageInputValue(input: Exclude<VideoGenerationInputValue, string>["image"]) {
    if (typeof input === "object" && input !== null && "sourceType" in input) {
        return input.sourceType === "data" ? input.data : input.url;
    }

    return input;
}

function toAiSdkVideoPrompt(input: VideoGenerationInputValue) {
    if (typeof input === "string") {
        return input;
    }

    return {
        image: videoImageInputValue(input.image),
        ...(input.text ? { text: input.text } : {}),
    };
}

function toGeneratedVideo(video: AiSdkGeneratedFile) {
    return aiSdkFileToGeneratedFile(video);
}

function toVideoGenerateResult(result: {
    video?: AiSdkGeneratedFile;
    videos?: AiSdkGeneratedFile[];
    providerMetadata?: unknown;
}): VideoGenerationResult {
    const videos = result.videos?.map(toGeneratedVideo) ?? [];
    const video = result.video ? toGeneratedVideo(result.video) : videos[0];

    return {
        videos: videos.length > 0 ? videos : video ? [video] : [],
        providerMetadata: result.providerMetadata,
    };
}

export function aiSdkVideoModel<TProviderOptions = unknown, TModelId extends string = string>(
    options: AiSdkGenerationModelOptions<AiVideoModel, TModelId>,
): VideoGenerationModel<TProviderOptions, TModelId> {
    disableAiSdkWarnings();

    return {
        providerId: options.providerId,
        modelId: options.modelId,
        kind: "video",
        async generate(input) {
            try {
                const result = await aiGenerateVideo({
                    model: options.model,
                    prompt: toAiSdkVideoPrompt(input.input),
                    n: input.n,
                    aspectRatio: input.aspectRatio as never,
                    resolution: input.resolution as never,
                    duration: input.duration,
                    providerOptions: input.providerOptions as never,
                    abortSignal: input.signal,
                });

                return toVideoGenerateResult(result);
            } catch (error) {
                throw wrapAiSdkError(error);
            }
        },
    };
}

export function aiSdkSpeechModel<TProviderOptions = unknown, TModelId extends string = string>(
    options: AiSdkGenerationModelOptions<AiSpeechModel, TModelId>,
): SpeechGenerationModel<TProviderOptions, TModelId> {
    disableAiSdkWarnings();

    return {
        providerId: options.providerId,
        modelId: options.modelId,
        kind: "speech",
        async generate(input) {
            try {
                const result = await aiGenerateSpeech({
                    model: options.model,
                    text: input.input,
                    voice: input.voice,
                    providerOptions: input.providerOptions as never,
                    abortSignal: input.signal,
                });

                return {
                    audio: aiSdkFileToGeneratedFile(result.audio),
                    providerMetadata: result.providerMetadata,
                } satisfies SpeechGenerationResult;
            } catch (error) {
                throw wrapAiSdkError(error);
            }
        },
    };
}

function transcriptionInputValue(input: TranscriptionGenerationInputValue) {
    if (typeof input === "object" && input !== null && "sourceType" in input) {
        return input.sourceType === "data" ? input.data : input.url;
    }

    return input;
}

export function aiSdkTranscriptionModel<
    TProviderOptions = unknown,
    TModelId extends string = string,
>(
    options: AiSdkGenerationModelOptions<AiTranscriptionModel, TModelId>,
): TranscriptionGenerationModel<TProviderOptions, TModelId> {
    disableAiSdkWarnings();

    return {
        providerId: options.providerId,
        modelId: options.modelId,
        kind: "transcription",
        async transcribe(input) {
            try {
                const result = await aiTranscribe({
                    model: options.model,
                    audio: transcriptionInputValue(input.input) as never,
                    providerOptions: input.providerOptions as never,
                    abortSignal: input.signal,
                });

                return {
                    text: result.text,
                    segments: "segments" in result ? result.segments : undefined,
                    providerMetadata: result.providerMetadata,
                } satisfies TranscriptionGenerationResult;
            } catch (error) {
                throw wrapAiSdkError(error);
            }
        },
    };
}
