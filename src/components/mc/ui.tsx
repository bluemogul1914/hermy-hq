"use client";

/* ───────────────────────────────────────────────────────────
   Mission Control cockpit · shared building blocks
   Tiny wrappers over the Calm Luxury kit used by all the
   new MC-backed pages (Dashboard, Goals, Projects, Cost,
   Activity, Org). Keeps each page lean.
   ─────────────────────────────────────────────────────────── */

import { Activity, RefreshCw, ServerOff } from "lucide-react";
import { Panel, Skeleton } from "@/components/ui/kit";

export function PageHeader({
  eyebrow,
  title,
  sub,
  action,
}: {
  eyebrow: string;
  title: string;
  sub?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex justify-between items-end gap-4 mb-8">
      <div>
        <div className="eyebrow mb-2">{eyebrow}</div>
        <h1 className="text-[32px] font-semibold tracking-[-0.025em] leading-none text-[var(--text)]">
          {title}
        </h1>
        {sub && (
          <p className="mt-2 text-[13px] text-[var(--text-3)] max-w-xl">{sub}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function StatCard({
  label,
  value,
  format,
  helper,
  accent = "#a1a1aa",
  href,
}: {
  label: string;
  value: number;
  format?: (n: number) => string;
  helper?: string;
  accent?: string;
  href?: string;
}) {
  const body = (
    <div className="panel flex flex-col p-5 h-full">
      <span className="eyebrow" style={{ color: "var(--text-3)" }}>
        {label}
      </span>
      <div
        className="mt-3 num font-semibold leading-none tracking-[-0.02em] text-[34px]"
        style={{ color: "var(--hq-text)" }}
      >
        {format ? format(value) : value.toLocaleString("en-US")}
      </div>
      {helper && (
        <div className="mt-2 text-[12px] text-[var(--text-3)] flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: accent }} />
          {helper}
        </div>
      )}
    </div>
  );
  return href ? (
    <a href={href} className="block h-full">
      {body}
    </a>
  ) : (
    body
  );
}

export function ErrorState({ message }: { message?: string }) {
  return (
    <Panel className="p-8">
      <div className="flex flex-col items-center text-center gap-3 py-6">
        <ServerOff className="w-7 h-7 text-[var(--text-3)]" />
        <p className="text-[14px] font-medium text-[var(--text-2)]">
          Mission Control unreachable
        </p>
        <p className="text-[12.5px] text-[var(--text-3)] max-w-sm">
          {message || "Could not read the board. Check the Mission Control service, then reload."}
        </p>
        <button
          onClick={() => window.location.reload()}
          className="inline-flex items-center gap-1.5 mt-2 text-[12.5px] font-medium"
          style={{ color: "var(--accent)" }}
        >
          <RefreshCw className="w-3.5 h-3.5" /> Retry
        </button>
      </div>
    </Panel>
  );
}

export function LoadingGrid({ n = 4 }: { n?: number }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="panel p-5">
          <Skeleton className="h-3 w-16 mb-4" />
          <Skeleton className="h-8 w-24" />
        </div>
      ))}
    </div>
  );
}

// ── Mini 14-day bar chart (recharts) ──
export function MiniBar({
  data,
}: {
  data: Array<{ day: string; count: number }>;
}) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center gap-2 text-[12px] text-[var(--text-4)] py-6">
        <Activity className="w-4 h-4" /> No activity recorded yet this fortnight.
      </div>
    );
  }
  const max = Math.max(1, ...data.map((d) => d.count));
  const maxBar = 72;
  return (
    <div className="flex items-end gap-[3px] h-[120px] w-full">
      {data.map((d) => {
        const h = d.count > 0 ? Math.max(4, Math.round((d.count / max) * maxBar)) : 2;
        const label = d.day.slice(5); // MM-DD
        return (
          <div key={d.day} className="flex-1 flex flex-col items-center gap-1.5 min-w-0" title={`${d.day}: ${d.count}`}>
            <div
              className="w-full rounded-[3px] transition-all duration-500"
              style={{
                height: h,
                background: d.count > 0 ? "var(--accent)" : "rgba(255,255,255,0.06)",
                opacity: d.count > 0 ? 0.85 : 1,
              }}
            />
            <span className="text-[8.5px] num text-[var(--text-4)] leading-none">{label}</span>
          </div>
        );
      })}
    </div>
  );
}

export type { Activity };

// ── Scaffold — a nav destination whose data source is not wired yet ──
export function Scaffold({
  icon,
  title,
  sub,
  eyebrow,
  source,
}: {
  icon: React.ReactNode;
  title: string;
  sub: string;
  eyebrow: string;
  source: string;
}) {
  return (
    <div className="w-full mx-auto pt-2 max-w-4xl">
      <PageHeader eyebrow={eyebrow} title={title} sub={sub} />
      <Panel className="p-6">
        <div className="flex flex-col items-center text-center gap-3 py-10">
          <span className="text-[var(--text-3)]">{icon}</span>
          <p className="text-[14px] font-medium text-[var(--text-2)]">
            Route is wired — data source not connected yet.
          </p>
          <p className="text-[12.5px] text-[var(--text-3)] max-w-md">
            {source}
          </p>
        </div>
      </Panel>
    </div>
  );
}