"use client";

/* ────────────────────────────────────────────────────────────
   Blue Mogul AI · Productivity
   Pomodoro timer (25m work / 5m break) + sticky notes.
   State is authored server-side through Mission Control via
   the /api/mc/productivity/* proxy. The timer ticks locally
   for smooth cadence and syncs back on every user action.
   ──────────────────────────────────────────────────────────── */

import { useEffect, useState, useRef } from "react";
import {
  Timer,
  Play,
  Pause,
  RotateCcw,
  Plus,
  Trash2,
  Save,
  Edit3,
} from "lucide-react";
import { Button, Panel, Pill, rise, EmptyState, Skeleton } from "@/components/ui/kit";
import { PageHeader } from "@/components/mc/ui";
import { mcGetSafe, mcPost } from "@/lib/mc";

interface PomodoroState {
  mode: "work" | "break";
  time_left: number;
  running: boolean;
  completed_cycles: number;
  operator_id?: string;
}

interface StickyNote {
  id: string | number;
  content: string;
  created_at?: string;
  updated_at?: string;
}

const WORK_DURATION = 25 * 60; // seconds
const BREAK_DURATION = 5 * 60;

const fmt = (n: number): string => {
  const m = Math.floor(n / 60);
  const s = n % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
};

/* ────────────────────────────────────────────────────────────
   Pomodoro Timer
   ──────────────────────────────────────────────────────────── */

function PomodoroTimer() {
  const [state, setState] = useState<PomodoroState>({
    mode: "work",
    time_left: WORK_DURATION,
    running: false,
    completed_cycles: 0,
    operator_id: undefined,
  });
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Pull canonical state from Mission Control on mount
  useEffect(() => {
    (async () => {
      const d = await mcGetSafe<PomodoroState>("productivity/pomodoro");
      if (d) {
        setState({
          mode: d.mode ?? "work",
          time_left: d.time_left ?? WORK_DURATION,
          running: d.running ?? false,
          completed_cycles: d.completed_cycles ?? 0,
          operator_id: d.operator_id,
        });
      }
      setLoading(false);
    })();
  }, []);

  // Local tick — functional update reads latest state every second
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (!state.running || state.time_left <= 0) return;

    intervalRef.current = setInterval(() => {
      setState((prev) => ({
        ...prev,
        time_left: prev.time_left > 0 ? prev.time_left - 1 : 0,
      }));
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [state.running]);

  // When the clock hits zero, advance to the next mode
  useEffect(() => {
    if (state.time_left === 0 && state.running) {
      const newCycles =
        state.mode === "work" ? state.completed_cycles + 1 : state.completed_cycles;
      const newMode: "work" | "break" = state.mode === "work" ? "break" : "work";
      const newTimeLeft = newMode === "work" ? WORK_DURATION : BREAK_DURATION;
      const newState: PomodoroState = {
        mode: newMode,
        time_left: newTimeLeft,
        running: true,
        completed_cycles: newCycles,
        operator_id: state.operator_id,
      };
      setState(newState);
      mcPost("productivity/pomodoro", newState).catch(() => {
        /* best-effort sync */
      });
    }
  }, [
    state.time_left,
    state.running,
    state.mode,
    state.completed_cycles,
    state.operator_id,
  ]);

  // Optimistic update + server sync
  const sync = async (patch: Partial<PomodoroState>) => {
    const newState = { ...state, ...patch };
    setState(newState);
    try {
      await mcPost("productivity/pomodoro", newState);
    } catch {
      /* local state stays — server will reconcile on next load */
    }
  };

  const start = () => sync({ running: true });
  const pause = () => sync({ running: false });
  const reset = () =>
    sync({
      mode: "work",
      time_left: WORK_DURATION,
      running: false,
      completed_cycles: 0,
    });
  const switchMode = (mode: "work" | "break") =>
    sync({
      mode,
      time_left: mode === "work" ? WORK_DURATION : BREAK_DURATION,
      running: false,
    });

  const totalDuration = state.mode === "work" ? WORK_DURATION : BREAK_DURATION;
  const pct = Math.max(0, (state.time_left / totalDuration) * 100);

  if (loading) {
    return (
      <Panel className="p-6">
        <div className="flex items-center justify-between mb-5">
          <Skeleton className="h-9 w-40" />
          <Skeleton className="h-6 w-16" />
        </div>
        <div className="text-center py-2">
          <Skeleton className="h-14 w-32 mx-auto mb-4" />
          <Skeleton className="h-5 w-20 mx-auto mb-4" />
          <Skeleton className="h-[4px] w-56 mx-auto rounded-full" />
        </div>
        <div className="flex justify-center gap-3">
          <Skeleton className="h-9 w-24 rounded-full" />
          <Skeleton className="h-9 w-20 rounded-full" />
        </div>
      </Panel>
    );
  }

  return (
    <Panel className="p-6 hq-rise" style={rise(0)}>
      {/* Mode toggle + cycle counter */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-1.5">
          <Button
            variant={state.mode === "work" ? "primary" : "ghost"}
            size="sm"
            onClick={() => switchMode("work")}
          >
            Work
          </Button>
          <Button
            variant={state.mode === "break" ? "primary" : "ghost"}
            size="sm"
            onClick={() => switchMode("break")}
          >
            Break
          </Button>
        </div>
        <Pill tone="neutral">
          <span className="num">{state.completed_cycles}</span> cycles
        </Pill>
      </div>

      {/* Countdown */}
      <div className="text-center py-2">
        <div className="text-[56px] num font-medium text-[var(--text)] tracking-tight leading-none">
          {fmt(state.time_left)}
        </div>
        <div className="mt-3 mb-4 flex justify-center">
          {state.mode === "work" ? (
            <Pill tone="accent">Focus mode</Pill>
          ) : (
            <Pill tone="neutral">Break</Pill>
          )}
        </div>

        {/* Progress bar */}
        <div className="h-[4px] w-full max-w-md mx-auto rounded-full bg-white/[0.06] overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-1000"
            style={{
              width: `${pct}%`,
              background: state.mode === "work" ? "var(--accent)" : "var(--up)",
              opacity: 0.85,
            }}
          />
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-3">
        {!state.running ? (
          <Button variant="primary" onClick={start}>
            <Play className="w-4 h-4" /> Start
          </Button>
        ) : (
          <Button variant="ghost" onClick={pause}>
            <Pause className="w-4 h-4" /> Pause
          </Button>
        )}
        <Button variant="ghost" onClick={reset}>
          <RotateCcw className="w-4 h-4" /> Reset
        </Button>
      </div>
    </Panel>
  );
}

/* ────────────────────────────────────────────────────────────
   Sticky Notes
   ──────────────────────────────────────────────────────────── */

function StickyNotes() {
  const [notes, setNotes] = useState<StickyNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [editingId, setEditingId] = useState<string | number | null>(null);
  const [editText, setEditText] = useState("");

  const refresh = async () => {
    setLoading(true);
    const d = await mcGetSafe<StickyNote[]>("productivity/sticky");
    if (!d) {
      setError("Could not load sticky notes from Mission Control");
    } else {
      setError(null);
    }
    setNotes(d ?? []);
    setLoading(false);
  };

  useEffect(() => {
    refresh();
  }, []);

  const createNote = async () => {
    if (!input.trim()) return;
    try {
      await mcPost("productivity/sticky", { content: input });
      setInput("");
      refresh();
    } catch (e: any) {
      setError(e.message || "Failed to create note");
    }
  };

  const updateNote = async (id: string | number) => {
    try {
      await mcPost("productivity/sticky", { id, content: editText });
      setEditingId(null);
      setEditText("");
      refresh();
    } catch (e: any) {
      setError(e.message || "Failed to update note");
    }
  };

  const deleteNote = async (id: string | number) => {
    try {
      await mcPost("productivity/sticky", { id, action: "delete" });
      refresh();
    } catch (e: any) {
      setError(e.message || "Failed to delete note");
    }
  };

  if (loading) {
    return (
      <Panel className="p-6 hq-rise" style={rise(1)}>
        <div className="flex items-center justify-between mb-4">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>
        <div className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      </Panel>
    );
  }

  return (
    <Panel className="p-6 hq-rise" style={rise(1)}>
      <div className="flex items-center justify-between mb-4">
        <span className="eyebrow">Sticky Notes</span>
        <Pill tone="neutral">{notes.length}</Pill>
      </div>

      {error && (
        <p className="text-[12px] text-[var(--down)] mb-3">{error}</p>
      )}

      {notes.length === 0 ? (
        <EmptyState
          icon={<Timer className="w-5 h-5" />}
          title="No notes yet"
          hint="Capture quick thoughts, tasks, or reminders while you focus."
          action={
            <div className="w-full max-w-sm">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="What's on your mind?"
                className="w-full bg-[var(--surface-1)] border border-[var(--line)] text-[var(--text)] placeholder-[var(--text-3)] rounded-[var(--r-md)] px-4 py-3 text-[14px] resize-none focus:outline-none focus:border-[var(--accent)]"
                rows={3}
              />
              <div className="mt-2 flex justify-end">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={createNote}
                  disabled={!input.trim()}
                >
                  <Plus className="w-3.5 h-3.5" /> Add
                </Button>
              </div>
            </div>
          }
        />
      ) : (
        <div className="space-y-3">
          {notes.map((note) => (
            <div
              key={note.id}
              className="border border-[var(--line)] rounded-[var(--r-md)] bg-[var(--surface-1)] p-3"
            >
              <div className="flex items-start justify-between gap-2">
                {editingId === note.id ? (
                  <textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    className="flex-1 bg-[var(--surface-1)] border border-[var(--line)] text-[var(--text)] placeholder-[var(--text-3)] rounded-[var(--r-sm)] px-3 py-2 text-[14px] resize-none focus:outline-none focus:border-[var(--accent)]"
                    rows={3}
                    autoFocus
                  />
                ) : (
                  <p className="text-[13px] text-[var(--text-2)] leading-relaxed flex-1 whitespace-pre-wrap break-words">
                    {note.content || "Untitled"}
                  </p>
                )}
                <div className="flex items-center gap-1 shrink-0">
                  {editingId === note.id ? (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => updateNote(note.id)}
                    >
                      <Save className="w-3.5 h-3.5" />
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditingId(note.id);
                        setEditText(note.content);
                      }}
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteNote(note.id)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add note form */}
      <div className="mt-4">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={notes.length === 0 ? "Type a note…" : "Add another note…"}
          className="w-full bg-[var(--surface-1)] border border-[var(--line)] text-[var(--text)] placeholder-[var(--text-3)] rounded-[var(--r-md)] px-4 py-3 text-[14px] resize-none focus:outline-none focus:border-[var(--accent)]"
          rows={2}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              createNote();
            }
          }}
        />
        <div className="mt-2 flex justify-end">
          <Button
            variant="primary"
            size="sm"
            onClick={createNote}
            disabled={!input.trim()}
          >
            <Plus className="w-3.5 h-3.5" /> Add note
          </Button>
        </div>
      </div>
    </Panel>
  );
}

/* ────────────────────────────────────────────────────────────
   Page
   ──────────────────────────────────────────────────────────── */

export default function ProductivityPage() {
  return (
    <div className="w-full mx-auto pt-2 max-w-5xl">
      <PageHeader
        eyebrow="Operate"
        title="Productivity"
        sub="Pomodoro timer and sticky notes, synced through Mission Control."
      />
      <div className="space-y-6">
        <PomodoroTimer />
        <StickyNotes />
      </div>
    </div>
  );
}
