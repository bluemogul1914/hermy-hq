"use client";

/* ───────────────────────────────────────────────────────────
   Blue Mogul AI · Goals
   The goal-aware portfolio from Mission Control: each objective
   carries a target metric + progress, and the tasks serving it.
   Read-only view through the /api/mc proxy (single source).
   ─────────────────────────────────────────────────────────── */

import { useEffect, useState } from "react";
import { Flag, Target, Plus } from "lucide-react";
import { rise, Panel, Pill, EmptyState, Button } from "@/components/ui/kit";
import { PageHeader, ErrorState, LoadingGrid } from "@/components/mc/ui";
import { mcGetSafe, mcPost } from "@/lib/mc";

interface Goal {
  id: number;
  title: string;
  description: string | null;
  goal_type: string;
  parent_goal_id: number | null;
  target_metric: string | null;
  target_value: number | null;
  target_date: string | null;
  status: string;
  latest_actual: number | null;
  latest_actual_at: string | null;
  pct_to_target: number | null;
  tasks_done: number;
  tasks_total: number;
}

const STATUS_TONE: Record<string, "up" | "warn" | "down" | "neutral" | "accent"> = {
  active: "accent",
  achieved: "up",
  missed: "down",
  abandoned: "neutral",
};

const TYPE_LABEL: Record<string, string> = {
  north_star: "North star",
  phase: "Phase",
  milestone: "Milestone",
  service_line: "Service line",
};

const STATUS_ORDER = ["active", "achieved", "missed", "abandoned"];

export default function GoalsPage() {
  const [goals, setGoals] = useState<Goal[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formTitle, setFormTitle] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formType, setFormType] = useState("milestone");
  const [formMetric, setFormMetric] = useState("");
  const [formTarget, setFormTarget] = useState("");
  const [formDate, setFormDate] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function loadGoals() {
    (async () => {
      const d = await mcGetSafe<Goal[]>("/goals");
      if (!d) setError("goals read failed");
      setGoals(d ?? []);
    })();
  }

  useEffect(() => {
    loadGoals();
  }, []);

  if (error && !goals) {
    return (
      <div className="w-full mx-auto pt-2 max-w-5xl">
        <PageHeader eyebrow="Operate" title="Goals" />
        <ErrorState message={error} />
      </div>
    );
  }

  if (!goals) {
    return (
      <div className="w-full mx-auto pt-2 max-w-5xl">
        <PageHeader eyebrow="Operate" title="Goals" />
        <LoadingGrid n={3} />
      </div>
    );
  }

  const ordered = [...goals].sort(
    (a, b) =>
      STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status)
      || (a.target_date ?? "").localeCompare(b.target_date ?? "")
  );

  return (
    <div className="w-full mx-auto pt-2 max-w-5xl">
      <PageHeader
        eyebrow="Operate"
        title="Goals"
        sub="The objectives Mission Control is steering toward — track the metric, the target, and the work serving it."
        action={
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowForm(true)}
          >
            <Plus className="w-3.5 h-3.5" /> New Goal
          </Button>
        }
      />

      {showForm && (
        <Panel className="p-5 mb-4 hq-rise" style={rise(0)}>
          <h3 className="text-[15px] font-medium text-[var(--text)] mb-4">New Goal</h3>
          <div className="space-y-3">
            <div>
              <label className="eyebrow mb-1.5 block">Title</label>
              <input
                type="text"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="e.g. Q5 — $100,000 MRR"
                className="w-full px-3 py-2 text-[13px] bg-[var(--surface-1)] border border-[var(--line)] rounded-[8px] text-[var(--text)] placeholder:text-[var(--text-4)] focus:outline-none focus:border-[var(--accent)] transition-colors"
              />
            </div>
            <div>
              <label className="eyebrow mb-1.5 block">Description</label>
              <textarea
                value={formDesc}
                onChange={(e) => setFormDesc(e.target.value)}
                placeholder="What does this goal achieve?"
                rows={2}
                className="w-full px-3 py-2 text-[13px] bg-[var(--surface-1)] border border-[var(--line)] rounded-[8px] text-[var(--text)] placeholder:text-[var(--text-4)] focus:outline-none focus:border-[var(--accent)] transition-colors resize-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="eyebrow mb-1.5 block">Type</label>
                <select
                  value={formType}
                  onChange={(e) => setFormType(e.target.value)}
                  className="w-full px-3 py-2 text-[13px] bg-[var(--surface-1)] border border-[var(--line)] rounded-[8px] text-[var(--text)] focus:outline-none focus:border-[var(--accent)] transition-colors"
                >
                  <option value="north_star">North star</option>
                  <option value="milestone">Milestone</option>
                  <option value="service_line">Service line</option>
                  <option value="phase">Phase</option>
                </select>
              </div>
              <div>
                <label className="eyebrow mb-1.5 block">Target date</label>
                <input
                  type="date"
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  className="w-full px-3 py-2 text-[13px] bg-[var(--surface-1)] border border-[var(--line)] rounded-[8px] text-[var(--text)] focus:outline-none focus:border-[var(--accent)] transition-colors"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="eyebrow mb-1.5 block">Target metric</label>
                <input
                  type="text"
                  value={formMetric}
                  onChange={(e) => setFormMetric(e.target.value)}
                  placeholder="e.g. MRR"
                  className="w-full px-3 py-2 text-[13px] bg-[var(--surface-1)] border border-[var(--line)] rounded-[8px] text-[var(--text)] placeholder:text-[var(--text-4)] focus:outline-none focus:border-[var(--accent)] transition-colors"
                />
              </div>
              <div>
                <label className="eyebrow mb-1.5 block">Target value</label>
                <input
                  type="number"
                  value={formTarget}
                  onChange={(e) => setFormTarget(e.target.value)}
                  placeholder="e.g. 100000"
                  className="w-full px-3 py-2 text-[13px] bg-[var(--surface-1)] border border-[var(--line)] rounded-[8px] text-[var(--text)] placeholder:text-[var(--text-4)] focus:outline-none focus:border-[var(--accent)] transition-colors"
                />
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={async () => {
                  if (!formTitle.trim()) return;
                  setSubmitting(true);
                  try {
                    await mcPost("goals", {
                      title: formTitle,
                      description: formDesc || null,
                      goal_type: formType,
                      target_metric: formMetric || null,
                      target_value: formTarget ? parseFloat(formTarget) : null,
                      target_date: formDate || null,
                    });
                    setShowForm(false);
                    setFormTitle("");
                    setFormDesc("");
                    setFormMetric("");
                    setFormTarget("");
                    setFormDate("");
                    loadGoals();
                  } catch (e) {
                    setError("Failed to create goal");
                  }
                  setSubmitting(false);
                }}
                disabled={submitting || !formTitle.trim()}
                className="px-4 py-2 text-[13px] font-medium rounded-[9999px] bg-[var(--gold-gradient)] text-[#0a0f24] hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {submitting ? "Creating…" : "Create Goal"}
              </button>
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-2 text-[13px] font-medium rounded-[9999px] bg-[var(--surface-1)] border border-[var(--line)] text-[var(--text-2)] hover:text-[var(--text)] transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </Panel>
      )}

      {ordered.length === 0 ? (
        <Panel className="p-6">
          <EmptyState
            icon={<Flag className="w-6 h-6" />}
            title="No goals yet"
            hint="Create goals in Mission Control and they'll show up here."
          />
        </Panel>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 hq-rise" style={rise(0)}>
          {ordered.map((g, i) => {
            const pct = g.pct_to_target;
            const pctClamped = pct == null ? 0 : Math.min(Math.max(pct, 0), 100);
            return (
              <Panel key={g.id} className="p-5 hq-rise" style={rise(i % 3)}>
                <div className="flex items-center justify-between gap-2 mb-2.5">
                  <Pill tone={STATUS_TONE[g.status] || "neutral"}>
                    {g.status}
                  </Pill>
                  <span className="eyebrow !text-[10px]">
                    {TYPE_LABEL[g.goal_type] || g.goal_type}
                  </span>
                </div>
                <h3 className="text-[16px] font-semibold tracking-[-0.01em] text-[var(--text)] leading-snug">
                  {g.title}
                </h3>
                {g.description && (
                  <p className="mt-1.5 text-[13px] text-[var(--text-2)] leading-relaxed line-clamp-2">
                    {g.description}
                  </p>
                )}

                {/* metric strip */}
                <div className="mt-4 flex items-center gap-4">
                  <div className="flex items-center gap-2 text-[12px] text-[var(--text-3)]">
                    <Target className="w-3.5 h-3.5" />
                    <span>
                      {g.target_metric || "metric"}:{" "}
                      <span className="num text-[var(--text)]">
                        {g.latest_actual == null ? "—" : g.latest_actual}
                      </span>
                      {g.target_value != null && (
                        <> / <span className="num text-[var(--text-2)]">{g.target_value}</span></>
                      )}
                    </span>
                  </div>
                  {g.target_date && (
                    <span className="text-[12px] text-[var(--text-4)]">
                      by {g.target_date}
                    </span>
                  )}
                </div>

                {/* progress */}
                <div className="mt-3">
                  <div className="h-[4px] w-full rounded-full bg-white/[0.06] overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${pctClamped}%`,
                        background:
                          g.status === "missed"
                            ? "var(--down)"
                            : g.status === "achieved"
                              ? "var(--up)"
                              : "var(--accent)",
                        opacity: 0.85,
                      }}
                    />
                  </div>
                  <div className="mt-1.5 flex items-center justify-between text-[11.5px] num text-[var(--text-4)]">
                    <span>{pct == null ? "no actual yet" : `${pct}% to target`}</span>
                    <span>
                      {g.tasks_done}/{g.tasks_total} tasks
                    </span>
                  </div>
                </div>
              </Panel>
            );
          })}
        </div>
      )}
    </div>
  );
}