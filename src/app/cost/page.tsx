"use client";

/* ───────────────────────────────────────────────────────────
   Blue Mogul AI · Cost
   Agent budget standing from Mission Control's /api/budgets.
   Live spend vs monthly cap per agent, plus a fleet roll-up.
   ─────────────────────────────────────────────────────────── */

import { useEffect, useState } from "react";
import { Wallet } from "lucide-react";
import { rise, Panel, Pill, EmptyState } from "@/components/ui/kit";
import { PageHeader, ErrorState, LoadingGrid } from "@/components/mc/ui";
import { mcGetSafe } from "@/lib/mc";

interface Budget {
  agent_name: string;
  period: string;
  monthly_cap_usd: number | null;
  spent_usd: number;
  pct_used: number;
}

const money = (n: number | null | undefined) =>
  n == null ? "—" : `$${Number(n).toFixed(2)}`;

export default function CostPage() {
  const [budgets, setBudgets] = useState<Budget[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const d = await mcGetSafe<Budget[]>("/budgets");
      if (!d) setError("budget read failed");
      setBudgets(d ?? []);
    })();
  }, []);

  if (error && !budgets) {
    return (
      <div className="w-full mx-auto pt-2 max-w-5xl">
        <PageHeader eyebrow="Company" title="Cost" />
        <ErrorState message={error} />
      </div>
    );
  }
  if (!budgets || budgets.length === 0) {
    return (
      <div className="w-full mx-auto pt-2 max-w-5xl">
        <PageHeader eyebrow="Company" title="Cost" />
        {!budgets ? <LoadingGrid n={2} /> : (
          <Panel className="p-6">
            <EmptyState
              icon={<Wallet className="w-6 h-6" />}
              title="No budget rows yet"
              hint="Agent budget rows appear once caps or spend are recorded in Mission Control."
            />
          </Panel>
        )}
      </div>
    );
  }

  const spent = budgets.reduce((s, b) => s + Number(b.spent_usd), 0);
  const cap = budgets.reduce((s, b) => s + (Number(b.monthly_cap_usd) || 0), 0);
  const period = budgets[0]?.period ?? "—";
  const sorted = [...budgets].sort((a, b) => (b.pct_used ?? 0) - (a.pct_used ?? 0));

  return (
    <div className="w-full mx-auto pt-2 max-w-5xl">
      <PageHeader
        eyebrow="Company"
        title="Cost"
        sub={`Fleet budget standing for ${period}. Sole record of truth: Mission Control.`}
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6 hq-rise" style={rise(0)}>
        <Panel className="p-5">
          <span className="eyebrow">Spent this period</span>
          <div className="mt-2 num font-semibold text-[28px] text-[var(--text)]">{money(spent)}</div>
        </Panel>
        <Panel className="p-5">
          <span className="eyebrow">Aggregate cap</span>
          <div className="mt-2 num font-semibold text-[28px] text-[var(--text)]">{money(cap)}</div>
        </Panel>
        <Panel className="p-5">
          <span className="eyebrow">Utilization</span>
          <div className="mt-2 num font-semibold text-[28px] text-[var(--text)]">
            {cap > 0 ? `${Math.round((spent / cap) * 100)}%` : "—"}
          </div>
        </Panel>
      </div>

      <Panel className="p-5 hq-rise" style={rise(1)}>
        <div className="eyebrow mb-4">Per-agent spend</div>
        <div className="space-y-4">
          {sorted.map((b) => {
            const pct = Number(b.pct_used) || 0;
            const pctColor = pct >= 100 ? "var(--down)" : pct >= 75 ? "var(--warn)" : "var(--accent)";
            return (
              <div key={b.agent_name}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="flex items-center gap-2 text-[13px] font-medium text-[var(--text)]">
                    {b.agent_name}
                  </span>
                  <span className="num text-[12px] text-[var(--text-3)]">
                    {money(b.spent_usd)}
                    {b.monthly_cap_usd != null && <span className="text-[var(--text-4)]"> / {money(b.monthly_cap_usd)}</span>}
                    <span className="ml-2" style={{ color: pctColor }}>{pct.toFixed(1)}%</span>
                  </span>
                </div>
                <div className="h-[6px] w-full rounded-full bg-white/[0.06] overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${Math.min(pct, 100)}%`,
                      background: pctColor,
                      opacity: 0.85,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </Panel>

      <p className="mt-4 text-[12px] text-[var(--text-4)]">
        Caps are set in Mission Control by the operator; edits happen there, not here.
      </p>
    </div>
  );
}