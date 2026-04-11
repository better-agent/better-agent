"use client";

import { client } from "@/better-agent/client";
import { useAgent } from "@better-agent/client/react";
import { useState } from "react";

const defaultAgent = process.env.NEXT_PUBLIC_DEFAULT_AGENT ?? "openai";

type MessagePart = {
  type: string;
};

type TextPart = MessagePart & {
  type: "text";
  text: string;
};

type ToolCallPart = MessagePart & {
  type: "tool-call";
  callId: string;
  name?: string;
  args?: string;
  toolTarget?: string;
  status: "pending" | "success" | "error";
  state?: string;
};

type ToolResultPart = MessagePart & {
  type: "tool-result";
  callId: string;
  result?: unknown;
  status: "pending" | "success" | "error";
};

type ToolResultPayload = {
  type?: string;
  message?: string;
  errorKind?: string;
  sandboxId?: string;
  path?: string;
  url?: string;
  created?: boolean;
  exitCode?: number;
  entries?: Array<{ name?: string; path?: string; type?: string }>;
};

const dedupeByCallId = <T extends { callId: string }>(parts: T[]) =>
  Array.from(new Map(parts.map((part) => [part.callId, part])).values());

const formatJson = (value: unknown) => {
  if (typeof value === "string") {
    try {
      return JSON.stringify(JSON.parse(value), null, 2);
    } catch {
      return value;
    }
  }

  if (value === undefined) {
    return "";
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

const getToolResultSummary = (toolName: string | undefined, result: unknown) => {
  if (!result || typeof result !== "object") {
    return "工具执行完成";
  }

  const payload = result as ToolResultPayload;

  if (payload.type === "tool_error") {
    return payload.message ?? "工具执行失败";
  }

  if (toolName === "sandbox_create") {
    if (typeof payload.sandboxId === "string" && payload.sandboxId.length > 0) {
      return `已创建沙盒 ${payload.sandboxId}`;
    }

    return "沙盒创建完成";
  }

  if (toolName === "sandbox_list_files") {
    return `已列出 ${payload.entries?.length ?? 0} 个条目`;
  }

  if (toolName === "sandbox_exec") {
    return `命令执行完成${typeof payload.exitCode === "number" ? `，退出码 ${payload.exitCode}` : ""}`;
  }

  if (toolName === "sandbox_write_file") {
    return typeof payload.path === "string" ? `已写入 ${payload.path}` : "文件写入完成";
  }

  if (toolName === "sandbox_read_file") {
    return typeof payload.path === "string" ? `已读取 ${payload.path}` : "文件读取完成";
  }

  if (toolName === "sandbox_make_dir") {
    return typeof payload.path === "string" ? `已创建目录 ${payload.path}` : "目录创建完成";
  }

  if (toolName === "sandbox_remove_path") {
    return typeof payload.path === "string" ? `已删除 ${payload.path}` : "路径删除完成";
  }

  if (toolName === "sandbox_get_host") {
    return typeof payload.url === "string" ? `已暴露预览地址 ${payload.url}` : "预览地址已生成";
  }

  if (toolName === "sandbox_kill") {
    return typeof payload.sandboxId === "string"
      ? `已终止沙盒 ${payload.sandboxId}`
      : "沙盒已终止";
  }

  return "工具执行完成";
};

const getToolStatusLabel = (part: ToolCallPart) => {
  if (part.status === "error") return "error";
  if (part.status === "success") return "success";
  if (part.state === "input-complete") return "queued";
  if (part.state === "input-streaming") return "building args";
  return "running";
};

const getToolTone = (status: "pending" | "success" | "error") =>
  status === "error"
    ? "border-red-500/30 bg-red-500/10 text-red-100"
    : status === "success"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
      : "border-cyan-500/30 bg-cyan-500/10 text-cyan-100";

export default function Home() {
  const [input, setInput] = useState("");
  const { messages, status, error, sendMessage, stop } = useAgent(client, {
    agent: defaultAgent,
    conversationId: "main",
    hydrateFromServer: true,
    resume: true,
  });

  return (
    <main className="min-h-screen bg-black px-4 py-6 text-white sm:px-6 sm:py-8">
      <section className="mx-auto grid max-w-3xl gap-4">
        <header className="grid gap-3">
          <p className="m-0 font-mono text-[11px] uppercase tracking-[0.08em] text-white/55">
            Better Agent x Daytona
          </p>
          <h1 className="m-0 text-[1.85rem] font-semibold tracking-[-0.05em] sm:text-[2.2rem]">
            Next.js Daytona Sandbox Chat
          </h1>
          <div className="flex items-center gap-2 border border-white/10 bg-white/5 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.2em] text-white/55">
            <span className="text-white/55">&gt;_</span>
            <span className="text-white/80">/agents/{defaultAgent}</span>
          </div>
          <p className="m-0 max-w-2xl text-sm leading-6 text-white/60">
            Ask the agent to create a Daytona sandbox, run commands, write files,
            or expose a local port with sandbox_get_host.
          </p>
        </header>

        <section className="grid gap-3 border border-white/10 bg-white/5 p-3 sm:p-4">
          <div className="flex items-center justify-between gap-3 font-mono text-[11px] uppercase tracking-[0.22em] text-white/55">
            <span>conversation main</span>
            <span>{status}</span>
          </div>

          <section
            className="grid min-h-[320px] gap-3 border border-white/10 bg-black/70 p-3"
            aria-live="polite"
          >
            {messages.length === 0 ? (
              <div className="grid place-items-center border border-dashed border-white/10 px-4 py-12 text-center text-sm leading-6 text-white/55">
                No messages yet.
              </div>
            ) : (
              <div className="grid content-start gap-3 self-start">
                {messages.map((message) => {
                  const textParts = message.parts.filter(
                    (part): part is TextPart => part.type === "text",
                  );
                  const toolCallParts = dedupeByCallId(
                    message.parts.filter(
                      (part): part is ToolCallPart => part.type === "tool-call",
                    ),
                  );
                  const toolResultParts = dedupeByCallId(
                    message.parts.filter(
                      (part): part is ToolResultPart => part.type === "tool-result",
                    ),
                  );

                  return (
                    <article
                      key={message.localId}
                      className={`max-w-[88%] border px-2.5 py-2 text-sm leading-[1.55] ${
                        message.role === "user"
                          ? "ml-auto border-white/20 bg-white text-black"
                          : "border-white/10 bg-black text-white"
                      }`}
                    >
                      <p
                        className={`m-0 font-mono text-[9px] uppercase tracking-[0.18em] ${
                          message.role === "user" ? "text-black/55" : "text-white/45"
                        }`}
                      >
                        {message.role}
                      </p>

                      {toolCallParts.length > 0 || toolResultParts.length > 0 ? (
                        <div className="mt-2 grid gap-2">
                          {toolCallParts.map((part) => (
                            <section
                              key={`call-${part.callId}`}
                              className={`grid gap-2 border px-3 py-2 ${getToolTone(part.status)}`}
                            >
                              <div className="flex items-center justify-between gap-3 font-mono text-[10px] uppercase tracking-[0.18em]">
                                <span>{part.name ?? "tool"}</span>
                                <span>{getToolStatusLabel(part)}</span>
                              </div>
                              <div className="font-mono text-[10px] uppercase tracking-[0.18em] opacity-75">
                                {part.toolTarget ?? "server"} tool
                              </div>
                              {part.args ? (
                                <pre className="m-0 overflow-x-auto whitespace-pre-wrap break-words border border-white/10 bg-black/30 px-3 py-2 font-mono text-[12px] leading-5 text-white/85">
                                  {formatJson(part.args)}
                                </pre>
                              ) : null}
                            </section>
                          ))}

                          {toolResultParts.map((part) => {
                            const toolCall = toolCallParts.find(
                              (toolPart) => toolPart.callId === part.callId,
                            );
                            const toolName = toolCall?.name;

                            return (
                              <section
                                key={`result-${part.callId}`}
                                className={`grid gap-2 border px-3 py-2 ${getToolTone(part.status)}`}
                              >
                                <div className="flex items-center justify-between gap-3 font-mono text-[10px] uppercase tracking-[0.18em]">
                                  <span>{toolName ? `${toolName} result` : "tool result"}</span>
                                  <span>{part.status}</span>
                                </div>
                                <p className="m-0 text-sm leading-6">
                                  {getToolResultSummary(toolName, part.result)}
                                </p>
                                {part.result ? (
                                  <pre className="m-0 overflow-x-auto whitespace-pre-wrap break-words border border-white/10 bg-black/30 px-3 py-2 font-mono text-[12px] leading-5 text-white/85">
                                    {formatJson(part.result)}
                                  </pre>
                                ) : null}
                              </section>
                            );
                          })}
                        </div>
                      ) : null}

                      {textParts.length > 0 ? (
                        <div className="mt-2 grid gap-2">
                          {textParts.map((part, index) => (
                            <p key={`${message.localId}-text-${index}`} className="m-0 whitespace-pre-wrap">
                              {part.text}
                            </p>
                          ))}
                        </div>
                      ) : null}

                      {textParts.length === 0 &&
                      toolCallParts.length === 0 &&
                      toolResultParts.length === 0 ? (
                        <p className="m-0 mt-1.5 whitespace-pre-wrap text-white/55">
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
              const value = input.trim();
              if (!value) return;
              setInput("");
              await sendMessage(value);
            }}
          >
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Create a sandbox and run `node -v`"
              aria-label="Message"
              className="min-h-[96px] w-full resize-none border border-white/10 bg-black px-3 py-2.5 text-sm leading-6 text-white outline-none transition placeholder:text-white/40 focus:border-white/20"
            />
            <div className="flex flex-wrap items-center justify-end gap-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => stop()}
                  disabled={status !== "submitted" && status !== "streaming"}
                  className="border border-white/10 px-3 py-2 text-sm text-white transition hover:border-white/20 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Stop
                </button>
                <button
                  type="submit"
                  disabled={
                    status === "submitted" ||
                    status === "streaming" ||
                    input.trim().length === 0
                  }
                  className="border border-white bg-white px-3 py-2 text-sm font-medium text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {status === "submitted" || status === "streaming"
                    ? "Streaming"
                    : "Send"}
                </button>
              </div>
            </div>
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
