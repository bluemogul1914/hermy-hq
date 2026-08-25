"use client";

import { useState, useEffect } from "react";

interface AgentActivity {
  timestamp: string;
  action: string;
  result?: string;
}

interface Agent {
  id: string;
  name: string;
  emoji: string;
  role: string;
  reportsTo?: string | null;
  status: string;
  currentTask?: string;
  lastActive?: string;
  tasksCompleted: number;
  totalCost: number;
  recentActivity: AgentActivity[];
}

// ── Status → visual config ────────────────────────────────
const STATUS: Record<string, { dot: string; tint: string; accent: string }> = {
  working:   { dot: "#38bdf8", accent: "var(--accent)",            tint: "rgba(56,189,248,0.12)" },
  idle:      { dot: "#fbbf24", accent: "#fbbf24",                  tint: "rgba(251,191,36,0.10)" },
  error:     { dot: "#f87171", accent: "var(--down)",              tint: "rgba(248,113,113,0.12)" },
  offline:   { dot: "#71717a", accent: "#71717a",                  tint: "rgba(113,113,122,0.06)" },
  online:    { dot: "#34d399", accent: "var(--up)",                tint: "rgba(52,211,153,0.12)" },
  active:    { dot: "#34d399", accent: "var(--up)",                tint: "rgba(52,211,153,0.12)" },
  completed: { dot: "#fbbf24", accent: "#fbbf24",                  tint: "rgba(251,191,36,0.10)" },
};

// ── Single org node card ──────────────────────────────────
function OrgNodeCard({ agent, isCeo }: { agent: Agent; isCeo: boolean }) {
  const colors = STATUS[agent.status] ?? STATUS.idle;
  const isOffline = agent.status === "offline";

  return (
    <div
      className={`panel-interactive ${isCeo ? "px-6 py-4" : "px-4 py-3"}`}
      style={{
        background: colors.tint,
        border: `1px solid color-mix(in srgb, ${colors.accent} 30%, transparent)`,
        borderRadius: "var(--r-md)",
        opacity: isOffline ? 0.45 : 1,
        minWidth: isCeo ? 240 : 190,
        maxWidth: 260,
      }}
    >
      <div className="flex items-start gap-2.5">
        <div
          className="w-9 h-9 rounded-[var(--r-sm)] flex items-center justify-center text-lg shrink-0"
          style={{ background: "var(--surface-2)", border: "1px solid var(--line)" }}
        >
          {agent.emoji}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="relative flex w-2 h-2 shrink-0">
              <span className="inline-flex w-2 h-2 rounded-full" style={{ background: colors.dot }} />
            </span>
            <span className={`font-semibold text-[var(--text)] truncate ${isCeo ? "text-[14px]" : "text-[13px]"}`}>
              {agent.name}
            </span>
          </div>
          <div className="text-[10px] text-[var(--text-3)] mt-0.5 leading-snug">{agent.role}</div>
        </div>
        {agent.tasksCompleted > 0 && (
          <span
            className="num text-[9px] px-1.5 py-0.5 rounded-full ml-auto shrink-0"
            style={{ background: "var(--surface-3)", border: "1px solid var(--line)", color: "var(--text-2)" }}
          >
            {agent.tasksCompleted}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Recursive org subtree ─────────────────────────────────
function OrgBranch({ agent, agents }: { agent: Agent; agents: Agent[] }) {
  const reports = agents.filter(a => a.reportsTo === agent.id);
  const isCeo = !agent.reportsTo;

  return (
    <div className="flex flex-col items-center w-full">
      <OrgNodeCard agent={agent} isCeo={!!isCeo} />

      {reports.length > 0 && (
        <div className="flex flex-col items-center w-full">
          {/* vertical drop from this node to the sibling bridge */}
          <div className="w-px h-4" style={{ background: "var(--line-strong)" }} />
          {/* horizontal bridge spanning all reports */}
          <div className="w-full h-px" style={{ background: "var(--line-strong)" }} />
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-4 w-full">
            {reports.map(child => (
              <div key={child.id} className="flex flex-col items-center">
                {/* vertical stem down onto each child */}
                <div className="w-px h-4" style={{ background: "var(--line-strong)" }} />
                <OrgBranch agent={child} agents={agents} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Scrolling activity ticker ─────────────────────────────
function ActivityTicker({ agents }: { agents: Agent[] }) {
  const events = agents
    .flatMap(a => (a.recentActivity ?? []).slice(0, 2).map(ev => ({ name: a.name, emoji: a.emoji, action: ev.action })))
    .slice(0, 8);

  const [idx, setIdx] = useState(0);
  useEffect(() => {
    if (events.length === 0) return;
    const t = setInterval(() => setIdx(i => (i + 1) % events.length), 4000);
    return () => clearInterval(t);
  }, [events.length]);

  if (events.length === 0) return null;
  const ev = events[idx];

  return (
    <div className="flex items-center gap-2 bg-neutral-900/60 border border-neutral-800/40 rounded-xl px-4 py-2 max-w-xl mx-auto">
      <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
      <span className="text-[10px] text-neutral-500 font-mono shrink-0">{ev.name}</span>
      <span className="text-[10px] text-neutral-400 truncate">{ev.action.slice(0, 80)}</span>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────
export default function OfficeView({ agents }: { agents: Agent[] }) {
  const ceo = agents.find(a => !a.reportsTo);
  const ranked = ceo ? [ceo, ...agents.filter(a => a.id !== ceo.id)] : agents;
  const legend = ["working", "idle", "offline", "error"];

  return (
    <div className="relative rounded-3xl overflow-hidden border border-neutral-800/60 bg-neutral-950/80">
      {/* Floor */}
      <div
        className="relative p-8"
        style={{
          background:
            "repeating-linear-gradient(0deg,transparent,transparent 39px,rgba(255,255,255,0.02) 39px,rgba(255,255,255,0.02) 40px)," +
            "repeating-linear-gradient(90deg,transparent,transparent 39px,rgba(255,255,255,0.02) 39px,rgba(255,255,255,0.02) 40px)",
        }}
      >
        {/* Office sign */}
        <div className="flex items-center justify-center mb-8">
          <div className="flex items-center gap-3 bg-neutral-900/80 border border-neutral-700/40 rounded-2xl px-5 py-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-mono font-bold tracking-[0.2em] text-neutral-400 uppercase">
              Blue Mogul AI · Org Chart
            </span>
            <span className="text-[9px] font-mono uppercase tracking-wider text-neutral-600">
              routing / budget taxonomy
            </span>
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          </div>
        </div>

        {/* Org chart */}
        <div className="flex justify-center overflow-x-auto">
          <div className="flex flex-col items-center min-w-max">
            {ceo ? (
              <OrgBranch agent={ceo} agents={agents} />
            ) : (
              <div className="text-[12px] text-neutral-500">No roster loaded.</div>
            )}
          </div>
        </div>

        {/* Activity ticker */}
        <div className="mt-8">
          <ActivityTicker agents={ranked} />
        </div>
      </div>

      {/* Legend */}
      <div className="border-t border-neutral-800/60 px-6 py-3 flex items-center gap-6 flex-wrap">
        {legend.map(status => (
          <div key={status} className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ background: STATUS[status]?.dot ?? "#71717a" }} />
            <span className="text-[10px] text-neutral-500 uppercase tracking-wider">{status}</span>
          </div>
        ))}
        <span className="ml-auto text-[9px] uppercase tracking-wider text-neutral-700">
          {agents.reduce((sum, a) => sum + a.tasksCompleted, 0)} tasks · all roles run on one orchestrator
        </span>
      </div>
    </div>
  );
}