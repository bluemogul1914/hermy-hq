import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Default org-chart roster — a ROUTING / BUDGET taxonomy, not separate
// autonomous processes. Every role is executed by a single orchestrator but is
// routable and budgeted under its manager's line. `reportsTo` = manager's id
// (null for the CEO).
const DEFAULT_AGENTS = [
  {
    id: "aria",
    name: "Aria",
    emoji: "\uD83D\uDC64",
    role: "CEO \u00B7 Chief Executive / Strategy",
    reportsTo: null,
    status: "online",
    tasksCompleted: 0,
    totalCost: 0,
    recentActivity: [],
  },
  {
    id: "cto-orion",
    name: "CTO Orion",
    emoji: "\uD83D\uDCBB",
    role: "CTO \u00B7 Infrastructure, cloud ops, tech stack",
    reportsTo: "aria",
    status: "idle",
    tasksCompleted: 0,
    totalCost: 0,
    recentActivity: [],
  },
  {
    id: "cloudmaster",
    name: "CLOUDMASTER",
    emoji: "\u2601\uFE0F",
    role: "Managed IT \u00B7 Cloud hosting, deployments",
    reportsTo: "cto-orion",
    status: "idle",
    tasksCompleted: 0,
    totalCost: 0,
    recentActivity: [],
  },
  {
    id: "foreman",
    name: "FOREMAN",
    emoji: "\uD83D\uDCCB",
    role: "PM \u00B7 Ticket triage, projects, client delivery",
    reportsTo: "cto-orion",
    status: "idle",
    tasksCompleted: 0,
    totalCost: 0,
    recentActivity: [],
  },
  {
    id: "morgan",
    name: "Morgan",
    emoji: "\uD83D\uDCB0",
    role: "Sales \u00B7 Pipeline, proposals, ARR",
    reportsTo: "cto-orion",
    status: "idle",
    tasksCompleted: 0,
    totalCost: 0,
    recentActivity: [],
  },
  {
    id: "cro",
    name: "CRO",
    emoji: "\uD83D\uDCC8",
    role: "Revenue \u00B7 Quotes, renewals, rev-ops",
    reportsTo: "morgan",
    status: "idle",
    tasksCompleted: 0,
    totalCost: 0,
    recentActivity: [],
  },
  {
    id: "dealer",
    name: "DEALER",
    emoji: "\uD83D\uDCDD",
    role: "Deal desk \u00B7 Proposals, procurement",
    reportsTo: "morgan",
    status: "idle",
    tasksCompleted: 0,
    totalCost: 0,
    recentActivity: [],
  },
];

export async function GET() {
  // Single source of truth: the LIVE Mission Control fleet (/api/status).
  // Same endpoint the Org (/org) board reads, so both boards always agree.
  const MC_BASE = process.env.MC_URL || "https://mission-control.bluemogul.us";
  const MC_TOKEN = process.env.MC_AUTH_TOKEN || "";
  const order: Record<string, number> = { green: 0, yellow: 1, red: 2, grey: 3 };
  const statusFromHealth: Record<string, string> = {
    green: "online",
    yellow: "idle",
    red: "offline",
    grey: "offline",
  };
  const byDefault = new Map<string, any>(DEFAULT_AGENTS.map((a) => [a.id, a]));

  try {
    const res = await fetch(`${MC_BASE}/api/status`, {
      headers: { "x-mc-token": MC_TOKEN },
      cache: "no-store",
    });
    if (!res.ok) {
      console.error("Agents API: MC upstream", res.status);
      // Fall back to the taxonomy roster, explicitly marked offline (unverified).
      return NextResponse.json(
        DEFAULT_AGENTS.map((a) => ({ ...a, status: "offline" })),
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    const statuses: any[] = await res.json();
    const agents: any[] = statuses.map((s) => {
      const id = String(s.agent_name).toLowerCase();
      const def = byDefault.get(id);
      return {
        id,
        name: def?.name || s.agent_name,
        emoji: def?.emoji || "🤖",
        role: def?.role || "Agent",
        reportsTo: def?.reportsTo ?? "aria",
        status: statusFromHealth[s.health] || s.status || "offline",
        currentTask: s.current_task ?? undefined,
        lastActive: s.last_heartbeat ?? undefined,
        secondsSinceHeartbeat: Number(s.seconds_since_heartbeat),
        tasksCompleted: def?.tasksCompleted ?? 0,
        totalCost: 0,
        recentActivity: [],
      };
    });
    // Keep the org-chart connected: re-point dangling `reportsTo` (e.g.
    // CLOUDMASTER → cto-orion, which isn't a live MC identity) at the CEO
    // so every card renders under a real node instead of being orphaned.
    const ids = new Set(agents.map((a) => a.id));
    for (const a of agents) {
      if (a.reportsTo != null && !ids.has(a.reportsTo)) a.reportsTo = "aria";
    }
    // Ensure exactly one root (CEO) so the office-chart tree renders cleanly.
    const root = agents.find((a: any) => a.reportsTo == null);
    const ceo = root ?? (agents.find((a: any) => a.id === "aria") as any) ?? agents[0];
    if (ceo) ceo.reportsTo = undefined;
    agents.sort((a: any, b: any) => (order[a.status] ?? 9) - (order[b.status] ?? 9));
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

    // Find the default agent info for name/emoji/role
    const defaultAgent = DEFAULT_AGENTS.find((a) => a.id === agentId);

    // Get existing state or create defaults
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
