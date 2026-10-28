"use client";

/* ───────────────────────────────────────────────────────────
   Blue Mogul AI · Quality Gate
   Quality reviews for tasks flowing through Mission Control.
     GET  /api/approvals            — pending approval queue
     GET  /api/tasks/{id}/quality   — per-task review status
     POST /api/tasks/{id}/quality   — create / resolve a review
   ─────────────────────────────────────────────────────────── */

import { useEffect, useState } from "react";
import {
  Clock,
  Search,
  Shield,
  ShieldCheck,
  ShieldOff,
  X as XIcon,
} from "lucide-react";
import { rise, Panel, Pill, EmptyState, Button } from "@/components/ui/kit";
import { PageHeader, ErrorState, LoadingGrid } from "@/components/mc/ui";
import { mcGet, mcPost } from "@/lib/mc";

/* Local safe-read wrapper (mirrors the mc.ts read pattern without throwing). */
async function mcRead<T>(path: string): Promise<T | null> {
  try {
    return (await mcGet(path)) as T;
  } catch {
    return null;
  }
}

interface Approval {
  id: string;
  task_id: string;
  task_name?: string;
  kind?: string;
  title?: string;
  status?: string;
  priority?: string;
  requested_by?: string;
  created_at?: string;
  due_at?: string | null;
}

interface QualityCheck {
  name: string;
  passed: boolean;
}

interface TaskQuality {
  task_id: string;
  status: string; // pending_review | in_review | approved | rejected | needs_revision
  reviewed_at?: string | null;
  reviewed_by?: string | null;
  score?: number | null;
  checks?: QualityCheck[];
}

const STATUS_TONE: Record<string, "up" | "warn" | "down" | "neutral" | "accent"> = {
  pending_review: "neutral",
  in_review: "accent",
  approved: "up",
  rejected: "down",
  needs_revision: "warn",
};

const STATUS_LABEL: Record<string, string> = {
  pending_review: "Pending review",
  in_review: "In review",
  approved: "Approved",
  rejected: "Rejected",
  needs_revision: "Needs revision",
  pending: "Pending",
};

const OUTCOME_OPTIONS = [
  { value: "approved", label: "Approve", tone: "up" as const, icon: <Shield className="w-4 h-4" /> },
  { value: "needs_revision", label: "Request revision", tone: "warn" as const, icon: <ShieldCheck className="w-4 h-4" /> },
  { value: "rejected", label: "Reject", tone: "down" as const, icon: <ShieldOff className="w-4 h-4" /> },
];

function timeAgo(d: string | null | undefined): string {
  if (!d) return "—";
  const diff = Date.now() - new Date(d).getTime();
  if (Number.isNaN(diff)) return "—";
  const s = Math.floor(diff / 1000);
  if (s < 45) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function statusIcon(status: string): React.ReactNode {
  switch (status) {
    case "approved":
      return <Shield className="w-4 h-4" style={{ color: "var(--up)" }} />;
    case "rejected":
      return <ShieldOff className="w-4 h-4" style={{ color: "var(--down)" }} />;
    case "needs_revision":
      return <ShieldCheck className="w-4 h-4" style={{ color: "var(--warn)" }} />;
    case "in_review":
      return <ShieldCheck className="w-4 h-4" style={{ color: "var(--accent)" }} />;
    default:
      return <Clock className="w-4 h-4" style={{ color: "var(--text-3)" }} />;
  }
}

export default function QualityPage() {
  const [approvals, setApprovals] = useState<Approval[] | null>(null);
  const [quality, setQuality] = useState<Record<string, TaskQuality>>({});
  const [error, setError] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState<Approval | null>(null);
  const [reviewBusy, setReviewBusy] = useState(false);
  const [outcome, setOutcome] = useState("approved");
  const [score, setScore] = useState<string>("");
  const [notes, setNotes] = useState("");

  const loadApprovals = async () => {
    const d = await mcRead<{ ok?: boolean; approvals?: Approval[] } | Approval[]>("/approvals");
    if (!d) {
      setError("approvals read failed");
      setApprovals([]);
    } else {
      const extracted: Approval[] = Array.isArray(d) ? d : d?.approvals ?? [];
      setApprovals(extracted);
    }
  };

  const loadQuality = async (taskId: string) => {
    const d = await mcRead<TaskQuality>(`/tasks/${taskId}/quality`);
    if (d) {
      setQuality((prev) => ({ ...prev, [taskId]: d }));
    }
    return d;
  };

  const refresh = async () => {
    setError(null);
    await loadApprovals();
    setQuality({});
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Warm quality status for the visible approvals (bounded set).
  useEffect(() => {
    if (!approvals) return;
    void Promise.all(
      approvals.map((a) => loadQuality(a.task_id))
    );
  }, [approvals]);

  const openReview = (approval: Approval) => {
    setReviewing(approval);
    setOutcome("approved");
    setScore("");
    setNotes("");
  };

  const closeReview = () => setReviewing(null);

  const submitReview = async () => {
    if (!reviewing) return;
    const payload: Record<string, unknown> = {
      status: outcome,
      notes: notes.trim(),
    };
    if (score.trim() !== "") payload.score = Number(score);
    setReviewBusy(true);
    try {
      await mcPost(`/tasks/${reviewing.task_id}/quality`, payload);
      closeReview();
      await loadApprovals();
      await loadQuality(reviewing.task_id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "review submit failed");
    } finally {
      setReviewBusy(false);
    }
  };

  const pending = approvals ?? [];
  const pendingCount = pending.length;
  const qualityStatuses = Object.values(quality);
  const approvedCount = qualityStatuses.filter((q) => q.status === "approved").length;
  const pendingReviewCount = qualityStatuses.filter((q) => q.status === "pending_review" || q.status === "in_review").length;

  const isLoaded = approvals !== null;

  return (
    <div className="w-full mx-auto pt-2 max-w-5xl">
      <PageHeader
        eyebrow="Operate"
        title="Quality Gate"
        sub="Quality reviews flowing through Mission Control. Approve or reject task submissions, request revisions, and inspect each task's review status."
      />

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8 hq-rise" style={rise(0)}>
        <Panel className="p-5">
          <span className="eyebrow">Pending approvals</span>
          <div className="mt-2 num font-semibold text-[28px] text-[var(--text)]">
            {pendingCount}
          </div>
        </Panel>
        <Panel className="p-5">
          <span className="eyebrow">Approved</span>
          <div className="mt-2 num font-semibold text-[28px] text-[var(--up)]">
            {approvedCount}
          </div>
        </Panel>
        <Panel className="p-5">
          <span className="eyebrow">Needs review</span>
          <div className="mt-2 num font-semibold text-[28px] text-[var(--warn)]">
            {pendingReviewCount}
          </div>
        </Panel>
      </div>

      {/* ── Loading ── */}
      {!isLoaded && !error ? <LoadingGrid n={3} /> : null}

      {error && !approvals ? <ErrorState message={error} /> : null}

      {isLoaded && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 hq-rise" style={rise(0)}>
          <Panel className="p-5">
            <span className="eyebrow mb-3 block">Pending approvals</span>
            {pendingCount === 0 ? (
              <EmptyState
                icon={<ShieldCheck className="w-6 h-6" style={{ color: "var(--up)" }} />}
                title="Nothing needs review — you're clear."
                hint="Tasks pending quality approval will appear here."
              />
            ) : (
              <div className="flex flex-col gap-3">
                {pending.map((a, i) => (
                  <ApprovalCard
                    key={a.id}
                    approval={a}
                    quality={quality[a.task_id]}
                    onReview={openReview}
                    riseIndex={i}
                  />
                ))}
              </div>
            )}
          </Panel>

          {/* ── Quality status panel ── */}
          <Panel className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="eyebrow">Task quality status</span>
              <Button variant="ghost" size="sm" onClick={() => approvals && Promise.all(approvals.map((a) => loadQuality(a.task_id)))}>
                Refresh
              </Button>
            </div>
            {pendingCount === 0 ? (
              <EmptyState
                icon={<Search className="w-6 h-6" />}
                title="No tasks to check"
                hint="Submit tasks for quality review and their status will surface here."
              />
            ) : (
              <div className="flex flex-col gap-3">
                {pending.map((a) => {
                  const q = quality[a.task_id];
                  return (
                    <QualityRow key={`q-${a.id}`} approval={a} quality={q} />
                  );
                })}
              </div>
            )}
          </Panel>
        </div>
      )}

      {/* ── Create / resolve quality review dialog ── */}
      {reviewing && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="hq-rise" style={rise(1)}>
            <Panel className="p-6 w-full max-w-lg">
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="flex items-center gap-2.5">
                  <ShieldCheck className="w-5 h-5" style={{ color: "var(--accent)" }} />
                  <h2 className="text-[17px] font-semibold text-[var(--text)]">
                    Quality review
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={closeReview}
                  className="btn-ghost inline-flex items-center justify-center p-1 rounded-lg"
                  aria-label="Close"
                >
                  <XIcon className="w-4 h-4" />
                </button>
              </div>

              <div className="mb-4">
                <span className="eyebrow">Task</span>
                <p className="mt-1 text-[14px] font-medium text-[var(--text)]">
                  {reviewing.task_name || reviewing.title || `#${reviewing.id}`}
                </p>
                <span className="text-[12px] text-[var(--text-3)]">
                  {reviewing.kind ? `${reviewing.kind} · ` : ""}
                  {reviewing.priority && <Pill tone="neutral">{reviewing.priority}</Pill>}
                </span>
              </div>

              <div className="space-y-4">
                <div>
                  <span className="eyebrow mb-2 block">Outcome</span>
                  <div className="flex gap-2 flex-wrap">
                    {OUTCOME_OPTIONS.map((opt) => (
                      <label
                        key={opt.value}
                        className={`flex items-center gap-1.5 rounded-full px-3 py-2 text-[12.5px] font-medium cursor-pointer transition-colors
                          ${outcome === opt.value
                            ? "border-2 bg-white/[0.06]"
                            : "border border-[var(--line)] hover:border-[var(--line-strong)]"}`}
                        style={outcome === opt.value ? { borderColor: `var(--${opt.tone === "up" ? "up" : opt.tone === "warn" ? "warn" : "down"})` } : undefined}
                      >
                        <input
                          type="radio"
                          name="outcome"
                          value={opt.value}
                          checked={outcome === opt.value}
                          onChange={() => setOutcome(opt.value)}
                          className="hidden"
                        />
                        {opt.icon}
                        {opt.label}
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="eyebrow mb-1.5 block">Score (optional)</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={score}
                    onChange={(e) => setScore(e.target.value)}
                    placeholder="0–100"
                    className="w-full bg-[var(--surface-1)] border border-[var(--line)] text-[var(--text)] placeholder-[var(--text-3)] rounded-[var(--r-md)] px-4 py-2.5 text-[13px] focus:outline-none focus:border-[var(--line-strong)]"
                  />
                </div>

                <div>
                  <label className="eyebrow mb-1.5 block">Notes</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder={outcome === "approved" ? "Any context for the approver?" : "Explain the revision requested."}
                    rows={3}
                    className="w-full bg-[var(--surface-1)] border border-[var(--line)] text-[var(--text)] placeholder-[var(--text-3)] rounded-[var(--r-md)] px-4 py-2.5 text-[13px] focus:outline-none focus:border-[var(--line-strong)] resize-y"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-4 mt-2">
                <Button
                  variant="primary"
                  onClick={submitReview}
                  disabled={reviewBusy || notes.length > 2000}
                >
                  {reviewBusy ? "Submitting…" : "Submit review"}
                </Button>
                <Button variant="ghost" onClick={closeReview} disabled={reviewBusy}>
                  Cancel
                </Button>
              </div>
            </Panel>
          </div>
        </div>
      )}
    </div>
  );
}

function ApprovalCard({
  approval,
  quality,
  onReview,
  riseIndex,
}: {
  approval: Approval;
  quality?: TaskQuality;
  onReview: (a: Approval) => void;
  riseIndex: number;
}) {
  const status = quality?.status ?? "pending_review";
  const tone = STATUS_TONE[status] ?? "neutral";
  const label = STATUS_LABEL[status] ?? status;

  return (
    <div
      className="rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface-1)] p-4 hover:border-[var(--line-strong)] transition-colors"
      style={rise(riseIndex % 6)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Pill tone={tone}>{label}</Pill>
            {approval.kind && (
              <span className="eyebrow !text-[10px]">{approval.kind}</span>
            )}
          </div>
          <p className="mt-1.5 text-[13px] font-medium text-[var(--text)] leading-snug truncate">
            {approval.title || approval.task_name || `Task #${approval.id}`}
          </p>
          {approval.requested_by && (
            <span className="text-[11.5px] text-[var(--text-4)]">
              requested by {approval.requested_by} · {timeAgo(approval.created_at)}
            </span>
          )}
        </div>

        <Button variant="ghost" size="sm" onClick={() => onReview(approval)}>
          Review
        </Button>
      </div>
    </div>
  );
}

function QualityRow({
  approval,
  quality,
}: {
  approval: Approval;
  quality?: TaskQuality;
}) {
  const status = quality?.status ?? "pending_review";
  const tone = STATUS_TONE[status] ?? "neutral";
  const label = STATUS_LABEL[status] ?? status;
  const hasQuality = !!quality;

  return (
    <div className="flex items-center justify-between gap-3 py-2 -mx-1 first:mt-0">
      <div className="flex items-center gap-2.5 min-w-0">
        {statusIcon(status)}
        <span className="text-[13px] font-medium text-[var(--text)] truncate">
          {approval.task_name || approval.title || `#${approval.id}`}
        </span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {hasQuality && (
          <>
            {quality.score != null && (
              <Pill tone={tone}>{quality.score}/100</Pill>
            )}
            {quality.reviewed_at && (
              <span className="text-[11px] text-[var(--text-4)]">
                {timeAgo(quality.reviewed_at)}
              </span>
            )}
          </>
        )}
        <Pill tone={tone}>{label}</Pill>
      </div>
    </div>
  );
}
