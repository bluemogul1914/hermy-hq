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

export async function GET(request: Request) {
  const url = new URL(request.url);
  const artifactType = url.searchParams.get("type") || "all";

  const activity = await mcFetch("activity");
  const summary = await mcFetch("activity/summary");
  const board = await mcFetch("board");

  const artifacts: any[] = [];

  if (Array.isArray(activity)) {
    for (const event of activity) {
      artifacts.push({
        id: `activity-${event.id}`,
        type: "activity",
        title: `${event.action || "activity"} #${event.id}`,
        status: event.status || "unknown",
        agent: event.agent_name || "unknown",
        timestamp: event.timestamp_utc,
        url: null,
        description: event.approval_ref || event.action || "",
        task_id: event.task_id,
      });
    }
  }

  if (board && typeof board === "object") {
    for (const [column, tasks] of Object.entries(board)) {
      if (Array.isArray(tasks)) {
        for (const task of tasks) {
          if (task.id !== undefined && !artifacts.some((a) => a.id === `task-${task.id}`)) {
            artifacts.push({
              id: `task-${task.id}`,
              type: "task",
              title: task.title || `Task #${task.id}`,
              status: task.status || column,
              agent: task.assignee || null,
              timestamp: task.created_at || new Date().toISOString(),
              url: null,
              description: task.description || null,
            });
          }
        }
      }
    }
  }

  if (summary && Array.isArray(summary) && summary.length > 0) {
    for (const s of summary) {
      artifacts.push({ id: `summary-${s.period}`, type: "summary", title: `Summary: ${s.period}`, status: "ok", agent: null, timestamp: new Date().toISOString(), url: null, description: `${s.tasks_completed} completed, ${s.total_tasks} total` });
    }
  }

  let result = artifacts;
  if (artifactType !== "all") result = artifacts.filter((a) => a.type === artifactType);
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
