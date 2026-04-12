"use client";

import { client } from "@/better-agent/client";
import { useAgent } from "@better-agent/client/react";
import { useState } from "react";

const AGENTS = [
    {
        id: "openrouter-text",
        label: "OpenRouter Text",
        provider: "OpenRouter",
        path: "/agents/openrouter-text",
        capability: "text",
        delivery: "stream",
        description: "General chat via OpenRouter.",
    },
    {
        id: "openrouter-search",
        label: "OpenRouter Search",
        provider: "OpenRouter",
        path: "/agents/openrouter-search",
        capability: "search",
        delivery: "stream",
        description: "OpenRouter hosted web search.",
    },
    {
        id: "openrouter-file",
        label: "OpenRouter File",
        provider: "OpenRouter",
        path: "/agents/openrouter-file",
        capability: "file",
        delivery: "stream",
        description: "Read uploaded files inside a text chat turn.",
    },
    {
        id: "openrouter-audio",
        label: "OpenRouter Audio",
        provider: "OpenRouter",
        path: "/agents/openrouter-audio",
        capability: "audio",
        delivery: "stream",
        description: "Upload audio for transcription and spoken output.",
    },
    {
        id: "openrouter-image",
        label: "OpenRouter Image",
        provider: "OpenRouter",
        path: "/agents/openrouter-image",
        capability: "image",
        delivery: "stream",
        description: "Text-to-image and image-to-image generation.",
    },
] as const;

type AgentId = (typeof AGENTS)[number]["id"];
type Capability = (typeof AGENTS)[number]["capability"];
type Delivery = (typeof AGENTS)[number]["delivery"];
type Message = ReturnType<typeof useAgent<typeof client>>["messages"][number];
type MessagePart = Message["parts"][number];
type TextPart = Extract<MessagePart, { type: "text" }>;
type ImagePart = Extract<MessagePart, { type: "image" }>;
type FilePart = Extract<MessagePart, { type: "file" }>;
type AudioPart = Extract<MessagePart, { type: "audio" }>;
type TranscriptPart = Extract<MessagePart, { type: "transcript" }>;
type ToolCallPart = Extract<MessagePart, { type: "tool-call" }>;
type ToolResultPart = Extract<MessagePart, { type: "tool-result" }>;

const sourceToUrl = (
    source: ImagePart["source"] | FilePart["source"] | AudioPart["source"],
) => {
    if (source.kind === "base64") {
        return `data:${source.mimeType};base64,${source.data}`;
    }

    if (source.kind === "provider-file") {
        return "";
    }

    if (typeof source.url === "string") {
        return source.url;
    }

    const nested = source.url as
        | {
              image_url?: { url?: string };
              url?: string;
          }
        | undefined;

    return nested?.image_url?.url ?? nested?.url ?? "";
};

const readFileAsDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            if (typeof reader.result === "string") {
                resolve(reader.result);
                return;
            }
            reject(new Error("Failed to read file as data URL."));
        };
        reader.onerror = () => reject(reader.error ?? new Error("Failed to read file."));
        reader.readAsDataURL(file);
    });

const dataUrlToBase64Source = (dataUrl: string) => {
    const match = /^data:(.+?);base64,(.+)$/.exec(dataUrl);
    if (!match) {
        throw new Error("Unsupported data URL format.");
    }

    return {
        kind: "base64" as const,
        mimeType: match[1],
        data: match[2],
    };
};

const isImageCapability = (capability: Capability) => capability === "image";
const isFileCapability = (capability: Capability) => capability === "file";
const isAudioCapability = (capability: Capability) => capability === "audio";

const capabilityNeedsPrompt = (_capability: Capability) => true;

const capabilitySupportsReferenceImage = (capability: Capability) =>
    capability === "text" || capability === "search" || capability === "image";

const capabilitySupportsImageUpload = (capability: Capability) =>
    capability === "text" || capability === "search" || capability === "image";

const capabilitySupportsFileUpload = (capability: Capability) => capability === "file";

const capabilitySupportsAudioUpload = (capability: Capability) => capability === "audio";

export default function Page() {
    const [agent, setAgent] = useState<AgentId>("openrouter-text");
    const [input, setInput] = useState("");
    const [referenceImageUrl, setReferenceImageUrl] = useState("");
    const [referenceImageFile, setReferenceImageFile] = useState<File | null>(null);
    const [uploadedFile, setUploadedFile] = useState<File | null>(null);
    const [uploadedAudio, setUploadedAudio] = useState<File | null>(null);
    const [clientError, setClientError] = useState<string | null>(null);

    const activeAgent = AGENTS.find((entry) => entry.id === agent) ?? AGENTS[0];
    const conversationId = `main:${agent}`;

    const { messages, status, error, sendMessage, stop } = useAgent(client, {
        agent,
        conversationId,
        delivery: activeAgent.delivery as Delivery,
        hydrateFromServer: true,
        resume: true,
    });

    return (
        <main className="min-h-screen bg-[color:var(--background)] px-4 py-6 text-[color:var(--foreground)] sm:px-6 sm:py-8">
            <section className="mx-auto grid max-w-6xl gap-4">
                <header className="grid gap-3">
                    <p className="m-0 font-mono text-[11px] uppercase tracking-[0.08em] text-[color:var(--muted)]">
                        Better Agent · OpenRouter playground
                    </p>
                    <h1 className="m-0 text-[1.85rem] font-semibold tracking-[-0.05em] text-white sm:text-[2.2rem]">
                        Next.js OpenRouter Demo
                    </h1>
                    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                        {AGENTS.map((entry) => (
                            <button
                                key={entry.id}
                                type="button"
                                onClick={() => setAgent(entry.id)}
                                className={`grid gap-1 border px-3 py-3 text-left transition ${
                                    entry.id === agent
                                        ? "border-white bg-white text-black"
                                        : "border-[color:var(--border)] bg-[color:var(--panel)] text-[color:var(--foreground)] hover:border-[color:var(--border-strong)]"
                                }`}
                            >
                                <span className="font-medium">{entry.label}</span>
                                <span
                                    className={`text-xs leading-5 ${
                                        entry.id === agent
                                            ? "text-black/70"
                                            : "text-[color:var(--muted)]"
                                    }`}
                                >
                                    {entry.description}
                                </span>
                            </button>
                        ))}
                    </div>
                    <div className="grid gap-2 border border-[color:var(--border)] bg-[color:var(--panel)] px-3 py-3 text-sm sm:grid-cols-[auto_1fr] sm:items-center">
                        <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-[color:var(--muted)]">
                            {activeAgent.provider}
                        </div>
                        <div className="grid gap-1">
                            <div className="font-medium text-white">{activeAgent.label}</div>
                            <div className="text-xs text-[color:var(--muted)]">
                                {activeAgent.path} · {activeAgent.capability} ·{" "}
                                {activeAgent.delivery}
                            </div>
                        </div>
                    </div>
                </header>

                <section className="grid gap-3 border border-[color:var(--border)] bg-[color:var(--panel)] p-3 sm:p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3 font-mono text-[11px] uppercase tracking-[0.22em] text-[color:var(--muted)]">
                        <span>{conversationId}</span>
                        <span>
                            {activeAgent.label} · {status}
                        </span>
                    </div>

                    <section
                        className="grid min-h-[360px] gap-3 border border-[color:var(--border)] bg-[color:var(--panel-muted)] p-3"
                        aria-live="polite"
                    >
                        {messages.length === 0 ? (
                            <div className="grid place-items-center border border-dashed border-[color:var(--border)] px-4 py-12 text-center text-sm leading-6 text-[color:var(--muted)]">
                                No messages yet.
                            </div>
                        ) : (
                            <div className="grid content-start gap-3 self-start">
                                {messages.map((message) => {
                                    const textParts = message.parts.filter(
                                        (part): part is TextPart => part.type === "text",
                                    );
                                    const imageParts = message.parts.filter(
                                        (part): part is ImagePart => part.type === "image",
                                    );
                                    const fileParts = message.parts.filter(
                                        (part): part is FilePart => part.type === "file",
                                    );
                                    const audioParts = message.parts.filter(
                                        (part): part is AudioPart => part.type === "audio",
                                    );
                                    const transcriptParts = message.parts.filter(
                                        (part): part is TranscriptPart =>
                                            part.type === "transcript",
                                    );
                                    const toolCallParts = message.parts.filter(
                                        (part): part is ToolCallPart => part.type === "tool-call",
                                    );
                                    const toolResultParts = message.parts.filter(
                                        (part): part is ToolResultPart =>
                                            part.type === "tool-result",
                                    );

                                    return (
                                        <article
                                            key={message.localId}
                                            className={`max-w-[96%] border px-2.5 py-2 text-sm leading-[1.55] ${
                                                message.role === "user"
                                                    ? "ml-auto border-[color:var(--border-strong)] bg-white text-black"
                                                    : "border-[color:var(--border)] bg-black text-[color:var(--foreground)]"
                                            }`}
                                        >
                                            <p
                                                className={`m-0 font-mono text-[9px] uppercase tracking-[0.18em] ${
                                                    message.role === "user"
                                                        ? "text-black/55"
                                                        : "text-[color:var(--muted)]"
                                                }`}
                                            >
                                                {message.role}
                                            </p>

                                            {textParts.length > 0 ? (
                                                <div className="mt-1.5 grid gap-2">
                                                    {textParts.map((part, index) => (
                                                        <p
                                                            key={`${message.localId}-text-${index}`}
                                                            className="m-0 whitespace-pre-wrap"
                                                        >
                                                            {part.text}
                                                        </p>
                                                    ))}
                                                </div>
                                            ) : null}

                                            {imageParts.length > 0 ? (
                                                <div className="mt-2 grid gap-2">
                                                    {imageParts.map((part, index) => (
                                                        // eslint-disable-next-line @next/next/no-img-element
                                                        <img
                                                            key={`${message.localId}-image-${index}`}
                                                            src={sourceToUrl(part.source)}
                                                            alt={`Generated content ${index + 1}`}
                                                            className="max-h-[420px] w-full rounded border border-white/10 object-contain"
                                                        />
                                                    ))}
                                                </div>
                                            ) : null}

                                            {fileParts.length > 0 ? (
                                                <div className="mt-2 grid gap-2">
                                                    {fileParts.map((part, index) => {
                                                        const href = sourceToUrl(part.source);
                                                        return href ? (
                                                            <a
                                                                key={`${message.localId}-file-${index}`}
                                                                href={href}
                                                                target="_blank"
                                                                rel="noreferrer"
                                                                className="block border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-[color:var(--foreground)]"
                                                            >
                                                                {part.source.filename ??
                                                                    `File ${index + 1}`}
                                                            </a>
                                                        ) : (
                                                            <div
                                                                key={`${message.localId}-file-${index}`}
                                                                className="border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-[color:var(--foreground)]"
                                                            >
                                                                {part.source.filename ??
                                                                    `File ${index + 1}`}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            ) : null}

                                            {audioParts.length > 0 ? (
                                                <div className="mt-2 grid gap-2">
                                                    {audioParts.map((part, index) => (
                                                        <audio
                                                            key={`${message.localId}-audio-${index}`}
                                                            controls
                                                            src={sourceToUrl(part.source)}
                                                            className="w-full"
                                                        />
                                                    ))}
                                                </div>
                                            ) : null}

                                            {transcriptParts.length > 0 ? (
                                                <div className="mt-2 grid gap-2">
                                                    {transcriptParts.map((part, index) => (
                                                        <div
                                                            key={`${message.localId}-transcript-${index}`}
                                                            className="border border-white/10 bg-white/[0.03] px-3 py-2"
                                                        >
                                                            <p className="m-0 font-mono text-[9px] uppercase tracking-[0.18em] text-[color:var(--muted)]">
                                                                transcript
                                                            </p>
                                                            <p className="m-0 mt-1 whitespace-pre-wrap">
                                                                {part.text}
                                                            </p>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : null}

                                            {toolCallParts.length > 0 ? (
                                                <div className="mt-2 grid gap-2">
                                                    {toolCallParts.map((part, index) => (
                                                        <div
                                                            key={`${message.localId}-tool-call-${index}`}
                                                            className="border border-white/10 bg-white/[0.03] px-3 py-2 font-mono text-xs"
                                                        >
                                                            <p className="m-0">
                                                                tool call: {part.name ?? "unknown"}{" "}
                                                                · {part.status}
                                                            </p>
                                                            {part.args ? (
                                                                <pre className="m-0 mt-1 overflow-x-auto whitespace-pre-wrap text-[color:var(--muted)]">
                                                                    {part.args}
                                                                </pre>
                                                            ) : null}
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : null}

                                            {toolResultParts.length > 0 ? (
                                                <div className="mt-2 grid gap-2">
                                                    {toolResultParts.map((part, index) => (
                                                        <div
                                                            key={`${message.localId}-tool-result-${index}`}
                                                            className="border border-white/10 bg-white/[0.03] px-3 py-2 font-mono text-xs"
                                                        >
                                                            <p className="m-0">
                                                                tool result · {part.status}
                                                            </p>
                                                            <pre className="m-0 mt-1 overflow-x-auto whitespace-pre-wrap text-[color:var(--muted)]">
                                                                {JSON.stringify(
                                                                    part.result,
                                                                    null,
                                                                    2,
                                                                )}
                                                            </pre>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : null}

                                            {textParts.length === 0 &&
                                            imageParts.length === 0 &&
                                            fileParts.length === 0 &&
                                            audioParts.length === 0 &&
                                            transcriptParts.length === 0 &&
                                            toolCallParts.length === 0 &&
                                            toolResultParts.length === 0 ? (
                                                <p className="m-0 mt-1.5 whitespace-pre-wrap text-[color:var(--muted)]">
                                                    No renderable content
                                                </p>
                                            ) : null}
                                        </article>
                                    );
                                })}
                            </div>
                        )}
                    </section>

                    <form
                        className="grid gap-3"
                        onSubmit={async (event) => {
                            event.preventDefault();

                            if (status === "submitted" || status === "streaming") {
                                stop();
                                return;
                            }

                            setClientError(null);

                            const prompt = input.trim();
                            const imageUrl = referenceImageUrl.trim();

                            if (capabilityNeedsPrompt(activeAgent.capability) && !prompt) {
                                setClientError("This capability requires a prompt.");
                                return;
                            }

                            let imageDataUrl: string | null = null;
                            let fileDataUrl: string | null = null;
                            let audioDataUrl: string | null = null;

                            try {
                                if (referenceImageFile) {
                                    imageDataUrl = await readFileAsDataUrl(referenceImageFile);
                                }
                                if (uploadedFile) {
                                    fileDataUrl = await readFileAsDataUrl(uploadedFile);
                                }
                                if (uploadedAudio) {
                                    audioDataUrl = await readFileAsDataUrl(uploadedAudio);
                                }
                            } catch (readError) {
                                setClientError(
                                    readError instanceof Error
                                        ? readError.message
                                        : "Failed to read uploaded file.",
                                );
                                return;
                            }

                            const imageParts: Array<
                                | { type: "image"; source: { kind: "url"; url: string } }
                                | {
                                      type: "image";
                                      source: {
                                          kind: "base64";
                                          data: string;
                                          mimeType: string;
                                      };
                                  }
                            > = [];

                            if (imageDataUrl) {
                                imageParts.push({
                                    type: "image",
                                    source: dataUrlToBase64Source(imageDataUrl),
                                });
                            } else if (imageUrl) {
                                imageParts.push({
                                    type: "image",
                                    source: { kind: "url", url: imageUrl },
                                });
                            }

                            const fileParts: Array<{
                                type: "file";
                                source: {
                                    kind: "base64";
                                    data: string;
                                    mimeType: string;
                                    filename?: string;
                                };
                            }> = [];

                            if (fileDataUrl && uploadedFile) {
                                fileParts.push({
                                    type: "file",
                                    source: {
                                        ...dataUrlToBase64Source(fileDataUrl),
                                        filename: uploadedFile.name,
                                    },
                                });
                            }

                            const audioParts: Array<{
                                type: "audio";
                                source: {
                                    kind: "base64";
                                    data: string;
                                    mimeType: string;
                                };
                            }> = [];

                            if (audioDataUrl) {
                                audioParts.push({
                                    type: "audio",
                                    source: dataUrlToBase64Source(audioDataUrl),
                                });
                            }

                            let nextInput: Record<string, unknown>;

                            switch (activeAgent.capability) {
                                case "text":
                                case "search":
                                case "image": {
                                    nextInput = {
                                        input: [
                                            {
                                                type: "message",
                                                role: "user",
                                                content: [
                                                    { type: "text", text: prompt },
                                                    ...imageParts,
                                                ],
                                            },
                                        ],
                                    };
                                    break;
                                }
                                case "file": {
                                    if (fileParts.length === 0) {
                                        setClientError("Upload a local file for the file demo.");
                                        return;
                                    }

                                    nextInput = {
                                        input: [
                                            {
                                                type: "message",
                                                role: "user",
                                                content: [
                                                    { type: "text", text: prompt },
                                                    ...fileParts,
                                                ],
                                            },
                                        ],
                                    };
                                    break;
                                }
                                case "audio": {
                                    if (audioParts.length === 0) {
                                        setClientError(
                                            "Upload a local audio file for the audio demo.",
                                        );
                                        return;
                                    }

                                    nextInput = {
                                        input: [
                                            {
                                                type: "message",
                                                role: "user",
                                                content: [
                                                    { type: "text", text: prompt },
                                                    ...audioParts,
                                                ],
                                            },
                                        ],
                                        modalities: ["text", "audio"],
                                        audio: {
                                            voice: "alloy",
                                            format: "wav",
                                        },
                                    };
                                    break;
                                }
                                default: {
                                    setClientError("Unsupported capability.");
                                    return;
                                }
                            }

                            if (isImageCapability(activeAgent.capability)) {
                                nextInput.modalities = ["image"];
                            }

                            await sendMessage(nextInput as never);

                            setInput("");
                            if (isImageCapability(activeAgent.capability)) {
                                setReferenceImageUrl("");
                                setReferenceImageFile(null);
                            }
                            if (isFileCapability(activeAgent.capability)) {
                                setUploadedFile(null);
                            }
                            if (isAudioCapability(activeAgent.capability)) {
                                setUploadedAudio(null);
                            }
                        }}
                    >
                        <textarea
                            value={input}
                            onChange={(event) => setInput(event.target.value)}
                            placeholder={
                                isImageCapability(activeAgent.capability)
                                    ? "Describe the image you want..."
                                    : activeAgent.capability === "search"
                                      ? "Ask for current information..."
                                      : isFileCapability(activeAgent.capability)
                                        ? "Ask about the uploaded file..."
                                        : isAudioCapability(activeAgent.capability)
                                          ? "Ask to transcribe, summarize, or reply to the audio..."
                                          : "Ask something..."
                            }
                            aria-label="Prompt"
                            className="min-h-[96px] w-full resize-none border border-[color:var(--border)] bg-black px-3 py-2.5 text-sm leading-6 text-[color:var(--foreground)] outline-none transition placeholder:text-[color:var(--muted)] focus:border-[color:var(--border-strong)]"
                        />

                        {capabilitySupportsReferenceImage(activeAgent.capability) ? (
                            <input
                                value={referenceImageUrl}
                                onChange={(event) => setReferenceImageUrl(event.target.value)}
                                placeholder="Optional public image URL"
                                aria-label="Reference image URL"
                                className="w-full border border-[color:var(--border)] bg-black px-3 py-2.5 text-sm leading-6 text-[color:var(--foreground)] outline-none transition placeholder:text-[color:var(--muted)] focus:border-[color:var(--border-strong)]"
                            />
                        ) : null}

                        {capabilitySupportsImageUpload(activeAgent.capability) ? (
                            <label className="grid gap-1 border border-[color:var(--border)] bg-black px-3 py-2.5 text-sm text-[color:var(--foreground)]">
                                <span className="text-xs uppercase tracking-[0.18em] text-[color:var(--muted)]">
                                    Optional local image file
                                </span>
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={(event) => {
                                        setReferenceImageFile(event.target.files?.[0] ?? null);
                                    }}
                                    className="text-sm"
                                />
                                <span className="text-xs text-[color:var(--muted)]">
                                    {referenceImageFile?.name ?? "No file selected"}
                                </span>
                            </label>
                        ) : null}

                        {capabilitySupportsFileUpload(activeAgent.capability) ? (
                            <label className="grid gap-1 border border-[color:var(--border)] bg-black px-3 py-2.5 text-sm text-[color:var(--foreground)]">
                                <span className="text-xs uppercase tracking-[0.18em] text-[color:var(--muted)]">
                                    Local file
                                </span>
                                <input
                                    type="file"
                                    onChange={(event) => {
                                        setUploadedFile(event.target.files?.[0] ?? null);
                                    }}
                                    className="text-sm"
                                />
                                <span className="text-xs text-[color:var(--muted)]">
                                    {uploadedFile?.name ?? "No file selected"}
                                </span>
                            </label>
                        ) : null}

                        {capabilitySupportsAudioUpload(activeAgent.capability) ? (
                            <label className="grid gap-1 border border-[color:var(--border)] bg-black px-3 py-2.5 text-sm text-[color:var(--foreground)]">
                                <span className="text-xs uppercase tracking-[0.18em] text-[color:var(--muted)]">
                                    Local audio file
                                </span>
                                <input
                                    type="file"
                                    accept="audio/*"
                                    onChange={(event) => {
                                        setUploadedAudio(event.target.files?.[0] ?? null);
                                    }}
                                    className="text-sm"
                                />
                                <span className="text-xs text-[color:var(--muted)]">
                                    {uploadedAudio?.name ?? "No file selected"}
                                </span>
                            </label>
                        ) : null}

                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <p className="m-0 text-xs leading-5 text-[color:var(--muted)]">
                                {activeAgent.capability === "text"
                                    ? "Text chat supports multimodal input. Add a public image URL or local image file."
                                    : activeAgent.capability === "search"
                                      ? "This variant includes OpenRouter hosted web search."
                                      : activeAgent.capability === "file"
                                        ? "Upload a local file and ask the model to read or summarize it."
                                        : activeAgent.capability === "audio"
                                          ? "Upload audio to transcribe it and request spoken output."
                                          : "Image generation supports text-only or image-guided prompts."}
                            </p>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => stop()}
                                    disabled={status !== "submitted" && status !== "streaming"}
                                    className="border border-[color:var(--border)] px-3 py-2 text-sm text-[color:var(--foreground)] transition hover:border-[color:var(--border-strong)] disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                    Stop
                                </button>
                                <button
                                    type="submit"
                                    disabled={
                                        status === "submitted" ||
                                        status === "streaming" ||
                                        (capabilityNeedsPrompt(activeAgent.capability) &&
                                            input.trim().length === 0)
                                    }
                                    className="border border-white bg-white px-3 py-2 text-sm font-medium text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                    {status === "submitted" || status === "streaming"
                                        ? "Running"
                                        : isImageCapability(activeAgent.capability)
                                          ? "Generate"
                                          : "Send"}
                                </button>
                            </div>
                        </div>

                        {clientError ? (
                            <p className="m-0 border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                                {clientError}
                            </p>
                        ) : null}

                        {error ? (
                            <p className="m-0 border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                                {error.message}
                            </p>
                        ) : null}
                    </form>
                </section>
            </section>
        </main>
    );
}
