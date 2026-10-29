"use client";

import { useState, useEffect } from "react";
import { MessageCircle, Clock } from "lucide-react";
import VirtualCity from "@/components/VirtualCity";

/* ───────────────────────────────────────────────────────────
   Blue Mogul AI · OfficeView — The virtual office floor.
   Foundation: my-virtual-world agent studio patterns:
   • Agent cards with emoji avatar, status dot (pulse when working),
     name, role, current task, last-active, channel, task count.
   • Org tree with connecting lines (deterministic layout).
   • Live activity ticker.
   • Status legend: green=working, amber=idle, gray=offline.
   All styling uses the Calm Luxury CSS-variable system
   (navy gradient + gold accent), not Tailwind neutral classes.
   ─────────────────────────────────────────────────────────── */

interface AgentActivity {
  timestamp: string;
  action: string;
  result?: string;
}

export interface Agent {
  id: string;
  name: string;
  emoji: string;
  role: string;
  reportsTo?: string | null;
  status: string;
  currentTask?: string;
  lastActive?: string;
  channel?: string;
  secondsSinceHeartbeat?: number;
  tasksCompleted: number;
  totalCost: number;
  recentActivity: AgentActivity[];
}

// ── Status → visual config (my-virtual-world: green=working, amber=idle, gray=offline) ──
const STATUS: Record<string, { dot: string; tint: string; accent: string }> = {
  working:   { dot: "var(--accent)", accent: "var(--accent)", tint: "color-mix(in srgb, var(--accent) 12%, transparent)" },
  idle:      { dot: "var(--warn)",   accent: "var(--warn)",   tint: "color-mix(in srgb, var(--warn) 10%, transparent)" },
  error:     { dot: "var(--down)",   accent: "var(--down)",   tint: "color-mix(in srgb, var(--down) 12%, transparent)" },
  offline:   { dot: "var(--text-4)", accent: "var(--text-4)", tint: "color-mix(in srgb, var(--text-4) 6%, transparent)" },
  online:    { dot: "var(--up)",     accent: "var(--up)",     tint: "color-mix(in srgb, var(--up) 12%, transparent)" },
  active:    { dot: "var(--up)",     accent: "var(--up)",     tint: "color-mix(in srgb, var(--up) 12%, transparent)" },
  completed: { dot: "var(--warn)",   accent: "var(--warn)",   tint: "color-mix(in srgb, var(--warn) 10%, transparent)" },
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function lastSeenLabel(agent: Agent): string {
  if (!agent.lastActive && !agent.secondsSinceHeartbeat) return "never";
  if (agent.secondsSinceHeartbeat != null) {
    const s = agent.secondsSinceHeartbeat;
    if (s < 900) return "now";
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    return `${Math.floor(s / 3600)}h ago`;
  }
  if (agent.lastActive) return timeAgo(agent.lastActive);
  return "—";
}

// ── Status dot with optional pulse (my-virtual-world pattern) ──
function StatusDot({ status }: { status: string }) {
  const s = STATUS[status] || STATUS.offline;
  const pulse = status === "working" || status === "online" || status === "active";
  return (
    <span className="relative flex w-2 h-2 shrink-0">
      {pulse && (
        <span
          className="absolute inline-flex h-full w-full rounded-full opacity-60 animate-ping"
          style={{ background: s.dot }}
        />
      )}
      <span className="relative inline-flex w-2 h-2 rounded-full" style={{ background: s.dot }} />
    </span>
  );
}

// ── Single org node card (my-virtual-world agent card pattern) ──
function OrgNodeCard({
  agent,
  isCeo,
  onChat,
}: {
  agent: Agent;
  isCeo: boolean;
  onChat?: (agent: Agent) => void;
}) {
  const colors = STATUS[agent.status] ?? STATUS.offline;
  const isOffline = agent.status === "offline";

  return (
    <div
      className={`panel ${isCeo ? "px-6 py-4" : "px-4 py-3"} ${isOffline ? "opacity-55" : ""}`}
      style={{
        background: colors.tint,
        border: `1px solid color-mix(in srgb, ${colors.accent} 30%, transparent)`,
        borderRadius: "var(--r-md)",
        minWidth: isCeo ? 240 : 190,
        maxWidth: 260,
      }}
    >
      <div className="flex items-start gap-2.5">
        {/* Avatar — my-virtual-world pattern: emoji in a rounded surface */}
        <div
          className={`flex items-center justify-center text-lg shrink-0 ${isCeo ? "w-10 h-10" : "w-8 h-8"} rounded-[var(--r-sm]`}
          style={{ background: "var(--surface-2)", border: "1px solid var(--line)" }}
        >
          {agent.emoji}
        </div>
        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <StatusDot status={agent.status} />
            <span
              className={`font-semibold text-[var(--text)] truncate ${isCeo ? "text-[14px]" : "text-[13px]"}`}
            >
              {agent.name}
            </span>
          </div>
          <div className="text-[10px] text-[var(--text-3)] mt-0.5 leading-snug">
            {agent.role}
          </div>

          {/* Current task — shown when working (my-virtual-world "what it is doing") */}
          {agent.currentTask && agent.status === "working" && (
            <div
              className="text-[11px] mt-1.5 truncate"
              style={{ color: "var(--accent)" }}
              title={agent.currentTask}
            >
              {agent.currentTask.slice(0, 60)}
              {agent.currentTask.length > 60 ? "…" : ""}
            </div>
          )}

          {/* Last seen — my-virtual-world heartbeat freshness */}
          {(agent.lastActive || agent.secondsSinceHeartbeat != null) && (
            <div className="flex items-center gap-1 mt-1">
              <Clock className="w-2.5 h-2.5 text-[var(--text-4)]" />
              <span className="text-[9px] text-[var(--text-3)]">
                {lastSeenLabel(agent)}
              </span>
            </div>
          )}

          {/* Channel — routing taxonomy tag */}
          {agent.channel && (
            <div className="text-[9px] text-[var(--text-3)] mt-0.5 truncate" title={agent.channel}>
              {agent.channel}
            </div>
          )}
        </div>

        {/* Stats + chat — my-virtual-world card corner */}
        <div className="text-right shrink-0 flex flex-col items-end gap-1">
          {agent.tasksCompleted > 0 && (
            <span
              className="num text-[9px] px-1.5 py-0.5 rounded-full"
              style={{
                background: "var(--surface-3)",
                border: "1px solid var(--line)",
                color: "var(--text-2)",
              }}
            >
              {agent.tasksCompleted}
            </span>
          )}
          {onChat && agent.status !== "offline" && (
            <button
              onClick={() => onChat(agent)}
              className="p-1 rounded transition-colors"
              style={{
                color: "var(--text-3)",
                border: "1px solid var(--line)",
                background: "var(--surface-2)",
              }}
              title={`Chat with ${agent.name}`}
            >
              <MessageCircle className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Recursive org subtree with connecting lines ──
function OrgBranch({
  agent,
  agents,
  onChat,
}: {
  agent: Agent;
  agents: Agent[];
  onChat?: (agent: Agent) => void;
}) {
  const reports = agents.filter((a) => a.reportsTo === agent.id);
  const isCeo = !agent.reportsTo;

  return (
    <div className="flex flex-col items-center w-full">
      <OrgNodeCard agent={agent} isCeo={!!isCeo} onChat={onChat} />

      {reports.length > 0 && (
        <div className="flex flex-col items-center w-full">
          {/* vertical drop from this node to the sibling bridge */}
          <div className="w-px h-4" style={{ background: "var(--line-strong)" }} />
          {/* horizontal bridge spanning all reports */}
          <div className="w-full h-px" style={{ background: "var(--line-strong)" }} />
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-4 w-full">
            {reports.map((child) => (
              <div key={child.id} className="flex flex-col items-center">
                {/* vertical stem down onto each child */}
                <div className="w-px h-4" style={{ background: "var(--line-strong)" }} />
                <OrgBranch agent={child} agents={agents} onChat={onChat} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Scrolling activity ticker (my-virtual-world "what they did last") ──
function ActivityTicker({ agents }: { agents: Agent[] }) {
  const events = agents
    .flatMap((a) =>
      (a.recentActivity ?? []).slice(0, 2).map((ev) => ({
        name: a.name,
        emoji: a.emoji,
        action: ev.action,
      }))
    )
    .slice(0, 8);

  const [idx, setIdx] = useState(0);
  useEffect(() => {
    if (events.length === 0) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % events.length), 4000);
    return () => clearInterval(t);
  }, [events.length]);

  if (events.length === 0) return null;
  const ev = events[idx];

  return (
    <div
      className="flex items-center gap-2 rounded-xl px-4 py-2 max-w-xl mx-auto"
      style={{
        background: "var(--surface-2)",
        border: "1px solid var(--line)",
      }}
    >
      <div className="w-1.5 h-1.5 rounded-full bg-[var(--up)] animate-pulse shrink-0" />
      <span className="text-[10px] font-mono text-[var(--text-3)] shrink-0">
        {ev.name}
      </span>
      <span className="text-[10px] text-[var(--text-2)] truncate">
        {ev.action.slice(0, 80)}
      </span>
    </div>
  );
}

// ── Main export ──
export default function OfficeView({
  agents,
  onChat,
}: {
  agents: Agent[];
  onChat?: (agent: Agent) => void;
}) {
  const ceo = agents.find((a) => !a.reportsTo);
  const ranked = ceo ? [ceo, ...agents.filter((a) => a.id !== ceo.id)] : agents;
  const legend = ["working", "idle", "offline", "error"];

  // 3D city view toggle — default is the 2D org chart (unchanged).
  // Toggling does NOT unmount the roster, so 2D state is preserved.
  const [cityMode, setCityMode] = useState(false);

  const online = agents.filter((a) => a.status !== "offline").length;
  const working = agents.filter((a) => a.status === "working" || a.status === "active").length;

  return (
    <div
      className="relative rounded-[var(--r-lg)] overflow-hidden"
      style={{
        border: "1px solid var(--line)",
        background: "var(--surface-1)",
      }}
    >
      {/* Floor — grid pattern matching the ambient backdrop */}
      <div
        className="relative p-8"
        style={{
          background:
            "repeating-linear-gradient(0deg,transparent,transparent 39px,rgba(212,175,55,0.02) 39px,rgba(212,175,55,0.02) 40px)," +
            "repeating-linear-gradient(90deg,transparent,transparent 39px,rgba(212,175,55,0.02) 39px,rgba(212,175,55,0.02) 40px)",
        }}
      >
        {/* Office sign — my-virtual-world: the org chart "routing / budget taxonomy" */}
        <div className="flex items-center justify-center mb-8">
          <div
            className="flex items-center gap-3 rounded-2xl px-5 py-2"
            style={{
              background: "var(--surface-2)",
              border: "1px solid var(--line)",
            }}
          >
            <div className="w-2 h-2 rounded-full bg-[var(--up)] animate-pulse" />
            <span className="text-xs font-mono font-bold tracking-[0.2em] text-[var(--text-3)] uppercase">
              Blue Mogul AI · Org Chart
            </span>
            <span className="text-[9px] font-mono uppercase tracking-wider text-[var(--text-4)]">
              routing / budget taxonomy
            </span>
            <div className="w-2 h-2 rounded-full bg-[var(--up)] animate-pulse" />
          </div>

          {/* 3D City toggle — swaps the org tree for VirtualCity */}
          <button
            type="button"
            aria-label="Toggle 3D city mode"
            aria-pressed={cityMode}
            onClick={() => setCityMode((v) => !v)}
            className="ml-3 px-3.5 py-1.5 rounded-full text-[11px] font-mono font-semibold tracking-[0.15em] uppercase transition-all"
            style={{
              background: cityMode
                ? "color-mix(in srgb, var(--accent) 18%, transparent)"
                : "var(--surface-1)",
              border: `1px solid ${
                cityMode ? "var(--accent)" : "var(--line)"
              }`,
              color: cityMode ? "var(--accent)" : "var(--text-2)",
              boxShadow: cityMode
                ? "0 0 14px color-mix(in srgb, var(--accent) 30%, transparent)"
                : "none",
            }}
          >
            {cityMode ? "2D Org" : "3D City"}
          </button>
        </div>

        {/* Live stats bar */}
        <div className="flex items-center justify-center gap-6 mb-6">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-[var(--up)]" />
            <span className="text-[11px] text-[var(--text-3)] font-mono">
              {online}/{agents.length} online
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-[var(--accent)] animate-pulse" />
            <span className="text-[11px] text-[var(--text-3)] font-mono">
              {working} working
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-[var(--warn)]" />
            <span className="text-[11px] text-[var(--text-3)] font-mono">
              {agents.reduce((sum, a) => sum + a.tasksCompleted, 0)} tasks
            </span>
          </div>
        </div>

        {/* Org chart tree (2D) OR 3D city — toggled by the header button.
            Only the tree block swaps; the header, stats, ticker and legend
            stay mounted, so 2D state is preserved across toggle. */}
        {cityMode ? (
          <div className="h-[560px] w-full">
            <VirtualCity agents={agents} />
          </div>
        ) : (
          <div className="flex justify-center overflow-x-auto">
            <div className="flex flex-col items-center min-w-max">
              {ceo ? (
                <OrgBranch agent={ceo} agents={agents} onChat={onChat} />
              ) : (
                <div className="text-[12px] text-[var(--text-3)]">
                  No roster loaded.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Activity ticker — my-virtual-world: recent agent activity scrolls */}
        <div className="mt-8">
          <ActivityTicker agents={ranked} />
        </div>
      </div>

      {/* Status legend */}
      <div
        className="border-t px-6 py-3 flex items-center gap-6 flex-wrap"
        style={{ borderTopColor: "var(--line)" }}
      >
        {legend.map((status) => (
          <div key={status} className="flex items-center gap-1.5">
            <div
              className="w-2 h-2 rounded-full"
              style={{
                background: STATUS[status]?.dot ?? "var(--text-4)",
              }}
            />
            <span className="text-[10px] text-[var(--text-3)] font-mono uppercase tracking-wider">
              {status}
            </span>
          </div>
        ))}
        <span className="ml-auto text-[9px] font-mono uppercase tracking-wider text-[var(--text-4)]">
          {agents.reduce((sum, a) => sum + a.tasksCompleted, 0)} tasks ·{" "}
          all roles run on one orchestrator
        </span>
      </div>
    </div>
  );
}
