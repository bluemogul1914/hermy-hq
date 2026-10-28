"use client";

/* ───────────────────────────────────────────────────────────
   Blue Mogul AI · Org
   The fleet roster + health: every agent Mission Control knows
   about, its current task, channel, and heartbeat freshness.
   Live from /api/status through the /api/mc proxy.
   ─────────────────────────────────────────────────────────── */

import { useEffect, useState } from "react";
import { Users } from "lucide-react";
import { rise, Panel, Pill, EmptyState } from "@/components/ui/kit";
import { PageHeader, ErrorState, LoadingGrid } from "@/components/mc/ui";
import { mcGetSafe } from "@/lib/mc";

interface Agent {
  agent_name: string;
  channel: string | null;
  status: string;
  current_task: string | null;
  last_heartbeat: string | null;
  seconds_since_heartbeat: number | null;
  health: "grey" | "green" | "yellow" | "red";
}

const HEALTH_LABEL: Record<Agent["health"] | "none", string> = {
  green: "Healthy",
  yellow: "Stale",
  red: "Offline",
  grey: "Never reported",
  none: "—",
};

const HEALTH_COLOR: Record<Agent["health"] | "none", string> = {
  green: "var(--up)",
  yellow: "var(--warn)",
  red: "var(--down)",
  grey: "var(--text-4)",
  none: "var(--text-4)",
};

// Map MC /api/status agent format to the Org page's Agent interface.
// MC v2026.10.24 returns {id, name, status, last_activity, ...}
// while older MC versions returned {agent_name, health, last_heartbeat, ...}.
function mapMcAgent(s: any): Agent {
  const now = Date.now() / 1000;
  const lastActivity = s.last_heartbeat || s.last_activity;
  const secondsSince = lastActivity
    ? Math.max(0, Math.floor(now - lastActivity))
    : null;

  let health: Agent["health"] = "grey";
  if (s.health) {
    health = s.health;
  } else if (s.status) {
    const mcStatus = String(s.status).toLowerCase();
    if (mcStatus.includes("online") || mcStatus.includes("active") || mcStatus.includes("working") || mcStatus.includes("up")) {
      health = "green";
    } else if (mcStatus.includes("idle") || mcStatus.includes("stale")) {
      health = "yellow";
    } else if (mcStatus.includes("offline") || mcStatus.includes("dead") || mcStatus.includes("down")) {
      health = "red";
    }
  }

  return {
    agent_name: s.agent_name || s.name || s.id || "",
    channel: s.channel || null,
    status: s.status || "unknown",
    current_task: s.current_task || null,
    last_heartbeat: lastActivity ? new Date(lastActivity * 1000).toISOString() : null,
    seconds_since_heartbeat: secondsSince,
    health,
  };
}

export default function OrgPage() {
  const [agents, setAgents] = useState<Agent[] | null>(null);
  const [error, setError] = useState<string | null>(null);

useEffect(() => {
  (async () => {
    const d = await mcGetSafe<{ agents?: any[] } | any[]>("/status");
    if (!d) {
      setError("status read failed");
      setAgents([]);
      return;
    }
    // MC wraps agents in { agents: [...] } around v2026.10.24
    const mcAgents: any[] = Array.isArray(d)
      ? (d as any[])
      : (d as { agents?: any[] }).agents ?? [];
    setAgents(mcAgents.map(mapMcAgent));
  })();
}, []);

  if (error && !agents) {
    return (
      <div className="w-full mx-auto pt-2 max-w-5xl">
        <PageHeader eyebrow="Company" title="Organization" />
        <ErrorState message={error} />
      </div>
    );
  }
  if (!agents) {
    return (
      <div className="w-full mx-auto pt-2 max-w-5xl">
        <PageHeader eyebrow="Company" title="Organization" />
        <LoadingGrid n={3} />
      </div>
    );
  }

  const count = (h: Agent["health"]) => agents.filter((a) => a.health === h).length;
  const online = count("green");
  const order = { green: 0, yellow: 1, red: 2, grey: 3 } as const;
  const sorted = [...agents].sort((a, b) => order[a.health] - order[b.health]);

  const lastBeat = (a: Agent): string => {
    if (a.health === "grey") return "never";
    const s = a.seconds_since_heartbeat;
    if (s == null) return "—";
    if (s < 900) return "now";
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    return `${Math.floor(s / 3600)}h ago`;
  };

  return (
    <div className="w-full mx-auto pt-2 max-w-5xl">
      <PageHeader
        eyebrow="Company"
        title="Organization"
        sub={`Agent roster and fleet health. ${online} of ${agents.length} reporting in the last 15 minutes.`}
      />

      {/* Health legend */}
      <div className="flex items-center gap-4 mb-5 text-[12px] text-[var(--text-3)] hq-rise" style={rise(0)}>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: HEALTH_COLOR.green }} /> {count("green")} healthy</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: HEALTH_COLOR.yellow }} /> {count("yellow")} stale</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: HEALTH_COLOR.red }} /> {count("red")} offline</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: HEALTH_COLOR.grey }} /> {count("grey")} unconfigured</span>
      </div>

      {sorted.length === 0 ? (
        <Panel className="p-6">
          <EmptyState icon={<Users className="w-6 h-6" />} title="No agents registered" />
        </Panel>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 hq-rise" style={rise(0)}>
          {sorted.map((a, i) => (
            <Panel key={a.agent_name} className="p-4 hq-rise" style={rise(i % 3)}>
              <div className="flex items-center justify-between gap-2 mb-2.5">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="relative flex w-2 h-2 shrink-0">
                    <span
                      className="absolute inline-flex h-full w-full rounded-full opacity-50"
                      style={{ background: HEALTH_COLOR[a.health], animation: a.health === "green" ? "pulse 2s ease-out infinite" : "none" }}
                    />
                    <span className="relative inline-flex w-2 h-2 rounded-full" style={{ background: HEALTH_COLOR[a.health] }} />
                  </span>
                  <span className="text-[14px] font-semibold text-[var(--text)] truncate">
                    {a.agent_name}
                  </span>
                </div>
                <Pill tone={a.health === "green" ? "up" : a.health === "yellow" ? "warn" : a.health === "red" ? "down" : "neutral"}>
                  {HEALTH_LABEL[a.health]}
                </Pill>
              </div>

              <div className="space-y-1.5 text-[12.5px]">
                <div className="flex justify-between">
                  <span className="text-[var(--text-3)]">State</span>
                  <span className="text-[var(--text-2)] capitalize">{a.status || "idle"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-3)]">Last heartbeat</span>
                  <span className="num text-[var(--text-2)]">{lastBeat(a)}</span>
                </div>
                {a.channel && (
                  <div className="flex justify-between">
                    <span className="text-[var(--text-3)]">Channel</span>
                    <span className="text-[var(--text-2)]">{a.channel}</span>
                  </div>
                )}
              </div>

              {a.current_task && (
                <div className="mt-3 pt-3 border-t border-[var(--line)]">
                  <div className="eyebrow !text-[10px] mb-1">Current task</div>
                  <p className="text-[12.5px] text-[var(--text-2)] leading-snug line-clamp-2">{a.current_task}</p>
                </div>
              )}
            </Panel>
          ))}
        </div>
      )}
    </div>
  );
}