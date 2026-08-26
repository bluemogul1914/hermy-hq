"use client";

/* ───────────────────────────────────────────────────────────
   Blue Mogul AI · Activity
   Fleet operations activity: the 14-day run chart, status /
   priority mix, success rate, and the recent transition feed —
   all straight from Mission Control's /api/dashboard.
   ─────────────────────────────────────────────────────────── */

import { useEffect, useState } from "react";
import { Activity as ActivityIcon } from "lucide-react";
import { rise, Panel, Pill, EmptyState } from "@/components/ui/kit";
import { PageHeader, ErrorState, LoadingGrid, MiniBar } from "@/components/mc/ui";
import { mcGetSafe } from "@/lib/mc";

interface Dash {
  charts: {
    run_activity: Array<{ day: string; count: number }>;
    by_priority: Array<{ priority: string; count: number }>;
    by_status: Array<{ status: string; count: number }>;
    success_rate: { completed: number; total: number; failed: number; rate_pct: number | null };
  };
  recent_activity: Array<{ id: number; task_id: number | null; agent_name: string; from_status: string | null; to_status: string; note: string | null; created_at: string; task_title: string | null }>;
}

function timeAgo(d: string): string {
  const diff = Date.now() - new Date(d).getTime();
  if (Number.isNaN(diff)) return "—";
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const STATUS_TONE: Record<string, "up" | "warn" | "down" | "neutral" | "accent"> = {
  done: "up",
  error: "down",
  blocked: "down",
  in_progress: "accent",
};

export default function ActivityPage() {
  const [dash, setDash] = useState<Dash | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const d = await mcGetSafe<Dash>("/dashboard");
      if (!d) setError("activity read failed");
      setDash(d ?? null);
    })();
  }, []);

  if (error && !dash) {
    return (
      <div className="w-full mx-auto pt-2 max-w-5xl">
        <PageHeader eyebrow="Company" title="Activity" />
        <ErrorState message={error} />
      </div>
    );
  }
  if (!dash) {
    return (
      <div className="w-full mx-auto pt-2 max-w-5xl">
        <PageHeader eyebrow="Company" title="Activity" />
        <LoadingGrid n={2} />
      </div>
    );
  }

  const { charts, recent_activity } = dash;
  const { success_rate } = charts;

  return (
    <div className="w-full mx-auto pt-2 max-w-5xl">
      <PageHeader
        eyebrow="Company"
        title="Activity"
        sub="Task throughput over the last 14 days — volume, priorities, outcomes."
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Run chart + breakdown */}
        <div className="lg:col-span-2 space-y-5 hq-rise" style={rise(0)}>
          <Panel className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="eyebrow">Run activity · 14 days</span>
              <Pill tone="neutral">{charts.run_activity.reduce((s, d) => s + d.count, 0)} events</Pill>
            </div>
            <MiniBar data={charts.run_activity} />
          </Panel>

          <Panel className="p-5">
            <div className="flex items-center justify-between mb-4">
              <span className="eyebrow">By status · 14 days</span>
              <Pill tone="neutral">{charts.by_status.reduce((s, x) => s + x.count, 0)} tasks</Pill>
            </div>
            {charts.by_status.length === 0 ? (
              <p className="text-[12.5px] text-[var(--text-4)]">No tasks this fortnight.</p>
            ) : (
              <div className="space-y-3">
                {charts.by_status.map((s) => {
                  const total = charts.by_status.reduce((a, x) => a + x.count, 0) || 1;
                  return (
                    <div key={s.status}>
                      <div className="flex items-center justify-between mb-1 text-[13px]">
                        <span className="text-[var(--text)] capitalize">{s.status}</span>
                        <span className="num text-[var(--text-3)]">{s.count}</span>
                      </div>
                      <div className="h-[6px] w-full rounded-full bg-white/[0.06] overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${(s.count / total) * 100}%`,
                            background: STATUS_TONE[s.status] ? "var(--accent)" : "rgba(255,255,255,0.14)",
                            opacity: 0.8,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Panel>
        </div>

        {/* Right rail: success + recent feed */}
        <div className="space-y-5 hq-rise" style={rise(1)}>
          <Panel className="p-5">
            <span className="eyebrow">Success rate · 14 days</span>
            <div className="mt-3 flex items-end gap-3">
              <div className="num font-semibold text-[40px] leading-none text-[var(--text)]">
                {success_rate.rate_pct == null ? "—" : `${success_rate.rate_pct}%`}
              </div>
            </div>
            <div className="mt-4 flex items-center gap-4 text-[12px] text-[var(--text-3)]">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[var(--up)]" /> {success_rate.completed} done
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[var(--down)]" /> {success_rate.failed} failed
              </span>
              <span>{success_rate.total} total</span>
            </div>
          </Panel>

          <Panel className="p-5">
            <span className="eyebrow mb-3 block">Recent transitions</span>
            {recent_activity.length === 0 ? (
              <EmptyState
                icon={<ActivityIcon className="w-5 h-5" />}
                title="Quiet so far"
                hint="Task transitions will appear here."
              />
            ) : (
              <div className="space-y-1">
                {recent_activity.slice(0, 10).map((a) => (
                  <div key={a.id} className="flex items-start gap-2.5 py-2 border-b border-[var(--line)] last:border-0 text-[12.5px]">
                    <span className="num text-[var(--text-4)] shrink-0 w-[52px]">{timeAgo(a.created_at)}</span>
                    <div className="min-w-0">
                      <span className="text-[var(--text-2)]">{a.agent_name || ""}</span>
                      <span className="text-[var(--text-4)]"> · </span>
                      <span className="text-[var(--text)]">{a.task_title ?? a.note ?? "#" + (a.task_id ?? "?")}</span>
                      <div className="text-[var(--text-4)]">
                        {a.from_status ? `${a.from_status} → ` : ""}{a.to_status}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}