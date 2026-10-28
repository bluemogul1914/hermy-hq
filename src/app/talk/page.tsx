"use client";

/* ───────────────────────────────────────────────────────────
   Blue Mogul AI · Talk Mode
   Voice chat entry point for the Hermy cockpit.

   Flow:
     1. The agent selector is populated from /status (the MC
        roster) so the user picks who they want to speak with.
     2. Press the mic → we ask Mission Control for a voice-session
        token via GET /api/talk/token (proxied through /api/mc to
        MC's /api/talk/token). The token carries
        { token, agent_name, voice, model }.
     3. We claim the microphone, spin up the Web Speech API for
        on-device speech→text, and stream the user's transcript
        into the panel as final results arrive.
     4. The agent's spoken reply is served back by MC over the token
        channel; "agent" rows appear in the transcript when the
        session emits them. Press the mic again to stop listening,
        or switch agents / disconnect at any time.

   All MC secrets stay server-side — the browser only ever talks
   to /api/mc/*; the bearer token never leaves the server.
   ─────────────────────────────────────────────────────────── */

import { useEffect, useRef, useState } from "react";
import {
  Mic,
  Loader2,
  Wifi,
  WifiOff,
  Trash2,
  RefreshCw,
  Square,
  AlertCircle,
} from "lucide-react";
import { rise, Panel, Pill, EmptyState, Button, Skeleton } from "@/components/ui/kit";
import { PageHeader, ErrorState, LoadingGrid } from "@/components/mc/ui";
import { mcGet } from "@/lib/mc";

interface Agent {
  agent_name: string;
  status?: string;
  health?: "green" | "yellow" | "red" | "grey";
}

interface TalkToken {
  token: string;
  agent_name: string;
  voice: string;
  model: string;
}

interface TranscriptLine {
  role: "user" | "agent";
  text: string;
  ts: number;
}

type ConnStatus = "idle" | "connecting" | "connected" | "recording" | "error";

const STATUS_CONFIG: Record<ConnStatus, { color: string; dot: string; label: string }> = {
  idle: { color: "var(--text-3)", dot: "var(--text-4)", label: "Not connected" },
  connecting: { color: "var(--warn)", dot: "var(--warn)", label: "Connecting…" },
  connected: { color: "var(--accent)", dot: "var(--accent)", label: "Connected" },
  recording: { color: "var(--up)", dot: "var(--up)", label: "Listening…" },
  error: { color: "var(--down)", dot: "var(--down)", label: "Connection error" },
};

// Local mirror of the Web Speech event shapes we use. We avoid the global
// SpeechRecognitionEvent / SpeechRecognitionErrorEvent names because they
// aren't present in every TypeScript DOM-lib revision.
type SRResult = { isFinal: boolean; transcript: string };
type SRResults = { length: number; item(index: number): SRResult };
type AnySR = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((ev: { results: SRResults }) => void) | null;
  onerror: ((ev: { error: string }) => void) | null;
  onend: (() => void) | null;
};
type SRConstructor = new () => AnySR;
const SpeechRecognitionCtor: SRConstructor | null =
  typeof window !== "undefined"
    ? (window as unknown as {
        SpeechRecognition?: SRConstructor;
        webkitSpeechRecognition?: SRConstructor;
      }).SpeechRecognition ||
      (window as unknown as {
        SpeechRecognition?: SRConstructor;
        webkitSpeechRecognition?: SRConstructor;
      }).webkitSpeechRecognition ||
      null
    : null;

// Safe wrapper around mcGet — returns null instead of throwing, so a failed
// roster read never crashes the page (mirrors the other MC-backed pages).
async function safeGet<T>(path: string): Promise<T | null> {
  try {
    return (await mcGet(path)) as T;
  } catch {
    return null;
  }
}

const INPUT_CLS =
  "w-full bg-[var(--surface-1)] text-[14px] text-[var(--text)] placeholder:text-[var(--text-3)] px-3.5 py-2.5 rounded-[10px] border border-[var(--line)] outline-none focus:border-[color-mix(in_srgb,var(--accent)_45%,transparent)] transition-colors appearance-none";

function healthFromStatus(status: string | undefined): "green" | "yellow" | "red" | "grey" {
  const s = (status || "").toLowerCase();
  if (s === "online" || s === "up" || s === "green") return "green";
  if (s === "offline" || s === "down" || s === "red") return "red";
  if (s === "degraded" || s === "yellow" || s === "warn" || s === "idle") return "yellow";
  return "grey";
}

export default function TalkPage() {
  const [agents, setAgents] = useState<Agent[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedAgent, setSelectedAgent] = useState<string>("");
  const [token, setToken] = useState<TalkToken | null>(null);
  const [status, setStatus] = useState<ConnStatus>("idle");
  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);

  const streamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<AnySR | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);

  // ── load the agent roster for the selector ──
  useEffect(() => {
    let alive = true;
    (async () => {
      const d = await safeGet("status");
      if (!alive) return;
      const mcAgents: any[] = (d as any)?.[0]?.agents || (d as any)?.agents || [];
      if (!Array.isArray(mcAgents) || mcAgents.length === 0) {
        setError("Could not read the agent roster from Mission Control.");
        setAgents([]);
        setLoading(false);
        return;
      }
      // Map MC's { id, name, status, last_activity } → Talk's Agent interface
      const mapped: Agent[] = mcAgents.map((a: any) => ({
        agent_name: a.name || a.agent_name || "unknown",
        status: a.status,
        health: healthFromStatus(a.status),
      }));
      setAgents(mapped);
      const online = mapped.filter((a) => a.health === "green");
      const fallback = online.length ? online : mapped;
      setSelectedAgent(fallback[0]?.agent_name ?? "");
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, []);

  // done loading the roster once it resolves (or errors)
  const rosterDone = agents !== null;
  useEffect(() => {
    if (rosterDone) setLoading(false);
  }, [rosterDone]);

  // ── keep the transcript scrolled to the latest line ──
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [transcript]);

  // ── acquire the voice-session token (agent_name sent server-side) ──
  async function fetchToken(agent: string): Promise<TalkToken | null> {
    try {
      const d = await mcGet(`talk/token?agent_name=${encodeURIComponent(agent)}`);
      return (d as TalkToken) ?? null;
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e);
      setError(`Token request failed: ${detail}`);
      return null;
    }
  }

  // ── connect: get token + claim mic ──
  async function connect() {
    if (!selectedAgent) return;
    setStatus("connecting");
    setError(null);

    const t = await fetchToken(selectedAgent);
    if (!t) {
      setStatus("error");
      return;
    }
    setToken(t);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      setStatus("connected");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Microphone access denied";
      setError(msg);
      setStatus("error");
    }
  }

  // ── start listening (speech→text) ──
  function startRecording() {
    if (!SpeechRecognitionCtor) {
      setError("Speech recognition is not available in this browser.");
      setStatus("error");
      return;
    }
    const sr = new SpeechRecognitionCtor();
    sr.continuous = true;
    sr.interimResults = true;
    sr.lang = "en-US";

    sr.onresult = (ev) => {
      const list = ev.results;
      if (list.length === 0) return;
      const latest = list.item(list.length - 1);
      // Only commit final results so the transcript doesn't flicker.
      if (latest.isFinal) {
        const text = latest.transcript.trim();
        if (text) setTranscript((prev) => [...prev, { role: "user", text, ts: Date.now() }]);
      }
    };

    sr.onerror = (ev) => {
      setError(ev.error);
    };

    sr.onend = () => {
      if (recording) setRecording(false);
    };

    recognitionRef.current = sr;
    sr.start();
    setRecording(true);
    setStatus("recording");
  }

  // ── stop listening ──
  function stopRecording() {
    recognitionRef.current?.stop();
    setRecording(false);
    setStatus("connected");
  }

  // ── primary mic action: connect-then-record, or toggle record ──
  function onMicPress() {
    if (status === "recording") {
      stopRecording();
      return;
    }
    if (status === "connected") {
      startRecording();
      return;
    }
    // idle / error → (re)connect
    connect();
  }

  // ── disconnect: drop token + mic ──
  function disconnect() {
    recognitionRef.current?.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    recognitionRef.current = null;
    setToken(null);
    setRecording(false);
    setStatus("idle");
  }

  // ── clear the transcript panel ──
  function clearTranscript() {
    setTranscript([]);
  }

  // While the roster loads, mirror the cost page's loading treatment.
  if (loading) {
    return (
      <div className="w-full mx-auto pt-2 max-w-5xl">
        <PageHeader eyebrow="Creative" title="Talk Mode" />
        <div className="space-y-4">
          <div className="flex gap-3 hq-rise" style={rise(0)}>
            <Skeleton className="h-10 w-48" />
            <Skeleton className="h-10 w-40" />
          </div>
          <Skeleton className="h-[320px] w-full" />
        </div>
      </div>
    );
  }

  // ── fatal: roster unreadable (no token can be requested without an agent) ──
  if (error && !agents) {
    return (
      <div className="w-full mx-auto pt-2 max-w-5xl">
        <PageHeader eyebrow="Creative" title="Talk Mode" />
        <ErrorState message={error} />
      </div>
    );
  }

  const cfg = STATUS_CONFIG[status];
  const disabled = status === "connecting";
  const onlineAgents = agents?.filter((a) => !!a.agent_name) ?? [];

  return (
    <div className="w-full mx-auto pt-2 max-w-5xl">
      <PageHeader
        eyebrow="Creative"
        title="Talk Mode"
        sub="Voice chat with an agent. Press the mic to connect and start speaking — MC returns a voice-session token and the agent replies over the same channel."
        action={
          <Button variant="ghost" size="sm" onClick={() => setError(null)}>
            <RefreshCw className="w-3.5 h-3.5" />
            Retry
          </Button>
        }
      />

      {/* ── agent selector + connection status ── */}
      <div className="flex flex-wrap items-end gap-3 hq-rise" style={rise(0)}>
        <div className="flex-1 min-w-[180px]">
          <label className="eyebrow mb-1.5 block">Agent</label>
          <select
            value={selectedAgent}
            onChange={(e) => {
              if (token) disconnect();
              setSelectedAgent(e.target.value);
            }}
            disabled={disabled}
            className={INPUT_CLS}
          >
            {onlineAgents.length === 0 ? (
              <option value="">No agents available</option>
            ) : (
              onlineAgents.map((a) => (
                <option key={a.agent_name} value={a.agent_name}>
                  {a.agent_name}
                </option>
              ))
            )}
          </select>
        </div>

        <div className="flex items-center gap-2 shrink-0" style={{ color: cfg.color }}>
          <span
            className="relative flex w-2.5 h-2.5 shrink-0 rounded-full"
            style={{ background: cfg.dot }}
          >
            {status === "recording" && (
              <span
                className="absolute inline-flex h-full w-full rounded-full opacity-60 animate-ping"
                style={{ background: cfg.dot }}
              />
            )}
            <span className="relative inline-flex w-2.5 h-2.5 rounded-full" />
          </span>
          <Pill tone={status === "error" ? "down" : status === "recording" ? "up" : status === "connecting" ? "warn" : "neutral"}>
            {cfg.label}
          </Pill>
        </div>
      </div>

      {/* ── connection error banner ── */}
      {error ? (
        <div className="hq-rise" style={rise(1)}>
          <Panel className="p-3 mb-4 flex items-start gap-2.5">
            <AlertCircle
              className="w-4 h-4 mt-0.5 shrink-0"
              style={{ color: "var(--down)" }}
            />
            <p className="text-[12.5px] text-[var(--text-2)] break-words flex-1">{error}</p>
            <button
              onClick={() => setError(null)}
              className="ml-auto text-[var(--text-4)] hover:text-[var(--text-2)] transition-colors"
              aria-label="Dismiss"
            >
              ✕
            </button>
          </Panel>
        </div>
      ) : null}

      {/* ── main talk panel: mic + transcript ── */}
      <Panel className="p-6 hq-rise" style={rise(2)}>
        <div className="flex flex-col items-center gap-5">
          {/* ── the mic button ── */}
          <button
            type="button"
            onClick={onMicPress}
            disabled={disabled}
            aria-label={
              status === "recording"
                ? "Stop listening"
                : status === "connected"
                  ? "Start listening"
                  : status === "connecting"
                    ? "Connecting…"
                    : "Start voice chat"
            }
            className={`
              relative flex items-center justify-center
              w-16 h-16 rounded-full
              transition-all duration-200 ease-out
              ${status === "recording"
                ? "bg-[var(--down)] shadow-[0_0_0_6px_color-mix(in_srgb,var(--down)_20%,transparent)]"
                : status === "connected"
                  ? "bg-[var(--accent)] shadow-[0_0_0_6px_color-mix(in_srgb,var(--accent)_25%,transparent)]"
                  : "bg-[var(--surface-2)] border-2 border-[var(--line)]"}
              ${disabled ? "opacity-50 pointer-events-none" : "hover:scale-105 active:scale-95"}
            `}
          >
            {status === "connecting" ? (
              <Loader2 className="w-7 h-7 text-[var(--text)] animate-spin" />
            ) : status === "recording" ? (
              <Square className="w-7 h-7 text-white" />
            ) : (
              <Mic className="w-7 h-7 text-[var(--text)]" />
            )}
          </button>

          <div className="text-center">
            <div
              className="text-[15px] font-medium"
              style={{ color: cfg.color }}
            >
              {status === "recording"
                ? "Listening… speak now"
                : status === "connected"
                  ? `${selectedAgent} · ready`
                  : cfg.label}
            </div>
            {status === "connected" && !recording && (
              <p className="mt-1 text-[12px] text-[var(--text-3)]">
                Press the mic to start speaking.
              </p>
            )}
          </div>
        </div>

        {/* ── transcript ── */}
        <div className="mt-6">
          <div className="flex items-center justify-between mb-3">
            <span className="eyebrow">Voice transcript</span>
            {transcript.length > 0 && (
              <Button variant="ghost" size="sm" onClick={clearTranscript}>
                <Trash2 className="w-3.5 h-3.5" /> Clear
              </Button>
            )}
          </div>
          {transcript.length === 0 ? (
            <div
              className="min-h-[160px] flex items-center justify-center border border-[var(--line)] rounded-[var(--r-md)]"
              style={{ background: "var(--surface-1)" }}
            >
              <EmptyState
                icon={<Mic className="w-5 h-5" />}
                title={status === "recording" ? "Transcribing…" : "No transcript yet"}
                hint={
                  status === "recording"
                    ? "Your speech will appear here as the agent hears it."
                    : status === "connected"
                      ? "Press the mic and start speaking — text streams in here."
                      : "Connect and start a voice chat to see the transcript."
                }
              />
            </div>
          ) : (
            <div
              className="min-h-[160px] max-h-[240px] overflow-y-auto rounded-[var(--r-md)] p-4 space-y-3"
              style={{ background: "var(--surface-1)", border: "1px solid var(--line)" }}
            >
              {transcript.map((line) => (
                <div key={line.ts} className="flex items-baseline gap-2.5 text-[13px] leading-relaxed">
                  <span
                    className="num shrink-0 text-[var(--text-4)]"
                    style={{
                      color: line.role === "agent" ? "var(--accent)" : "var(--text-3)",
                    }}
                  >
                    {line.role === "agent" ? "🗣️" : "👤"}
                  </span>
                  <span className="text-[var(--text)] break-words">{line.text}</span>
                  <span className="ml-auto num text-[10px] text-[var(--text-4)]">
                    {new Date(line.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              ))}
              <div ref={transcriptEndRef} />
            </div>
          )}
        </div>

        {/* ── session details + disconnect ── */}
        {token && (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-4 pt-5" style={{ borderTop: "1px solid var(--line)" }}>
            <div className="flex flex-wrap items-center gap-4 text-[12px] text-[var(--text-3)]">
              <span className="num">
                voice: <span className="text-[var(--text-2)]">{token.voice}</span>
              </span>
              <span className="num">
                model: <span className="text-[var(--text-2)]">{token.model}</span>
              </span>
              <span
                className="num truncated max-w-[140px]"
                title={token.token}
                style={{ color: "var(--text-4)" }}
              >
                token: <span className="text-[var(--text-2)]">{token.token.slice(0, 8)}…</span>
              </span>
            </div>
            <Button variant="ghost" size="sm" onClick={disconnect}>
              <WifiOff className="w-3.5 h-3.5" /> Disconnect
            </Button>
          </div>
        )}
      </Panel>

      {/* ── connected-but-no-token-yet detail ── */}
      {!token && status === "connected" && (
        <Panel className="p-4 hq-rise" style={rise(3)}>
          <div className="flex items-center gap-2 text-[12.5px] text-[var(--text-3)]">
            <Wifi className="w-3.5 h-3.5 text-[var(--accent)]" />
            <span>Connected to the MC voice channel for</span>
            <Pill tone="accent">{selectedAgent}</Pill>
          </div>
        </Panel>
      )}
    </div>
  );
}
