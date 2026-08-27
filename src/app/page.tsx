"use client";

/* ───────────────────────────────────────────────────────────
   Blue Mogul AI · Dashboard
   Mirrors the Mission Control board. Every number here is the
   Mission Control backend (mission-control.bluemogul.us) —
   single source of truth, read through the /api/mc proxy.
   ─────────────────────────────────────────────────────────── */

import { useEffect, useState } from "react";
import Link from "next/link";
import { rise, Panel, Pill, Skeleton, EmptyState } from "@/components/ui/kit";
import { PageHeader, StatCard, ErrorState, LoadingGrid, MiniBar } from "@/components/mc/ui";
import { mcGetSafe } from "@/lib/mc";

interface Dash {
  stats: {
    agents_enabled: number;
    tasks_in_progress: number;
    pending_approvals: number;
    blocked_tasks: number;
    month_spent: number;
    month_cap: number;
  };
  charts: {
    run_activity: Array<{ day: string; count: number }>;
    by_priority: Array<{ priority: string; count: number }>;
    by_status: Array<{ status: string; count: number }>;
    success_rate: { completed: number; total: number; failed: number; rate_pct: number | null };
  };
  recent_activity: Array<{ id: number; task_id: number | null; agent_name: string; from_status: string | null; to_status: string; note: string | null; created_at: string; task_title: string | null }>;
  recent_tasks: Array<{ id: number; title: string; status: string; assignee: string | null; priority: string; updated_at: string }>;
}

type Board = Record<string, Array<{ id: number; title: string; status: string; assignee: string | null; priority: string }>>;

const COLUMN_ORDER = ["in_progress", "pending_approval", "blocked", "unassigned", "assigned", "done"];
const COL_LABEL: Record<string, string> = {
  in_progress: "In progress",
  pending_approval: "Pending approval",
  blocked: "Blocked",
  unassigned: "Unassigned",
  assigned: "Assigned",
  done: "Done",
};

function timeAgo(d: string): string {
  const diff = Date.now() - new Date(d).getTime();
  if (Number.isNaN(diff)) return "—";
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const days = Math.floor(h / 24);
  return `${days}d`;
}

// POST an MC action through the read/write proxy (approve/start/reject).
// Payload keys mirror what MC's server.js expects.
async function mcAction(
  taskId: number,
  action: "approve" | "reject" | "start",
  payload: Record<string, unknown>,
): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(`/api/mc/tasks/${taskId}/${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const j = (await res.json()) as { error?: string };
      detail = j.error || detail;
    } catch {
      /* ignore */
    }
    return { ok: false, error: detail };
  }
  return { ok: true };
}

export default function DashboardPage() {
  const [dash, setDash] = useState<Dash | null>(null);
  const [board, setBoard] = useState<Board | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState<number | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  async function reload() {
    const [d, b] = await Promise.all([
      mcGetSafe<Dash>("/dashboard"),
      mcGetSafe<Board>("/board"),
    ]);
    if (d) setDash(d);
    if (b) setBoard(b);
  }

  async function actOn(
    taskId: number,
    assignee: string | null,
    col: string,
    action: "approve" | "reject" | "start",
  ) {
    if (acting !== null) return;
    setActing(taskId);
    setActionMsg(null);
    let payload: Record<string, unknown> = {};
    if (action === "approve") payload = { approver: "tracey" };
    if (action === "start") payload = { agent_name: assignee || "CLOUDMASTER" };
    if (action === "reject") payload = { reason: "Not approved", approver: "tracey" };
    const r = await mcAction(taskId, action, payload);
    if (col !== "pending_approval") await reload(); else await reload();
    setActing(null);
    setActionMsg(r.ok ? `#${taskId} ${action}d` : `#${taskId} ${action} failed: ${r.error}`);
  }

  useEffect(() => {
    let alive = true;
    (async () => {
      const [d, b] = await Promise.all([
        mcGetSafe<Dash>("/dashboard"),
        mcGetSafe<Board>("/board"),
      ]);
      if (!alive) return;
      if (!d) setError("dashboard read failed");
      setDash(d);
      setBoard(b);
      setLoading(false);
    })();
    const iv = setInterval(() => {
      Promise.all([
        mcGetSafe<Dash>("/dashboard"),
        mcGetSafe<Board>("/board"),
      ]).then(([d, b]) => {
        if (d) setDash(d);
        if (b) setBoard(b);
      });
    }, 15000);
    return () => { alive = false; clearInterval(iv); };
  }, []);

  if (error && !dash) {
    return (
      <div className="w-full mx-auto pt-2 max-w-6xl">
        <PageHeader eyebrow="Blue Mogul AI" title="Dashboard" />
        <ErrorState message={error} />
      </div>
    );
  }

  if (loading && !dash) {
    return (
      <div className="w-full mx-auto pt-2 max-w-6xl">
        <PageHeader eyebrow="Blue Mogul AI" title="Dashboard" />
        <LoadingGrid n={4} />
      </div>
    );
  }

  const stats = dash?.stats;
  const success = dash?.charts.success_rate;

  return (
    <div className="w-full mx-auto pt-2 max-w-6xl">
      <PageHeader
        eyebrow="Blue Mogul AI · command center"
        title="Dashboard"
        sub="Live board, budget, and fleet health — same Mission Control source you run from Telegram."
      />

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 hq-rise" style={rise(0)}>
        <StatCard label="Agents online" value={stats?.agents_enabled ?? 0} href="/org"
          accent="#34d399" helper={`${stats?.agents_enabled ?? 0} heartbeats <15m`} />
        <StatCard label="In progress" value={stats?.tasks_in_progress ?? 0} href="/"
          accent="#3b82f6" helper="tasks being worked" />
        <StatCard label="Pending approval" value={stats?.pending_approvals ?? 0}
          accent="#f59e0b" helper="awaiting your tap" />
        <StatCard label="Blocked" value={stats?.blocked_tasks ?? 0}
          accent="#f43f5e" helper="need decision" />
        <StatCard label="Spent this month" value={stats?.month_spent ?? 0}
          format={(n) => `$${n.toLocaleString()}`}
          helper={stats && stats.month_cap > 0 ? `of $${stats.month_cap.toLocaleString()} cap` : "open agent cap"}
          accent="#8b5cf6" />
        <StatCard label="Success rate · 14d" value={success?.rate_pct ?? 0}
          format={(n) => (n == null ? "—" : `${n}%`)}
          accent="#22c55e" helper={`${success?.completed ?? 0}/${success?.total ?? 0} tasks done`} />
      </div>

      {/* Activity + Board */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mt-6">
        {/* Activity chart (span 2, left) */}
        <div className="lg:col-span-2 space-y-5">
          <Panel className="p-5 hq-rise" style={rise(1)}>
            <div className="flex items-center justify-between mb-3">
              <span className="eyebrow">Run activity · 14 days</span>
              <Pill tone="neutral">{dash?.charts.run_activity.reduce((s, d) => s + d.count, 0) ?? 0} events</Pill>
            </div>
            <MiniBar data={dash?.charts.run_activity ?? []} />
          </Panel>

          {/* Recent activity feed */}
          <Panel className="p-5 hq-rise" style={rise(2)}>
            <div className="flex items-center justify-between mb-3">
              <span className="eyebrow">Recent activity</span>
            </div>
            {!dash || dash.recent_activity.length === 0 ? (
              <EmptyState title="No transitions yet" hint="Task state changes will show up here." />
            ) : (
              <div className="space-y-1">
                {dash.recent_activity.slice(0, 8).map((a) => (
                  <div key={a.id} className="flex items-center gap-3 py-2 border-b border-[var(--line)] last:border-0 text-[13px]">
                    <span className="num text-[var(--text-3)] shrink-0 w-[46px] tabular-nums">
                      {timeAgo(a.created_at)}
                    </span>
                    <span className="text-[var(--text-3)] shrink-0">{a.agent_name || ""}</span>
                    <span className="truncate text-[var(--text)]">
                      {a.task_title ?? a.note ?? `#${a.task_id ?? "?"}`}
                    </span>
                    <span className="ml-auto shrink-0 text-[var(--text-4)]">
                      {a.from_status ? `${a.from_status} → ` : ""}{a.to_status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>

        {/* Board columns (right rail) */}
        <div className="space-y-4 hq-rise" style={rise(1)}>
          <div className="eyebrow px-1">Board</div>
          {actionMsg && (
            <p className="px-1 text-[12px]" style={{ color: actionMsg.includes("failed") ? "var(--down)" : "var(--up)" }}>
              {actionMsg}
            </p>
          )}
          {COLUMN_ORDER.map((col) => {
            const tasks = board?.[col] ?? [];
            return (
              <Panel key={col} className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="eyebrow">{COL_LABEL[col]}</span>
                  <Pill tone={col === "blocked" ? "down" : "neutral"}>{tasks.length}</Pill>
                </div>
                {tasks.length === 0 ? (
                  <p className="text-[12px] text-[var(--text-4)]">Empty</p>
                ) : (
                  <div className="space-y-2.5">
                    {tasks.slice(0, 8).map((t) => (
                      <div key={t.id} className="rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface-1)] p-2.5">
                        <div className="text-[12.5px] leading-tight">
                          <span className="text-[var(--text)]">{t.title}</span>
                          {t.assignee && (
                            <span className="text-[var(--text-4)]"> · {t.assignee}</span>
                          )}
                        </div>
                        <div className="flex gap-1.5 mt-2 flex-wrap">
                          {col === "pending_approval" && (
                            <>
                              <button
                                className="text-[11px] px-2 py-1 rounded-[var(--r-sm)] font-medium"
                                style={{ background: "var(--up)", color: "var(--surface-0)" }}
                                onClick={() => actOn(Number(t.id), t.assignee, col, "approve")}
                                disabled={acting === t.id}
                              >
                                {acting === t.id ? "…" : "✓ Approve"}
                              </button>
                              <button
                                className="text-[11px] px-2 py-1 rounded-[var(--r-sm)] font-medium"
                                style={{ background: "var(--surface-2)", color: "var(--text-2)" }}
                                onClick={() => actOn(Number(t.id), t.assignee, col, "reject")}
                                disabled={acting === t.id}
                              >
                                Reject
                              </button>
                            </>
                          )}
                          {col === "assigned" && (
                            <button
                              className="text-[11px] px-2 py-1 rounded-[var(--r-sm)] font-medium"
                              style={{ background: "var(--accent)", color: "var(--surface-0)" }}
                              onClick={() => actOn(Number(t.id), t.assignee, col, "start")}
                              disabled={acting === t.id}
                            >
                              {acting === t.id ? "…" : "Start"}
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                    {tasks.length > 8 && (
                      <p className="text-[11.5px] text-[var(--text-4)]">+{tasks.length - 8} more</p>
                    )}
                  </div>
                )}
              </Panel>
            );
          })}
          <Link
            href="/tasks"
            className="inline-flex items-center gap-1.5 text-[12.5px] font-medium"
            style={{ color: "var(--accent)" }}
          >
            Open full board →
          </Link>
        </div>
      </div>
    </div>
  );
}