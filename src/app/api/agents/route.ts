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
  try {
    const states = await prisma.agentState.findMany();
    const stateMap: Record<string, any> = {};
    for (const s of states) {
      stateMap[s.id] = s;
    }

    const agents = DEFAULT_AGENTS.map((agent) => {
      const s = stateMap[agent.id] || {};
      return {
        ...agent,
        status: s.status || agent.status,
        currentTask: s.currentTask || undefined,
        lastActive: s.lastActive || undefined,
        tasksCompleted: s.tasksCompleted || agent.tasksCompleted,
        totalCost: s.totalCost || agent.totalCost,
        recentActivity: s.recentActivity || agent.recentActivity,
      };
    });

    return NextResponse.json(agents, {
      headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
    });
  } catch (error) {
    console.error("Agents API error:", error);
    return NextResponse.json(DEFAULT_AGENTS, { status: 200 });
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
