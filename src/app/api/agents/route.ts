import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// ─────────────────────────────────────────────────────────────────
// Blue Mogul Hermes Fleet Roster — the source-of-truth org chart.
// Based on the fleet roster: 24 profiles (23 active + 1 deleted).
// 8 with MCP bridge staging tokens, 15 without (DEV proxies STRATEGIST).
// reportsTo = manager's id (null/undefined for the CEO/JACKIE).
// ─────────────────────────────────────────────────────────────────
const DEFAULT_AGENTS = [
  // ── Executive layer ──
  { id: "jackie", name: "JACKIE", emoji: "👤", role: "Chief of Staff & Coordinator — Fleet orchestrator since ARIA stood down", reportsTo: null, status: "online", tasksCompleted: 0, totalCost: 0, recentActivity: [], channel: "#command" },
  // ── Active with MCP bridge staging tokens ──
  { id: "hunter", name: "HUNTER", emoji: "🔍", role: "Lead Discovery & Research — Revenue pipeline, prospect qualification", reportsTo: "jackie", status: "idle", tasksCompleted: 0, totalCost: 0, recentActivity: [], channel: "#sales" },
  { id: "closer", name: "CLOSER", emoji: "🤖", role: "Sales Messaging & Proposals — Outreach drafts, sales prep", reportsTo: "jackie", status: "idle", tasksCompleted: 0, totalCost: 0, recentActivity: [], channel: "#close" },
  { id: "dev", name: "DEV", emoji: "🔧", role: "Developer / Proxy — Code patches, service offer proxy for STRATEGIST", reportsTo: "jackie", status: "idle", tasksCompleted: 0, totalCost: 0, recentActivity: [], channel: "#command" },
  { id: "warden", name: "WARDEN", emoji: "🛡️", role: "Security & Audit — Credential hardening, infrastructure verification", reportsTo: "jackie", status: "idle", tasksCompleted: 0, totalCost: 0, recentActivity: [], channel: "#security" },
  { id: "cloudmaster", name: "CLOUDMASTER", emoji: "☁️", role: "Infrastructure — Production topology, consumer inventory", reportsTo: "jackie", status: "idle", tasksCompleted: 0, totalCost: 0, recentActivity: [], channel: "#ops" },
  { id: "scout", name: "SCOUT", emoji: "🛰️", role: "Research & Scheduling — Tier-1 contact research, cron scheduling", reportsTo: "jackie", status: "idle", tasksCompleted: 0, totalCost: 0, recentActivity: [], channel: "#ops" },
  { id: "forge", name: "FORGE", emoji: "🔗", role: "Backend Integration — Connect portal, dealer functions", reportsTo: "jackie", status: "idle", tasksCompleted: 0, totalCost: 0, recentActivity: [], channel: "#command" },
  // ── Profiles on disk (no MCP staging token) ──
  { id: "muse", name: "MOGUL-BRAND", emoji: "🎨", role: "Brand identity — Brand management", reportsTo: "jackie", status: "idle", tasksCompleted: 0, totalCost: 0, recentActivity: [], channel: "#brand" },
  { id: "strategist", name: "STRATEGIST", emoji: "🧭", role: "Strategic planning & product strategy — Service offers", reportsTo: "dev", status: "idle", tasksCompleted: 0, totalCost: 0, recentActivity: [], channel: "#command" },
  { id: "lex", name: "LEX", emoji: "⚖️", role: "Legality — Legal review, compliance", reportsTo: "jackie", status: "idle", tasksCompleted: 0, totalCost: 0, recentActivity: [], channel: "#command" },
  { id: "accountant", name: "ACCOUNTANT", emoji: "💰", role: "Client-facing: 'Dana, Accounts' — Bookkeeping, margin calculations", reportsTo: "jackie", status: "idle", tasksCompleted: 0, totalCost: 0, recentActivity: [], channel: "#finance" },
  { id: "publisher", name: "PUBLISHER", emoji: "📦", role: "Content publishing — Owns task C5", reportsTo: "jackie", status: "idle", tasksCompleted: 0, totalCost: 0, recentActivity: [], channel: "#brand" },
  { id: "pathfinder", name: "PATHFINDER", emoji: "🧭", role: "Pathfinding — Assigned to task C6", reportsTo: "jackie", status: "idle", tasksCompleted: 0, totalCost: 0, recentActivity: [], channel: "#command" },
  { id: "pixel", name: "PIXEL", emoji: "🎭", role: "Blue Mogul's UX/UI design specification agent", reportsTo: "jackie", status: "idle", tasksCompleted: 0, totalCost: 0, recentActivity: [], channel: "#brand" },
  { id: "sentinel", name: "SENTINEL", emoji: "👁️", role: "Security monitoring", reportsTo: "warden", status: "idle", tasksCompleted: 0, totalCost: 0, recentActivity: [], channel: "#security" },
  { id: "mentor", name: "MENTOR", emoji: "🎓", role: "Mentoring — Knowledge transfer, team guidance", reportsTo: "jackie", status: "idle", tasksCompleted: 0, totalCost: 0, recentActivity: [], channel: "#command" },
  { id: "veritas", name: "VERITAS", emoji: "🔍", role: "Truth/accuracy verification — Fact-checking, validation", reportsTo: "jackie", status: "idle", tasksCompleted: 0, totalCost: 0, recentActivity: [], channel: "#command" },
  { id: "atlas", name: "ATLAS", emoji: "🗺️", role: "General orchestration tasks — Workflow coordination", reportsTo: "jackie", status: "idle", tasksCompleted: 0, totalCost: 0, recentActivity: [], channel: "#command" },
  { id: "scribe", name: "SCRIBE", emoji: "✍️", role: "Content writing — Articles, documentation, copy", reportsTo: "jackie", status: "idle", tasksCompleted: 0, totalCost: 0, recentActivity: [], channel: "#brand" },
  { id: "care", name: "CARE", emoji: "🤝", role: "Customer care — Support, community management", reportsTo: "jackie", status: "idle", tasksCompleted: 0, totalCost: 0, recentActivity: [], channel: "#command" },
  { id: "coursebuilder", name: "COURSEBUILDER", emoji: "📚", role: "Learning/training content — BM Academy courses", reportsTo: "publisher", status: "idle", tasksCompleted: 0, totalCost: 0, recentActivity: [], channel: "#brand" },
  { id: "jcode", name: "JCODE", emoji: "💻", role: "Code tooling — JCode CLI harness", reportsTo: "dev", status: "idle", tasksCompleted: 0, totalCost: 0, recentActivity: [], channel: "#command" },
  // ── MC live agents (synced from MC /api/status, with fallback metadata) ──
  { id: "cro", name: "CRO", emoji: "📈", role: "Revenue Officer — Quotes, renewals, rev-ops", reportsTo: "jackie", status: "idle", tasksCompleted: 0, totalCost: 0, recentActivity: [], channel: "#sales" },
  { id: "cmo", name: "CMO", emoji: "📢", role: "Chief Marketing Officer — Brand, campaigns", reportsTo: "jackie", status: "idle", tasksCompleted: 0, totalCost: 0, recentActivity: [], channel: "#brand" },
  { id: "commander", name: "COMMANDER", emoji: "🎖️", role: "Command — Task orchestration, agent dispatch", reportsTo: "jackie", status: "idle", tasksCompleted: 0, totalCost: 0, recentActivity: [], channel: "#command" },
  { id: "coo", name: "COO", emoji: "⚙️", role: "Chief Operations Officer — Ops coordination", reportsTo: "jackie", status: "idle", tasksCompleted: 0, totalCost: 0, recentActivity: [], channel: "#ops" },
  { id: "guardian", name: "GUARDIAN", emoji: "👁️", role: "Security monitoring — Threat detection", reportsTo: "warden", status: "idle", tasksCompleted: 0, totalCost: 0, recentActivity: [], channel: "#security" },
];

export async function GET() {
  // Single source of truth: the LIVE Mission Control fleet (/api/status).
  // Same endpoint the Org (/org) board reads, so both boards always agree.
  const MC_BASE = process.env.MC_URL || "http://172.18.0.1:3200";
  const MC_TOKEN = process.env.MC_AUTH_TOKEN || "";
  const order: Record<string, number> = { green: 0, yellow: 1, grey: 2, red: 3 };
  const statusFromHealth: Record<string, string> = {
    green: "online",
    yellow: "idle",
    red: "offline",
    grey: "offline",
  };
  const byId = new Map<string, any>();
  DEFAULT_AGENTS.forEach((a) => byId.set(a.id.toLowerCase(), a));

  try {
    const res = await fetch(`${MC_BASE}/api/status`, {
      headers: { "x-mc-token": MC_TOKEN },
      cache: "no-store",
    });
    if (!res.ok) {
      console.error("Agents API: MC upstream", res.status);
      return NextResponse.json(
        DEFAULT_AGENTS.map((a) => ({ ...a, status: "offline" })),
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    const data: any = await res.json();
    // MC /api/status returns a bare array of agent statuses
    const statuses: any[] = Array.isArray(data) ? data : (data.agents || data);
    const now = Date.now() / 1000;
    const agents: any[] = statuses.map((s) => {
      const id = String(s.agent_name || s.name || s.id || "unknown").toLowerCase();
      const def = byId.get(id) || byId.get(id.replace(/[^a-z0-9]/g, "-"));
      // Derive health from MC status
      let health = s.health;
      if (!health && s.status) {
        const mcStatus = String(s.status).toLowerCase();
        if (mcStatus.includes("online") || mcStatus.includes("active") || mcStatus.includes("working") || mcStatus.includes("up")) {
          health = "green";
        } else if (mcStatus.includes("idle") || mcStatus.includes("stale")) {
          health = "yellow";
        } else if (mcStatus.includes("offline") || mcStatus.includes("dead") || mcStatus.includes("down")) {
          health = "red";
        } else {
          health = "grey";
        }
      }
      if (!health) health = "grey";
      const lastActivity = s.last_heartbeat || s.last_activity;
      let lastActiveDate: Date | null = null;
      if (lastActivity) {
        if (typeof lastActivity === "number") {
          lastActiveDate = new Date(lastActivity * 1000);
        } else {
          lastActiveDate = new Date(lastActivity);
        }
      }
      const secondsSince = lastActiveDate
        ? Math.max(0, Math.floor((Date.now() - lastActiveDate.getTime()) / 1000))
        : (s.seconds_since_heartbeat ? parseFloat(s.seconds_since_heartbeat) : 0);
      return {
        id,
        name: def?.name || s.agent_name || s.name || s.id || "Unknown",
        emoji: def?.emoji || "🤖",
        role: def?.role || s.role || "Agent",
        channel: def?.channel || s.channel || "#general",
        reportsTo: def?.reportsTo ?? "jackie",
        status: statusFromHealth[health as string] || s.status || "offline",
        currentTask: s.current_task ?? undefined,
        lastActive: lastActiveDate?.toISOString(),
        secondsSinceHeartbeat: secondsSince,
        tasksCompleted: def?.tasksCompleted ?? 0,
        totalCost: 0,
        recentActivity: [],
      };
    });
    // Merge: ensure all DEFAULT_AGENTS appear even if MC doesn't report them
    const mcIds = new Set(agents.map((a) => a.id));
    for (const def of DEFAULT_AGENTS) {
      if (!mcIds.has(def.id.toLowerCase())) {
        agents.push({ ...def, status: "offline" });
      }
    }
    // Keep the org-chart connected: re-point dangling reportsTo at the CEO
    const ids = new Set(agents.map((a) => a.id));
    for (const a of agents) {
      if (a.reportsTo != null && !ids.has(a.reportsTo)) a.reportsTo = "jackie";
    }
    // Ensure exactly one root (CEO)
    const root = agents.find((a: any) => a.reportsTo == null || a.reportsTo === undefined);
    const ceo = root ?? (agents.find((a: any) => a.id === "jackie") as any) ?? agents[0];
    if (ceo) ceo.reportsTo = undefined;
    agents.sort((a: any, b: any) => (order[a.status === "online" ? "green" : a.status === "idle" ? "yellow" : "grey"] ?? 9) - (order[b.status === "online" ? "green" : b.status === "idle" ? "yellow" : "grey"] ?? 9));
    return NextResponse.json(agents, {
      headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
    });
  } catch (err) {
    console.error("Agents API error:", String(err));
    return NextResponse.json(
      DEFAULT_AGENTS.map((a) => ({ ...a, status: "offline" })),
      { headers: { "Cache-Control": "no-store" }, status: 200 },
    );
  }
}

// POST to update agent state (called by cron jobs)
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { agentId, action, status, currentTask } = body;

    if (!agentId) {
      return NextResponse.json({ error: "agentId required" }, { status: 400 });
    }

    const defaultAgent = DEFAULT_AGENTS.find((a) => a.id === agentId);
    let existing = await prisma.agentState.findUnique({ where: { id: agentId } });

    const recentActivity = (existing?.recentActivity as any[]) || [];
    const newRecentActivity = action
      ? [
          { timestamp: new Date().toISOString(), action },
          ...recentActivity.slice(0, 19),
        ]
      : recentActivity;

    const updatedState = await prisma.agentState.upsert({
      where: { id: agentId },
      update: {
        ...(status ? { status } : {}),
        ...(currentTask !== undefined ? { currentTask } : {}),
        lastActive: new Date(),
        ...(action
          ? {
              recentActivity: newRecentActivity,
              tasksCompleted: (existing?.tasksCompleted || 0) + 1,
            }
          : {}),
      },
      create: {
        id: agentId,
        name: defaultAgent?.name || agentId,
        emoji: defaultAgent?.emoji,
        role: defaultAgent?.role,
        status: status || "idle",
        currentTask: currentTask || null,
        lastActive: new Date(),
        tasksCompleted: action ? 1 : 0,
        totalCost: 0,
        recentActivity: newRecentActivity,
      },
    });

    return NextResponse.json({ ok: true, agent: updatedState });
  } catch (error) {
    console.error("Agent update error:", error);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}