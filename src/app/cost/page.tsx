"use client";

/* ───────────────────────────────────────────────────────────
   Blue Mogul AI · Cost

   Two sources, in order of truth:
     1. Hermes actual spend  — mirrored from `hermes insights` by the
        hermes-bridge (real token accounting, per model). This is what is
        actually being billed.
     2. Mission Control budgets — live spend vs monthly cap per agent,
        when the operator has recorded caps there.

   The Hermes figure is the bill; the MC figure is the governance rail.
   ─────────────────────────────────────────────────────────── */

import { useEffect, useState } from "react";
import { Wallet, Gauge } from "lucide-react";
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

interface HermesModel {
  model: string;
  sessions: number;
  tokens: number;
}
interface HermesParsed {
  period?: string | null;
  sessions?: number | null;
  messages?: number | null;
  toolCalls?: number | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  totalTokens?: number | null;
  estimatedUsd?: number | null;
  models?: HermesModel[];
}
interface HermesCost {
  days?: number;
  parsed?: HermesParsed | null;
  summary?: string | null;
  syncedAt?: string | null;
}

const money = (n: number | null | undefined) =>
  n == null ? "—" : `$${Number(n).toFixed(2)}`;

const compact = (n: number | null | undefined) => {
  if (n == null) return "—";
  const v = Number(n);
  if (v >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return String(v);
};

export default function CostPage() {
  const [cost, setCost] = useState<HermesCost | null>(null);
  const [budgets, setBudgets] = useState<Budget[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/hermes/cost", { cache: "no-store" });
        if (r.ok) setCost(await r.json());
      } catch (e) {
        console.error("hermes cost read failed", e);
      }
      const d = await mcGetSafe<Budget[]>("/budgets");
      if (d === null) setError("budget read failed");
      setBudgets(d ?? []);
    })();
  }, []);

  if (cost === null && budgets === null) {
    return (
      <div className="w-full mx-auto pt-2 max-w-5xl">
        <PageHeader eyebrow="Company" title="Cost" />
        <LoadingGrid n={3} />
      </div>
    );
  }

  const p = cost?.parsed ?? null;
  const syncAge = cost?.syncedAt ? new Date(cost.syncedAt) : null;

  const hasBudgets = !!budgets && budgets.length > 0;
  const spent = hasBudgets ? budgets!.reduce((s, b) => s + Number(b.spent_usd), 0) : 0;
  const cap = hasBudgets
    ? budgets!.reduce((s, b) => s + (Number(b.monthly_cap_usd) || 0), 0)
    : 0;
  const sortedBudgets = hasBudgets
    ? [...budgets!].sort((a, b) => (b.pct_used ?? 0) - (a.pct_used ?? 0))
    : [];

  return (
    <div className="w-full mx-auto pt-2 max-w-5xl">
      <PageHeader
        eyebrow="Company"
        title="Cost"
        sub={
          p
            ? `Actual Hermes spend for ${p.period ?? "the reporting window"}.`
            : "Actual Hermes spend, mirrored from `hermes insights` by the bridge."
        }
      />

      {/* ── Hermes actual spend ── */}
      {p ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6 hq-rise" style={rise(0)}>
            <Panel className="p-5">
              <span className="eyebrow">Spent (window)</span>
              <div className="mt-2 num font-semibold text-[28px] text-[var(--text)]">
                {money(p.estimatedUsd)}
              </div>
            </Panel>
            <Panel className="p-5">
              <span className="eyebrow">Sessions</span>
              <div className="mt-2 num font-semibold text-[28px] text-[var(--text)]">
                {p.sessions ?? "—"}
              </div>
            </Panel>
            <Panel className="p-5">
              <span className="eyebrow">Total tokens</span>
              <div className="mt-2 num font-semibold text-[28px] text-[var(--text)]">
                {compact(p.totalTokens)}
              </div>
            </Panel>
            <Panel className="p-5">
              <span className="eyebrow">Tool calls</span>
              <div className="mt-2 num font-semibold text-[28px] text-[var(--text)]">
                {p.toolCalls ?? "—"}
              </div>
            </Panel>
          </div>

          <Panel className="p-5 hq-rise" style={rise(1)}>
            <div className="flex items-center justify-between mb-4">
              <span className="eyebrow flex items-center gap-2">
                <Gauge className="w-3.5 h-3.5" /> Spend by model
              </span>
              <span className="text-[11px] text-[var(--text-4)] num">
                in {compact(p.inputTokens)} · out {compact(p.outputTokens)}
              </span>
            </div>
            {p.models && p.models.length > 0 ? (
              <div className="space-y-3">
                {(() => {
                  const max = Math.max(...p.models!.map((m) => m.tokens || 0), 1);
                  return p.models!
                    .filter((m) => m.tokens > 0 || m.sessions > 0)
                    .map((m) => (
                      <div key={m.model}>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[13px] font-medium text-[var(--text)] truncate">
                            {m.model}
                          </span>
                          <span className="num text-[12px] text-[var(--text-3)] shrink-0 ml-3">
                            {compact(m.tokens)} tokens
                            <span className="text-[var(--text-4)]"> · {m.sessions} sess</span>
                          </span>
                        </div>
                        <div className="h-[6px] w-full rounded-full bg-white/[0.06] overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-700"
                            style={{
                              width: `${Math.max((m.tokens / max) * 100, 1.5)}%`,
                              background: "var(--accent)",
                              opacity: 0.85,
                            }}
                          />
                        </div>
                      </div>
                    ));
                })()}
              </div>
            ) : (
              <p className="text-[12.5px] text-[var(--text-4)]">No model activity in this window.</p>
            )}
            <p className="mt-4 text-[11.5px] text-[var(--text-4)]">
              {syncAge
                ? `Mirrored from the host ${syncAge.toLocaleString()}. Covers the whole fleet (all profiles).`
                : "Awaiting the next bridge sync."}
            </p>
          </Panel>
        </>
      ) : (
        <Panel className="p-6 mb-6">
          <EmptyState
            icon={<Wallet className="w-6 h-6" />}
            title="No Hermes spend mirrored yet"
            hint="The hermes-bridge pushes `hermes insights` into the bus every 30s. If this stays empty, check that hermes-bridge is running on the host."
          />
        </Panel>
      )}

      {/* ── Mission Control budgets (governance rail) ── */}
      <div className="mt-8">
        <div className="flex items-center gap-2 mb-3">
          <Wallet className="w-4 h-4 text-[var(--text-3)]" />
          <span className="eyebrow uppercase">Budgets & caps</span>
          {hasBudgets && <Pill tone="neutral">{sortedBudgets.length}</Pill>}
        </div>

        {error && !hasBudgets ? (
          <Panel className="p-6">
            <EmptyState icon={<Wallet className="w-6 h-6" />} title="Budget read failed" hint={error} />
          </Panel>
        ) : !hasBudgets ? (
          <Panel className="p-6">
            <EmptyState
              icon={<Wallet className="w-6 h-6" />}
              title="No budget rows in Mission Control yet"
              hint="Per-agent caps appear here once the operator records caps or spend in Mission Control. The spend above is the real bill regardless."
            />
          </Panel>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
              <Panel className="p-5">
                <span className="eyebrow">Cap-tracked spend</span>
                <div className="mt-2 num font-semibold text-[24px] text-[var(--text)]">{money(spent)}</div>
              </Panel>
              <Panel className="p-5">
                <span className="eyebrow">Aggregate cap</span>
                <div className="mt-2 num font-semibold text-[24px] text-[var(--text)]">{money(cap)}</div>
              </Panel>
              <Panel className="p-5">
                <span className="eyebrow">Utilization</span>
                <div className="mt-2 num font-semibold text-[24px] text-[var(--text)]">
                  {cap > 0 ? `${Math.round((spent / cap) * 100)}%` : "—"}
                </div>
              </Panel>
            </div>
            <Panel className="p-5">
              <div className="eyebrow mb-4">Per-agent spend</div>
              <div className="space-y-4">
                {sortedBudgets.map((b) => {
                  const pct = Number(b.pct_used) || 0;
                  const pctColor =
                    pct >= 100 ? "var(--down)" : pct >= 75 ? "var(--warn)" : "var(--accent)";
                  return (
                    <div key={b.agent_name}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[13px] font-medium text-[var(--text)]">{b.agent_name}</span>
                        <span className="num text-[12px] text-[var(--text-3)]">
                          {money(b.spent_usd)}
                          {b.monthly_cap_usd != null && (
                            <span className="text-[var(--text-4)]"> / {money(b.monthly_cap_usd)}</span>
                          )}
                          <span className="ml-2" style={{ color: pctColor }}>
                            {pct.toFixed(1)}%
                          </span>
                        </span>
                      </div>
                      <div className="h-[6px] w-full rounded-full bg-white/[0.06] overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${Math.min(pct, 100)}%`, background: pctColor, opacity: 0.85 }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Panel>
          </>
        )}
        <p className="mt-4 text-[12px] text-[var(--text-4)]">
          Caps are set in Mission Control by the operator; edits happen there, not here.
        </p>
      </div>
    </div>
  );
}
