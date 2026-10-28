"use client";

/* ───────────────────────────────────────────────────────────
   Blue Mogul AI · Gateway Health
   Fleet agent gateway liveness — live status cards with uptime
   indicators and a probe history table. Data flows from the
   hermy-hq /api/gateway-health route, which composes gateway +
   platform health from MC's /api/status roster, the MCP bridge
   probe, and the Telegram bot API check.
   ─────────────────────────────────────────────────────────── */

import { useEffect, useState } from "react";
import { Gauge, RefreshCw, Clock } from "lucide-react";
import { rise, Panel, Pill, EmptyState, Button } from "@/components/ui/kit";
import { PageHeader, ErrorState, LoadingGrid } from "@/components/mc/ui";

type GatewayStatus = "up" | "down" | "degraded" | "unknown";

interface GatewayHealth {
  gateway: string;
  status: GatewayStatus;
  uptime_seconds: number | null;
  uptime_percent: number | null;
  last_probe: string | null;
  response_ms: number | null;
  error: string | null;
  consecutive_failures: number | null;
}

interface ProbeRecord {
  gateway: string;
  timestamp: string;
  status: GatewayStatus;
  response_ms: number | null;
  error: string | null;
}

const STATUS_LABEL: Record<GatewayStatus, string> = {
  up: "Healthy",
  down: "Offline",
  degraded: "Degraded",
  unknown: "Unknown",
};

const STATUS_COLOR: Record<GatewayStatus, string> = {
  up: "var(--up)",
  down: "var(--down)",
  degraded: "var(--warn)",
  unknown: "var(--text-4)",
};

const STATUS_TONE: Record<GatewayStatus, "up" | "down" | "warn" | "neutral"> = {
  up: "up",
  down: "down",
  degraded: "warn",
  unknown: "neutral",
};

const STATUS_ORDER: GatewayStatus[] = ["up", "degraded", "down", "unknown"];

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

function formatUptime(seconds: number | null): string {
  if (seconds == null) return "—";
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatDateTime(d: string): string {
  return new Date(d).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function GatewayHealthPage() {
  const [gateways, setGateways] = useState<GatewayHealth[] | null>(null);
  const [history, setHistory] = useState<ProbeRecord[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    try {
      const res = await fetch("/api/gateway-health", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d: GatewayHealth[] = await res.json();
      setGateways(d);
      // Synthesize a probe-history entry from the latest probe
      setHistory(
        d.map((g) => ({
          gateway: g.gateway,
          timestamp: g.last_probe || new Date().toISOString(),
          status: g.status,
          response_ms: g.response_ms,
          error: g.error,
        }))
      );
      setError(null);
    } catch {
      setError("gateway health read failed");
      setGateways([]);
      setHistory([]);
    }
  }

  useEffect(() => {
    reload();
    const iv = setInterval(reload, 30000);
    return () => clearInterval(iv);
  }, []);

  if (error && !gateways) {
    return (
      <div className="w-full mx-auto pt-2 max-w-5xl">
        <PageHeader eyebrow="Setup" title="Gateway Health" />
        <ErrorState message={error} />
      </div>
    );
  }

  if (!gateways) {
    return (
      <div className="w-full mx-auto pt-2 max-w-5xl">
        <PageHeader eyebrow="Setup" title="Gateway Health" />
        <LoadingGrid n={4} />
      </div>
    );
  }

  const sorted = [...gateways].sort(
    (a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status),
  );
  const counts = {
    up: sorted.filter((g) => g.status === "up").length,
    degraded: sorted.filter((g) => g.status === "degraded").length,
    down: sorted.filter((g) => g.status === "down").length,
    unknown: sorted.filter((g) => g.status === "unknown").length,
  };
  const total = sorted.length;

  return (
    <div className="w-full mx-auto pt-2 max-w-5xl">
      <PageHeader
        eyebrow="Setup"
        title="Gateway Health"
        sub="Fleet agent gateway liveness — live probes with uptime and response latency."
      />

      {/* ── Summary cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6 hq-rise" style={rise(0)}>
        <Panel className="p-5">
          <span className="eyebrow">Total gateways</span>
          <div className="mt-2 num font-semibold text-[28px] text-[var(--text)]">
            {total}
          </div>
        </Panel>
        <Panel className="p-5">
          <span className="eyebrow">Healthy</span>
          <div className="mt-2 num font-semibold text-[28px]" style={{ color: STATUS_COLOR.up }}>
            {counts.up}
          </div>
        </Panel>
        <Panel className="p-5">
          <span className="eyebrow">Degraded</span>
          <div className="mt-2 num font-semibold text-[28px]" style={{ color: STATUS_COLOR.degraded }}>
            {counts.degraded}
          </div>
        </Panel>
        <Panel className="p-5">
          <span className="eyebrow">Offline</span>
          <div className="mt-2 num font-semibold text-[28px]" style={{ color: STATUS_COLOR.down }}>
            {counts.down}
          </div>
        </Panel>
      </div>

      {/* ── Health legend ── */}
      <div
        className="flex items-center gap-4 mb-5 text-[12px] text-[var(--text-3)] flex-wrap"
        style={rise(0)}
      >
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full" style={{ background: STATUS_COLOR.up }} />{" "}
          {counts.up} healthy
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full" style={{ background: STATUS_COLOR.degraded }} />{" "}
          {counts.degraded} degraded
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full" style={{ background: STATUS_COLOR.down }} />{" "}
          {counts.down} offline
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full" style={{ background: STATUS_COLOR.unknown }} />{" "}
          {counts.unknown} unknown
        </span>
      </div>

      {/* ── Gateway status cards ── */}
      {total === 0 ? (
        <Panel className="p-6 mb-6">
          <EmptyState
            icon={<Gauge className="w-6 h-6" />}
            title="No gateways registered"
            hint="Fleet agent gateways appear here once they start reporting health probes through Mission Control."
          />
        </Panel>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {sorted.map((g, i) => (
            <Panel key={g.gateway} className="p-4 hq-rise" style={rise(i % 3)}>
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="relative flex w-2.5 h-2.5 shrink-0">
                    <span
                      className="absolute inline-flex h-full w-full rounded-full opacity-50"
                      style={{
                        background: STATUS_COLOR[g.status],
                        animation: g.status === "up" ? "pulse 2s ease-out infinite" : "none",
                      }}
                    />
                    <span
                      className="relative inline-flex w-2.5 h-2.5 rounded-full"
                      style={{ background: STATUS_COLOR[g.status] }}
                    />
                  </span>
                  <span className="text-[14px] font-semibold text-[var(--text)] truncate">
                    {g.gateway}
                  </span>
                </div>
                <Pill tone={STATUS_TONE[g.status]}>
                  {STATUS_LABEL[g.status]}
                </Pill>
              </div>

              <div className="space-y-1.5 text-[12.5px]">
                <div className="flex justify-between">
                  <span className="text-[var(--text-3)]">Uptime</span>
                  <span className="num text-[var(--text-2)]">
                    {g.uptime_seconds != null ? formatUptime(g.uptime_seconds) : "—"}
                    {g.uptime_percent != null &&
                      ` · ${Number(g.uptime_percent).toFixed(1)}%`}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-3)]">Last probe</span>
                  <span className="num text-[var(--text-2)]">
                    {g.last_probe ? timeAgo(g.last_probe) : "—"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-3)]">Response</span>
                  <span className="num text-[var(--text-2)]">
                    {g.response_ms != null ? `${g.response_ms} ms` : "—"}
                  </span>
                </div>
                {g.consecutive_failures != null && g.consecutive_failures > 0 && (
                  <div className="flex justify-between">
                    <span className="text-[var(--text-3)]">Failures</span>
                    <span className="num text-[var(--down)]">
                      {g.consecutive_failures}
                    </span>
                  </div>
                )}
                {g.error && (
                  <div className="mt-2 pt-2 border-t border-[var(--line)]">
                    <p className="text-[11.5px] text-[var(--down)] break-words">
                      {g.error}
                    </p>
                  </div>
                )}
              </div>
            </Panel>
          ))}
        </div>
      )}

      {/* ── Probe history table ── */}
      <Panel className="p-0 overflow-hidden hq-rise" style={rise(1)}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--line)]">
          <span className="eyebrow">Probe history</span>
          <Pill tone="neutral">{history.length}</Pill>
        </div>
        {history.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={<Clock className="w-6 h-6" />}
              title="No probe history yet"
              hint="Recent health probe records will appear here once gateways start reporting."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--line)]">
                  <th className="text-left py-2.5 px-4 text-[11px] font-medium text-[var(--text-4)] uppercase tracking-wider">
                    Time
                  </th>
                  <th className="text-left py-2.5 px-4 text-[11px] font-medium text-[var(--text-4)] uppercase tracking-wider">
                    Gateway
                  </th>
                  <th className="text-left py-2.5 px-4 text-[11px] font-medium text-[var(--text-4)] uppercase tracking-wider">
                    Status
                  </th>
                  <th className="text-right py-2.5 px-4 text-[11px] font-medium text-[var(--text-4)] uppercase tracking-wider">
                    Latency
                  </th>
                </tr>
              </thead>
              <tbody className="text-[12.5px]">
                {history.slice(0, 50).map((p, i) => (
                  <tr
                    key={`${p.gateway}-${p.timestamp}-${i}`}
                    className="border-b border-[var(--line)] last:border-0"
                  >
                    <td className="py-2.5 px-4 num whitespace-nowrap text-[var(--text-3)]">
                      {formatDateTime(p.timestamp)}
                    </td>
                    <td className="py-2.5 px-4 text-[var(--text)]">
                      {p.gateway}
                    </td>
                    <td className="py-2.5 px-4">
                      <Pill tone={STATUS_TONE[p.status]}>
                        {STATUS_LABEL[p.status]}
                      </Pill>
                    </td>
                    <td className="py-2.5 px-4 text-right num text-[var(--text-2)]">
                      {p.response_ms != null ? `${p.response_ms} ms` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {/* ── Footer ── */}
      <div className="flex items-center justify-between mt-4 text-[12px] text-[var(--text-3)]">
        <span>Auto-refreshes every 30 seconds</span>
        <Button variant="ghost" size="sm" onClick={() => reload()}>
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </Button>
      </div>
    </div>
  );
}
