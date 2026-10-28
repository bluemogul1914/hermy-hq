"use client";

/* ───────────────────────────────────────────────────────────
   Blue Mogul AI · AgentChat
   Shared streaming chat modal for agents in the Office / Profiles
   views. Inspired by my-virtual-world's chat-window.js: streaming
   answers as they come, suggestion chips, typing indicator.
   ─────────────────────────────────────────────────────────── */

import { useState, useEffect, useRef, useCallback } from "react";
import { Send, Bot } from "lucide-react";

export interface ChatAgent {
  id: string;
  name: string;
  emoji: string;
  role: string;
  status?: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

// my-virtual-world SUGGEST patterns
const SUGGEST: string[] = [
  "What have you been up to today?",
  "Help me plan my week",
  "Summarise a document for me",
  "Explain this like I'm five",
];

const STATUS_DOT: Record<string, string> = {
  online: "var(--up)",
  working: "var(--accent)",
  active: "var(--up)",
  idle: "var(--warn)",
  error: "var(--down)",
  offline: "var(--text-4)",
};

export function AgentChat({
  agent,
  onClose,
}: {
  agent: ChatAgent;
  onClose: () => void;
}) {
  const [input, setInput] = useState("");
  const [msgs, setMsgs] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, loading]);

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const dot = STATUS_DOT[agent.status ?? "offline"];

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    const newMsgs = [...msgs, { role: "user" as const, content: text }];
    setMsgs(newMsgs);
    setLoading(true);

    try {
      const response = await fetch("/api/agent-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: agent.id,
          message: text,
          history: msgs,
          stream: true,
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        setMsgs((prev) => [
          ...prev,
          { role: "assistant", content: err.error || "Sorry, something went wrong. Try again." },
        ]);
        setLoading(false);
        return;
      }

      // Stream the response
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let reply = "";

      if (!reader) {
        setMsgs((prev) => [
          ...prev,
          { role: "assistant", content: "Streaming not supported in this browser." },
        ]);
        setLoading(false);
        return;
      }

      // Add a placeholder assistant message that we'll stream into
      setMsgs((prev) => [...prev, { role: "assistant", content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });

        // Parse SSE lines: "data: {...}\n\n"
        for (const line of chunk.split("\n")) {
          if (line.startsWith("data: ")) {
            const raw = line.slice(6).trim();
            if (raw === "[DONE]") continue;
            try {
              const data = JSON.parse(raw);
              const delta = data.choices?.[0]?.delta;
              if (delta?.content) {
                reply += delta.content;
                // Update the last assistant message in real-time
                setMsgs((prev) => {
                  const copy = [...prev];
                  const last = copy[copy.length - 1];
                  if (last?.role === "assistant") {
                    copy[copy.length - 1] = { ...last, content: reply };
                  }
                  return copy;
                });
              }
            } catch {
              // ignore parse errors
            }
          }
        }
      }
    } catch {
      setMsgs((prev) => [
        ...prev,
        { role: "assistant", content: "Sorry, something went wrong. Try again." },
      ]);
    } finally {
      setLoading(false);
    }
  }, [agent.id, input, loading, msgs]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="elevated w-full max-w-lg overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center gap-3 px-4 py-3.5"
          style={{ borderBottom: "1px solid var(--line)" }}
        >
          <div className="text-2xl">{agent.emoji || "🤖"}</div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span
                className="relative flex w-2 h-2 shrink-0"
                style={{ color: dot }}
              >
                {agent.status === "working" || agent.status === "online" || agent.status === "active" ? (
                  <span
                    className="absolute inline-flex h-full w-full rounded-full opacity-60 animate-ping"
                    style={{ background: dot }}
                  />
                ) : null}
                <span
                  className="relative inline-flex w-2 h-2 rounded-full"
                  style={{ background: dot }}
                />
              </span>
              <span className="text-[14px] font-semibold text-[var(--text)] truncate">
                {agent.name}
              </span>
            </div>
            <div className="text-[12px] text-[var(--text-3)] truncate">
              {agent.role}
            </div>
          </div>
          <button
            onClick={onClose}
            className="ml-auto text-[var(--text-3)] hover:text-[var(--text)] transition-colors text-xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Messages */}
        <div
          className="h-80 overflow-y-auto p-4 space-y-3 flex flex-col"
          style={{ background: "var(--surface-1)" }}
        >
          {msgs.length === 0 && !loading && (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center">
              <Bot className="w-10 h-10 text-[var(--text-4)]" />
              <p className="text-[var(--text-3)] text-[13px]">
                Ask {agent.name} anything. They&apos;re ready.
              </p>
              <div className="flex flex-wrap gap-1.5 justify-center max-w-sm">
                {SUGGEST.map((s) => (
                  <button
                    key={s}
                    onClick={() => setInput(s)}
                    className="text-[11px] px-3 py-1.5 rounded-full transition-colors"
                    style={{
                      background: "var(--surface-2)",
                      border: "1px solid var(--line)",
                      color: "var(--text-2)",
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {msgs.map((m, i) => (
            <div
              key={i}
              className={`flex ${
                m.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className="max-w-[80%] rounded-[var(--r-md)] px-3.5 py-2 text-[13px] leading-relaxed"
                style={
                  m.role === "user"
                    ? { background: "var(--surface-3)", color: "var(--text)" }
                    : {
                        background: "var(--surface-2)",
                        border: "1px solid var(--line)",
                        color: "var(--text-2)",
                      }
                }
              >
                {m.role === "assistant" && (
                  <span className="text-xs mr-1">{agent.emoji}</span>
                )}
                {m.content || (
                  <span className="opacity-50">
                    thinking…
                  </span>
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div
                className="rounded-[var(--r-md)] px-3.5 py-2"
                style={{
                  background: "var(--surface-2)",
                  border: "1px solid var(--line)",
                }}
              >
                <span className="text-[var(--text-3)] text-[13px]">
                  {agent.emoji} thinking…
                </span>
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        {/* Input */}
        <div
          className="flex gap-2 p-3"
          style={{ borderTop: "1px solid var(--line)" }}
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !loading && input.trim()) {
                e.preventDefault();
                send();
              }
            }}
            placeholder={`Message ${agent.name}…`}
            rows={1}
            maxLength={2000}
            className="flex-1 rounded-[9999px] px-4 py-2 text-[13px] text-[var(--text)] placeholder:text-[var(--text-3)] focus:outline-none resize-none"
            style={{
              background: "var(--surface-1)",
              border: "1px solid var(--line)",
            }}
          />
          <button
            onClick={send}
            disabled={!input.trim() || loading}
            className="btn-primary px-4 py-2 text-[13px] flex items-center justify-center w-10 h-10 rounded-full"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
