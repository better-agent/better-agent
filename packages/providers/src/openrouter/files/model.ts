import type { createOpenRouterClient } from "../client/create-client";
import { createOpenRouterResponsesModel } from "../responses/model";
import type { OpenRouterResponseModelId } from "../types";
import type { OpenRouterFileCaps, OpenRouterFileGenerativeModel } from "./types";

export const OPENROUTER_FILE_CAPS = {
    inputModalities: { text: true, file: true },
    inputShape: "chat",
    replayMode: "multi_turn",
    supportsInstruction: true,
    outputModalities: {
        text: {
            options: {},
        },
    },
    tools: true,
    structured_output: true,
    additionalSupportedRoles: ["developer"],
} as const satisfies OpenRouterFileCaps;

export const createOpenRouterFileModel = <M extends OpenRouterResponseModelId>(
    modelId: M,
    client: ReturnType<typeof createOpenRouterClient>,
): OpenRouterFileGenerativeModel<M> => {
    const base = createOpenRouterResponsesModel(modelId, client);
    return {
        ...base,
        caps: OPENROUTER_FILE_CAPS,
    } as OpenRouterFileGenerativeModel<M>;
};
