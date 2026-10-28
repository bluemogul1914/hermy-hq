"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import OfficeView from "@/components/OfficeView";
import { AgentChat, ChatAgent } from "@/components/AgentChat";

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
  channel?: string;
  secondsSinceHeartbeat?: number;
  tasksCompleted: number;
  totalCost: number;
  recentActivity: AgentActivity[];
}

const statusConfig: Record<string, { color: string; dot: string; label: string; pulse?: boolean }> = {
  idle: { color: "var(--warn)", dot: "var(--warn)", label: "Idle" },
  working: { color: "var(--accent)", dot: "var(--accent)", label: "Working", pulse: true },
  error: { color: "var(--down)", dot: "var(--down)", label: "Error" },
  offline: { color: "var(--text-3)", dot: "var(--text-4)", label: "Offline" },
  online: { color: "var(--up)", dot: "var(--up)", label: "Online", pulse: true },
  active: { color: "var(--up)", dot: "var(--up)", label: "Active", pulse: true },
  mixed: { color: "var(--warn)", dot: "var(--warn)", label: "Partial" },
};

const roleColors: Record<string, string> = {
  jackie:      "from-indigo-500/20 to-indigo-600/5 border-indigo-500/20",
  hunter:      "from-amber-500/20 to-amber-600/5 border-amber-500/20",
  closer:      "from-rose-500/20 to-rose-600/5 border-rose-500/20",
  dev:         "from-cyan-500/20 to-cyan-600/5 border-cyan-500/20",
  warden:      "from-emerald-500/20 to-emerald-600/5 border-emerald-500/20",
  cloudmaster: "from-sky-500/20 to-sky-600/5 border-sky-500/20",
  scout:       "from-purple-500/20 to-purple-600/5 border-purple-500/20",
  forge:       "from-orange-500/20 to-orange-600/5 border-orange-500/20",
  muse:        "from-pink-500/20 to-pink-600/5 border-pink-500/20",
  strategist:  "from-amber-500/20 to-amber-600/5 border-amber-500/20",
  lex:         "from-slate-500/20 to-slate-600/5 border-slate-500/20",
  accountant:  "from-green-500/20 to-green-600/5 border-green-500/20",
  publisher:   "from-blue-500/20 to-blue-600/5 border-blue-500/20",
  pathfinder:  "from-lime-500/20 to-lime-600/5 border-lime-500/20",
  pixel:       "from-fuchsia-500/20 to-fuchsia-600/5 border-fuchsia-500/20",
  sentinel:    "from-red-500/20 to-red-600/5 border-red-500/20",
  mentor:      "from-yellow-500/20 to-yellow-600/5 border-yellow-500/20",
  veritas:     "from-teal-500/20 to-teal-600/5 border-teal-500/20",
  atlas:       "from-indigo-500/20 to-indigo-600/5 border-indigo-500/20",
  scribe:      "from-stone-500/20 to-stone-600/5 border-stone-500/20",
  care:        "from-rose-500/20 to-rose-600/5 border-rose-500/20",
  coursebuilder:"from-indigo-500/20 to-indigo-600/5 border-indigo-500/20",
  jcode:       "from-cyan-500/20 to-cyan-600/5 border-cyan-500/20",
  cro:         "from-purple-500/20 to-purple-600/5 border-purple-500/20",
  cmo:         "from-pink-500/20 to-pink-600/5 border-pink-500/20",
  commander:   "from-amber-500/20 to-amber-600/5 border-amber-500/20",
  coo:         "from-emerald-500/20 to-emerald-600/5 border-emerald-500/20",
  guardian:    "from-red-500/20 to-red-600/5 border-red-500/20",
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

function AgentCard({ agent, isExpanded, onToggle }: { agent: Agent; isExpanded: boolean; onToggle: () => void }) {
  const status = statusConfig[agent.status] || statusConfig.offline;

  return (
    <div className="panel panel-interactive overflow-hidden">
      {/* Main card */}
      <div className="p-5 cursor-pointer" onClick={onToggle}>
        <div className="flex items-start gap-3.5">
          {/* Avatar */}
          <div className="w-12 h-12 rounded-[var(--r-md)] flex items-center justify-center text-2xl shrink-0"
            style={{ background: "var(--surface-2)", border: "1px solid var(--line)" }}>
            {agent.emoji}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="relative flex w-2 h-2 shrink-0">
                {status.pulse && <span className="absolute inline-flex h-full w-full rounded-full opacity-60 animate-ping" style={{ background: status.dot }} />}
                <span className="relative inline-flex w-2 h-2 rounded-full" style={{ background: status.dot }} />
              </span>
              <h3 className="text-[14px] font-semibold text-[var(--text)]">{agent.name}</h3>
              <span className="text-[10px] font-medium" style={{ color: status.color }}>{status.label}</span>
            </div>
            <p className="text-[12px] text-[var(--text-3)] mt-1">{agent.role}</p>

            {/* Current task */}
            {agent.currentTask && agent.status === "working" && (
              <p className="text-[12px] mt-2 truncate" style={{ color: "var(--accent)" }}>{agent.currentTask}</p>
            )}
          </div>

          {/* Stats */}
          <div className="text-right shrink-0">
            <div className="num text-[22px] font-semibold text-[var(--text)] leading-none">{agent.tasksCompleted}</div>
            <div className="eyebrow mt-1.5">tasks</div>
            {agent.lastActive && (
              <div className="num text-[10px] text-[var(--text-4)] mt-1">{timeAgo(agent.lastActive)}</div>
            )}
          </div>
        </div>
      </div>

      {/* Expanded activity feed */}
      {isExpanded && (
        <div className="px-5 py-4 space-y-2.5" style={{ borderTop: "1px solid var(--line)" }}>
          <h4 className="eyebrow">Recent Activity</h4>
          {agent.recentActivity.length === 0 ? (
            <p className="text-[12px] text-[var(--text-3)] py-2">No activity yet</p>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {agent.recentActivity.slice(0, 10).map((activity, i) => (
                <div key={i} className="flex items-start gap-2.5 text-[12px]">
                  <span className="num text-[var(--text-4)] shrink-0 w-14">{timeAgo(activity.timestamp)}</span>
                  <span className="text-[var(--text-2)]">{activity.action}</span>
                  {activity.result && (
                    <span className="text-[var(--text-3)] ml-auto truncate max-w-[200px]">{activity.result}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Compact org-chart tree (Cards view's "Team Structure") ──
function OrgMiniCard({ agent }: { agent: Agent }) {
  const status = statusConfig[agent.status] || statusConfig.offline;
  const isOffline = agent.status === "offline";
  return (
    <div className="flex items-center gap-2.5 rounded-[var(--r-md)] px-3.5 py-2.5"
      style={{ background: "var(--surface-1)", border: "1px solid var(--line)", opacity: isOffline ? 0.5 : 1 }}>
      <div className="w-6 h-6 rounded-[var(--r-sm)] flex items-center justify-center text-sm shrink-0"
        style={{ background: "var(--surface-2)", border: "1px solid var(--line)" }}>
        {agent.emoji}
      </div>
      <div>
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: status.dot }} />
          <span className="text-[12px] font-semibold text-[var(--text)]">{agent.name}</span>
        </div>
        <div className="text-[10px] text-[var(--text-3)]">{agent.role}</div>
      </div>
    </div>
  );
}

function OrgTree({ agent, agents }: { agent: Agent; agents: Agent[] }) {
  const reports = agents.filter(a => a.reportsTo === agent.id);
  if (!reports.length) return <OrgMiniCard agent={agent} />;
  return (
    <div className="flex flex-col items-center">
      <OrgMiniCard agent={agent} />
      <div className="w-px h-5" style={{ background: "var(--line-strong)" }} />
      <div className="flex flex-wrap justify-center gap-x-3 gap-y-4">
        {reports.map(child => (
          <div key={child.id} className="flex flex-col items-center">
            <div className="w-px h-4" style={{ background: "var(--line-strong)" }} />
            <OrgTree agent={child} agents={agents} />
          </div>
        ))}
      </div>
    </div>
  );
}

function OrgChart({ agents }: { agents: Agent[] }) {
  const ceo = agents.find(a => !a.reportsTo);
  if (!ceo) return <p className="text-[12px] text-[var(--text-3)] text-center py-4">No roster loaded.</p>;
  return (
    <div className="flex flex-col items-center gap-2">
      <OrgTree agent={ceo} agents={agents} />
    </div>
  );
}

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);
  const [view, setView] = useState<"cards" | "office">("office");
  const [chatAgent, setChatAgent] = useState<ChatAgent | null>(null);

  const loadAgents = useCallback(async () => {
    try {
      const res = await fetch("/api/agents");
      const data = await res.json();
      setAgents(Array.isArray(data) ? data : []);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    loadAgents();
    const interval = setInterval(loadAgents, 10000); // poll every 10s
    return () => clearInterval(interval);
  }, [loadAgents]);

  if (loading) {
    return (
      <div className="relative min-h-screen p-8">
        <div className="relative z-10 w-full mx-auto grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="sk h-32 rounded-[var(--r-lg)]" />)}
        </div>
      </div>
    );
  }

  const ceoAgent = agents.find(a => !a.reportsTo);
  const teamAgents = agents.filter(a => a.reportsTo && a.id !== ceoAgent?.id);
  const online = agents.filter(a => a.status !== "offline").length;
  const working = agents.filter(a => a.status === "working").length;
  const totalTasks = agents.reduce((sum, a) => sum + a.tasksCompleted, 0);

  return (
    <>
      <div className="relative z-10 w-full mx-auto text-[var(--text)] p-8 pb-16 space-y-8">
      {/* Header */}
      <div className="hq-rise flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="eyebrow mb-2.5">Agent HQ</div>
          <h1 className="text-[32px] font-semibold tracking-[-0.025em] leading-none text-[var(--text)]">Your AI Team</h1>
          <p className="text-[13px] text-[var(--text-3)] mt-3">Working 24/7</p>
        </div>
        <div className="flex items-center gap-6">
          {/* Stats */}
          <div className="flex gap-7 text-center">
            <div>
              <div className="num text-[22px] font-semibold leading-none" style={{ color: "var(--up)" }}>{online}<span className="text-[var(--text-4)]">/{agents.length}</span></div>
              <div className="eyebrow mt-1.5">Online</div>
            </div>
            <div>
              <div className="num text-[22px] font-semibold leading-none" style={{ color: "var(--accent)" }}>{working}</div>
              <div className="eyebrow mt-1.5">Working</div>
            </div>
            <div>
              <div className="num text-[22px] font-semibold leading-none text-[var(--text)]">{totalTasks}</div>
              <div className="eyebrow mt-1.5">Total Tasks</div>
            </div>
          </div>
          {/* View toggle */}
          <div className="flex rounded-full p-1 gap-1" style={{ border: "1px solid var(--line)" }}>
            <button
              onClick={() => setView("office")}
              className={`px-3.5 py-1.5 rounded-full text-[12px] font-medium transition-colors ${
                view === "office"
                  ? "bg-white/[0.08] text-[var(--text)]"
                  : "text-[var(--text-3)] hover:text-[var(--text-2)]"
              }`}
            >
              Office
            </button>
            <button
              onClick={() => setView("cards")}
              className={`px-3.5 py-1.5 rounded-full text-[12px] font-medium transition-colors ${
                view === "cards"
                  ? "bg-white/[0.08] text-[var(--text)]"
                  : "text-[var(--text-3)] hover:text-[var(--text-2)]"
              }`}
            >
              Cards
            </button>
          </div>
        </div>
      </div>

      {/* Live Agent Chat Modal */}
      {chatAgent && <AgentChat agent={chatAgent} onClose={() => setChatAgent(null)} />}

      {/* Office View */}
      {view === "office" && (
        <>
          <OfficeView agents={agents} onChat={(a) => setChatAgent(a)} />
          {/* Chat quick-launch strip */}
          <div className="flex flex-wrap gap-2 pt-2">
            {teamAgents
              .filter((a) => a.status !== "offline")
              .map((a) => (
                <button key={a.id} onClick={() => setChatAgent(a)}
                className="flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[12px] text-[var(--text-2)] transition-colors panel-interactive"
                style={{ background: "var(--surface-1)", border: "1px solid var(--line)" }}>
                <span>{a.emoji}</span> Chat with {a.name}
              </button>
            ))}
            {ceoAgent && ceoAgent.status !== "offline" && (
              <button onClick={() => setChatAgent(ceoAgent)}
                className="flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[12px] transition-colors"
                style={{ color: "var(--accent)", background: "color-mix(in srgb, var(--accent) 10%, transparent)", border: "1px solid color-mix(in srgb, var(--accent) 28%, transparent)" }}>
                {ceoAgent.emoji} Chat with {ceoAgent.name}
              </button>
            )}
          </div>
        </>
      )}

      {/* Cards View */}
      {view === "cards" && (
        <>
          {/* Chief Executive (Aria) — full width */}
          {ceoAgent && (
            <AgentCard
              agent={ceoAgent}
              isExpanded={expandedAgent === ceoAgent.id}
              onToggle={() => setExpandedAgent(expandedAgent === ceoAgent.id ? null : ceoAgent.id)}
            />
          )}

          {/* Team grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {teamAgents.map(agent => (
              <AgentCard
                key={agent.id}
                agent={agent}
                isExpanded={expandedAgent === agent.id}
                onToggle={() => setExpandedAgent(expandedAgent === agent.id ? null : agent.id)}
              />
            ))}
          </div>

          {/* Org chart visual */}
          <div className="pt-6" style={{ borderTop: "1px solid var(--line)" }}>
            <div className="eyebrow mb-5">Team Structure</div>
            <OrgChart agents={agents} />
          </div>
        </>
      )}
      </div>
    </>
  );
}
