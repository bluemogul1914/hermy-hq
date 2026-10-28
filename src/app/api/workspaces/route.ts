import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const MC_BASE = process.env.MC_URL || "http://172.18.0.1:3200";
const MC_TOKEN = process.env.MC_AUTH_TOKEN || "";

async function mcFetch(path: string): Promise<any> {
  try {
    const res = await fetch(`${MC_BASE}/api/${path}`, {
      headers: MC_TOKEN ? { "x-mc-token": MC_TOKEN } : {},
      cache: "no-store",
    });
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

export async function GET() {
  const board = await mcFetch("board");
  const goals = await mcFetch("goals");
  const workspaces: any[] = [];

  const columnNames: Record<string, string> = {
    unassigned: "Unassigned", assigned: "Assigned", in_progress: "In Progress",
    pending_approval: "Pending Approval", blocked: "Blocked", done: "Done", error: "Error",
  };

  if (board && typeof board === "object") {
    for (const [column, tasks] of Object.entries(board)) {
      if (Array.isArray(tasks)) {
        workspaces.push({ id: `ws-${column}`, name: columnNames[column] || column, type: "board-column", taskCount: tasks.length, column, tasks: tasks.map((t: any) => ({ id: t.id, title: t.title, status: t.status, assignee: t.assignee })) });
      }
    }
  }

  if (goals && Array.isArray(goals)) {
    for (const goal of goals) {
      workspaces.push({ id: `goal-${goal.id}`, name: goal.title || `Goal #${goal.id}`, type: "goal", description: goal.description, target: goal.target_value, metric: goal.target_metric, deadline: goal.target_date, status: goal.status });
    }
  }

  return NextResponse.json(workspaces, { headers: { "Cache-Control": "no-store" } });
}
