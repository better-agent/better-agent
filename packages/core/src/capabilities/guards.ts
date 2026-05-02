import type { AgentCapabilities } from "./types";

export function supportsInputModality(
    capabilities: AgentCapabilities,
    modality: keyof NonNullable<NonNullable<AgentCapabilities["multimodal"]>["input"]>,
): boolean {
    return capabilities.multimodal?.input?.[modality] === true;
}

export function supportsOutputModality(
    capabilities: AgentCapabilities,
    modality: keyof NonNullable<NonNullable<AgentCapabilities["multimodal"]>["output"]>,
): boolean {
    return capabilities.multimodal?.output?.[modality] === true;
}

export function supportsTextOutput(capabilities: AgentCapabilities): boolean {
    return capabilities.output?.supportedMimeTypes?.includes("text/plain") === true;
}

export function supportsStructuredOutput(capabilities: AgentCapabilities): boolean {
    return capabilities.output?.structuredOutput === true;
}

export function supportsToolCalls(capabilities: AgentCapabilities): boolean {
    return capabilities.tools?.supported === true;
}
