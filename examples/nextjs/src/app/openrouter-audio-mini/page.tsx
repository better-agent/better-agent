"use client";

import Link from "next/link";
import { useState } from "react";

const DEFAULT_PROMPT = "你好，请用中文打招呼，并直接返回语音。";

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

const extractBase64Payload = (dataUrl: string) => {
    const match = /^data:(.+?);base64,(.+)$/.exec(dataUrl);
    if (!match) {
        throw new Error("Unsupported data URL format.");
    }

    return {
        mimeType: match[1],
        data: match[2],
    };
};

export default function OpenRouterAudioMiniPage() {
    const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
    const [audioBase64, setAudioBase64] = useState("");
    const [audioFormat, setAudioFormat] = useState("wav");
    const [audioFileName, setAudioFileName] = useState<string | null>(null);
    const [requestPreview, setRequestPreview] = useState("");
    const [responseText, setResponseText] = useState("");
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    return (
        <main className="min-h-screen bg-[color:var(--background)] px-4 py-8 text-[color:var(--foreground)] sm:px-6">
            <section className="mx-auto grid max-w-5xl gap-6">
                <header className="grid gap-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="grid gap-2">
                            <p className="m-0 font-mono text-[11px] uppercase tracking-[0.16em] text-[color:var(--muted)]">
                                OpenRouter Raw Request Demo
                            </p>
                            <h1 className="m-0 text-[2rem] font-semibold tracking-[-0.05em] text-white sm:text-[2.4rem]">
                                gpt-audio-mini chat/completions
                            </h1>
                        </div>
                        <Link
                            href="/"
                            className="border border-[color:var(--border)] px-3 py-2 text-sm text-[color:var(--foreground)] transition hover:border-[color:var(--border-strong)]"
                        >
                            Back to playground
                        </Link>
                    </div>

                    <p className="m-0 max-w-4xl text-sm leading-7 text-[color:var(--muted)]">
                        这个页面不走现有的 Better Agent 多 demo 逻辑，而是通过服务端代理直接按
                        OpenRouter 官方音频输出格式发请求：只输入文本，设置{" "}
                        <code>modalities: ["text", "audio"]</code>、<code>audio</code> 和{" "}
                        <code>stream: true</code>，再把 SSE 里的语音片段聚合回来。
                    </p>
                </header>

                <section className="grid gap-4 border border-[color:var(--border)] bg-[color:var(--panel)] p-4 sm:p-5">
                    <form
                        className="grid gap-4"
                        onSubmit={async (event) => {
                            event.preventDefault();
                            setIsLoading(true);
                            setError(null);
                            setResponseText("");
                            setAudioUrl(null);

                            const payload = {
                                prompt: prompt.trim(),
                                audioBase64: audioBase64.trim(),
                                audioFormat: audioFormat.trim() || "wav",
                            };

                            setRequestPreview(
                                JSON.stringify(
                                    {
                                        model: "openai/gpt-audio-mini",
                                        messages: [
                                            {
                                                role: "user",
                                                content: payload.audioBase64
                                                    ? [
                                                          {
                                                              type: "text",
                                                              text: payload.prompt,
                                                          },
                                                          {
                                                              type: "input_audio",
                                                              input_audio: {
                                                                  data: payload.audioBase64,
                                                                  format: payload.audioFormat,
                                                              },
                                                          },
                                                      ]
                                                    : payload.prompt,
                                            },
                                        ],
                                        modalities: ["text", "audio"],
                                        audio: {
                                            voice: "alloy",
                                            format: "wav",
                                        },
                                        stream: true,
                                    },
                                    null,
                                    2,
                                ),
                            );

                            try {
                                const response = await fetch("/api/openrouter-audio-mini", {
                                    method: "POST",
                                    headers: {
                                        "content-type": "application/json",
                                    },
                                    body: JSON.stringify(payload),
                                });

                                const text = await response.text();
                                let parsed: unknown = text;
                                try {
                                    parsed = JSON.parse(text);
                                } catch {
                                    // keep raw text
                                }

                                setResponseText(
                                    typeof parsed === "string"
                                        ? parsed
                                        : JSON.stringify(parsed, null, 2),
                                );

                                if (!response.ok || typeof parsed === "string") {
                                    setError(`Request failed with status ${response.status}.`);
                                    return;
                                }

                                const data = parsed as {
                                    audioBase64?: string;
                                    audioMimeType?: string;
                                };

                                if (data.audioBase64 && data.audioMimeType) {
                                    setAudioUrl(
                                        `data:${data.audioMimeType};base64,${data.audioBase64}`,
                                    );
                                }
                            } catch (requestError) {
                                setError(
                                    requestError instanceof Error
                                        ? requestError.message
                                        : "Request failed.",
                                );
                            } finally {
                                setIsLoading(false);
                            }
                        }}
                    >
                        <label className="grid gap-2">
                            <span className="text-sm font-medium text-white">Prompt</span>
                            <textarea
                                value={prompt}
                                onChange={(event) => setPrompt(event.target.value)}
                                className="min-h-[96px] w-full resize-none border border-[color:var(--border)] bg-black px-3 py-3 text-sm leading-6 text-[color:var(--foreground)] outline-none transition placeholder:text-[color:var(--muted)] focus:border-[color:var(--border-strong)]"
                            />
                        </label>

                        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_140px]">
                            <label className="grid gap-2">
                                <span className="text-sm font-medium text-white">Audio Format</span>
                                <input
                                    value={audioFormat}
                                    onChange={(event) => setAudioFormat(event.target.value)}
                                    className="w-full border border-[color:var(--border)] bg-black px-3 py-2.5 text-sm leading-6 text-[color:var(--foreground)] outline-none transition focus:border-[color:var(--border-strong)]"
                                />
                            </label>

                            <label className="grid gap-2">
                                <span className="text-sm font-medium text-white">Audio File</span>
                                <input
                                    type="file"
                                    accept="audio/*"
                                    className="text-sm text-[color:var(--foreground)]"
                                    onChange={async (event) => {
                                        const file = event.target.files?.[0];
                                        if (!file) {
                                            setAudioFileName(null);
                                            return;
                                        }

                                        try {
                                            const dataUrl = await readFileAsDataUrl(file);
                                            const source = extractBase64Payload(dataUrl);
                                            setAudioBase64(source.data);
                                            setAudioFileName(file.name);
                                        } catch (fileError) {
                                            setError(
                                                fileError instanceof Error
                                                    ? fileError.message
                                                    : "Failed to read file.",
                                            );
                                        }
                                    }}
                                />
                            </label>
                        </div>

                        <label className="grid gap-2">
                            <span className="text-sm font-medium text-white">Audio Base64</span>
                            <textarea
                                value={audioBase64}
                                onChange={(event) => setAudioBase64(event.target.value)}
                                className="min-h-[180px] w-full resize-y border border-[color:var(--border)] bg-black px-3 py-3 font-mono text-xs leading-6 text-[color:var(--foreground)] outline-none transition placeholder:text-[color:var(--muted)] focus:border-[color:var(--border-strong)]"
                            />
                            <span className="text-xs leading-6 text-[color:var(--muted)]">
                                {audioFileName
                                    ? `Loaded from file: ${audioFileName}`
                                    : "留空即可只用文本请求语音输出；如果你想测试 input_audio，再上传文件或粘贴 base64。"}
                            </span>
                        </label>

                        <div className="flex flex-wrap items-center gap-3">
                            <button
                                type="submit"
                                disabled={isLoading}
                                className="border border-white bg-white px-4 py-2 text-sm font-medium text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                {isLoading ? "Sending..." : "Send Raw Request"}
                            </button>
                            <span className="text-xs leading-6 text-[color:var(--muted)]">
                                请求会在服务端发到 <code>https://openrouter.ai/api/v1/chat/completions</code>，
                                不会把 API key 暴露到浏览器。
                            </span>
                        </div>

                        {error ? (
                            <p className="m-0 border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm leading-6 text-red-200">
                                {error}
                            </p>
                        ) : null}
                    </form>
                </section>

                <section className="grid gap-4 lg:grid-cols-2">
                    <article className="grid gap-3 border border-[color:var(--border)] bg-[color:var(--panel)] p-4">
                        <h2 className="m-0 text-base font-medium text-white">Request Preview</h2>
                        <pre className="m-0 overflow-x-auto bg-black p-3 text-xs leading-6 text-[color:var(--muted)]">
                            {requestPreview || "提交后会在这里显示即将发给 OpenRouter 的 JSON body。"}
                        </pre>
                    </article>

                    <article className="grid gap-3 border border-[color:var(--border)] bg-[color:var(--panel)] p-4">
                        <h2 className="m-0 text-base font-medium text-white">Raw Response</h2>
                        <pre className="m-0 overflow-x-auto whitespace-pre-wrap break-words bg-black p-3 text-xs leading-6 text-[color:var(--muted)]">
                            {responseText || "响应会原样显示在这里。"}
                        </pre>
                        {audioUrl ? <audio controls src={audioUrl} className="w-full" /> : null}
                    </article>
                </section>
            </section>
        </main>
    );
}
