import { BetterAgentError } from "@better-agent/shared/errors";
import type { AgentInputMessage, AgentMessage } from "../ag-ui/messages";
import type { AnyDefinedAgent } from "../agent/types";
import type { AgentMemory, MemoryMessage, MemoryThread } from "../memory";
import { createRunErrorEvent } from "../runtime/events";
import type { RuntimeInterrupt } from "../runtime/interrupts";
import { type BetterAgentIdGenerator, defaultGenerateId } from "../runtime/utils";
import { validateInput } from "../schema";
import { type BetterAgentStorage, type RunRecord, storageTables } from "../storage";
import { isUnsupportedStorageTableError } from "../storage";
import { dedupeToolsByName, resolveTools } from "../tools/resolve-tools";
import type { ToolSource } from "../tools/types";
import type { AppContext } from "./create-app-context";
import type { AppRunInput } from "./types";

export function validateAgentContext<TContext>(
    agent: AnyDefinedAgent,
    context: TContext | undefined,
): TContext | undefined {
    if (!agent.contextSchema) {
        return context;
    }

    return validateInput(agent.contextSchema, context, {
        invalidMessage: `Context for agent '${agent.name}' failed schema validation.`,
    }) as TContext;
}

export async function resolveAgentInstruction(
    agent: AnyDefinedAgent,
    context: unknown,
): Promise<string | undefined> {
    if (!agent.instruction) {
        return undefined;
    }

    if (typeof agent.instruction === "function") {
        return await agent.instruction(context);
    }

    return agent.instruction;
}

export function prepareAgentMessages(input: {
    messages: AgentInputMessage[];
    generateId?: BetterAgentIdGenerator;
    agentName?: string;
    runId?: string;
    threadId?: string;
}): AgentMessage[] {
    const generateId = input.generateId ?? defaultGenerateId;
    return input.messages.map((message) => ({
        ...message,
        id: generateId("message", {
            agentName: input.agentName,
            runId: input.runId,
            threadId: input.threadId,
            role: message.role,
        }),
    }));
}

export function createCombinedToolSource<TContext>(input: {
    context: AppContext;
    agentTools?: ToolSource<TContext>;
}): ToolSource<TContext> | undefined {
    if (!input.context.pluginRuntime.hasTools) {
        return input.agentTools;
    }

    return async (runContext: TContext) => {
        const pluginTools = await input.context.pluginRuntime.resolveTools(runContext);
        const agentTools = await resolveTools(input.agentTools, runContext);

        return dedupeToolsByName([...pluginTools, ...agentTools]);
    };
}

export function toCommittedMessages(messages: MemoryMessage[]): AgentMessage[] {
    return messages.map((message) => {
        const { threadId: _threadId, runId: _runId, createdAt: _createdAt, ...rest } = message;
        return rest;
    });
}

export async function loadThreadHistory(
    memory: AgentMemory | undefined,
    threadId: string | undefined,
): Promise<AgentMessage[]> {
    if (!memory || !threadId) {
        return [];
    }

    const messages = await memory.messages.list({
        threadId,
        ...(memory.lastMessages !== undefined ? { limit: memory.lastMessages } : {}),
    });
    return toCommittedMessages(messages);
}

export async function persistFailedRun(input: {
    storage?: BetterAgentStorage;
    runBase: Omit<RunRecord, "status" | "updatedAt" | "finalEvent" | "finishedAt">;
    error: unknown;
}): Promise<void> {
    if (!input.storage) {
        return;
    }

    const finishedAt = Date.now();
    const errorMessage = input.error instanceof Error ? input.error.message : String(input.error);
    const errorCode =
        typeof input.error === "object" &&
        input.error !== null &&
        "code" in input.error &&
        typeof input.error.code === "string"
            ? input.error.code
            : undefined;

    const storage = input.storage;

    await tolerateUnsupportedStorageTable(() =>
        storage.set(storageTables.runs, input.runBase.runId, {
            ...input.runBase,
            status: errorCode === "ABORTED" ? "aborted" : "failed",
            finalEvent: createRunErrorEvent({
                message: errorMessage,
                ...(errorCode ? { code: errorCode } : {}),
            }),
            updatedAt: finishedAt,
            finishedAt,
        }),
    );
}

export async function tolerateUnsupportedStorageTable<T>(
    run: () => T | Promise<T>,
    fallback?: T,
): Promise<T | undefined> {
    try {
        return await run();
    } catch (error) {
        if (isUnsupportedStorageTableError(error)) {
            return fallback;
        }

        throw error;
    }
}

export async function resolveUnsupportedStorageTable<T>(run: () => T | Promise<T>): Promise<
    | {
          supported: true;
          value: T;
      }
    | {
          supported: false;
      }
> {
    try {
        return {
            supported: true,
            value: await run(),
        };
    } catch (error) {
        if (isUnsupportedStorageTableError(error)) {
            return {
                supported: false,
            };
        }

        throw error;
    }
}

export function createRunAbortCheck(input: {
    runId: string;
    signal?: AbortSignal;
    storage?: BetterAgentStorage;
}): (message: string) => Promise<void> {
    return async (message: string) => {
        if (input.signal?.aborted) {
            throw BetterAgentError.fromCode("ABORTED", message);
        }

        const storage = input.storage;
        if (!storage) {
            return;
        }

        const record = await tolerateUnsupportedStorageTable(
            () => storage.get<RunRecord>(storageTables.runs, input.runId),
            undefined,
        );

        if (record?.abortRequestedAt !== undefined) {
            throw BetterAgentError.fromCode("ABORTED", message);
        }
    };
}

export function getInterruptedRunInterrupts(record: RunRecord): RuntimeInterrupt[] {
    if (record.status !== "interrupted") {
        return [];
    }

    const finalEvent = record.finalEvent;
    if (!finalEvent || finalEvent.type !== "RUN_FINISHED" || finalEvent.outcome !== "interrupt") {
        return [];
    }

    if (!Array.isArray(finalEvent.interrupts)) {
        return [];
    }

    return finalEvent.interrupts as RuntimeInterrupt[];
}

export function validateResumeEntries(input: {
    resume: Array<{
        interruptId: string;
        status: "resolved" | "cancelled";
        payload?: unknown;
    }>;
    interrupts: RuntimeInterrupt[];
}): void {
    if (input.resume.length === 0) {
        throw BetterAgentError.fromCode("VALIDATION_FAILED", "Resume input must not be empty.");
    }

    const openInterruptIds = new Set(input.interrupts.map((interrupt) => interrupt.id));
    const resumeIds = new Set<string>();
    const interruptsById = new Map(input.interrupts.map((interrupt) => [interrupt.id, interrupt]));

    for (const entry of input.resume) {
        if (!openInterruptIds.has(entry.interruptId)) {
            throw BetterAgentError.fromCode(
                "VALIDATION_FAILED",
                `Resume entry '${entry.interruptId}' does not match an open interrupt.`,
            );
        }

        if (resumeIds.has(entry.interruptId)) {
            throw BetterAgentError.fromCode(
                "VALIDATION_FAILED",
                `Resume entry '${entry.interruptId}' is duplicated.`,
            );
        }

        if (entry.status === "cancelled" && entry.payload !== undefined) {
            throw BetterAgentError.fromCode(
                "VALIDATION_FAILED",
                `Cancelled resume entry '${entry.interruptId}' must not include payload.`,
            );
        }

        const interrupt = interruptsById.get(entry.interruptId);

        if (entry.status === "resolved") {
            if (interrupt?.responseSchema) {
                validateInput(interrupt.responseSchema, entry.payload, {
                    invalidMessage: `Resume payload for interrupt '${entry.interruptId}' failed schema validation.`,
                });
            }
        }

        if (interrupt?.expiresAt && Date.now() > Date.parse(interrupt.expiresAt)) {
            throw BetterAgentError.fromCode(
                "VALIDATION_FAILED",
                `Interrupt '${entry.interruptId}' has expired and can no longer be resumed.`,
            );
        }

        resumeIds.add(entry.interruptId);
    }

    if (resumeIds.size !== openInterruptIds.size) {
        throw BetterAgentError.fromCode(
            "VALIDATION_FAILED",
            "Resume input must address all open interrupts from the interrupted run.",
        );
    }
}

export async function resolveThreadResumeState(
    context: AppContext,
    input: Pick<AppRunInput, "threadId" | "resume" | "messages">,
    memory: AgentMemory | undefined,
): Promise<{
    existingThread: MemoryThread | undefined;
    latestRun: RunRecord | undefined;
    openInterrupts: RuntimeInterrupt[];
}> {
    const existingThread =
        memory && input.threadId ? await memory.threads.get(input.threadId) : undefined;
    const storage = context.config.storage;
    const threadId = input.threadId;
    const latestRunResult =
        storage && threadId
            ? await resolveUnsupportedStorageTable(() =>
                  storage.list<RunRecord>(storageTables.runs, {
                      where: { threadId },
                      orderBy: { startedAt: "desc" },
                      take: 1,
                  }),
              )
            : undefined;
    const latestRun = latestRunResult?.supported ? latestRunResult.value.items[0] : undefined;
    const openInterrupts = latestRun ? getInterruptedRunInterrupts(latestRun) : [];

    if (input.resume) {
        if ((input.messages?.length ?? 0) > 0) {
            throw BetterAgentError.fromCode(
                "VALIDATION_FAILED",
                "Resume input must not include messages.",
            );
        }

        if (!input.threadId) {
            throw BetterAgentError.fromCode("VALIDATION_FAILED", "Resume input requires threadId.");
        }

        if (!storage || latestRunResult?.supported === false) {
            throw BetterAgentError.fromCode(
                "VALIDATION_FAILED",
                "Resume input requires runs storage to be configured.",
            );
        }

        if (!latestRun) {
            throw BetterAgentError.fromCode(
                "VALIDATION_FAILED",
                `No latest run found for thread '${input.threadId}'.`,
            );
        }

        if (latestRun.status !== "interrupted" || openInterrupts.length === 0) {
            throw BetterAgentError.fromCode("VALIDATION_FAILED", "Latest run is not interrupted.");
        }

        validateResumeEntries({
            resume: input.resume,
            interrupts: openInterrupts,
        });
    } else if (openInterrupts.length > 0) {
        throw BetterAgentError.fromCode(
            "VALIDATION_FAILED",
            "This thread has pending interrupts. Provide resume input to continue.",
        );
    }

    return {
        existingThread,
        latestRun,
        openInterrupts,
    };
}

export function getStoredRunConfig<TContext = unknown, TProviderOptions = unknown>(
    record: RunRecord | undefined,
): {
    context?: TContext;
    providerOptions?: TProviderOptions;
    maxSteps?: number;
    resume?: AppRunInput["resume"];
} {
    if (!record || typeof record.config !== "object" || record.config === null) {
        return {};
    }

    return record.config as {
        context?: TContext;
        toolChoice?: AppRunInput["toolChoice"];
        providerOptions?: TProviderOptions;
        maxSteps?: number;
        resume?: AppRunInput["resume"];
    };
}

export function resolveEffectiveRunConfig<TContext = unknown, TProviderOptions = unknown>(input: {
    resume?: AppRunInput["resume"];
    context: TContext | undefined;
    toolChoice: AppRunInput["toolChoice"] | undefined;
    providerOptions: TProviderOptions | undefined;
    maxSteps: number | undefined;
    stored: {
        context?: TContext;
        toolChoice?: AppRunInput["toolChoice"];
        providerOptions?: TProviderOptions;
        maxSteps?: number;
        resume?: AppRunInput["resume"];
    };
    defaultMaxSteps: number | undefined;
    defaultToolChoice: AppRunInput["toolChoice"] | undefined;
}): {
    context?: TContext;
    toolChoice?: AppRunInput["toolChoice"];
    providerOptions?: TProviderOptions;
    maxSteps?: number;
    resume?: AppRunInput["resume"];
} {
    if (!input.resume) {
        return {
            context: input.context,
            toolChoice: input.toolChoice ?? input.defaultToolChoice,
            providerOptions: input.providerOptions,
            maxSteps: input.maxSteps ?? input.defaultMaxSteps,
        };
    }

    return {
        context: input.context ?? input.stored.context,
        toolChoice: input.toolChoice ?? input.stored.toolChoice ?? input.defaultToolChoice,
        providerOptions: input.providerOptions ?? input.stored.providerOptions,
        maxSteps: input.maxSteps ?? input.stored.maxSteps ?? input.defaultMaxSteps,
        resume: input.resume,
    };
}

export const resolvedAgentRunId = async (
    agentName: string,
    storage?: BetterAgentStorage,
    runId?: string,
    scope?: string,
    action = "request",
): Promise<string> => {
    if (runId) {
        return runId;
    }

    if (!storage) {
        throw BetterAgentError.fromCode(
            "VALIDATION_FAILED",
            `Please provide runid or run storage to ${action}.`,
        );
    }

    const result = await resolveUnsupportedStorageTable(() =>
        storage.list<RunRecord>(storageTables.runs, {
            where: { agentName, status: "running", ...(scope ? { scope } : {}) },
            orderBy: { startedAt: "desc" },
            take: 1,
        }),
    );

    const resolvedRunId = result.supported ? result.value.items[0]?.runId : undefined;
    if (!resolvedRunId) {
        throw BetterAgentError.fromCode(
            "VALIDATION_FAILED",
            `Please provide runid or run storage to ${action}.`,
        );
    }

    return resolvedRunId;
};
