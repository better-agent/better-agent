import type { AgentCapabilities, AgentModel } from "@better-agent/core";
import { type LanguageModel, Output, generateText, streamText } from "ai";
import { disableAiSdkWarnings, wrapAiSdkError } from "./errors";
import { toAiSdkPrompt } from "./messages";
import { toBetterAgentGenerateResult } from "./results";
import { toBetterAgentStreamResult } from "./stream";
import { mergeAiSdkTools } from "./tools";

export interface AiSdkModelOptions<
    TCapabilities extends AgentCapabilities = AgentCapabilities,
    TModelId extends string = string,
> {
    model: LanguageModel;
    providerId: string;
    modelId: TModelId;
    capabilities: TCapabilities;
}

export const aiSdkModel = <
    TCapabilities extends AgentCapabilities = AgentCapabilities,
    TProviderOptions = unknown,
    TModelId extends string = string,
>(
    options: AiSdkModelOptions<TCapabilities, TModelId>,
): AgentModel<TCapabilities, undefined, TProviderOptions, TModelId> => {
    disableAiSdkWarnings();

    return {
        providerId: options.providerId,
        modelId: options.modelId,
        capabilities: options.capabilities,
        async generate(generateOptions, context) {
            try {
                const result = await generateText({
                    model: options.model,
                    ...toAiSdkPrompt(generateOptions.messages),
                    tools: mergeAiSdkTools(generateOptions.tools, generateOptions.providerTools),
                    toolChoice: generateOptions.toolChoice as never,
                    ...(generateOptions.output
                        ? {
                              output: Output.object({
                                  schema: generateOptions.output.schema as never,
                                  name: generateOptions.output.name,
                                  description: generateOptions.output.description,
                              }),
                          }
                        : {}),
                    abortSignal: context.signal,
                    providerOptions: generateOptions.providerOptions as never,
                });

                return toBetterAgentGenerateResult(
                    result,
                    context.generateId("message", { role: "assistant" }),
                    context,
                );
            } catch (error) {
                throw wrapAiSdkError(error);
            }
        },
        async stream(generateOptions, context) {
            try {
                const result = streamText({
                    model: options.model,
                    ...toAiSdkPrompt(generateOptions.messages),
                    tools: mergeAiSdkTools(generateOptions.tools, generateOptions.providerTools),
                    toolChoice: generateOptions.toolChoice as never,
                    ...(generateOptions.output
                        ? {
                              output: Output.object({
                                  schema: generateOptions.output.schema as never,
                                  name: generateOptions.output.name,
                                  description: generateOptions.output.description,
                              }),
                          }
                        : {}),
                    abortSignal: context.signal,
                    providerOptions: generateOptions.providerOptions as never,
                });

                return toBetterAgentStreamResult(
                    result,
                    context.generateId("message", { role: "assistant" }),
                    context,
                    generateOptions.output !== undefined,
                );
            } catch (error) {
                throw wrapAiSdkError(error);
            }
        },
    };
};
