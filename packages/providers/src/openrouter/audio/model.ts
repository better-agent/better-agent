import type { createOpenRouterClient } from "../client/create-client";
import { createOpenRouterResponsesModel } from "../responses/model";
import type { OpenRouterResponseModelId } from "../types";
import type { OpenRouterAudioCaps, OpenRouterAudioGenerativeModel } from "./types";

export const OPENROUTER_AUDIO_CAPS = {
    inputModalities: { text: true, audio: true },
    inputShape: "chat",
    replayMode: "multi_turn",
    supportsInstruction: true,
    outputModalities: {
        text: {
            options: {},
        },
        audio: true,
    },
    tools: true,
    structured_output: true,
    additionalSupportedRoles: ["developer"],
} as const satisfies OpenRouterAudioCaps;

export const createOpenRouterAudioModel = <M extends OpenRouterResponseModelId>(
    modelId: M,
    client: ReturnType<typeof createOpenRouterClient>,
): OpenRouterAudioGenerativeModel<M> => {
    const base = createOpenRouterResponsesModel(modelId, client);
    return {
        ...base,
        caps: OPENROUTER_AUDIO_CAPS,
    } as OpenRouterAudioGenerativeModel<M>;
};
