"use client";

/* ───────────────────────────────────────────────────────────
   Blue Mogul AI · Terminal
   Operate the Mission Control host shell through the
   /api/terminal endpoint (GET /api/terminal/status,
   POST /api/terminal/run). Commands execute server-side with
   shell=False — metacharacters are NOT interpreted. Every run
   is audited to the activity stream. Access is gated by owner/
   admin RBAC (enforced server-side via the MC bearer token)
   plus a shared terminal password surfaced by the status
   endpoint's `password_required` flag. — ────────────────────────────────────────────────────────── */

import { useEffect, useState, useRef } from "react";
import { Terminal, Trash2, Clock, Play } from "lucide-react";
import { Button, Panel, Pill, rise, EmptyState } from "@/components/ui/kit";
import { PageHeader, ErrorState, LoadingGrid } from "@/components/mc/ui";
import { mcGetSafe, mcPost } from "@/lib/mc";

interface TerminalStatus {
  ok: boolean;
  enabled: boolean;
  password_required: boolean;
  timeout_seconds: number;
}

interface TerminalResult {
  ok: boolean;
  exit_code: number | null;
  stdout: string;
  stderr: string;
  duration_ms: number;
  timed_out?: boolean;
  error?: string;
  detail?: string;
}

interface HistoryEntry {
  id: string;
  command: string;
  result: TerminalResult;
  ts: number;
}

const PRESETS = ["ls -la", "pwd", "whoami", "df -h", "free -h", "uptime"];

/* One executed command block — prompt, stdout, stderr, status line. */
function TerminalEntry({ entry }: { entry: HistoryEntry }) {
  const r = entry.result;
  const isSuccess = r.exit_code === 0;
  const isFail = r.exit_code !== null && r.exit_code !== 0;
  const exitColor = isSuccess
    ? "var(--up)"
    : isFail
      ? "var(--down)"
      : "var(--text-3)";
  const exitLabel = r.exit_code === null ? "—" : String(r.exit_code);

  return (
    <div className="mb-3 break-all">
      <div className="flex items-baseline gap-1">
        <span style={{ color: "var(--accent)" }}> $ </span>
        <span className="text-[var(--text)]">{entry.command}</span>
      </div>

      {r.stdout && (
        <pre className="mt-1 text-[var(--text-2)] whitespace-pre-wrap break-all ml-[20px]">
          {r.stdout}
        </pre>
      )}

      {r.stderr && (
        <pre className="mt-1 text-[var(--down)] whitespace-pre-wrap break-all ml-[20px]">
          {r.stderr}
        </pre>
      )}

      <div className="flex items-center gap-4 mt-1 ml-[20px] text-[11px] num text-[var(--text-4)]">
        <span className="flex items-center gap-1.5">
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: exitColor }}
          />
          <span style={{ color: exitColor }}>exit {exitLabel}</span>
        </span>
        <span className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          <span>{r.duration_ms}ms</span>
        </span>
        {r.timed_out && <Pill tone="warn">Timed out</Pill>}
        {!r.ok && r.error && (
          <span className="text-[var(--down)]">error: {r.error}</span>
        )}
      </div>
    </div>
  );
}

export default function TerminalPage() {
  // ── status ──
  const [status, setStatus] = useState<TerminalStatus | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

  // ── form ──
  const [command, setCommand] = useState("");
  const [password, setPassword] = useState("");
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);

  // ── output ──
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  const cmdRef = useRef<HTMLInputElement>(null);
  const pwRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Fetch terminal feature status on mount.
  useEffect(() => {
    (async () => {
      const d = await mcGetSafe<TerminalStatus>("terminal/status");
      if (!d) {
        setStatusError("terminal status read failed");
      } else {
        setStatus(d);
      }
    })();
  }, []);

  // Auto-scroll to the latest output.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [history, running]);

  // ── initial load ──
  if (!status && !statusError) {
    return (
      <div className="w-full mx-auto pt-2 max-w-5xl">
        <PageHeader eyebrow="Operate" title="Terminal" />
        <LoadingGrid n={3} />
      </div>
    );
  }

  // ── error / disabled ──
  if (statusError || !status?.enabled) {
    return (
      <div className="w-full mx-auto pt-2 max-w-5xl">
        <PageHeader eyebrow="Operate" title="Terminal" />
        <ErrorState
          message={
            statusError ||
            "The Terminal feature is not enabled on Mission Control."
          }
        />
      </div>
    );
  }

  async function runCommand() {
    const cmd = command.trim();
    if (!cmd || running || !status) return;
    if (status.password_required && !password.trim()) {
      pwRef.current?.focus();
      return;
    }

    setRunning(true);
    setRunError(null);

    const body: { command: string; password?: string } = { command: cmd };
    if (status.password_required) body.password = password;

    try {
      const res = (await mcPost("terminal/run", body)) as TerminalResult;
      const result = res;
      setHistory((prev) =>
        [...prev, {
          id: String(Date.now()),
          command: cmd,
          result,
          ts: Date.now(),
        }],
      );
      setCommand("");
    } catch (e: any) {
      const msg = e?.message || "command failed";
      setRunError(msg);
      setHistory((prev) =>
        [...prev, {
          id: String(Date.now()),
          command: cmd,
          result: {
            ok: false,
            exit_code: null,
            stdout: "",
            stderr: msg,
            duration_ms: 0,
          },
          ts: Date.now(),
        }],
      );
    } finally {
      setRunning(false);
    }
  }

  function clearOutput() {
    if (running) return;
    setHistory([]);
    setRunError(null);
    setCommand("");
    cmdRef.current?.focus();
  }

  const inputBaseCls =
    "font-mono text-[13px] bg-[var(--surface-1)] border border-[var(--line)] " +
    "text-[var(--text)] placeholder-[var(--text-4)] rounded-[var(--r-sm)] " +
    "px-3 py-2 focus:outline-none focus:border-[var(--accent)] " +
    "focus:bg-[var(--surface-2)] disabled:opacity-40";

  return (
    <div className="w-full mx-auto pt-2 max-w-5xl">
      <PageHeader
        eyebrow="Operate"
        title="Terminal"
        sub="Run shell commands on the Mission Control host. Commands execute server-side with shell=False — metacharacters are not interpreted. Every run is audited to the activity stream."
      />

      {/* ── status row ── */}
      <div className="flex items-center gap-2 mb-4 hq-rise" style={rise(0)}>
        <Pill tone={status.enabled ? "up" : "down"}>
          {status.enabled ? "Enabled" : "Disabled"}
        </Pill>
        {status.password_required && <Pill tone="warn">Password required</Pill>}
        <Pill tone="neutral">
          <Clock className="w-3 h-3 mr-1" />
          {status.timeout_seconds}s cap
        </Pill>
      </div>

      {/* ── terminal output ── */}
      <Panel className="p-0 mb-4 hq-rise" style={rise(1)}>
        <div
          ref={scrollRef}
          className="terminal-screen font-mono text-[12.5px] leading-[1.6]
                     bg-[var(--surface-1)] border border-[var(--line)]
                     rounded-[var(--r-md)] h-[380px] overflow-y-auto"
        >
          {history.length === 0 && !running ? (
            <div className="h-full flex flex-col items-center justify-center">
              <EmptyState
                icon={<Terminal className="w-6 h-6" />}
                title="No commands run yet"
                hint="Enter a command below to execute it on the Mission Control host."
                action={
                  <div className="flex flex-wrap gap-1.5 justify-center mt-4">
                    {PRESETS.map((p) => (
                      <button
                        key={p}
                        onClick={() => {
                          setCommand(p);
                          cmdRef.current?.focus();
                        }}
                        className="text-[11px] font-medium px-2.5 py-1 rounded-full
                                   transition-colors"
                        style={{
                          color: "var(--text-3)",
                          background:
                            "color-mix(in srgb, var(--text-3) 12%, transparent)",
                          border:
                            "1px solid color-mix(in srgb, var(--text-3) 22%, transparent)",
                        }}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                }
              />
            </div>
          ) : (
            <div className="p-4">
              {history.map((entry) => (
                <TerminalEntry key={entry.id} entry={entry} />
              ))}
              {running && (
                <div className="flex items-center gap-2 text-[var(--text-3)] mb-3">
                  <span style={{ color: "var(--accent)" }}> $ </span>
                  <span className="break-all">{command}</span>
                  <span className="animate-pulse text-[var(--accent)]">▋</span>
                </div>
              )}
            </div>
          )}
        </div>
      </Panel>

      {/* ── input bar ── */}
      <Panel className="p-4 hq-rise" style={rise(2)}>
        <div className="flex items-stretch gap-2">
          {status.password_required && (
            <input
              ref={pwRef}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runCommand()}
              placeholder="Terminal password"
              disabled={running}
              className={inputBaseCls}
              style={{ maxWidth: "200px" }}
              autoComplete="off"
            />
          )}
          <input
            ref={cmdRef}
            type="text"
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && runCommand()}
            placeholder={running ? "Running…" : "Enter command (e.g. ls -la)…"}
            disabled={running}
            className={"flex-1 " + inputBaseCls}
            autoComplete="off"
          />
          <Button
            variant="primary"
            onClick={runCommand}
            disabled={running || !command.trim()}
            className="shrink-0"
          >
            {running ? (
              <>
                <Clock className="w-4 h-4 animate-spin" />
                <span>Running</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                <span>Run</span>
              </>
            )}
          </Button>
          <Button
            variant="ghost"
            onClick={clearOutput}
            disabled={running || history.length === 0}
            className="shrink-0"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>

        {runError && (
          <p className="mt-2 text-[12px] text-[var(--down)] break-all">{runError}</p>
        )}
        {history.length > 0 && (
          <p className="mt-2 text-[11px] text-[var(--text-4)] num">
            {history.length} command{history.length > 1 ? "s" : ""} recorded
          </p>
        )}
      </Panel>
    </div>
  );
}
