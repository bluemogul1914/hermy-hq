"use client";

/* ───────────────────────────────────────────────────────────
   Blue Mogul AI · Projects (live board)
   The real Mission Control board rendered inside the cockpit.
   Distinct from the local /tasks demo: every card here is the
   MC task queue via the /api/mc proxy. Open columns + a done
   roll-up sum up the working portfolio.
   ─────────────────────────────────────────────────────────── */

import { useEffect, useState } from "react";
import Link from "next/link";
import { Kanban } from "lucide-react";
import { rise, Panel, Pill, EmptyState } from "@/components/ui/kit";
import { PageHeader, ErrorState, LoadingGrid } from "@/components/mc/ui";
import { mcGetSafe } from "@/lib/mc";

interface Task {
  id: number;
  title: string;
  description: string | null;
  status: string;
  assignee: string | null;
  priority: string;
  created_at: string;
}

type Board = Record<string, Task[]>;

const OPEN = ["in_progress", "pending_approval", "blocked", "unassigned", "assigned"] as const;
const OPEN_LABEL: Record<string, string> = {
  in_progress: "In progress",
  pending_approval: "Pending approval",
  blocked: "Blocked",
  unassigned: "Unassigned",
  assigned: "Assigned",
};
const PRIORITY_TONE: Record<string, "warn" | "down" | "neutral"> = {
  critical: "down",
  high: "warn",
  medium: "neutral",
};

export default function ProjectsPage() {
  const [board, setBoard] = useState<Board | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const d = await mcGetSafe<Board>("/board");
      if (!d) setError("board read failed");
      setBoard(d ?? {});
    })();
  }, []);

  if (error && !board) {
    return (
      <div className="w-full mx-auto pt-2 max-w-6xl">
        <PageHeader eyebrow="Operate" title="Projects · Live board" />
        <ErrorState message={error} />
      </div>
    );
  }
  if (!board) {
    return (
      <div className="w-full mx-auto pt-2 max-w-6xl">
        <PageHeader eyebrow="Operate" title="Projects · Live board" />
        <LoadingGrid n={4} />
      </div>
    );
  }

  const openTotal = OPEN.reduce((s, c) => s + (board[c]?.length ?? 0), 0);
  const doneTotal = board.done?.length ?? 0;

  return (
    <div className="w-full mx-auto pt-2 max-w-6xl">
      <PageHeader
        eyebrow="Operate"
        title="Projects · Board"
        sub={`The live Mission Control queue. ${openTotal} open · ${doneTotal} completed.`}
      />

      {openTotal === 0 && doneTotal === 0 ? (
        <Panel className="p-6">
          <EmptyState
            icon={<Kanban className="w-6 h-6" />}
            title="Board is clear"
            hint="Tasks created in Mission Control will land here."
          />
        </Panel>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 hq-rise" style={rise(0)}>
          {[...OPEN, "done"].map((col, i) => {
            const tasks = board[col] ?? [];
            return (
              <Panel key={col} className="flex flex-col p-4 hq-rise" style={rise(i)}>
                <div className="flex items-center justify-between mb-3">
                  <span className="eyebrow">{OPEN_LABEL[col] ?? "Done"}</span>
                  <Pill tone={col === "blocked" ? "down" : "neutral"}>{tasks.length}</Pill>
                </div>
                <div className="rule mb-2" />
                <div className="space-y-2">
                  {tasks.length === 0 ? (
                    <p className="text-[12px] text-[var(--text-4)] py-4 text-center">Empty</p>
                  ) : (
                    tasks.slice(0, 12).map((t) => (
                      <div
                        key={t.id}
                        className="rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface-1)] p-3"
                      >
                        <p className="text-[13px] font-medium text-[var(--text)] leading-snug">
                          {t.title}
                        </p>
                        <div className="mt-2 flex items-center gap-2 flex-wrap">
                          {t.priority && (
                            <Pill tone={PRIORITY_TONE[t.priority] || "neutral"}>{t.priority}</Pill>
                          )}
                          {t.assignee && (
                            <span className="text-[11px] text-[var(--text-4)]">@{t.assignee}</span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                  {tasks.length > 12 && (
                    <p className="text-[11.5px] text-[var(--text-4)]">+{tasks.length - 12} more</p>
                  )}
                </div>
              </Panel>
            );
          })}
        </div>
      )}

      <p className="mt-6 text-[12px] text-[var(--text-4)]">
        Full board, approvals, and history:{" "}
        <a href="https://mission-control.bluemogul.us" className="text-[var(--text-3)] underline underline-offset-2">
          mission-control.bluemogul.us
        </a>{" "}
        · Manage tasks: <Link href="/hermes" className="text-[var(--text-3)] underline underline-offset-2">Agent</Link>
      </p>
    </div>
  );
}